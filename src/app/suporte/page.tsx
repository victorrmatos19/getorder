import Logo from '@/components/Logo'

export const metadata = {
  title: 'Suporte — GetOrder',
}

export default function SuportePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header
        className="px-6 py-4"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <div className="max-w-3xl mx-auto">
          <Logo size="md" />
        </div>
      </header>

      <main
        className="max-w-3xl mx-auto px-6 py-10 text-base"
        style={{ color: 'var(--ink)' }}
      >
        <h1 className="serif text-2xl mb-2">Suporte — GetOrder</h1>
        <p className="text-base mb-6" style={{ color: 'var(--ink)' }}>
          Precisa de ajuda com o GetOrder? Estamos aqui.
        </p>

        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-mid)' }}>
          O GetOrder Staff é o aplicativo da equipe do restaurante (administrador, garçom e
          cozinha). As contas são criadas pelo próprio restaurante — não há cadastro público
          no aplicativo.
        </p>

        <Section title="Fale com a gente">
          <ul className="space-y-3">
            <li>
              <span className="font-bold" style={{ color: 'var(--ink)' }}>WhatsApp:</span>{' '}
              <a
                href="https://wa.me/5511917320202"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'var(--accent)' }}
              >
                (11) 91732-0202
              </a>
            </li>
            <li>
              <span className="font-bold" style={{ color: 'var(--ink)' }}>E-mail:</span>{' '}
              <a href="mailto:optmore@outlook.com" className="underline" style={{ color: 'var(--accent)' }}>
                optmore@outlook.com
              </a>
            </li>
            <li>
              <span className="font-bold" style={{ color: 'var(--ink)' }}>Atendimento:</span>{' '}
              Segunda a sexta, 9h às 18h
            </li>
          </ul>
        </Section>

        <Section title="Dúvidas comuns">
          <div className="space-y-4">
            <div>
              <p className="font-bold" style={{ color: 'var(--ink)' }}>
                Não consigo entrar no app
              </p>
              <p className="mt-1">
                As contas são criadas pelo administrador do restaurante. Peça ao responsável
                para verificar seu e-mail/senha ou recriar seu acesso.
              </p>
            </div>
            <div>
              <p className="font-bold" style={{ color: 'var(--ink)' }}>
                Sou cliente do restaurante
              </p>
              <p className="mt-1">
                Os pedidos são feitos pelo site, escaneando o QR Code da mesa — não por este
                aplicativo.
              </p>
            </div>
          </div>
        </Section>

        <p className="text-sm mt-10" style={{ color: 'var(--muted)' }}>
          GetOrder é um produto da Optmore.
        </p>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="serif text-lg mb-3" style={{ color: 'var(--ink)' }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: 'var(--text-mid)' }}>
        {children}
      </div>
    </section>
  )
}
