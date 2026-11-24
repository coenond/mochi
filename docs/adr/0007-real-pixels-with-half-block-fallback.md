---
status: accepted
---

# Real pixel art where the surface can draw it, half-blocks as a fallback

Supersedes ADR-0001. Mochi is a golden retriever puppy in side profile, about 32 by 24 pixels with a dark outline, turning its head toward the owner for reactions. Half-block characters make every pixel half a text row, so a dog with that much detail would take 12 or more rows. Instead the pet is drawn as real pixels where the surface can: SVG in the desktop app, VS Code and mobile, and an image in terminals that support one (kitty, Ghostty, iTerm2 3.5 and later). There it fits in a band 3 text rows tall. Every other terminal gets a simple half-block fallback: the smaller front-facing chibi puppy (24 by 10 pixels, 5 rows) with only a few behaviours (walk, sit, sleep, happy, worried).

Considered: half-blocks everywhere (too coarse or far too tall), an automatic downscale for the fallback (mushy), and a full hand-drawn fallback set (every behaviour drawn twice).
