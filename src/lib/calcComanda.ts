import type { ItemPedido, Produto } from '@/types'

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * Preço EFETIVO de um produto (display/carrinho) — MESMA regra que o servidor usa ao gravar o
 * snapshot (`criar_item_pedido`): em oferta com `oferta_preco` definido → `oferta_preco`, senão `preco`.
 * Garante "anunciado = cobrado" (cardápio, carrinho, preview e comanda batem com o snapshot da RPC).
 */
export function precoEfetivo(p: Pick<Produto, 'preco' | 'oferta_preco' | 'em_oferta'>): number {
  return p.em_oferta && p.oferta_preco != null ? p.oferta_preco : p.preco
}

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
// Base = PREÇO EFETIVO (respeita a oferta), igual ao snapshot que a RPC grava,
// + soma dos adicionais escolhidos, × quantidade.

export type CartLine = {
  key: string                 // uid local — permite o mesmo produto com configs diferentes
  produto: Produto
  quantidade: number
  observacao: string | null
  adicionais: { id: string; nome: string; preco: number }[]
}

export function subtotalCartLine(line: CartLine): number {
  const adicionais = line.adicionais.reduce((s, a) => s + a.preco, 0)
  return cents((precoEfetivo(line.produto) + adicionais) * line.quantidade)
}

export function totalCart(lines: CartLine[]): number {
  return cents(lines.reduce((s, l) => s + subtotalCartLine(l), 0))
}
