import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Body = {
  nome?: string
  slug?: string
  admin_email?: string
  admin_password?: string
  categorias_padrao?: boolean
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export async function POST(req: Request) {
 try {
  // 1) Verificar que o caller é super_admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (perfil?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Apenas super admin' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Body
  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'Informe o nome do restaurante.' }, { status: 400 })
  }
  if (!body.admin_email?.trim() || !body.admin_password) {
    return NextResponse.json({ error: 'Informe email e senha do admin.' }, { status: 400 })
  }
  if (body.admin_password.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter ao menos 8 caracteres.' }, { status: 400 })
  }

  const slug = body.slug?.trim() ? slugify(body.slug) : slugify(body.nome)

  // Service role: sem essa env (server-side, não-NEXT_PUBLIC) o createAdminClient lança.
  // Em produção, configurar SUPABASE_SERVICE_ROLE_KEY nas Environment Variables do Vercel.
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente no ambiente (Vercel → Environment Variables).' },
      { status: 500 },
    )
  }

  // 2) Criar restaurante
  const { data: rest, error: e1 } = await admin
    .from('restaurantes')
    .insert({ nome: body.nome.trim(), slug, ativo: true })
    .select('*')
    .single()
  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 400 })
  }

  // 3) Categorias padrão (opcional)
  if (body.categorias_padrao !== false) {
    await admin.from('categorias').insert([
      { restaurante_id: rest.id, nome: 'Destaques', emoji: '⭐', ordem: 1 },
      { restaurante_id: rest.id, nome: 'Lanches',  emoji: '🍔', ordem: 2 },
      { restaurante_id: rest.id, nome: 'Drinks',   emoji: '🥤', ordem: 3 },
      { restaurante_id: rest.id, nome: 'Petiscos', emoji: '🍟', ordem: 4 },
    ])
  }

  // 3b) Horários de funcionamento padrão (7 dias abertos) — sem isso o cliente vê
  // "Fora do horário de funcionamento" e não consegue pedir (useDisponibilidade trata
  // dia sem horário como fechado). O admin refina em /admin/configuracoes → Horário.
  await admin.from('horarios_funcionamento').insert(
    Array.from({ length: 7 }, (_, dia) => ({
      restaurante_id: rest.id,
      dia_semana: dia,
      abre: '00:00',
      fecha: '23:59',
      fechado: false,
    })),
  )

  // 4) Criar usuário admin
  const { data: created, error: e2 } = await admin.auth.admin.createUser({
    email: body.admin_email.trim(),
    password: body.admin_password,
    email_confirm: true,
  })
  if (e2 || !created.user) {
    // rollback do restaurante para não deixar tenant órfão
    await admin.from('restaurantes').delete().eq('id', rest.id)
    return NextResponse.json({ error: e2?.message || 'Erro ao criar usuário' }, { status: 400 })
  }

  // 5) Criar perfil com role admin atrelado ao restaurante
  const { error: e3 } = await admin.from('perfis').insert({
    id: created.user.id,
    role: 'admin',
    restaurante_id: rest.id,
  })
  if (e3) {
    return NextResponse.json({ error: e3.message }, { status: 400 })
  }

  return NextResponse.json({ restaurante: rest, admin_user_id: created.user.id })
 } catch (e: any) {
  // Qualquer exceção não prevista vira JSON (evita corpo vazio → "Unexpected end of JSON input")
  return NextResponse.json({ error: e?.message || 'Erro inesperado ao criar restaurante.' }, { status: 500 })
 }
}
