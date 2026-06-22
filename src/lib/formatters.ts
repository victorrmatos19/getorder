export const fmt = {
  currency: (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),

  // número → "1.850,00" (sem símbolo; o rótulo do campo já diz "R$")
  money: (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),

  // input cru → máscara em centavos: pega só dígitos e divide por 100
  moneyMask: (raw: string) => {
    const d = raw.replace(/\D/g, '')
    return d ? fmt.money(parseInt(d, 10) / 100) : ''
  },

  // string mascarada → número (robusto a milhar/vírgula): só dígitos / 100
  moneyParse: (masked: string) => {
    const d = masked.replace(/\D/g, '')
    return d ? parseInt(d, 10) / 100 : 0
  },

  cpf: (v: string) =>
    v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),

  cpfMask: (v: string) =>
    v.replace(/\D/g, '')
     .replace(/(\d{3})(\d)/, '$1.$2')
     .replace(/(\d{3})(\d)/, '$1.$2')
     .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
     .slice(0, 14),

  cpfPartial: (v: string | null | undefined) => {
    if (!v) return ''
    const n = v.replace(/\D/g, '')
    if (n.length < 11) return v
    return `***.***.${n.slice(6, 9)}-${n.slice(9)}`
  },

  time: (v: string | Date) =>
    new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),

  date: (v: string | Date) =>
    new Date(v).toLocaleDateString('pt-BR'),

  elapsed: (v: string | Date) => {
    const diff = Math.floor((Date.now() - new Date(v).getTime()) / 60000)
    if (diff < 1) return 'agora'
    if (diff < 60) return `${diff}min`
    return `${Math.floor(diff / 60)}h${(diff % 60).toString().padStart(2, '0')}min`
  },

  elapsedMin: (v: string | Date) =>
    Math.floor((Date.now() - new Date(v).getTime()) / 60000),
}

export function isCPFValid(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '')
  if (n.length !== 11) return false
  if (/^(\d)\1{10}$/.test(n)) return false
  return true
}
