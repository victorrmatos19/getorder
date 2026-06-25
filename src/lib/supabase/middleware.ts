import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isProtected =
    path.startsWith('/admin') ||
    path.startsWith('/cozinha') ||
    path.startsWith('/garcom') ||
    path.startsWith('/super-admin')

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (isProtected && user) {
    const { data: perfil } = await supabase
      .from('perfis')
      .select('role, ativo')
      .eq('id', user.id)
      .maybeSingle()

    // Conta desativada: barra imediatamente (defense in depth). O ban no Auth
    // bloqueia novo login/refresh, mas um access token já emitido vive até
    // expirar — aqui fechamos a janela a cada navegação.
    if (perfil && perfil.ativo === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('inactive', '1')
      return NextResponse.redirect(url)
    }

    const role = perfil?.role
    const allowed =
      role === 'super_admin' ||
      (path.startsWith('/super-admin') && role === 'super_admin') ||
      (path.startsWith('/admin')   && role === 'admin') ||
      (path.startsWith('/garcom')  && (role === 'admin' || role === 'garcom')) ||
      (path.startsWith('/cozinha') && (role === 'admin' || role === 'cozinha'))

    if (!allowed) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('forbidden', '1')
      return NextResponse.redirect(url)
    }
  }

  return response
}
