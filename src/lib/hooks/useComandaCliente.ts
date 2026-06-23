'use client'

import { useQuery } from '@tanstack/react-query'
import { getComandaCliente } from '@/lib/comandaCliente'

/**
 * Acompanhamento da comanda no fluxo do cliente (/mesa).
 *
 * Lê via RPC `get_comanda_cliente` (não toca itens_pedido direto — RLS escopada).
 * Como o cliente anônimo perde o realtime (que respeita RLS), usamos POLLING:
 * refetch a cada 5s + ao focar a aba. A cozinha do staff segue em realtime normal.
 */
export function useComandaCliente(comandaId: string | undefined) {
  return useQuery({
    queryKey: ['comanda-cliente', comandaId],
    enabled: !!comandaId,
    queryFn: () => getComandaCliente(comandaId!),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })
}
