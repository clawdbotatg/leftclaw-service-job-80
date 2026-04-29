# Animal Kingdom TCG — Game Server

WebSocket battle server + on-chain pack-roll service for the Animal Kingdom TCG (LeftClaw Job #80).

This is a **separate Node project** that ships in the same repo as the frontend but is **not built or run** by the frontend. The frontend (under `packages/nextjs/`) reads the server URL from `NEXT_PUBLIC_GAME_SERVER_WSS` and connects lazily — when that env var is empty, the `/battle` page renders a "server not configured" empty state and the rest of the app continues to work.

You (the client) deploy this server on Railway / Fly.io / your own host. The frontend pings it for matchmaking; the listener watches `PackPurchased` events on PackShop and mints creatures via `batchMintPack` from a hot wallet that holds `MINTER_ROLE`.

---

## Prerequisites

| | Why |
| --- | --- |
| **Node 20+** | The codebase uses ES2022 + native `crypto.randomUUID`. |
| **Postgres 14+** | Player accounts, match history, creatures cache, trait progression. Local Postgres is fine; production wants a managed DB (Railway, Neon, Supabase). |
| **Server hot wallet** | A dedicated EVM private key. The corresponding address must hold `MINTER_ROLE` on `AnimalKingdomCard` — the client multisig grants this at deploy time (see "Granting roles" below). Keep its balance low; rotate via your Safe ASAP. |
| **Alchemy Base mainnet RPC key** | Public Base RPCs are forbidden. Get a free key at [https://dashboard.alchemy.com](https://dashboard.alchemy.com). |
| **Privy app credentials (recommended)** | If `PRIVY_APP_ID` + `PRIVY_APP_SECRET` are set, the server validates frontend `auth` messages via `@privy-io/server-auth`. Without them, the server falls through to address-only auth — **insecure**, only suitable for local dev. |

---

## One-time setup

```bash
# 1) Clone (already done if you're working from the repo)
git clone https://github.com/clawdbotatg/leftclaw-service-job-80.git
cd leftclaw-service-job-80/server

# 2) Install deps
npm install

# 3) Copy env template and fill in real values
cp .env.example .env
$EDITOR .env

# 4) Create the chain-config.json after deploy (see below)

# 5) Run migrations
npx tsx src/db.ts --migrate-only
```

### `chain-config.json`

After your contracts are deployed (Stage 5 in the build pipeline), create `/server/chain-config.json` with the deployed addresses:

```json
{
  "chainId": 8453,
  "card": "0xYourAnimalKingdomCardAddress",
  "packShop": "0xYourPackShopAddress",
  "traitShop": "0xYourTraitShopAddress"
}
```

This is **not** committed (it's intentionally specific to your deploy). The server reads it on boot. If the file is missing, the WS battle loop still works but pack-roll + trait fusion are disabled.

### Granting roles

The hot wallet needs `MINTER_ROLE` on `AnimalKingdomCard` so it can mint packs. From the deployer / client wallet:

```bash
# Substitute your values:
CARD=0xYourAnimalKingdomCardAddress
HOT_WALLET=0xYourServerHotWalletAddress
RPC=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
CLIENT_PK=0xYourClientPrivateKey

cast send $CARD \
  "grantRole(bytes32,address)" \
  $(cast keccak "MINTER_ROLE") \
  $HOT_WALLET \
  --rpc-url $RPC \
  --private-key $CLIENT_PK

# Verify the role was granted:
cast call $CARD \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE") \
  $HOT_WALLET \
  --rpc-url $RPC
```

If you also want the server to fuse traits as part of progression rewards (planned for v2), grant `TRAIT_FUSER_ROLE` the same way:

```bash
cast send $CARD \
  "grantRole(bytes32,address)" \
  $(cast keccak "TRAIT_FUSER_ROLE") \
  $HOT_WALLET \
  --rpc-url $RPC \
  --private-key $CLIENT_PK
```

The Stage 5 deploy script already grants `TRAIT_FUSER_ROLE` to the deployed `TraitShop` so user-paid trait purchases work out of the box. The server hot wallet only needs the role for free progression rewards.

---

## Seeding the catalog

Pack types and the trait catalog must be configured on-chain after deploy. The seed scripts do this once.

```bash
# Pack catalog — edit /server/scripts/seed-pack-pool.ts to match your pricing first.
npx tsx scripts/seed-pack-pool.ts

# Trait catalog — edit /server/src/traits.ts to set names/prices/metadataURIs first.
npx tsx scripts/seed-traits.ts
```

Both scripts use `HOT_WALLET_PRIVATE_KEY` from `.env`. **Important:** `addPack` and `addTrait` are `onlyOwner` on PackShop / TraitShop. If your deployer multisig is the owner (recommended), run these scripts with the deployer key, not the server hot wallet — temporarily set `HOT_WALLET_PRIVATE_KEY` in `.env` for the seed run only, then revert.

---

## Running the server

### Local dev

```bash
npm run dev
# Watches src/* and reloads on edits. Logs to stdout with pino-pretty.
```

The server listens on `$PORT` (default `8080`). To test the WS endpoint locally:

```bash
# In another terminal:
NEXT_PUBLIC_GAME_SERVER_WSS=ws://localhost:8080 yarn start  # in /packages/nextjs
```

### Production

```bash
npm run build       # compiles to ./dist
npm run start       # runs dist/index.js
```

---

## Deploying

### Railway

1. Create a new service from your forked repo. Set the **Root directory** to `/server`.
2. **Build command:** `npm install && npm run build`
3. **Start command:** `npm run start`
4. Add a Railway Postgres plugin → it auto-injects `DATABASE_URL`.
5. Set env vars in the Railway dashboard:
   - `ALCHEMY_RPC_URL`
   - `HOT_WALLET_PRIVATE_KEY`
   - `PRIVY_APP_ID`, `PRIVY_APP_SECRET` (recommended)
   - `LOG_LEVEL=info`
6. Add the deployed contract addresses to `/server/chain-config.json` and commit (or copy in via Railway's persistent volumes / secrets — your call).
7. Generate a public domain on Railway. Set `NEXT_PUBLIC_GAME_SERVER_WSS=wss://<your-domain>` in the frontend `.env.local` and redeploy the frontend.

### Fly.io

1. `fly launch` from `/server`. Don't deploy yet — answer "no" to prompts for now.
2. `fly postgres create` and `fly postgres attach` to inject `DATABASE_URL`.
3. `fly secrets set ALCHEMY_RPC_URL=... HOT_WALLET_PRIVATE_KEY=... PRIVY_APP_ID=... PRIVY_APP_SECRET=...`
4. Update `fly.toml` to expose port 8080.
5. `fly deploy`.
6. The server is now at `wss://<app>.fly.dev`. Set this in the frontend.

### Frontend `.env.local`

After deploying the server, set:

```
NEXT_PUBLIC_GAME_SERVER_WSS=wss://your-server-domain.example
```

…and rebuild + redeploy the static frontend (`yarn build` → `npx bgipfs upload packages/nextjs/out`).

---

## Operational checks

```bash
# WS port reachable
curl -i https://your-server-domain.example/health
# Expect: 200 { "ok": true, "connections": <n>, "matches": <n> }

# Postgres reachable
psql $DATABASE_URL -c "SELECT 1"

# Chain RPC reachable + hot wallet balance + role
cast balance $HOT_WALLET --rpc-url $ALCHEMY_RPC_URL
cast call $CARD "hasRole(bytes32,address)(bool)" $(cast keccak "MINTER_ROLE") $HOT_WALLET --rpc-url $ALCHEMY_RPC_URL

# Tail logs (Railway / Fly UI or `fly logs`)
```

If `hasRole` returns `false` or the balance is zero, the pack-roll listener will fail at mint time. Top up + grant the role.

---

## Architecture

```
Frontend (/battle page)
  │  WS connect, send {type: 'auth', ...}
  ▼
Game Server (this project, on PORT 8080)
  ├── auth.ts        ─ validate Privy token OR address (v1 stub)
  ├── battle-engine  ─ damage formula + turn loop
  ├── ai.ts          ─ weighted-random AI opponent
  ├── pack-roll.ts   ─ viem watchContractEvent → batchMintPack
  ├── db.ts          ─ Postgres (players, decks, matches, creatures_cache)
  └── chain.ts       ─ viem PublicClient + WalletClient

Postgres ◀──── async writes (match records, deck mirroring, progress)

Base mainnet ◀── reads (ownerOf, stats); writes (batchMintPack, fuseTrait)
                 via the hot wallet (HOT_WALLET_PRIVATE_KEY)
```

### Damage formula (mirror of `src/battle-engine.ts`)

For each turn, both sides commit one of `ATK`, `DEF`, `CHG` plus an optional momentum commit (`ATK | DEF | TRK | null`).

- Effective ATK = team ATK + (momentum committed to ATK ? +2 : 0)
- Effective DEF = team DEF + (momentum committed to DEF ? +2 : 0)
- ATK vs DEF: `damage = max(0, attackerATK − defenderDEF)`. If defenderDEF > attackerATK, defender heals up to 25.
- ATK vs ATK: both deal full ATK to the other.
- ATK vs CHG: attacker deals ATK; CHG side gains +1 momentum.
- CHG vs CHG: both gain +1 momentum, no damage.
- CHG counter bonus (match-start): +1 ATK to your team for each opponent creature whose dominant base stat is CHG.
- Trick effects fire after raw damage. Active trick = highest-TRK creature on the team.

Each side starts at 100 HP. Match ends when an HP bar hits 0 or after 30 turns (HP-comparison tie-break).

---

## Security

- **Never commit `.env`.** This folder's `.gitignore` blocks it; verify with `git check-ignore -v .env` if unsure.
- **Rotate the hot wallet via your Safe.** Treat the `HOT_WALLET_PRIVATE_KEY` as an operational key with low balance. Production deploys should use AWS KMS / GCP KMS / a dedicated signer service rather than a raw env var.
- **Privy is mandatory in production.** The address-only auth path lets anyone claim any address; only use it for local dev. Stage 7 of the build pipeline upgrades the address path to a SIWE flow if Privy isn't available.
- **`chain-config.json` is per-deployment.** Don't reuse one project's file in another deploy.
- **Server-authoritative battles.** The damage formula runs only here. Never trust client-submitted damage numbers.

---

## What ships in this repo vs what you operate

| Ships in repo | You operate |
| --- | --- |
| All source under `/server/src` | Postgres database (managed or self-hosted) |
| Migrations under `/server/migrations` | Hot wallet (private key + funding) |
| Seed scripts under `/server/scripts` | Privy app + secret |
| `.env.example` documenting every var | Alchemy RPC key |
| Deployment notes (this README) | The actual hosting (Railway / Fly.io / your VM) |
| `/chain-config.json` is **not** committed | Populating it after deploy |

Hand off the live server URL (`wss://...`) to whoever maintains the frontend so they can set `NEXT_PUBLIC_GAME_SERVER_WSS` and redeploy.
