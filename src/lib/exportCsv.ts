// Exportação CSV sem dependência. Separador ';' (padrão pt-BR/Excel) + BOM
// UTF-8 para acentos abrirem certo no Excel.

type Celula = string | number | null | undefined

function escapar(v: Celula): string {
  const s = v === null || v === undefined ? '' : String(v)
  if (/[";\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: Celula[][]): void {
  const sep = ';'
  const corpo = [cabecalho, ...linhas].map((row) => row.map(escapar).join(sep)).join('\r\n')
  const blob = new Blob(['﻿' + corpo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
