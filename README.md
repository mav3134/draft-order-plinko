# Draft Order Plinko

A Price is Right style Plinko game that decides a fantasy draft order. Each
player picks their name, drags a chip onto one of 10 top slots, and the chip
bounces down the pegs into one of 10 numbered slots at the bottom (1st in the
middle, 9th/10th on the edges). Every top slot secretly maps to a different
bottom slot — the mapping is randomized server-side and never sent to the
browser, so nobody can peek.

The draft order, filled slots, and who has already played are stored
**server-side**, so everyone sees the same live board from any device.

## Rules (built in)

1. Each slot at the top falls into a different slot at the bottom. It's completely random.
2. Pick your name from the drop down.
3. Click and drag a chip to a slot.
4. Release your chip.
5. You can only play 1 chip, then your draft position is locked in!

A slot that's already been won turns red and gets capped — a chip aimed at it
clanks off the cap, falls off the board to crowd boos, and that player can try
a different top slot. Picking a name that already played locks the whole
board. The **Reset** button deals a brand-new random board (password
protected).

## Run it

```
npm install
npm start          # http://localhost:3000
```

State is kept in `data/plinko.json` by default. To store state in Azure Blob
Storage instead (recommended for Azure App Service, where local disk resets on
redeploy), set `AZURE_STORAGE_CONNECTION_STRING` — state then lives as
`plinko.json` in a `plinko` container.

## Deploy

Any Node 18+ host works. For Azure App Service: create a Web App, point its
deployment at this repo (Deployment Center → GitHub), and add
`AZURE_STORAGE_CONNECTION_STRING` under Configuration → Application settings.
