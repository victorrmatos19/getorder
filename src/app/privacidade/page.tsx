import Logo from '@/components/Logo'

export const metadata = {
  title: 'Política de Privacidade — GetOrder',
}

export default function PrivacidadePage() {
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
        <p className="text-sm mb-6" style={{ color: 'var(--text-mid)' }}>
          Última atualização: 26/06/2026
        </p>

        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-mid)' }}>
          O GetOrder é um sistema de comandas digitais por QR Code, operado pela Optmore.
          Esta política descreve quais dados são tratados em duas situações distintas:
          (a) quando um cliente final faz pedidos pelo site do restaurante e (b) quando a
          equipe do restaurante usa o aplicativo/sistema GetOrder.
        </p>

        <Section title="1. Dados que tratamos">
          <SubTitle>Cliente final (pedido pelo QR Code da mesa, no site)</SubTitle>
          <p>
            O cliente não se identifica. A comanda é aberta diretamente na mesa, sem nome,
            CPF ou cadastro. Tratamos apenas:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Itens pedidos e observações do pedido</li>
            <li>Forma de pagamento registrada (ex.: PIX, débito, crédito, dinheiro) — sem dados do cartão</li>
          </ul>
          <p className="mt-3">
            Esses dados ficam vinculados à mesa/comanda, não a uma pessoa identificada.
          </p>

          <SubTitle className="mt-6">Equipe do restaurante (uso do aplicativo GetOrder Staff)</SubTitle>
          <p>
            Para operar o sistema, a equipe faz login. Tratamos:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>E-mail de login (autenticação da conta da equipe, criada pelo restaurante)</li>
            <li>Fotos enviadas pelo administrador (imagens de produtos do cardápio e logo do restaurante)</li>
          </ul>
          <p className="mt-3">
            Não coletamos localização, contatos, dados de saúde nem identificadores de
            publicidade, e não realizamos rastreamento.
          </p>
        </Section>

        <Section title="2. Finalidade">
          <ul className="list-disc pl-5 space-y-1">
            <li>Operar as comandas e exibir/entregar os pedidos</li>
            <li>Calcular e exibir valores (o GetOrder não processa pagamento; apenas registra a forma)</li>
            <li>Autenticar a equipe do restaurante</li>
            <li>Exibir o cardápio e a identidade visual do restaurante</li>
            <li>Apoiar a emissão fiscal pelo estabelecimento, quando aplicável</li>
            <li>Análise estatística agregada e anônima</li>
          </ul>
        </Section>

        <Section title="3. Papéis (LGPD)">
          O restaurante é o controlador dos dados; o GetOrder/Optmore atua como operador,
          tratando os dados conforme as instruções do restaurante.
        </Section>

        <Section title="4. Compartilhamento">
          Não compartilhamos dados com terceiros, exceto quando exigido por lei ou para a
          emissão fiscal pelo próprio estabelecimento.
        </Section>

        <Section title="5. Armazenamento">
          Os dados são armazenados de forma segura (infraestrutura Supabase) pelo período
          necessário ao cumprimento das finalidades descritas.
        </Section>

        <Section title="6. Seus direitos (LGPD)">
          <p>
            Você pode solicitar acesso, correção ou exclusão dos seus dados e revogar
            consentimento. Como o restaurante é o controlador, pedidos relativos a dados de
            pedido devem ser feitos ao estabelecimento onde o pedido foi realizado. Para
            dados da conta da equipe, o pedido pode ser feito ao GetOrder pelos contatos
            abaixo.
          </p>
        </Section>

        <Section title="7. Contato">
          <p className="font-bold" style={{ color: 'var(--ink)' }}>GetOrder — Optmore</p>
          <p className="mt-2">
            WhatsApp:{' '}
            <a
              href="https://wa.me/5511917320202"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: 'var(--accent)' }}
            >
              (11) 91732-0202
            </a>
          </p>
          <p className="mt-1">
            E-mail:{' '}
            <a href="mailto:optmore@outlook.com" className="underline" style={{ color: 'var(--accent)' }}>
              optmore@outlook.com
            </a>
          </p>
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

function SubTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`font-bold mb-1 ${className}`} style={{ color: 'var(--ink)' }}>
      {children}
    </h3>
  )
}
