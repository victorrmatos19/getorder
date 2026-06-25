import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import type { Role } from '@/types'

// PATCH — edição/ações sobre um usuário da equipe (garçom/cozinha) do próprio
// restaurante. Ações: update_nome, change_role, reset_password, deactivate,
// reactivate. Toda escrita via service_role; o target é sempre revalidado como
// garçom/cozinha do mesmo tenant antes de qualquer alteração.

const ROLES_GERENCIAVEIS: Role[] = ['garcom', 'cozinha']
// ~100 anos: o Supabase Auth não tem "ban indefinido"; um prazo enorme equivale.
const BAN_LONGO = '876000h'

type Action = 'update_nome' | 'change_role' | 'reset_password' | 'deactivate' | 'reactivate'

type PatchBody = {
  action?: Action
  nome?: string
  role?: string
  password?: string
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Guard extra: admin não age sobre o próprio registro (admin é read-only no v1).
  if (id === auth.userId) {
    return NextResponse.json({ error: 'Você não pode alterar o próprio usuário aqui.' }, { status: 403 })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente no ambiente.' },
      { status: 500 },
    )
  }

  // Revalida o target: existe, é do MESMO restaurante e é garçom/cozinha
  // (admin não edita outro admin/super_admin). Anti-forja de tenant/privilégio.
  const { data: target, error: eT } = await admin
    .from('perfis')
    .select('id, role, restaurante_id, ativo')
    .eq('id', id)
    .maybeSingle()
  if (eT) return NextResponse.json({ error: eT.message }, { status: 400 })
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  if (target.restaurante_id !== auth.restauranteId) {
    return NextResponse.json({ error: 'Usuário não pertence ao seu restaurante.' }, { status: 403 })
  }
  if (!ROLES_GERENCIAVEIS.includes(target.role as Role)) {
    return NextResponse.json({ error: 'Só é possível gerenciar garçom e cozinha.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as PatchBody
  const action = body.action

  switch (action) {
    case 'update_nome': {
      const nome = body.nome?.trim() ?? ''
      if (!nome) return NextResponse.json({ error: 'Informe o nome.' }, { status: 400 })
      const { error } = await admin.from('perfis').update({ nome }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    case 'change_role': {
      const role = body.role as Role
      if (!ROLES_GERENCIAVEIS.includes(role)) {
        return NextResponse.json({ error: 'Função inválida (só garçom ou cozinha).' }, { status: 400 })
      }
      const { error } = await admin.from('perfis').update({ role }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    case 'reset_password': {
      const password = body.password ?? ''
      if (password.length < 8) {
        return NextResponse.json({ error: 'Senha deve ter ao menos 8 caracteres.' }, { status: 400 })
      }
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    case 'deactivate': {
      const { error: e1 } = await admin.from('perfis').update({ ativo: false }).eq('id', id)
      if (e1) return NextResponse.json({ error: e1.message }, { status: 400 })
      // Bane no Auth (bloqueia novo login/refresh). O middleware checa ativo
      // para fechar a janela do access token já emitido (defense in depth).
      const { error: e2 } = await admin.auth.admin.updateUserById(id, { ban_duration: BAN_LONGO })
      if (e2) return NextResponse.json({ error: e2.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    case 'reactivate': {
      const { error: e1 } = await admin.from('perfis').update({ ativo: true }).eq('id', id)
      if (e1) return NextResponse.json({ error: e1.message }, { status: 400 })
      const { error: e2 } = await admin.auth.admin.updateUserById(id, { ban_duration: 'none' })
      if (e2) return NextResponse.json({ error: e2.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }
}
