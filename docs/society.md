# How the blobs live

This is how map v10 works. For the same thing with live pictures and charts, open `docs/blobs.html` (in the hub: "How blobs live"). The code is in `prototype/v10/js/life.js` (the society) and `prototype/v10/js/creatures.js` (the generator). The tests in `prototype/v10/test/life.test.js` check everything described here. Run them with `npm test` in `prototype/v10`.

## 1. Who a blob is

Each blob is built from a seed, the session id, so the same session always gets the same blob. It is built in three steps.

**Personality comes first.** Five traits, each between 0 and 1:

| Trait | What it changes |
|---|---|
| social | how fast it gets lonely, and how much company counts |
| energy | walking speed, and how fast it gets hungry |
| curious | how fast it gets bored, and how little a long walk bothers it |
| sleepy | how much rest matters to it |
| talk | how often it speaks in a group |

**The look comes from the personality,** so you can read a blob's character from its face:

- Sleepy blobs mostly have sleepy eyes. Curious ones get wide eyes or an antenna.
- Social blobs smile. Unfriendly ones may have horns.
- Lively blobs are tall or small. Calm ones are round or big.

**Then a rule pass repairs anything that would look wrong.** It never rejects a blob, so the seed still gives the same blob:

1. **Silhouette:** the body is the agent type. Claude is a droplet, Codex a cube, Gemini twin lobes.
2. **Build:** proportions come from five tested builds (round, tall, squat, small, big). There is no free-form stretching.
3. **Coat:** one of three greys. Colour is kept for status.
4. **Budget:** at most 2 points of decoration (pattern, accessory, mouth, wide eyes), so no blob looks busy.
5. **Fit:** Gemini already has ears, so it gets no cap or horns. Caps sit only on Codex's flat top. Small blobs wear nothing wider than a tuft.
6. **Spots:** spots and bands only go on bodies wide enough to show them.
7. **Mouth:** a mouth only goes where there is room under the eyes.
8. **Name:** two soft syllables, no repeated syllable, never one of the 1,489 real words of that shape in the system dictionary (`scripts/make-notwords.sh`), and unique in the world.

The tests generate 20,000 random blobs and expect zero rule breaks. The blob lab (`prototype/v10/lab.html`) draws 900 blobs in all eight faces on every load (7,200 sprites; `?check=1000` draws 24,000) and checks every pixel: each face pixel must sit on the body, and nothing may be clipped. A deliberately broken version fails this check, so the check is real.

## 2. Free time: home, and visits

Like Hangar's floor, every blob belongs to its desk. A free blob (a finished session) lives around its own plot:

| Activity | Who likes it most |
|---|---|
| nap at its desk | sleepy blobs (they also stay longer) |
| play ball | curious and lively blobs |
| read a book | calm, curious blobs; more in the evening |
| have a tea | everyone; more in the morning and at lunch |
| listen to music | lively, social blobs |
| stretch | lively blobs |
| visit a friend on its own machine, for a real exchange | social blobs |
| keep a waiting friend company | everyone, more the longer the friend has waited for you |
| stay put | everyone, a little |

**Time of day tilts it:** lunch makes visits 2.5 times as attractive (lunch together); evening makes naps 1.5 times; night makes naps 4 times and play and visits rarer.

## 3. Choosing

When its current activity ends (15 to 40 seconds), a free blob scores every option:

```
pull = how much it likes it x time of day x friendship x nearness x variety
```

It picks at random among its **top three**, weighted by pull.

## 4. The world

Tiny and dense, after Hangar: one island per machine, side by side, joined by short bridges. Each project plot holds its desks, each with the session's slab (lit by its state, dark when asleep), and a front row where its blobs nap and play and where visitors stand. Names are written on the floor in front of each plot; machine names float at the top of their island and step aside for any message.

## 5. Work always wins

The real state of a session overrides everything at once, whatever the blob was doing. Nothing in the world ever slows, blocks or changes real work: the agents never see the blobs.

## 6. Real data always wins

The real state of each session overrides the needs:

- **running, waiting, failed:** the blob goes straight to its desk. That takes under 25 seconds, and the tests check it.
- **asleep (quiet for a day or more):** it sleeps in the hub's rest zone.
- **finished:** it celebrates, and blobs nearby cheer.
- **failed:** its two closest friends among the free blobs come to comfort it.

## 7. Relationships and talk

- **Starting relationships:** colleagues on the same project start as friends. Neighbours on the same machine start as acquaintances.
- **Friendship grows** from waving in passing, chatting, playing together, visits, and comfort when a session fails.
- **Friends attract:** a zone with friends in it is worth more.
- **Group chats:** blobs that share a zone (except the rest zone), or stand close on a street, talk in turns. Talkative blobs speak more.
- **What they say** comes from their low needs ("so hungry"), their friends' real sessions ("Fuba waits on John", "Pele failed :("), their own finished work, and small talk. A question gets an answer.

## 8. What the tests check

`npm test` in `prototype/v10` runs `test/life.test.js` in Node, in simulated time (about a second):

- **Generator:** 20,000 blobs break no rule; the same seed gives the same blob; every feature appears; the look follows the personality; no name is a real word; names are unique.
- **World:** over 10 minutes every blob holds at most one spot and stays on the grid; from any desk a blob can reach every desk and front-row spot.
- **Life:** no free blob idles over 5 seconds; each does at least 3 different things in 10 minutes; every free blob talks and friendships form; walking is under a third of their free time.
- **Character:** the sleepiest blobs nap at least 1.5 times as much as the most awake ones.
- **Clock:** more visiting at lunch; more napping at night.
- **Work wins:** with live state changes, every blob reaches its desk within 25 seconds; the same start always gives the same world.

## Tuning

The numbers live in `likes()` and `routine()` in `life.js`; the layout in `buildWorld()` in `world.js`. Change a number and run `npm test`.
