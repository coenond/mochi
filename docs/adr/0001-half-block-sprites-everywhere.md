---
status: accepted
---

# Half-block character sprites on every surface

The pet is drawn as pixel art made of half-block characters (`▀ ▄ █`), two pixels per character cell, in the band above the prompt. The same drawing is used on the terminal, the desktop app, VS Code and mobile. We considered real pixels (SVG or raster images) on the desktop app, but that means drawing and maintaining every behaviour twice, and the half-block look is exactly the 8-bit charm we want. The pet is about 12 by 6 pixels and the band is 3 rows tall, so it costs the owner as little transcript space as possible.
