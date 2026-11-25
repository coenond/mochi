# Glossary

Mochi is a small pixel-art golden retriever puppy that lives above the Claude Code prompt and keeps the owner company while they work. Domain vocabulary only. No implementation details.

## The pet

**Pet**: the one dog an owner has adopted, with a name, a coat, needs and a current behaviour. There is exactly one pet per owner, shared by every project and session.
_Avoid_: dog, tamagotchi, character, avatar

**Owner**: the person using Claude Code who adopted the pet.
_Avoid_: user, player

**Coat**: the pet's shade of golden, chosen at adoption. One of: golden, light, red.
_Avoid_: skin, theme, colour scheme

**Adoption**: the moment the owner gives a new pet its name and coat. Before adoption there is only the basket.

**Basket**: what the band shows before adoption: an empty dog basket and a hint on how to adopt.

**Band**: the strip directly above the prompt where the pet lives and walks.
_Avoid_: bar, widget, panel

## What the pet does

**Behaviour**: what the pet is doing right now, such as walking, sleeping, sniffing or celebrating. The pet always has exactly one behaviour.
_Avoid_: state, animation, mode, action

**Idle behaviour**: a behaviour the pet chooses on its own when nothing is happening: walk, sit, lie down, sleep, yawn, scratch.

**Trick**: a short, playful behaviour: spin, roll over, play bow, hop. Done now and then on its own, and always after a treat.

**Reaction**: a behaviour caused by something happening: curious, thinking, worried, celebrating, confused, eating, being petted, and the reactions to tone: wagging (happy), shrinking back (angry) and coming close (sad), where the pet walks over to the caret and lies down beside it.

**Emote**: the short, dim text beside the pet that hints at how it feels, such as `*sniff*`, `zzz` or `hungry…`. Never a sentence, never a request.
_Avoid_: speech bubble, message, notification

## What the pet notices

**Tone**: the mood of what the owner writes: happy, angry, sad or neutral.
_Avoid_: sentiment, emotion

**Trouble**: something going wrong in the session, such as a failing tool call or command.
_Avoid_: error (too technical), failure

**Win**: something working out after trouble, such as tests passing after they failed. A win earns a treat.
_Avoid_: success

**Confusion**: the owner refusing something Claude asked permission for.

## Needs and care

**Need**: one of the pet's three levels, each from 0 to 100: hunger, happiness and energy. Needs drift over real time, also while Claude Code is closed, but never so far that the pet dies, falls ill or leaves.
_Avoid_: stat, meter, health

**Hunger**: how full the pet is. 100 is full; it empties over about eight hours.

**Happiness**: how content the pet is. Rises with petting, tricks and wins; falls with neglect and trouble.

**Energy**: how awake the pet is. Drains while awake, refills while asleep.

**Kibble**: everyday food, free and unlimited. The pet refuses it when full.
_Avoid_: food, meal

**Bowl**: where the pet eats its kibble. A hungry pet sits by its empty bowl.
_Avoid_: dish, plate

**Treat**: a special snack the owner earns with wins and gives by choice. Makes the pet very happy and do a trick.
_Avoid_: reward, coin, point

**Petting**: the owner giving the pet attention, by command, hotkey or click.
