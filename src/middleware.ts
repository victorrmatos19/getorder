import { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Roda em tudo, EXCETO estáticos e as rotas públicas (/mesa, /privacidade, /suporte) —
  // mantém a proteção server-side das rotas protegidas e tira o custo do middleware/
  // auth.getUser() do caminho crítico do cliente. (Negative-lookahead: o param matcher
  // `/admin/:path*` não estava interceptando as rotas.)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|mesa/|privacidade|suporte|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
