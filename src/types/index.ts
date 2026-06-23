export type Restaurante = {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  ativo: boolean
  taxa_servico_percentual: number
  taxa_servico_obrigatoria: boolean
  pedidos_pausados: boolean
  pausa_mensagem: string | null
  criado_em: string
}

export type HorarioFuncionamento = {
  id: string
  restaurante_id: string
  dia_semana: 0 | 1 | 2 | 3 | 4 | 5 | 6
  abre: string | null  // "HH:MM[:SS]"
  fecha: string | null
  fechado: boolean
}

export type Mesa = {
  id: string
  restaurante_id: string
  nome: string
  ativo: boolean
  criado_em: string
}

// Mantemos o tipo legado pelo histórico/compat. Não use em código novo.
export type CategoriaLegacy = 'cervejas' | 'lanches' | 'drinks' | 'petiscos'

export type Categoria = {
  id: string
  restaurante_id: string
  nome: string
  emoji: string | null
  ordem: number
  ativa: boolean
  criado_em: string
}

export type Produto = {
  id: string
  restaurante_id: string
  categoria_id: string | null
  // legacy enum coexiste até decommissionarmos. Não use em código novo.
  categoria: CategoriaLegacy | string
  nome: string
  descricao: string | null
  preco: number
  oferta_preco: number | null
  em_oferta: boolean
  novidade: boolean
  destaque_ordem: number
  disponivel: boolean
  // esgotado hoje: continua no cardápio, mas riscado e sem poder pedir
  esgotado: boolean
  ordem: number
  foto_url: string | null
  criado_em: string
  // joins opcionais
  categoria_ref?: Categoria
}

// ── Adicionais estruturados ─────────────────────────────────────────
// Grupos reutilizáveis de opções aplicáveis a produtos (ponto da carne,
// "tirar", adicionais pagos). Uma remoção é só uma opção de preço 0.

export type SelecaoAdicional = 'unica' | 'multipla'

export type GrupoAdicional = {
  id: string
  restaurante_id: string
  nome: string
  selecao: SelecaoAdicional
  obrigatorio: boolean
  min_escolhas: number
  max_escolhas: number | null  // null = sem teto
  ativo: boolean
  criado_em: string
  // join opcional
  adicionais?: Adicional[]
}

export type Adicional = {
  id: string
  restaurante_id: string
  grupo_id: string
  nome: string
  preco: number
  disponivel: boolean
  ordem: number
  criado_em: string
}

export type ProdutoGrupo = {
  id: string
  restaurante_id: string
  produto_id: string
  grupo_id: string
  ordem: number
  // join opcional
  grupo?: GrupoAdicional
}

// Snapshot imutável de um adicional escolhido no momento do pedido.
export type ItemPedidoAdicional = {
  id: string
  restaurante_id: string
  item_pedido_id: string
  adicional_id: string | null  // null se o adicional original foi removido
  grupo_nome_snapshot: string | null
  nome_snapshot: string
  preco_snapshot: number
  criado_em: string
}

export type FormaPagamento = 'pix' | 'debito' | 'credito' | 'dinheiro'

export type Comanda = {
  id: string
  restaurante_id: string
  mesa_id: string
  cliente_nome: string | null
  cliente_cpf: string | null
  status: 'aberta' | 'fechada' | 'cancelada'
  forma_pagamento: FormaPagamento | null
  total: number | null
  numero_pessoas: number
  taxa_servico_valor: number | null
  taxa_servico_aplicada: boolean
  aceite_lgpd_em: string | null
  // auditoria de cancelamento (migrations 014/015 — prevenção de comanda-zumbi)
  cancelada_em: string | null
  cancelada_por: string | null
  cancelamento_motivo: 'expiracao_automatica' | 'cancelada_garcom' | null
  criado_em: string
  fechado_em: string | null
  mesa?: Mesa
}

export type ItemStatus = 'novo' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado'

export type ItemPedido = {
  id: string
  restaurante_id: string
  comanda_id: string
  produto_id: string
  quantidade: number
  obs: string | null
  status: ItemStatus
  cancelado_em: string | null
  cancelado_por: string | null
  preco_base_snapshot?: number | null
  criado_em: string
  produto?: Produto
  comanda?: Comanda
  // join opcional: adicionais escolhidos (snapshot)
  adicionais?: ItemPedidoAdicional[]
}

export type Role = 'super_admin' | 'admin' | 'garcom' | 'cozinha'

export type Perfil = {
  id: string
  role: Role
  restaurante_id: string | null
}
