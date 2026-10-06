import { useEffect, useState } from 'react'

const STORAGE_KEY = 'controle-ferramentas'

function carregarDados() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function useFerramentas() {
  const [registros, setRegistros] = useState(carregarDados)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registros))
  }, [registros])

  function registrarRetirada({ ferramenta, responsavel, telefone }) {
    const novo = {
      id: crypto.randomUUID(),
      ferramenta: ferramenta.trim(),
      responsavel: responsavel.trim(),
      telefone: telefone.trim(),
      retiradoEm: new Date().toISOString(),
      devolvidoEm: null,
    }
    setRegistros((atual) => [novo, ...atual])
  }

  function marcarDevolvido(id) {
    setRegistros((atual) =>
      atual.map((item) =>
        item.id === id && !item.devolvidoEm
          ? { ...item, devolvidoEm: new Date().toISOString() }
          : item,
      ),
    )
  }

  const emUso = registros.filter((item) => !item.devolvidoEm)
  const historico = registros.filter((item) => item.devolvidoEm)

  return {
    emUso,
    historico,
    registrarRetirada,
    marcarDevolvido,
  }
}
