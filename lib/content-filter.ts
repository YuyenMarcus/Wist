const ADULT_KEYWORDS = [
  'dildo',
  'vibrator',
  'sex toy',
  'sex toys',
  'butt plug',
  'buttplug',
  'anal plug',
  'anal beads',
  'cock ring',
  'cockring',
  'fleshlight',
  'bondage',
  'handcuffs',
  'ball gag',
  'nipple clamp',
  'nipple clamps',
  'strap-on',
  'strapon',
  'strap on',
  'penis pump',
  'penis ring',
  'prostate massager',
  'g-spot',
  'clitoral',
  'masturbator',
  'love doll',
  'sex doll',
  'lubricant',
  'lube',
  'pleasure toy',
  'adult toy',
  'adult novelty',
  'erotic',
  'fetish',
  'bdsm',
  'dominatrix',
  'lingerie set',
  'crotchless',
  'edible underwear',
  'sexy costume',
  'stripper',
  'penis',
  'vagina',
  'orgasm',
]

const keywordPatterns = ADULT_KEYWORDS.map(
  (kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
)

export function isAdultContent(title: string | null | undefined): boolean {
  if (!title) return false
  const normalized = title.toLowerCase()
  return keywordPatterns.some((pattern) => pattern.test(normalized))
}
