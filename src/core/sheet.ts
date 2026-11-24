// Mochi's sprite sheet, as settled in docs/prototypes/sprites/ (copied, never imported).
// Pixel letters: o outline, c coat, s shade, l highlight, w cream, e eye, h eye shine,
// n nose, p pink.

import type { Palette, Sprite } from './sprites'

const FIXED = { e: '#1a120c', h: '#ffffff', n: '#1a120c', p: '#f2899f' }

/** The real-pixel pet: a golden retriever puppy in side profile, 32 by 24. */
const PET_PALETTE: Palette = {
  coats: {
    golden: { o: '#4a2a10', c: '#e9a640', s: '#c27f2a', l: '#f7cd78', w: '#fbe3ad' },
    light: { o: '#5a3a1c', c: '#f1cf8a', s: '#d6a75c', l: '#fbe7b9', w: '#fff5de' },
    red: { o: '#3d1d0b', c: '#c9722c', s: '#9e521c', l: '#e39a52', w: '#f0c184' },
  },
  fixed: FIXED,
}

/** The half-block fallback: a front-facing chibi puppy, 24 by 10. */
const FALLBACK_PALETTE: Palette = {
  coats: {
    golden: { o: '#6a3b12', c: '#e9a640', s: '#c98428', l: '#f6cb73', w: '#fbe2a9' },
    light: { o: '#6e4a25', c: '#f2cf8a', s: '#dcaa5c', l: '#fae5b5', w: '#fff4dc' },
    red: { o: '#4a2410', c: '#c9722c', s: '#a4551c', l: '#e39a52', w: '#f0c184' },
  },
  fixed: FIXED,
}

// prettier-ignore
export const PET_SIT: Sprite = {
  palette: PET_PALETTE,
  pixels: [
    '................................',
    '................................',
    '................................',
    '...................oooooo.......',
    '..................ollllllco.....',
    '.................olllcccccco....',
    '................ossssccccccco...',
    '................osssssccheccco..',
    '................ossssscceecccn..',
    '................osssssscccwwwn..',
    '.................osssssccwwwo...',
    '..............oooosssssccowwo...',
    '............oollllossssccoo.....',
    '...........olcccccosssso........',
    '..........olccccccsosos.........',
    '.........olccccccccwwo..........',
    '........olccccccccwwwo..........',
    '........occcccccccowwo..........',
    '.......occccccccco.occo.........',
    '..oo...occccccccco.occo.........',
    '.olloo.oscccccccso.occo.........',
    '.occcooossccccccso.occo.........',
    '..ossso.osswwwwso.ooooo.........',
    '.........oooooooo...............',
  ],
}

// prettier-ignore
export const FALLBACK_SIT: Sprite = {
  palette: FALLBACK_PALETTE,
  pixels: [
    '.........oooooo.........',
    '.......oocllllcoo.......',
    '.....ossoccccccosso.....',
    '....ossochecchecosso....',
    '....ossoceecceecosso.ss.',
    '....ossopcwnnwcpossosss.',
    '....ossoocwwwwcoossosso.',
    '....sosocwoooowcososso..',
    '.......ocwwccwwco.......',
    '........oooooooo........',
  ],
}
