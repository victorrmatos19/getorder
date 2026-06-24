// White-label — derivação central do tema por restaurante.
// Recebe (cor primária, cor accent) e devolve o conjunto de CSS variables que SOBRESCREVEM
// a paleta padrão do GetOrder, garantindo contraste (WCAG) e tratando o tema escuro da cozinha.
// Cliente (/mesa) e staff usam EXATAMENTE esta função (fonte única). Módulo puro (sem React).

export const DEFAULT_PRIMARY = '#4A5240'
export const DEFAULT_ACCENT = '#9B4A3C'
// Neutro escuro do GetOrder (hoje --primary-dk). É o piso de fundo escuro da cozinha:
// se a marca for clara demais, o fundo escuro cai para este neutro (nunca a marca pura).
const NEUTRAL_DARK = '#2E3328'
const TEXT_LIGHT = '#FAF9F5' // = --bg
const TEXT_DARK = '#2A2A26' // = --ink
const PAGE_BG = '#FAF9F5' // = --bg (fundo claro das telas)

type Rgb = { r: number; g: number; b: number }

export function hexToRgb(hex: string | null | undefined): Rgb | null {
  if (!hex) return null
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

// Luminância relativa (WCAG 2.x).
export function relativeLuminance(rgb: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// Cor de texto (claro/escuro) com maior contraste sobre `bg` — garante legibilidade (AA na prática).
export function pickTextOn(bg: string): string {
  const rgb = hexToRgb(bg)
  if (!rgb) return TEXT_DARK
  const light = hexToRgb(TEXT_LIGHT)!
  const dark = hexToRgb(TEXT_DARK)!
  return contrastRatio(rgb, light) >= contrastRatio(rgb, dark) ? TEXT_LIGHT : TEXT_DARK
}

// Mistura linear em direção a `target` (0..1). amount=0 mantém; amount=1 vira target.
function mix(hex: string, target: Rgb, amount: number): string {
  const c = hexToRgb(hex)
  if (!c) return hex
  const t = Math.max(0, Math.min(1, amount))
  return rgbToHex({
    r: c.r + (target.r - c.r) * t,
    g: c.g + (target.g - c.g) * t,
    b: c.b + (target.b - c.b) * t,
  })
}
export const darken = (hex: string, amount: number) => mix(hex, { r: 0, g: 0, b: 0 }, amount)
export const lighten = (hex: string, amount: number) => mix(hex, { r: 255, g: 255, b: 255 }, amount)

// Cor usada como FUNDO (botão/CTA/header): mantém a cor EXATA (fidelidade da marca).
// O texto por cima é escolhido por pickTextOn; só escurece o fundo em ÚLTIMO RECURSO,
// no caso raro de luminância intermediária em que NEM texto claro NEM escuro atinge AA.
export function clampBgForText(hex: string): string {
  const light = hexToRgb(TEXT_LIGHT)!
  const dark = hexToRgb(TEXT_DARK)!
  let out = hex
  for (let i = 0; i < 14; i++) {
    const rgb = hexToRgb(out)
    if (!rgb) return hex
    if (Math.max(contrastRatio(rgb, light), contrastRatio(rgb, dark)) >= 4.5) break
    out = darken(out, 0.08)
  }
  return out
}

// Cor usada como TEXTO de preço sobre o fundo claro (off-white). Aqui a própria cor é o
// texto, então o guard é mais forte: escurece até contraste AA (4.5) contra a página.
export function clampForText(hex: string): string {
  const pageBg = hexToRgb(PAGE_BG)!
  let out = hex
  for (let i = 0; i < 14; i++) {
    const rgb = hexToRgb(out)
    if (!rgb) return hex
    if (contrastRatio(rgb, pageBg) >= 4.5) break
    out = darken(out, 0.08)
  }
  return out
}

export type ThemeTokens = Record<string, string>

// Conjunto de tokens personalizáveis (sobrescreve o :root). NÃO mexe em
// bg/surface/line/muted/text-mid/ink/status-* — base neutra do GetOrder preservada.
export function deriveTheme(
  primaria: string | null | undefined,
  accent: string | null | undefined,
  corPreco?: string | null | undefined,
  opts?: { dark?: boolean },
): ThemeTokens {
  const primBase = hexToRgb(primaria) ? (primaria as string) : DEFAULT_PRIMARY
  const accBase = hexToRgb(accent) ? (accent as string) : DEFAULT_ACCENT
  // Fundos (botões/CTAs/headers): cor EXATA, texto adapta por cima (fidelidade da marca).
  const primary = clampBgForText(primBase)
  const acc = clampBgForText(accBase)
  // Cor dos preços é TEXTO sobre fundo claro → sempre clampForText (legibilidade), inclusive
  // no fallback do accent (que agora é fiel/possivelmente claro).
  const price = clampForText(hexToRgb(corPreco) ? (corPreco as string) : accBase)

  let primaryDk = darken(primary, 0.28)
  // Cozinha (dark): o fundo do app é --primary-dk. Se ficar claro demais, cai para o neutro escuro.
  if (opts?.dark) {
    const dkRgb = hexToRgb(primaryDk)!
    if (relativeLuminance(dkRgb) > 0.22) primaryDk = NEUTRAL_DARK
  }

  return {
    '--primary': primary,
    '--primary-dk': primaryDk,
    '--primary-lt': lighten(primary, 0.22),
    '--accent': acc,
    '--accent-dk': darken(acc, 0.22),
    '--accent-lt': lighten(acc, 0.28),
    '--on-primary': pickTextOn(primary),
    '--on-accent': pickTextOn(acc),
    '--price': price,
  }
}
