import Logo from '@/components/Logo'

export const metadata = {
  title: 'Política de Privacidade — GetOrder',
}

export default function PrivacidadePage() {
  const hoje = new Date().toLocaleDateString('pt-BR')

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
        <h1 className="serif text-2xl mb-2">Política de Privacidade</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-mid)' }}>
          Última atualização: {hoje}
        </p>

        <Section title="1. Dados coletados">
          Coletamos os seguintes dados quando você utiliza nosso sistema de
          comandas digitais:
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Nome completo</li>
            <li>CPF</li>
            <li>Dados dos pedidos realizados</li>
            <li>Forma de pagamento utilizada (sem dados do cartão)</li>
          </ul>
        </Section>

        <Section title="2. Finalidade">
          Os dados são utilizados exclusivamente para:
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Identificar sua comanda no estabelecimento</li>
            <li>Processar e entregar seus pedidos</li>
            <li>Emissão fiscal pelo estabelecimento (quando aplicável)</li>
            <li>Análise estatística agregada e anônima</li>
          </ul>
        </Section>

        <Section title="3. Compartilhamento">
          Seus dados não são compartilhados com terceiros, exceto quando exigido
          por lei ou para emissão fiscal pelo estabelecimento.
        </Section>

        <Section title="4. Armazenamento">
          Seus dados são armazenados de forma segura pela duração necessária ao
          cumprimento das finalidades descritas.
        </Section>

        <Section title="5. Seus direitos (LGPD)">
          Você tem o direito de:
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Solicitar acesso aos seus dados</li>
            <li>Corrigir dados incorretos</li>
            <li>Solicitar a exclusão dos seus dados</li>
            <li>Revogar o consentimento</li>
          </ul>
          <p className="mt-3">
            Para exercer esses direitos, entre em contato com o estabelecimento
            onde realizou seu pedido.
          </p>
        </Section>

        <Section title="6. Contato">
          Em caso de dúvidas, entre em contato com o estabelecimento responsável.
        </Section>
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
