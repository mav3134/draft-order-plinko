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

State is kept in `data/plinko.json` by default. On Azure App Service it is
automatically kept in `/home/data/plinko.json` instead, which survives both
restarts and redeploys — no configuration needed. Optionally, set
`AZURE_STORAGE_CONNECTION_STRING` to store state in Azure Blob Storage
(`plinko.json` in a `plinko` container).

## Deploy (Azure App Service)

1. Azure Portal → App Services → **Create → Web App**. Runtime **Node 20 LTS**
   on Linux; any always-on-capable plan works (Free F1 is fine — it just cold
   starts after idle).
2. On the new app: **Deployment Center → Source: GitHub**, pick this repo and
   the `main` branch, Save. Azure adds the GitHub Actions workflow and
   deploys; from then on every push to `main` auto-deploys.

That's it — the game is at `https://<app-name>.azurewebsites.net`.
