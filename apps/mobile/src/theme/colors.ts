/**
 * Wheahs-It-At palette.
 *
 * Warm cream paper + dark ink outlines, with accents borrowed from Boston's
 * subway lines. Every accent comes as a trio:
 *   base  – the fill
 *   dark  – the border AND the solid "3D" shadow under it
 *   soft  – a pale tint for backgrounds, selected states and tag pills
 */

export const ink = '#2B2118'; // outlines + main text (warm near-black)
export const inkSoft = '#6B5B4D'; // secondary text
export const inkFaint = '#B8A894'; // placeholders, disabled

export const cream = '#FFF8EC'; // app background
export const paper = '#FFFDF8'; // cards, inputs
export const sand = '#F3E6D0'; // card bottoms, dividers

export const line = {
  red: { base: '#E8483B', dark: '#9E1F16', soft: '#FFDCD6' },
  orange: { base: '#F59A1B', dark: '#A85E00', soft: '#FFE8C7' },
  green: { base: '#1F9D55', dark: '#0B5E2F', soft: '#D4F1DE' },
  blue: { base: '#2A66C9', dark: '#123A80', soft: '#D8E5FB' },
  purple: { base: '#9B3D8A', dark: '#5C1F52', soft: '#F3DCEE' },
  yellow: { base: '#FFC93C', dark: '#B07F00', soft: '#FFF1C4' },
} as const;

export type LineColor = keyof typeof line;

/** What each swipe direction "means" visually. */
export const actionColor = {
  pass: line.red,
  save: line.blue,
  going: line.green,
} as const;

export const colors = {
  ink,
  inkSoft,
  inkFaint,
  cream,
  paper,
  sand,
  white: '#FFFFFF',
  cheek: '#FF9DA6',
  ...line,
} as const;
