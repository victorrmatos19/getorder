import type { ItemPedido, Produto } from '@/types'

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * Subtotal de um item a partir dos SNAPSHOTS (nunca de produto.preco no caso novo):
 *   (preco_base_snapshot + soma(adicionais.preco_snapshot)) * quantidade
 *
 * Fallback: itens legados (anteriores à Fase 1) não têm preco_base_snapshot —
 * usa produto.preco como base para não quebrar comandas antigas.
 */
export function subtotalItem(item: ItemPedido): number {
  const base = item.preco_base_snapshot ?? item.produto?.preco ?? 0
  const adicionais = (item.adicionais ?? []).reduce(
    (s, a) => s + (a.preco_snapshot ?? 0),
    0,
  )
  return cents((base + adicionais) * item.quantidade)
}

/** Soma dos subtotais dos itens não cancelados. */
export function totalComanda(itens: ItemPedido[]): number {
  return cents(
    itens
      .filter((it) => it.status !== 'cancelado')
      .reduce((s, it) => s + subtotalItem(it), 0),
  )
}

// ── Carrinho do cliente (itens configurados, ainda não enviados) ──────
// Mesma lógica de preço da comanda: base = produto.preco (igual ao snapshot
// que a RPC grava), + soma dos adicionais escolhidos, × quantidade.

export type CartLine = {
  key: string                 // uid local — permite o mesmo produto com configs diferentes
  produto: Produto
  quantidade: number
  observacao: string | null
  adicionais: { id: string; nome: string; preco: number }[]
}

export function subtotalCartLine(line: CartLine): number {
  const adicionais = line.adicionais.reduce((s, a) => s + a.preco, 0)
  return cents((line.produto.preco + adicionais) * line.quantidade)
}

export function totalCart(lines: CartLine[]): number {
  return cents(lines.reduce((s, l) => s + subtotalCartLine(l), 0))
}
