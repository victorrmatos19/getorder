import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import type { Role, UsuarioEquipe } from '@/types'

// Endpoints privilegiados (service_role) de gestão da equipe pelo admin.
// Segurança: o restaurante_id vem SEMPRE do perfil do caller (requireAdmin),
// nunca do request; o role criado é restrito a {garcom, cozinha}.

const ROLES_GERENCIAVEIS: Role[] = ['garcom', 'cozinha']
const ORDEM_ROLE: Record<string, number> = { admin: 0, garcom: 1, cozinha: 2, super_admin: 3 }

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

type AdminClient = ReturnType<typeof createAdminClient>

// Resolve o e-mail (vive em auth.users, ilegível pelo client) de cada perfil.
// getUserById por id em paralelo — equipes são pequenas, evita paginar listUsers.
async function resolveEmails(admin: AdminClient, ids: string[]): Promise<Record<string, string>> {
  const pares = await Promise.all(
    ids.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id)
      return [id, data.user?.email ?? ''] as const
    }),
  )
  return Object.fromEntries(pares)
}

// GET — lista a equipe do restaurante do admin (inclui admins, read-only no front).
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let admin: AdminClient
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente no ambiente.' },
      { status: 500 },
    )
  }

  const { data: perfis, error } = await admin
    .from('perfis')
    .select('id, nome, role, ativo')
    .eq('restaurante_id', auth.restauranteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const emails = await resolveEmails(admin, (perfis ?? []).map((p) => p.id))

  const usuarios: UsuarioEquipe[] = (perfis ?? [])
    .map((p) => ({
      id: p.id,
      nome: p.nome ?? null,
      email: emails[p.id] ?? '',
      role: p.role as Role,
      ativo: p.ativo,
    }))
    .sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
      const ra = ORDEM_ROLE[a.role] ?? 9
      const rb = ORDEM_ROLE[b.role] ?? 9
      if (ra !== rb) return ra - rb
      return (a.nome ?? a.email).localeCompare(b.nome ?? b.email)
    })

  return NextResponse.json({ usuarios })
}

type PostBody = {
  nome?: string
  email?: string
  password?: string
  role?: string
}

// POST — cria garçom/cozinha no Auth + perfil atrelado ao restaurante do admin.
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await req.json().catch(() => ({}))) as PostBody
  const nome = body.nome?.trim() ?? ''
  const email = body.email?.trim() ?? ''
  const password = body.password ?? ''
  const role = body.role as Role

  if (!nome) return NextResponse.json({ error: 'Informe o nome.' }, { status: 400 })
  if (!emailValido(email)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Senha deve ter ao menos 8 caracteres.' }, { status: 400 })
  if (!ROLES_GERENCIAVEIS.includes(role)) {
    return NextResponse.json({ error: 'Função inválida (só garçom ou cozinha).' }, { status: 400 })
  }

  let admin: AdminClient
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente no ambiente.' },
      { status: 500 },
    )
  }

  // 1) Cria no Auth (e-mail já confirmado, sem fluxo de confirmação).
  const { data: created, error: e1 } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (e1 || !created.user) {
    return NextResponse.json({ error: e1?.message || 'Erro ao criar usuário.' }, { status: 400 })
  }

  // 2) Cria o perfil no tenant do admin. Falhou? Rollback do auth user (sem órfão).
  const { error: e2 } = await admin.from('perfis').insert({
    id: created.user.id,
    nome,
    role,
    restaurante_id: auth.restauranteId,
    ativo: true,
  })
  if (e2) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: e2.message }, { status: 400 })
  }

  const usuario: UsuarioEquipe = { id: created.user.id, nome, email, role, ativo: true }
  return NextResponse.json({ usuario })
}
