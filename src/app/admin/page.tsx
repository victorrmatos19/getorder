'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import StaffHeader from '@/components/StaffHeader'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import { construirPeriodo, type PeriodoKey } from '@/lib/periodo'
import { fmt } from '@/lib/formatters'
import { baixarCsv } from '@/lib/exportCsv'
import {
  useDashboard, computeResumo, computeTendencia, computeProdutos,
  computeMix, computeHeatmap, computeQualidade,
} from './dashboard/useDashboard'
import PeriodoSelector from './dashboard/PeriodoSelector'
import ResumoCards from './dashboard/ResumoCards'
import AoVivoHoje from './dashboard/AoVivoHoje'
import ProdutosRanking from './dashboard/ProdutosRanking'
import MixPagamento from './dashboard/MixPagamento'
import QualidadeGiro from './dashboard/QualidadeGiro'

const TendenciaChart = dynamic(() => import('./dashboard/TendenciaChart'), {
  ssr: false,
  loading: () => <div style={{ height: 200 }} />,
})
const HeatmapPico = dynamic(() => import('./dashboard/HeatmapPico'), { ssr: false })

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <div className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>{titulo}</div>
      {children}
    </div>
  )
}

export default function AdminDashboardPage() {
  const { restauranteId } = useRestaurante()

  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>('7d')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')

  const periodo = useMemo(
    () => construirPeriodo(periodoKey, { customInicio, customFim }),
    [periodoKey, customInicio, customFim],
  )

  const { data, isLoading, isError, error, refetch } = useDashboard(restauranteId, periodo)
  const resumo = useMemo(() => (data ? computeResumo(data) : null), [data])
  const tendencia = useMemo(() => (data ? computeTendencia(data.fechadasAtual, periodo) : []), [data, periodo])
  const produtos = useMemo(() => (data ? computeProdutos(data.itensFechadas) : null), [data])
  const mix = useMemo(() => (data ? computeMix(data.fechadasAtual) : null), [data])
  const heatmap = useMemo(() => (data ? computeHeatmap(data.itensPeriodo) : null), [data])
  const qualidade = useMemo(() => (data ? computeQualidade(data) : null), [data])

  const exportar = () => {
    if (!data) return
    const linhas = data.fechadasAtual.map((c) => {
      const tempoMin = c.fechado_em && c.criado_em
        ? Math.round((new Date(c.fechado_em).getTime() - new Date(c.criado_em).getTime()) / 60000)
        : ''
      return [
        c.fechado_em ? fmt.date(c.fechado_em) : '',
        c.fechado_em ? fmt.time(c.fechado_em) : '',
        c.mesa?.nome ?? '',
        fmt.money(c.total ?? 0),
        fmt.money(c.taxa_servico_valor ?? 0),
        c.forma_pagamento ?? '',
        c.numero_pessoas ?? '',
        tempoMin,
      ]
    })
    baixarCsv(
      `dashboard_${periodo.key}_${periodo.inicio.toISOString().slice(0, 10)}`,
      ['Data', 'Hora', 'Mesa', 'Total', 'Taxa', 'Pagamento', 'Pessoas', 'Tempo de mesa (min)'],
      linhas,
    )
  }

  return (
    <>
      <StaffHeader
        title="Painel"
        subtitle={`GetOrder · ${new Date().toLocaleDateString('pt-BR')}`}
        rightSlot={
          <button
            onClick={exportar}
            disabled={!data || !!isLoading}
            className="text-xs font-bold rounded-lg px-3 flex items-center gap-1.5"
            style={{
              minHeight: 40,
              background: 'transparent',
              border: '1px solid var(--line)',
              color: data ? 'var(--ink)' : 'var(--muted)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M8 11l4 4 4-4M4 19h16" />
            </svg>
            Exportar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
        <AoVivoHoje restauranteId={restauranteId} />

        <div className="flex flex-col gap-3">
          <PeriodoSelector
            periodoKey={periodoKey}
            onSelect={setPeriodoKey}
            customInicio={customInicio}
            customFim={customFim}
            onCustom={(campo, valor) => (campo === 'inicio' ? setCustomInicio(valor) : setCustomFim(valor))}
          />

          {isLoading && <div className="py-16 flex justify-center"><Spinner color="var(--accent)" /></div>}
          {isError && (
            <EmptyState
              icon="⚠️"
              title="Erro ao carregar"
              description={(error as any)?.message}
              action={
                <button onClick={() => refetch()} className="text-sm underline" style={{ color: 'var(--accent)' }}>
                  Tentar novamente
                </button>
              }
            />
          )}
          {resumo && !isLoading && !isError && <ResumoCards resumo={resumo} />}
        </div>

        {data && !isLoading && !isError && (
          <>
            <Bloco titulo="Tendência de faturamento">
              <TendenciaChart data={tendencia} />
            </Bloco>
            <Bloco titulo="Desempenho de produtos">
              {produtos && <ProdutosRanking produtos={produtos.produtos} adicionais={produtos.adicionais} />}
            </Bloco>
            <Bloco titulo="Mix operacional">
              {mix && <MixPagamento mix={mix} />}
            </Bloco>
            <Bloco titulo="Pico — dia × hora">
              {heatmap && <HeatmapPico matriz={heatmap.matriz} max={heatmap.max} />}
            </Bloco>
            <Bloco titulo="Qualidade / giro">
              {qualidade && <QualidadeGiro q={qualidade} />}
            </Bloco>
          </>
        )}
      </div>
    </>
  )
}
