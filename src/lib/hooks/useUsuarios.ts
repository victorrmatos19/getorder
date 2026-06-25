'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, UsuarioEquipe } from '@/types'

// Parse defensivo: se a resposta vier sem JSON (ex.: 500 de plataforma), não
// quebra com "Unexpected end of JSON input"; extrai a mensagem de erro.
async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const raw = await res.text()
  const json = raw ? JSON.parse(raw) : {}
  if (!res.ok) throw new Error(json.error || `Erro ${res.status}`)
  return json
}

export type CriarUsuarioInput = { nome: string; email: string; password: string; role: Role }

export type PatchUsuario =
  | { id: string; action: 'update_nome'; nome: string }
  | { id: string; action: 'change_role'; role: Role }
  | { id: string; action: 'reset_password'; password: string }
  | { id: string; action: 'deactivate' }
  | { id: string; action: 'reactivate' }

export function useUsuarios() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['usuarios'] })

  const list = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const json = await jsonFetch('/api/admin/usuarios')
      return (json.usuarios ?? []) as UsuarioEquipe[]
    },
  })

  const criar = useMutation({
    mutationFn: (input: CriarUsuarioInput) =>
      jsonFetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })

  const patch = useMutation({
    mutationFn: ({ id, ...body }: PatchUsuario) =>
      jsonFetch(`/api/admin/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  })

  return { list, criar, patch }
}

// Gera uma senha forte (~14 chars) com crypto, sem caracteres ambíguos.
export function gerarSenhaForte(len = 14) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*'
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, (n) => chars[n % chars.length]).join('')
}
