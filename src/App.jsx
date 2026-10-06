import { useState } from 'react'
import { useFerramentas } from './hooks/useFerramentas'

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
  if (digitos.length <= 7) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  }
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

export default function App() {
  const { emUso, historico, registrarRetirada, marcarDevolvido } =
    useFerramentas()

  const [aba, setAba] = useState('em-uso')
  const [form, setForm] = useState({
    ferramenta: '',
    responsavel: '',
    telefone: '',
  })
  const [erro, setErro] = useState('')

  function atualizarCampo(campo, valor) {
    setForm((atual) => ({
      ...atual,
      [campo]: campo === 'telefone' ? formatarTelefone(valor) : valor,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setErro('')

    if (!form.ferramenta.trim() || !form.responsavel.trim() || !form.telefone.trim()) {
      setErro('Preencha todos os campos para registrar a retirada.')
      return
    }

    const digitos = form.telefone.replace(/\D/g, '')
    if (digitos.length < 10) {
      setErro('Informe um telefone válido com DDD.')
      return
    }

    registrarRetirada(form)
    setForm({ ferramenta: '', responsavel: '', telefone: '' })
    setAba('em-uso')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-6 sm:px-6">
          <p className="text-sm font-medium uppercase tracking-wide text-amber-700">
            Almoxarifado
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Controle de Ferramentas
          </h1>
          <p className="text-slate-600">
            Registre retiradas, acompanhe o que está fora e consulte o histórico de
            devoluções.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Nova retirada
          </h2>

          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Nome da ferramenta
              </span>
              <input
                type="text"
                value={form.ferramenta}
                onChange={(e) => atualizarCampo('ferramenta', e.target.value)}
                placeholder="Ex.: Furadeira Bosch"
                className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">
                Nome de quem pegou
              </span>
              <input
                type="text"
                value={form.responsavel}
                onChange={(e) => atualizarCampo('responsavel', e.target.value)}
                placeholder="Ex.: João Silva"
                className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">
                Número de telefone
              </span>
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => atualizarCampo('telefone', e.target.value)}
                placeholder="(11) 98765-4321"
                className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </label>

            {erro && (
              <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            )}

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition hover:bg-amber-700 sm:w-auto"
              >
                Registrar retirada
              </button>
            </div>
          </form>
        </section>

        <section>
          <div className="mb-4 flex gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setAba('em-uso')}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                aba === 'em-uso'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Em uso ({emUso.length})
            </button>
            <button
              type="button"
              onClick={() => setAba('historico')}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                aba === 'historico'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Histórico ({historico.length})
            </button>
          </div>

          {aba === 'em-uso' && (
            <div className="space-y-3">
              {emUso.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
                  Nenhuma ferramenta retirada no momento.
                </p>
              ) : (
                emUso.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {item.ferramenta}
                      </h3>
                      <p className="text-slate-700">
                        Responsável: <span className="font-medium">{item.responsavel}</span>
                      </p>
                      <p className="text-slate-600">Telefone: {item.telefone}</p>
                      <p className="text-sm text-slate-500">
                        Retirado em {formatarData(item.retiradoEm)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => marcarDevolvido(item.id)}
                      className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700"
                    >
                      Marcar como Devolvido
                    </button>
                  </article>
                ))
              )}
            </div>
          )}

          {aba === 'historico' && (
            <div className="space-y-3">
              {historico.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
                  Ainda não há devoluções registradas.
                </p>
              ) : (
                historico.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {item.ferramenta}
                      </h3>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        Devolvido
                      </span>
                    </div>
                    <p className="text-slate-700">
                      Responsável: <span className="font-medium">{item.responsavel}</span>
                    </p>
                    <p className="text-slate-600">Telefone: {item.telefone}</p>
                    <div className="mt-2 flex flex-col gap-0.5 text-sm text-slate-500 sm:flex-row sm:gap-4">
                      <span>Retirado em {formatarData(item.retiradoEm)}</span>
                      <span>Devolvido em {formatarData(item.devolvidoEm)}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
