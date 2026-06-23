// Períodos do dashboard admin (v2) — datas em horário local do navegador.
// Cada período tem janela [inicio, fim] e o período ANTERIOR de mesma duração
// ([prevInicio, prevFim]) para a comparação Δ%.

export type PeriodoKey = 'hoje' | '7d' | 'mes' | 'custom'

export type Periodo = {
  key: PeriodoKey
  label: string
  inicio: Date
  fim: Date
  granularidade: 'hora' | 'dia'
  prevInicio: Date
  prevFim: Date
}

const DIA_MS = 24 * 60 * 60 * 1000

function inicioDoDia(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function fimDoDia(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

// `agora` é injetável para testes; no app passa new Date().
export function construirPeriodo(
  key: PeriodoKey,
  opts: { agora?: Date; customInicio?: string; customFim?: string } = {},
): Periodo {
  const agora = opts.agora ?? new Date()

  let inicio: Date
  let fim: Date
  let label: string
  let granularidade: 'hora' | 'dia'

  if (key === 'hoje') {
    inicio = inicioDoDia(agora)
    fim = fimDoDia(agora)
    label = 'Hoje'
    granularidade = 'hora'
  } else if (key === '7d') {
    fim = fimDoDia(agora)
    inicio = inicioDoDia(new Date(agora.getTime() - 6 * DIA_MS)) // 7 dias incluindo hoje
    label = '7 dias'
    granularidade = 'dia'
  } else if (key === 'mes') {
    fim = fimDoDia(agora)
    inicio = inicioDoDia(new Date(agora.getTime() - 29 * DIA_MS)) // 30 dias incluindo hoje
    label = 'Mês'
    granularidade = 'dia'
  } else {
    // custom — usa as datas informadas (yyyy-mm-dd); fallback p/ hoje
    const ci = opts.customInicio ? new Date(`${opts.customInicio}T00:00:00`) : agora
    const cf = opts.customFim ? new Date(`${opts.customFim}T00:00:00`) : agora
    inicio = inicioDoDia(ci <= cf ? ci : cf)
    fim = fimDoDia(ci <= cf ? cf : ci)
    label = 'Personalizado'
    granularidade = fim.getTime() - inicio.getTime() <= DIA_MS ? 'hora' : 'dia'
  }

  // Período anterior de MESMA duração, imediatamente antes
  const duracao = fim.getTime() - inicio.getTime()
  const prevInicio = new Date(inicio.getTime() - duracao - 1)
  const prevFim = new Date(inicio.getTime() - 1)

  return { key, label, inicio, fim, granularidade, prevInicio, prevFim }
}

// Δ% entre atual e anterior; null quando não há base de comparação.
export function variacaoPct(atual: number, anterior: number): number | null {
  if (!anterior) return null
  return (atual - anterior) / anterior
}

// rótulo curto de um bucket (dia "23/06" ou hora "14h") conforme granularidade
export function rotuloBucket(d: Date, gran: 'hora' | 'dia'): string {
  if (gran === 'hora') return `${d.getHours().toString().padStart(2, '0')}h`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
