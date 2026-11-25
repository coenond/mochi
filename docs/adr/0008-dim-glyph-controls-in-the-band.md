---
status: accepted, amended by ADR-0009
---

# Two dim glyph controls beside the pet

Amends ADR-0004. The band needs hotkeys (`p` pet, `f` feed, later `t` treat) and clicking, but the Claude Code engine only gives a hotkey to a visible `Button`, a `Button` holds only text, pictures (`Svg`, `Image`) take no clicks, and the band never says when it holds the keyboard. So the pet cannot be clicked itself, and no hotkey can be invisible.

Beside the pet sit small dim one-glyph buttons: `♥` pets (hotkey `p`) and `∴` feeds (hotkey `f`), with a treat glyph to come. They are icons, not words, so the emote stays the only text in the band. Clicking a glyph is the click, and every control also works from the keyboard after the band takes focus, and as a `/pet` command. Pressing a glyph never replies with text; the pet answers with its behaviour. A terminal draws a plain button with its hotkey in front (`p: ♥  f: ∴`), the only way it shows a hotkey; the desktop app draws native buttons.

Considered: dim text buttons (`p pet · f feed`, words in the band all the time) and no band controls at all (command-only, against the rule that clicking is a shortcut and keys always work).
