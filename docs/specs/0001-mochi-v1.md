# Spec 0001: Mochi v1

A cozy pixel-art golden retriever puppy that keeps the owner company in the band above the Claude Code prompt. Terms follow `GLOSSARY.md`; decisions are in `docs/adr/`.

## Look

- A golden retriever puppy in side profile, about 32 by 24 pixels, dark outline, big floppy ears, feathery tail. The head turns toward the owner for reactions (curious, being petted, worried, confused).
- Real pixels in a band 3 rows tall where the surface can draw them; a half-block fallback for other terminals with only walk, sit, sleep, happy and worried (ADR-0007).
- Coats: three golden shades, golden (default), light and red.
- Each behaviour has 2 to 6 frames. Walking is a quick four-step patter. The band redraws at about 6 to 9 frames per second while the pet moves and not at all while it is still. The pet moves about a fifth of the time.
- The look is settled first in a throwaway sprite sheet in `docs/prototypes/sprites/`.

## Adoption

- Before adoption the band shows the basket and the hint `/pet adopt to adopt a pup`.
- `/pet adopt <name> [coat]` adopts the pet. Without a coat the owner picks one of the three golden shades in the band (hotkeys `g`, `l`, `r`); the pup shows the shade the focus is on.
- One pet per owner, shared by all projects and sessions (ADR-0003).

## Behaviours

- Idle behaviours: walk, sit, lie down, sleep, yawn, scratch.
- Tricks: spin, roll over, play bow, hop.
- Reactions: curious, thinking, worried, celebrating, confused, eating, being petted.
- One behaviour at a time, chosen by priority (ADR-0005): petting or feeding, trouble and wins, tone, Claude working, needs, idle and tricks. Needs colour the higher behaviours (a hungry pet celebrates with less bounce).

## Reacting to the session

- **Typing**: the pet trots over and sits watching the prompt; ears perk at `?`. When the owner stops typing for a while it wanders off.
- **Tone**: happy, angry, sad or neutral, read from the draft while typing and from the submitted prompt (ADR-0002). Happy makes it wag, angry makes it shrink back, sad makes it come close and lie down.
- **Claude working**: Read, Grep and Glob: sniffing. Bash: watching intently. Edit and Write: carrying something. Agents or a long wait: lies down patiently and dozes after about two minutes.
- **Trouble**: a failing tool call makes it worried. More trouble in the same turn keeps it worried for longer. There is no scared reaction.
- **Win**: a test or build command that passes after trouble makes it celebrate and earns a treat.
- **Confusion**: the owner refusing a permission makes it tilt its head.
- Reactions to trouble and wins last about five seconds.

## Needs

- Hunger, happiness and energy, each 0 to 100, drifting on real time also while Claude Code is closed; they bottom out and the pet never dies, falls ill or leaves (ADR-0003).
- Hunger empties over about eight hours. Happiness rises with petting, tricks and wins and falls with neglect and trouble. Energy drains while awake and refills while asleep.
- A hungry pet sits by its empty bowl and walks slower. A tired pet sleeps more.

## Care

- `/pet feed`: kibble, free and unlimited; the pet refuses when full.
- `/pet treat`: gives an earned treat; big happiness bump and a trick.
- `/pet pet`: petting.
- `/pet status`: name, coat, needs as numbers, treats saved.
- `/pet name <name>`: renames the pet.
- Beside the pet, two dim glyph controls: `♥` pets and `∴` feeds, with a treat glyph to come. Once the band is focused, hotkeys `p` pet, `f` feed and `t` treat press them, and clicking a glyph presses it. The pet itself cannot be clicked: the engine gives pictures no clicks (ADR-0008). Nothing works only by clicking.

## Quietness

- No sounds, toasts, notifications or status line entries (ADR-0004).
- The emote: short dim text beside the pet, at most about 12 characters, changing at most once every ten seconds and fading after a few seconds. Feelings, never requests, except a soft `hungry…`.

## Settings

- Model tone: off by default (ADR-0002).

## Out of scope for v1

Digging, chasing its tail, toys and fetch (wanted next, issue #15), more breeds, accessories, multiple pets, sounds of any kind.
