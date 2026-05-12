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
  ordem: number
  foto_url: string | null
  criado_em: string
  // joins opcionais
  categoria_ref?: Categoria
}

export type FormaPagamento = 'pix' | 'debito' | 'credito' | 'dinheiro'

export type Comanda = {
  id: string
  restaurante_id: string
  mesa_id: string
  cliente_nome: string
  cliente_cpf: string
  status: 'aberta' | 'fechada'
  forma_pagamento: FormaPagamento | null
  total: number | null
  numero_pessoas: number
  taxa_servico_valor: number | null
  taxa_servico_aplicada: boolean
  aceite_lgpd_em: string | null
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
  criado_em: string
  produto?: Produto
  comanda?: Comanda
}

export type Role = 'super_admin' | 'admin' | 'garcom' | 'cozinha'

export type Perfil = {
  id: string
  role: Role
  restaurante_id: string | null
}
