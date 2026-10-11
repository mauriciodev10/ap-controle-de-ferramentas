import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from '../supabaseClient'

const TABELA_FERRAMENTAS = 'ferramentas'
const TABELA_HISTORICO = 'historico_movimentacoes'

function mensagemDoErro(error) {
  return error?.message ?? String(error)
}

function ordenarPorData(a, b) {
  return new Date(b.data_movimentacao) - new Date(a.data_movimentacao)
}

function atualizarPorId(atual, id, registro) {
  const semRegistro = atual.filter((item) => item.id !== id)
  return registro ? [...semRegistro, registro] : semRegistro
}

function juntarEventos(lista, eventos, ordenar) {
  const resultado = new Map(lista.map((item) => [item.id, item]))
  for (const [id, registro] of eventos) {
    if (registro) resultado.set(id, registro)
    else resultado.delete(id)
  }
  return [...resultado.values()].sort(ordenar)
}

export function useFerramentas() {
  const [ferramentas, setFerramentas] = useState([])
  const [movimentacoes, setMovimentacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [carregandoPermissao, setCarregandoPermissao] = useState(Boolean(supabase))
  const [autenticando, setAutenticando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [realtimeConectado, setRealtimeConectado] = useState(false)
  const [usuario, setUsuario] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [recuperacaoSenha, setRecuperacaoSenha] = useState(false)

  useEffect(() => {
    if (!supabase) return undefined

    let ativo = true
    let versao = 0
    const temporizadores = new Set()

    async function carregarPermissao(userId, versaoAtual) {
      try {
        const { data, error: erroPerfil } = await supabase
          .from('perfis_usuario')
          .select('papel')
          .eq('user_id', userId)
          .maybeSingle()

        if (!ativo || versaoAtual !== versao) return

        if (erroPerfil) {
          setErro(`Não foi possível confirmar a permissão de administrador: ${mensagemDoErro(erroPerfil)}`)
        } else {
          setIsAdmin(data?.papel === 'admin')
        }
      } catch (error) {
        if (ativo && versaoAtual === versao) {
          setErro(`Não foi possível confirmar a permissão de administrador: ${mensagemDoErro(error)}`)
        }
      } finally {
        if (ativo && versaoAtual === versao) setCarregandoPermissao(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (evento, sessao) => {
        const versaoAtual = ++versao
        setUsuario(sessao?.user ?? null)
        setIsAdmin(false)
        setErro('')
        if (evento === 'PASSWORD_RECOVERY') setRecuperacaoSenha(true)
        if (evento === 'SIGNED_OUT') setRecuperacaoSenha(false)

        if (!sessao?.user) {
          setCarregandoPermissao(false)
          return
        }

        setCarregandoPermissao(true)
        const temporizador = window.setTimeout(() => {
          temporizadores.delete(temporizador)
          void carregarPermissao(sessao.user.id, versaoAtual)
        }, 0)
        temporizadores.add(temporizador)
      },
    )

    return () => {
      ativo = false
      for (const temporizador of temporizadores) window.clearTimeout(temporizador)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let ativo = true
    let canal

    async function carregarDados() {
      if (!supabaseConfigurado || !supabase) {
        setErro('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para conectar ao banco.')
        setCarregando(false)
        return
      }

      const eventosDuranteCarga = {
        ferramentas: new Map(),
        movimentacoes: new Map(),
      }

      const processarEvento = (tipo, payload) => {
        const ehFerramenta = tipo === TABELA_FERRAMENTAS
        const evento = payload.eventType === 'DELETE' ? null : payload.new
        const id = evento?.id ?? payload.old.id
        const buffer = ehFerramenta
          ? eventosDuranteCarga.ferramentas
          : eventosDuranteCarga.movimentacoes
        buffer.set(id, evento)

        if (ehFerramenta) {
          setFerramentas((atual) =>
            atualizarPorId(atual, id, evento).sort((a, b) =>
              a.nome.localeCompare(b.nome, 'pt-BR'),
            ),
          )
        } else {
          setMovimentacoes((atual) =>
            atualizarPorId(atual, id, evento).sort(ordenarPorData),
          )
        }
      }

      try {
        canal = supabase
          .channel(`almoxarifado-${crypto.randomUUID()}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: TABELA_FERRAMENTAS },
            (payload) => processarEvento(TABELA_FERRAMENTAS, payload),
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: TABELA_HISTORICO },
            (payload) => processarEvento(TABELA_HISTORICO, payload),
          )
          .subscribe((status) => {
            if (!ativo) return
            setRealtimeConectado(status === 'SUBSCRIBED')
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setErro('A sincronização em tempo real falhou. Confira se as duas tabelas estão habilitadas no Supabase Realtime.')
            }
          })

        const [
          { data: listaFerramentas, error: erroFerramentas },
          { data: listaMovimentacoes, error: erroMovimentacoes },
        ] = await Promise.all([
          supabase.from(TABELA_FERRAMENTAS).select('*').order('nome'),
          supabase
            .from(TABELA_HISTORICO)
            .select('*')
            .order('data_movimentacao', { ascending: false }),
        ])

        if (erroFerramentas) throw erroFerramentas
        if (erroMovimentacoes) throw erroMovimentacoes

        if (ativo) {
          setFerramentas(
            juntarEventos(
              listaFerramentas,
              eventosDuranteCarga.ferramentas,
              (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
            ),
          )
          setMovimentacoes(
            juntarEventos(
              listaMovimentacoes,
              eventosDuranteCarga.movimentacoes,
              ordenarPorData,
            ),
          )
        }
      } catch (error) {
        if (ativo) {
          setErro(`Não foi possível carregar os dados do Supabase: ${mensagemDoErro(error)}`)
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregarDados()

    return () => {
      ativo = false
      if (canal) supabase?.removeChannel(canal)
    }
  }, [])

  async function executarOperacao(operacao, mensagemErro) {
    if (!supabase) {
      setErro('Supabase não está configurado.')
      return false
    }

    setSalvando(true)
    setErro('')
    try {
      const { error: erroOperacao } = await operacao()
      if (erroOperacao) throw erroOperacao
      return true
    } catch (error) {
      setErro(`${mensagemErro}: ${mensagemDoErro(error)}`)
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function entrarComoAdmin(email, senha) {
    if (!supabase) {
      setErro('Supabase não está configurado.')
      return false
    }

    setAutenticando(true)
    setErro('')
    try {
      const { error: erroLogin } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })
      if (erroLogin) throw erroLogin
      return true
    } catch (error) {
      setErro(`Não foi possível entrar: ${mensagemDoErro(error)}`)
      return false
    } finally {
      setAutenticando(false)
    }
  }

  async function solicitarRedefinicaoSenha(email) {
    if (!supabase) {
      setErro('Supabase não está configurado.')
      return false
    }

    setAutenticando(true)
    setErro('')
    try {
      const { error: erroRecuperacao } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: window.location.origin },
      )
      if (erroRecuperacao) throw erroRecuperacao
      return true
    } catch (error) {
      setErro(`Não foi possível enviar o link de redefinição: ${mensagemDoErro(error)}`)
      return false
    } finally {
      setAutenticando(false)
    }
  }

  async function atualizarSenha(senha) {
    if (!supabase) {
      setErro('Supabase não está configurado.')
      return false
    }

    setAutenticando(true)
    setErro('')
    try {
      const { error: erroAtualizacao } = await supabase.auth.updateUser({ password: senha })
      if (erroAtualizacao) throw erroAtualizacao
      setRecuperacaoSenha(false)
      return true
    } catch (error) {
      setErro(`Não foi possível atualizar a senha: ${mensagemDoErro(error)}`)
      return false
    } finally {
      setAutenticando(false)
    }
  }

  async function sairDaConta() {
    if (!supabase) return false

    setErro('')
    try {
      const { error: erroLogout } = await supabase.auth.signOut()
      if (erroLogout) throw erroLogout
      return true
    } catch (error) {
      setErro(`Não foi possível sair da conta: ${mensagemDoErro(error)}`)
      return false
    }
  }

  async function cadastrarFerramenta({ nome, codigo, categoria, fotoUrl }) {
    if (!isAdmin) {
      setErro('Somente administradores podem cadastrar ferramentas.')
      return false
    }

    const sucesso = await executarOperacao(
      () =>
        supabase.from(TABELA_FERRAMENTAS).insert({
          nome: nome.trim(),
          codigo: codigo.trim() || null,
          categoria: categoria.trim() || null,
          foto_url: fotoUrl.trim() || null,
        }),
      'Não foi possível cadastrar a ferramenta',
    )
    return sucesso
  }

  async function excluirFerramenta(ferramentaId) {
    if (!isAdmin) {
      setErro('Somente administradores podem excluir ferramentas.')
      return false
    }

    return executarOperacao(
      () =>
        supabase.rpc('excluir_ferramenta', {
          p_ferramenta_id: ferramentaId,
        }),
      'Não foi possível excluir a ferramenta',
    )
  }

  async function registrarRetirada({
    ferramentaId,
    responsavelNome,
    responsavelContato,
    observacoes,
  }) {
    return executarOperacao(
      () =>
        supabase.rpc('registrar_retirada_ferramenta', {
          p_ferramenta_id: ferramentaId,
          p_responsavel_nome: responsavelNome.trim(),
          p_responsavel_contato: responsavelContato.trim(),
          p_observacoes: observacoes.trim() || null,
        }),
      'Não foi possível registrar a retirada',
    )
  }

  async function marcarDevolvido(ferramentaId, observacoes = '') {
    return executarOperacao(
      () =>
        supabase.rpc('registrar_devolucao_ferramenta', {
          p_ferramenta_id: ferramentaId,
          p_observacoes: observacoes.trim() || null,
        }),
      'Não foi possível registrar a devolução',
    )
  }

  const ultimaMovimentacaoPorFerramenta = new Map()
  for (const movimentacao of [...movimentacoes].reverse()) {
    ultimaMovimentacaoPorFerramenta.set(movimentacao.ferramenta_id, movimentacao)
  }

  const emUso = ferramentas
    .filter((ferramenta) => ferramenta.status === 'EM_USO')
    .map((ferramenta) => ({
      ...ferramenta,
      retirada: ultimaMovimentacaoPorFerramenta.get(ferramenta.id),
    }))

  return {
    ferramentas,
    emUso,
    movimentacoes,
    carregando,
    salvando,
    carregandoPermissao,
    autenticando,
    erro,
    realtimeConectado,
    usuario,
    isAdmin,
    recuperacaoSenha,
    entrarComoAdmin,
    solicitarRedefinicaoSenha,
    atualizarSenha,
    sairDaConta,
    cadastrarFerramenta,
    excluirFerramenta,
    registrarRetirada,
    marcarDevolvido,
  }
}
