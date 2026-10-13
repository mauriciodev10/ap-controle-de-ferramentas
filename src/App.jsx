import { useState } from 'react'
import { useFerramentas } from './hooks/useFerramentas'

const classeInput =
  'rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200'

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarTelefone(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

function normalizarTexto(valor) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function novoFormularioFerramenta() {
  return { nome: '', codigo: '', categoria: '', fotoUrl: '' }
}

function novoFormularioRetirada() {
  return {
    ferramentaId: '',
    responsavelNome: '',
    responsavelContato: '',
    observacoes: '',
  }
}

export default function App() {
  const {
    ferramentas,
    emUso,
    movimentacoes,
    carregando,
    carregandoPermissao,
    autenticando,
    salvando,
    erro: erroSupabase,
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
  } = useFerramentas()

  const [aba, setAba] = useState('inventario')
  const [inventarioVisivel, setInventarioVisivel] = useState(false)
  const [formFerramenta, setFormFerramenta] = useState(novoFormularioFerramenta)
  const [formRetirada, setFormRetirada] = useState(novoFormularioRetirada)
  const [buscaFerramenta, setBuscaFerramenta] = useState('')
  const [listaFerramentasAberta, setListaFerramentasAberta] = useState(false)
  const [formLogin, setFormLogin] = useState({ email: '', senha: '' })
  const [loginAberto, setLoginAberto] = useState(false)
  const [esqueceuSenha, setEsqueceuSenha] = useState(false)
  const [senhaNova, setSenhaNova] = useState('')
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('')
  const [mensagemSucesso, setMensagemSucesso] = useState('')
  const [erroFormulario, setErroFormulario] = useState('')

  const ferramentasDisponiveis = ferramentas.filter(
    (ferramenta) => ferramenta.status === 'DISPONIVEL',
  )
  const buscaNormalizada = normalizarTexto(buscaFerramenta.trim())
  const ferramentasFiltradas = ferramentasDisponiveis.filter((ferramenta) =>
    [ferramenta.nome, ferramenta.codigo, ferramenta.categoria]
      .filter(Boolean)
      .some((campo) => normalizarTexto(campo).includes(buscaNormalizada)),
  )
  const ferramentaPorId = new Map(ferramentas.map((item) => [item.id, item]))

  async function handleCadastrarFerramenta(event) {
    event.preventDefault()
    setErroFormulario('')

    if (!formFerramenta.nome.trim()) {
      setErroFormulario('Informe o nome da ferramenta.')
      return
    }

    if (await cadastrarFerramenta(formFerramenta)) {
      setFormFerramenta(novoFormularioFerramenta())
    }
  }

  async function handleEntrarComoAdmin(event) {
    event.preventDefault()
    setMensagemSucesso('')
    if (await entrarComoAdmin(formLogin.email, formLogin.senha)) {
      setFormLogin({ email: '', senha: '' })
      setLoginAberto(false)
    }
  }

  async function handleSolicitarRedefinicao(event) {
    event.preventDefault()
    setMensagemSucesso('')
    if (await solicitarRedefinicaoSenha(formLogin.email)) {
      setMensagemSucesso('Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Confira também o spam.')
      setEsqueceuSenha(false)
    }
  }

  async function handleAtualizarSenha(event) {
    event.preventDefault()
    setMensagemSucesso('')
    if (senhaNova.length < 6) {
      setErroFormulario('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (senhaNova !== confirmacaoSenha) {
      setErroFormulario('As senhas não coincidem.')
      return
    }
    setErroFormulario('')
    if (await atualizarSenha(senhaNova)) {
      setSenhaNova('')
      setConfirmacaoSenha('')
      setMensagemSucesso('Senha atualizada. Você já pode usar a nova senha para entrar.')
    }
  }

  async function handleSubmitRetirada(event) {
    event.preventDefault()
    setErroFormulario('')

    if (
      !formRetirada.ferramentaId ||
      !formRetirada.responsavelNome.trim() ||
      !formRetirada.responsavelContato.trim()
    ) {
      setErroFormulario('Selecione uma ferramenta e informe o responsável e o contato.')
      return
    }

    if (formRetirada.responsavelContato.replace(/\D/g, '').length < 10) {
      setErroFormulario('Informe um contato válido com DDD.')
      return
    }

    if (await registrarRetirada(formRetirada)) {
      setFormRetirada(novoFormularioRetirada())
    }
  }

  async function handleDevolucao(ferramentaId) {
    if (await marcarDevolvido(ferramentaId)) {
      setErroFormulario('')
    }
  }

  async function handleExcluirFerramenta(ferramenta) {
    const confirmar = window.confirm(
      `Excluir "${ferramenta.nome}"? Esta ação também apagará permanentemente todo o histórico de movimentações dessa ferramenta.`,
    )
    if (!confirmar) return

    setErroFormulario('')
    await excluirFerramenta(ferramenta.id)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-amber-700">
              Almoxarifado
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Controle de Ferramentas — Hidráulica 01
            </h1>
          </div>
          {usuario ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">
                {isAdmin ? 'Administrador' : 'Conta sem permissão de administrador'}
              </span>
              <button
                type="button"
                onClick={sairDaConta}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Sair
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={carregandoPermissao}
              onClick={() => setLoginAberto((aberto) => !aberto)}
              aria-expanded={loginAberto}
              className="rounded-lg border border-amber-600 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
            >
              {carregandoPermissao
                ? 'Verificando acesso...'
                : loginAberto
                  ? 'Fechar login'
                  : 'Entrar como administrador'}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        {recuperacaoSenha && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Criar nova senha
            </h2>
            <form onSubmit={handleAtualizarSenha} className="grid gap-3 sm:max-w-md">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700">Nova senha</span>
                <input
                  required
                  minLength={6}
                  type="password"
                  autoComplete="new-password"
                  value={senhaNova}
                  onChange={(event) => setSenhaNova(event.target.value)}
                  className={classeInput}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700">Confirme a nova senha</span>
                <input
                  required
                  minLength={6}
                  type="password"
                  autoComplete="new-password"
                  value={confirmacaoSenha}
                  onChange={(event) => setConfirmacaoSenha(event.target.value)}
                  className={classeInput}
                />
              </label>
              <button
                type="submit"
                disabled={autenticando}
                className="rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition hover:bg-amber-700 disabled:opacity-60 sm:justify-self-start"
              >
                {autenticando ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </section>
        )}

        {loginAberto && !usuario && !recuperacaoSenha && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {esqueceuSenha ? 'Redefinir senha do administrador' : 'Acesso do administrador'}
            </h2>
            <form
              onSubmit={esqueceuSenha ? handleSolicitarRedefinicao : handleEntrarComoAdmin}
              className="grid gap-3 sm:max-w-md"
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700">E-mail</span>
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={formLogin.email}
                  onChange={(event) =>
                    setFormLogin((atual) => ({ ...atual, email: event.target.value }))
                  }
                  className={classeInput}
                />
              </label>
              {!esqueceuSenha && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">Senha</span>
                    <input
                      required
                      type="password"
                      autoComplete="current-password"
                      value={formLogin.senha}
                      onChange={(event) =>
                        setFormLogin((atual) => ({ ...atual, senha: event.target.value }))
                      }
                      className={classeInput}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={autenticando}
                    className="rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition hover:bg-amber-700 disabled:opacity-60 sm:justify-self-start"
                  >
                    {autenticando ? 'Entrando...' : 'Entrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEsqueceuSenha(true)}
                    className="text-left text-sm font-medium text-amber-700 hover:text-amber-800"
                  >
                    Esqueci minha senha
                  </button>
                </>
              )}
              {esqueceuSenha && (
                <>
                  <button
                    type="submit"
                    disabled={autenticando}
                    className="rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition hover:bg-amber-700 disabled:opacity-60 sm:justify-self-start"
                  >
                    {autenticando ? 'Enviando...' : 'Enviar link de redefinição'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEsqueceuSenha(false)}
                    className="text-left text-sm font-medium text-slate-600 hover:text-slate-800"
                  >
                    Voltar para entrar
                  </button>
                </>
              )}
            </form>
          </section>
        )}
        {mensagemSucesso && (
          <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {mensagemSucesso}
          </p>
        )}

        {carregando && (
          <p role="status" className="rounded-lg bg-slate-100 px-4 py-3 text-slate-700">
            Carregando inventário e movimentações...
          </p>
        )}
        {!carregando && (
          <p
            role="status"
            className={`rounded-lg px-4 py-3 text-sm ${
              realtimeConectado
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            {realtimeConectado
              ? 'Sincronização em tempo real ativa.'
              : 'Sincronização em tempo real desconectada.'}
          </p>
        )}
        {erroSupabase && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {erroSupabase}
          </p>
        )}

        <section className={`grid gap-6 ${isAdmin ? 'md:grid-cols-2' : ''}`}>
          {isAdmin && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Cadastrar ferramenta
              </h2>
              <form onSubmit={handleCadastrarFerramenta} className="grid gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Nome *</span>
                  <input
                    required
                    value={formFerramenta.nome}
                    onChange={(event) =>
                      setFormFerramenta((atual) => ({ ...atual, nome: event.target.value }))
                    }
                    placeholder="Ex.: Furadeira Bosch"
                    className={classeInput}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Código</span>
                  <input
                    value={formFerramenta.codigo}
                    onChange={(event) =>
                      setFormFerramenta((atual) => ({ ...atual, codigo: event.target.value }))
                    }
                    placeholder="Ex.: FUR-001"
                    className={classeInput}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Categoria</span>
                  <input
                    value={formFerramenta.categoria}
                    onChange={(event) =>
                      setFormFerramenta((atual) => ({
                        ...atual,
                        categoria: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Elétrica"
                    className={classeInput}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">URL da foto</span>
                  <input
                    type="url"
                    value={formFerramenta.fotoUrl}
                    onChange={(event) =>
                      setFormFerramenta((atual) => ({ ...atual, fotoUrl: event.target.value }))
                    }
                    placeholder="https://..."
                    className={classeInput}
                  />
                </label>
                <button
                  type="submit"
                  disabled={carregando || salvando}
                  className="mt-1 rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Adicionar ao inventário'}
                </button>
              </form>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Registrar retirada
            </h2>
            <form onSubmit={handleSubmitRetirada} className="grid gap-3">
              <div
                className="flex flex-col gap-1.5"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setListaFerramentasAberta(false)
                  }
                }}
              >
                <label
                  htmlFor="ferramenta-busca"
                  className="text-sm font-medium text-slate-700"
                >
                  Ferramenta *
                </label>
                <input
                  id="ferramenta-busca"
                  type="search"
                  value={buscaFerramenta}
                  onFocus={() => setListaFerramentasAberta(true)}
                  onChange={(event) => {
                    setBuscaFerramenta(event.target.value)
                    setFormRetirada((atual) => ({ ...atual, ferramentaId: '' }))
                    setListaFerramentasAberta(true)
                  }}
                  placeholder="Digite nome, código ou categoria da ferramenta"
                  className={classeInput}
                />
                {listaFerramentasAberta && (
                  <ul
                    id="lista-ferramentas-disponiveis"
                    className="max-h-56 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-sm"
                  >
                    {ferramentasFiltradas.length > 0 ? (
                      ferramentasFiltradas.map((ferramenta) => (
                        <li key={ferramenta.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setFormRetirada((atual) => ({
                                ...atual,
                                ferramentaId: ferramenta.id,
                              }))
                              setBuscaFerramenta(
                                `${ferramenta.nome}${ferramenta.codigo ? ` — ${ferramenta.codigo}` : ''}`,
                              )
                              setListaFerramentasAberta(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50 focus:bg-amber-50 focus:outline-none"
                          >
                            {ferramenta.nome}
                            {ferramenta.codigo ? ` — ${ferramenta.codigo}` : ''}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="px-3 py-2 text-sm text-slate-500">
                        Nenhuma peça encontrada
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700">Responsável *</span>
                <input
                  required
                  value={formRetirada.responsavelNome}
                  onChange={(event) =>
                    setFormRetirada((atual) => ({
                      ...atual,
                      responsavelNome: event.target.value,
                    }))
                  }
                  placeholder="Nome de quem está retirando"
                  className={classeInput}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700">Contato *</span>
                <input
                  required
                  type="tel"
                  value={formRetirada.responsavelContato}
                  onChange={(event) =>
                    setFormRetirada((atual) => ({
                      ...atual,
                      responsavelContato: formatarTelefone(event.target.value),
                    }))
                  }
                  placeholder="(11) 98765-4321"
                  className={classeInput}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700">Observações</span>
                <textarea
                  rows="2"
                  value={formRetirada.observacoes}
                  onChange={(event) =>
                    setFormRetirada((atual) => ({
                      ...atual,
                      observacoes: event.target.value,
                    }))
                  }
                  className={classeInput}
                />
              </label>
              <button
                type="submit"
                disabled={carregando || salvando || ferramentasDisponiveis.length === 0}
                className="mt-1 rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : 'Confirmar retirada'}
              </button>
              {ferramentasDisponiveis.length === 0 && (
                <p className="text-sm text-slate-500">
                  Cadastre uma ferramenta ou devolva uma ferramenta em uso para habilitar a retirada.
                </p>
              )}
            </form>
          </div>
        </section>

        {erroFormulario && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {erroFormulario}
          </p>
        )}

        <section>
          <div className="mb-4 flex gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setInventarioVisivel(false)
                setAba('inventario')
              }}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                aba === 'inventario'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Inventário ({ferramentas.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setInventarioVisivel(false)
                setAba('historico')
              }}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                aba === 'historico'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Histórico ({movimentacoes.length})
            </button>
          </div>

          {aba === 'inventario' && (
            <>
              <button
                type="button"
                onClick={() => setInventarioVisivel((visivel) => !visivel)}
                aria-expanded={inventarioVisivel}
                aria-controls="lista-inventario"
                className="mb-4 rounded-lg border border-amber-600 px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
              >
                {inventarioVisivel ? 'Ocultar inventário' : 'Mostrar inventário'}
              </button>
              {inventarioVisivel && (
                <div id="lista-inventario" className="space-y-3">
                  {ferramentas.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
                      Nenhuma ferramenta cadastrada no inventário.
                    </p>
                  ) : (
                    ferramentas.map((ferramenta) => {
                      const retirada = emUso.find((item) => item.id === ferramenta.id)?.retirada
                      const estaEmUso = ferramenta.status === 'EM_USO'
                      return (
                        <article
                          key={ferramenta.id}
                          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-4">
                            {ferramenta.foto_url && (
                              <img
                                src={ferramenta.foto_url}
                                alt=""
                                className="h-16 w-16 rounded-lg object-cover"
                              />
                            )}
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold text-slate-900">
                                  {ferramenta.nome}
                                </h3>
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    estaEmUso
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {estaEmUso ? 'Em uso' : 'Disponível'}
                                </span>
                              </div>
                              {ferramenta.codigo && (
                                <p className="text-sm text-slate-600">Código: {ferramenta.codigo}</p>
                              )}
                              {ferramenta.categoria && (
                                <p className="text-sm text-slate-600">
                                  Categoria: {ferramenta.categoria}
                                </p>
                              )}
                              {retirada && (
                                <>
                                  <p className="text-slate-700">
                                    Responsável: <span className="font-medium">{retirada.responsavel_nome}</span>
                                  </p>
                                  <p className="text-slate-600">
                                    Contato: {retirada.responsavel_contato}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    Retirado em {formatarData(retirada.data_movimentacao)}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          {(estaEmUso || isAdmin) && (
                            <div className="flex flex-wrap items-center gap-2">
                              {estaEmUso && (
                                <button
                                  type="button"
                                  onClick={() => handleDevolucao(ferramenta.id)}
                                  disabled={salvando}
                                  className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {salvando ? 'Salvando...' : 'Marcar devolvida'}
                                </button>
                              )}
                              {isAdmin && (
                                <div className="flex flex-col items-start gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleExcluirFerramenta(ferramenta)}
                                    disabled={salvando || estaEmUso}
                                    title={
                                      estaEmUso
                                        ? 'Marque a ferramenta como devolvida antes de excluí-la.'
                                        : undefined
                                    }
                                    className="rounded-lg border border-red-300 px-4 py-2.5 font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Excluir ferramenta
                                  </button>
                                  {estaEmUso && (
                                    <span className="text-xs text-slate-500">
                                      Devolva antes de excluir.
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      )
                    })
                  )}
                </div>
              )}
            </>
          )}

          {aba === 'historico' && (
            <div className="space-y-3">
              {movimentacoes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
                  Ainda não há movimentações registradas.
                </p>
              ) : (
                movimentacoes.map((movimentacao) => {
                  const ferramenta = ferramentaPorId.get(movimentacao.ferramenta_id)
                  const retirada =
                    movimentacao.tipo_movimentacao === 'RETIRADA'
                  return (
                    <article
                      key={movimentacao.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {ferramenta?.nome ?? 'Ferramenta'}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            retirada
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {retirada ? 'Retirada' : 'Devolução'}
                        </span>
                      </div>
                      {ferramenta?.codigo && (
                        <p className="text-sm text-slate-600">Código: {ferramenta.codigo}</p>
                      )}
                      <p className="text-slate-700">
                        Responsável: <span className="font-medium">{movimentacao.responsavel_nome}</span>
                      </p>
                      {movimentacao.responsavel_contato && (
                        <p className="text-slate-600">
                          Contato: {movimentacao.responsavel_contato}
                        </p>
                      )}
                      <p className="text-sm text-slate-500">
                        {retirada ? 'Retirada' : 'Devolução'} em{' '}
                        {formatarData(movimentacao.data_movimentacao)}
                      </p>
                      {movimentacao.observacoes && (
                        <p className="mt-2 text-sm text-slate-600">
                          Observações: {movimentacao.observacoes}
                        </p>
                      )}
                    </article>
                  )
                })
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
