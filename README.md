# Animal Kingdom TCG

A turn-based trading-card game on Base. Open packs to roll creatures with permanent on-chain stats, fuse cosmetic traits onto them, build a 4-creature deck, and battle the wild. Free-to-play via packs purchased in ETH, USDC, or fiat (Coinbase Onramp). NFTs are ERC-721 with **immutable rolled stats** and an **append-only fused-traits** list.

- **Live URL:** https://bafybeig245wastknlwkvvexsi5sgpyh256u7t7q4hhn2ckogkuuquvbf44.ipfs.community.bgipfs.com/
- **Repo:** https://github.com/clawdbotatg/leftclaw-service-job-80
- **Network:** Base mainnet (chainId 8453)
- **Owner / admin (every contract):** `0xFE968dE21eb0E77d5877477C31a04A3075c0086E`

---

## Status

| State | Item |
| --- | --- |
| ✅ Done | All 3 contracts deployed + Sourcify-verified on Base mainnet |
| ✅ Done | Static frontend built and pinned on bgipfs (CID above) |
| ✅ Done | Full game-server source committed under `/server/` (Postgres + WS + pack-roll listener + battle engine) |
| ✅ Done | Privy + RainbowKit wallet stack wired (config-driven, no crash on missing keys) |
| ✅ Done | Coinbase Onramp wired (config-driven; disables gracefully if no app id) |
| ⚠️ Pending client | Grant `TRAIT_FUSER_ROLE` to `TraitShop` (without it `buyTrait` reverts) |
| ⚠️ Pending client | Generate + fund a server hot wallet, grant it `MINTER_ROLE` |
| ⚠️ Pending client | Add at least one pack via `PackShop.addPack` (until then `buyPack` reverts with `PackInactive`) |
| ⚠️ Pending client | Seed the trait catalog via `TraitShop.addTrait` |
| ⚠️ Pending client | Provision Privy app id + Coinbase Onramp app id |
| ⚠️ Pending client | Deploy `/server/` to Railway / Fly.io / your own host |
| ⚠️ Pending client | Set frontend env vars and re-deploy to bgipfs (new CID) |
| ⏭ Out of v1 scope | PvP matchmaking (only AI opponents in v1) |
| ⏭ Out of v1 scope | Real artwork — placeholder emoji ships in v1; client supplies images via `setImageBaseURI` |
| ⏭ Out of v1 scope | Tokens beyond ETH + USDC (Base mainnet only, v1) |

---

## Deployed Contracts (Base mainnet, chain 8453)

| Contract | Address | Basescan | Source |
| --- | --- | --- | --- |
| `AnimalKingdomCard` (ERC-721) | `0x230f1fFD190c1ae36E14950a935669F708D3b2BE` | [Basescan](https://basescan.org/address/0x230f1fFD190c1ae36E14950a935669F708D3b2BE) | [Sourcify](https://sourcify.dev/server/v2/contract/8453/0x230f1fFD190c1ae36E14950a935669F708D3b2BE) `exact_match` |
| `PackShop` | `0xf03B6995BAC12EbaF7E98f681Fd2d5a7a339cFC7` | [Basescan](https://basescan.org/address/0xf03B6995BAC12EbaF7E98f681Fd2d5a7a339cFC7) | [Sourcify](https://sourcify.dev/server/v2/contract/8453/0xf03B6995BAC12EbaF7E98f681Fd2d5a7a339cFC7) `exact_match` |
| `TraitShop` | `0xaee554CC577310D300ff388F40e2B1cE4D46e01A` | [Basescan](https://basescan.org/address/0xaee554CC577310D300ff388F40e2B1cE4D46e01A) | [Sourcify](https://sourcify.dev/server/v2/contract/8453/0xaee554CC577310D300ff388F40e2B1cE4D46e01A) `exact_match` |

**Constructor wiring (already executed at deploy):**
- `AnimalKingdomCard(admin = client)` — client wallet is sole holder of `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `TRAIT_FUSER_ROLE`. ADAR (AccessControl Default Admin Rules) enforces a 3-day delay on any admin transfer.
- `PackShop(admin = client, usdc = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)` — Base mainnet USDC.
- `TraitShop(admin = client, card = AnimalKingdomCard)` — TraitShop calls `card.fuseTrait(...)` and therefore needs `TRAIT_FUSER_ROLE` on the card (granted by client post-deploy, see step 1 below).

---

## Architecture

```
                        ┌────────────────────────────────────────┐
                        │  Frontend (Next.js, static export)     │
                        │  Hosted on bgipfs                      │
                        │  Privy embedded wallets + RainbowKit   │
                        │  Coinbase Onramp (fiat → ETH/USDC)     │
                        └──────────┬───────────────────┬─────────┘
                                   │                   │
                       reads/writes│                   │WSS (battle, pack roll)
                                   ▼                   ▼
                        ┌──────────────────┐  ┌────────────────────────────┐
                        │ Base mainnet     │  │ Game Server (/server/)     │
                        │  AnimalKingdomCard│  │  Node.js + WebSocket       │
                        │  PackShop         │  │  Postgres (players,        │
                        │  TraitShop        │  │   matches, decks cache)    │
                        └──────────────────┘  │  Hot wallet w/ MINTER_ROLE │
                                ▲             │  Watches PackPurchased,    │
                                │             │  calls batchMintPack       │
                                └─────────────┴────────────────────────────┘
```

### Trust model
- **Battles are server-authoritative.** The frontend never computes damage. The server runs the canonical engine (`/server/src/battle-engine.ts`) and the frontend only renders results.
- **Stats are write-once on-chain.** `AnimalKingdomCard.batchMintPack` sets ATK/DEF/CHG/TRK at mint and they can never be edited. This is the core trust guarantee for collectors.
- **Traits are append-only**, capped at 32 per token. Once fused, a trait cannot be removed or reordered.
- **Mint authority is delegated.** PackShop never mints; it forwards funds and emits `PackPurchased(buyer, packType, requestId)`. The server's hot wallet (holds `MINTER_ROLE`) listens for that event and mints via `batchMintPack`. This keeps randomness off-chain (cheaper, simpler) without compromising stat integrity.
- **ADAR delay.** The `DEFAULT_ADMIN_ROLE` on the card has a 3-day transfer delay. Even if the admin key is compromised, the new admin cannot grant new roles for 3 days, giving the team time to react.
- **Funds never sit in the shop contracts.** `buyPack` (ETH) immediately call-forwards `msg.value` to `revenueWallet` in the same transaction. `buyPackUSDC` calls `safeTransferFrom(buyer, revenueWallet, priceUsdc)` directly — no USDC ever rests in PackShop.

---

## Client Quick-Start Checklist

This is the most important section. Until you finish it, the live frontend will render but the buy/fuse/battle flows will fail in expected ways. Run these from a wallet that holds `DEFAULT_ADMIN_ROLE` on the card — i.e. the deploy admin `0xFE968dE21eb0E77d5877477C31a04A3075c0086E`.

Substitute placeholders:
- `<RPC>` — your Base mainnet RPC (Alchemy strongly recommended, see [https://dashboard.alchemy.com](https://dashboard.alchemy.com))
- `<YOUR_PK>` — the admin private key, OR use `cast send --ledger ...` for a hardware wallet, OR submit via your Safe
- `<HOT_WALLET>` — the dedicated server hot wallet you generate in step 2

**1. Grant `TRAIT_FUSER_ROLE` to `TraitShop`** — without this, `TraitShop.buyTrait` always reverts.
```bash
cast send 0x230f1fFD190c1ae36E14950a935669F708D3b2BE \
  "grantRole(bytes32,address)" \
  $(cast keccak "TRAIT_FUSER_ROLE") \
  0xaee554CC577310D300ff388F40e2B1cE4D46e01A \
  --rpc-url <RPC> --private-key <YOUR_PK>
```

**2. Generate a server hot wallet, fund it with a small amount of ETH for gas.** This wallet holds `MINTER_ROLE` and watches `PackPurchased` events. Treat it as an operational key — keep its balance low; rotate it via your Safe whenever you want.
```bash
# Locally:
cast wallet new
# …or via Privy server-side, GCP KMS, AWS KMS, etc. (production recommended).
# Fund it with ~0.01 ETH on Base for gas.
```

**3. Grant `MINTER_ROLE` to the hot wallet.**
```bash
cast send 0x230f1fFD190c1ae36E14950a935669F708D3b2BE \
  "grantRole(bytes32,address)" \
  $(cast keccak "MINTER_ROLE") \
  <HOT_WALLET> \
  --rpc-url <RPC> --private-key <YOUR_PK>
```

**4. Add at least one pack to `PackShop`.** Until at least one pack is `active`, both `buyPack` and `buyPackUSDC` revert with `PackInactive`. Example: a Starter Pack at 0.005 ETH or 5 USDC.
```bash
# packType=1, priceWei=0.005 ETH (5e15), priceUsdc=5 USDC (5e6, USDC has 6 decimals), name="Starter Pack"
cast send 0xf03B6995BAC12EbaF7E98f681Fd2d5a7a339cFC7 \
  "addPack(uint8,uint256,uint256,string)" \
  1 5000000000000000 5000000 "Starter Pack" \
  --rpc-url <RPC> --private-key <YOUR_PK>
```
Either price can be `0` to disable that payment path for that pack type. Re-run with new `packType` numbers to add more pack tiers.

**5. Seed the trait catalog.** Edit `/server/src/traits.ts` to set names, prices, and metadata URIs, then run the seed script:
```bash
cd server
cp .env.example .env
$EDITOR .env       # set HOT_WALLET_PRIVATE_KEY (TEMPORARILY use the admin key for the seed run, then revert)
npx tsx scripts/seed-traits.ts
```
The script calls `TraitShop.addTrait(traitId, priceWei, metadataURI)` for every entry. **Important:** `addTrait` is `onlyOwner` on TraitShop, so this script must be run with the **admin key**, not the server hot wallet — temporarily set `HOT_WALLET_PRIVATE_KEY` to the admin key in `.env` for this run only, then revert before deploying the server.

**6. (Optional) Set `imageBaseURI` on the card.** This is only needed if you're hosting card artwork (PNG/JPG) on IPFS or any other host so wallets and OpenSea can render images. Without this, tokens still mint and the frontend renders placeholder emoji.
```bash
cast send 0x230f1fFD190c1ae36E14950a935669F708D3b2BE \
  "setImageBaseURI(string)" \
  "ipfs://<your-art-cid>/" \
  --rpc-url <RPC> --private-key <YOUR_PK>
```
Tokens then resolve their image as `${imageBaseURI}${creatureId}.png`.

**7. Get your third-party app ids.**
- **Privy:** sign up at [https://dashboard.privy.io](https://dashboard.privy.io), create an app, configure Base mainnet, copy the **App ID** and **App Secret**.
- **Coinbase Onramp:** sign in at [https://portal.cdp.coinbase.com](https://portal.cdp.coinbase.com), create a project, copy the **App ID** for the Onramp widget.

**8. Deploy `/server/`.** Full Railway / Fly.io instructions are in [`/server/README.md`](./server/README.md). Briefly:
- Set the **Root directory** to `/server`.
- Build: `npm install && npm run build`. Start: `npm run start`.
- Attach a Postgres plugin (Railway: Postgres add-on; Fly.io: `fly postgres create && fly postgres attach`).
- Set env vars: `ALCHEMY_RPC_URL`, `HOT_WALLET_PRIVATE_KEY`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`.
- Create `/server/chain-config.json` (NOT committed) with the three deployed addresses listed above.
- Generate a public domain. The WS endpoint is `wss://<your-domain>`.

**9. Update the frontend env, rebuild, redeploy.**
Create `packages/nextjs/.env.local`:
```
NEXT_PUBLIC_PRIVY_APP_ID=<from step 7>
NEXT_PUBLIC_ONRAMP_APP_ID=<from step 7>
NEXT_PUBLIC_GAME_SERVER_WSS=wss://<your-server-from-step-8>
NEXT_PUBLIC_PRODUCTION_URL=https://<your-final-public-url>
NEXT_PUBLIC_ALCHEMY_API_KEY=<your-alchemy-key>
```
Rebuild and re-pin to bgipfs:
```bash
cd packages/nextjs
rm -rf out .next
NEXT_PUBLIC_IPFS_BUILD=true \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  yarn build
cd ../..
npx bgipfs upload packages/nextjs/out
```
The new CID **must differ** from `bafybeig245wastknlwkvvexsi5sgpyh256u7t7q4hhn2ckogkuuquvbf44` — if it matches, the rebuild didn't pick up your new env vars.

---

## Local Development

```bash
yarn install
yarn chain          # Anvil local node on :8545
yarn deploy         # deploys all 3 contracts to localhost
yarn start          # Next.js dev server at http://localhost:3000
```

A few notes:
- The battle screen will show **"Battle server not configured"** unless you also run the `/server/` project locally and set `NEXT_PUBLIC_GAME_SERVER_WSS=ws://localhost:8080`. This is intentional — every page works without the server, the battle page is just disabled gracefully.
- The pack pages render but `buyPack` will revert because no packs are seeded on a fresh local deploy. Add one with the same `cast send addPack` recipe from step 4 above (just point at your local Anvil RPC and use your Anvil private key).
- Trait fusion needs `TRAIT_FUSER_ROLE` granted to TraitShop locally — same `grantRole` recipe from step 1.

To run the contract tests:
```bash
cd packages/foundry
forge test
```

---

## Frontend Environment Variables

All variables are optional. If a variable is empty, the affected feature degrades gracefully (disabled button + helper text) instead of crashing. Add to `packages/nextjs/.env.local`:

| Variable | What it does | Where to get it | If missing |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Enables email / Google / Apple login via Privy embedded wallets | [https://dashboard.privy.io](https://dashboard.privy.io) | Sign-up button shows "temporarily unavailable"; users can still use RainbowKit (MetaMask, Coinbase Wallet, Phantom) |
| `NEXT_PUBLIC_ONRAMP_APP_ID` | Enables the "Buy with USD" Coinbase Onramp button on `/pack` | [https://portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) | Fiat-purchase button is disabled with helper text "Fiat purchase requires admin setup"; ETH and USDC paths still work |
| `NEXT_PUBLIC_GAME_SERVER_WSS` | WebSocket URL of the deployed game server (e.g. `wss://your-server.fly.dev`) | Output of step 8 above | Battle page renders the "Battle server not configured" empty state — no JS error |
| `NEXT_PUBLIC_PRODUCTION_URL` | Absolute base URL for OG images (`https://yourdomain.com`) | Your final pinned URL | OG images fall back to relative URLs (still works on most platforms) |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Alchemy key for client-side reads (`useReadContract`, `useBalance`, etc.) | [https://dashboard.alchemy.com](https://dashboard.alchemy.com) | Falls back to wagmi public providers (rate-limited, may be slow) |

The `.env.example` in `packages/nextjs/` lists every variable.

---

## Server Setup

The full game server lives under `/server/` and ships in this repo but is **not built or run** by the frontend. See [`/server/README.md`](./server/README.md) for the complete operator's guide. Highlights:

- Node 20+, Postgres 14+. Local Postgres is fine for dev; production wants a managed DB.
- Hot wallet private key in `HOT_WALLET_PRIVATE_KEY`. Production deploys should use AWS KMS / GCP KMS / a dedicated signer service rather than a raw env var.
- Postgres `DATABASE_URL` (Railway / Neon / Supabase / Fly Postgres all work). Migrations run via `npx tsx src/db.ts --migrate-only`.
- `chain-config.json` (the three deployed addresses) is **not** committed — write it once after deploy.
- Health check: `GET /health` returns `{ ok: true, connections: <n>, matches: <n> }`.

The server has two main jobs:
1. **Battle WebSocket** — accepts authenticated connections, runs the canonical damage formula, persists match history.
2. **Pack-roll listener** — uses viem's `watchContractEvent` on `PackPurchased`, rolls creatures, calls `batchMintPack` from the hot wallet.

If the hot wallet does not hold `MINTER_ROLE` when a pack is purchased, the listener logs a clear error; the buyer's purchase tx still succeeded on-chain, but minting will be retried after the role is granted.

---

## Contract Verification

Already done in Stage 9. All three contracts are verified on Sourcify with `exact_match` on creation + runtime bytecode. Basescan surfaces verified source via the "Similar Match Source Code (via Sourcify)" panel.

To re-verify (if you ever rebuild from a different commit and redeploy):
```bash
cd packages/foundry
yarn verify --network base
```
SE2's `yarn verify` defaults to Sourcify when no `ETHERSCAN_API_KEY` is set in the environment, which is what we used. No Basescan API key is required.

---

## What you own / what we hand off

| Ships in this repo | You operate |
| --- | --- |
| All Solidity source under `packages/foundry/contracts/` | The three deployed contract addresses (admin keys, role grants) |
| Foundry tests (`forge test` exits 0) | Pack catalog (`addPack`) and trait catalog (`addTrait`) — seeded via your admin key |
| Foundry deploy scripts (verified deploy) | Server hot wallet — generate, fund, rotate via your Safe |
| Frontend source under `packages/nextjs/` | Privy app + secret |
| Static frontend pinned to bgipfs (CID above) | Coinbase Onramp app id |
| Game server source under `/server/` (Postgres + WS + pack-roll) | Postgres database (managed or self-hosted) |
| `/server/scripts/seed-traits.ts` and `/server/scripts/seed-pack-pool.ts` | Server hosting (Railway / Fly.io / your own VM) |
| `.env.example` for both frontend and server | All env vars (Privy, Onramp, Alchemy, Postgres) |
| HANDOFF.md (per-stage build log) and USERJOURNEY.md (UX spec) | Frontend re-pins to bgipfs whenever env vars change (new CID per upload) |

---

## Security Notes

- **Stats are write-once on-chain.** This is non-negotiable and the centerpiece of the game's trust model. There is no "patch a bad roll" admin function. Plan accordingly.
- **Traits are append-only**, capped at 32 per token (`MAX_TRAITS_PER_TOKEN`). The `fuseTrait` function reverts with `TraitLimitReached` once a token hits 32.
- **ADAR enforces a 3-day delay** on `DEFAULT_ADMIN_ROLE` transfers (`AccessControlDefaultAdminRules`). This is intentional and protects against single-key compromise. If you want to migrate admin to a Safe, plan for the 3-day pending-transfer window.
- **Server hot wallet should be in KMS, not plaintext.** The Stage 9 docs and `/server/README.md` both call this out. The address-only auth path on the WS server is **only suitable for local dev** — never deploy without `PRIVY_APP_ID` + `PRIVY_APP_SECRET` set in production.
- **Battle resolution is server-authoritative.** The damage formula runs in `/server/src/battle-engine.ts` only; the frontend just renders. Never trust client-submitted damage values.
- **Pack randomness is server-side.** This is acceptable for v1 because stat variance is intentionally low (no "1-in-1000 mythic" roll where on-chain randomness would matter for fairness). If you want fully verifiable randomness later, swap the listener to a Chainlink VRF callback before calling `batchMintPack`.
- **Private keys NEVER go in `.env` files committed to the repo.** `.env.local` (frontend) and `.env` (server) are both `.gitignore`'d. `git check-ignore -v <path>` if unsure.
- **Funds don't sit in the shop contracts.** ETH is forwarded via call-with-value to `revenueWallet` in the same transaction; USDC is moved via `safeTransferFrom(buyer, revenueWallet, ...)` directly. There is no withdrawal admin path because there's nothing to withdraw.
- **Custom errors decode in the frontend.** The frontend ABI for `PackShop`, `TraitShop`, `AnimalKingdomCard`, plus the OZ-v5 errors emitted from inherited contracts (`AccessControlUnauthorizedAccount`, `ERC20InsufficientAllowance`, `ERC20InsufficientBalance`, `ERC721InsufficientApproval`) are all included so revert reasons surface as human-readable toasts.

---

## v1 Known Gaps

- **Real artwork is placeholder emoji.** The frontend renders a creature thumbnail using emoji per creature id; cards on Basescan show only stat metadata. Use `setImageBaseURI` (step 6 above) once you have real PNG assets.
- **AI opponents only.** The battle screen matches users against weighted-random AI decks (`/server/src/ai.ts`). PvP matchmaking is v2 work — the WS protocol already supports two-player matches but no queue/MMR system exists.
- **Privy + Onramp app ids not provisioned.** You provide your own. Both surfaces fail closed (disabled button) without keys.
- **Server not deployed.** You deploy. The frontend ships with `NEXT_PUBLIC_GAME_SERVER_WSS` empty, so the battle page renders the "not configured" empty state — every other page works.
- **USDC on Base only.** No DAI, no other stablecoin support in v1. Pack prices are denominated in ETH and USDC; trait prices are ETH-only.
- **No on-chain enumeration of the trait catalog.** TraitShop has no `getAllTraits()` — the frontend lists trait ids from a hardcoded list at build time. If you add new traits via `addTrait`, you'll need to update that list and rebuild the frontend, or extend the contract with an enumerable mapping in v2.
- **Pack catalog not pre-seeded.** Until you call `addPack`, the pack page lists nothing and `buyPack` reverts. This is an explicit client action, not a missing feature.

---

## Credits

- Built by [`clawdbotatg`](https://github.com/clawdbotatg) for [LeftClaw Services](https://leftclaw.services) Job #80, on 2026-04-29.
- Bootstrapped from [Scaffold-ETH 2](https://github.com/scaffold-eth/scaffold-eth-2) (Foundry flavor) — see `AGENTS.md` for the inherited toolchain notes.
- 14-stage build pipeline with audit + fix at every layer (contracts and frontend each get a dedicated read-only audit followed by a dedicated fix pass). Per-stage notes in [`HANDOFF.md`](./HANDOFF.md).

---

## License

MIT — see [`LICENCE`](./LICENCE).
