---
status: accepted
---

# Cozy needs on real time, one global pet

Needs drift on wall-clock time, also while Claude Code is closed, by comparing against the last time the pet was seen. Unlike a classic Tamagotchi the pet never dies, falls ill or runs away: needs bottom out and a neglected pet is just hungry, sleepy and mopey, then overjoyed when the owner returns. Guilt is not cozy.

There is one pet per owner, kept in the cross-session store and shared by every project and every session. Concurrent sessions read and write the same pet; the last write wins. We accept the rare lost update over the complexity of merging.
