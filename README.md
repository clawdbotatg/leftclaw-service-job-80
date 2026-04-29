# Animal Kingdom TCG

An onchain trading-card game on Base. Open packs to roll creatures with permanent stats, fuse cosmetic traits, build a deck, and battle the wild.

> This README is a placeholder. The full client-facing documentation (deployed contract addresses, deployment instructions, server setup, env vars) ships in the `readme` stage of the build pipeline.

## Stack

- **Smart contracts** — Foundry, deployed to Base mainnet
  - `AnimalKingdomCard` — ERC-721 with immutable rolled stats + append-only fused traits
  - `PackShop` — sells packs in ETH or USDC; emits `PackPurchased` for the off-chain pack roller to mint
  - `TraitShop` — sells trait fusions; calls `fuseTrait` on the card contract
- **Frontend** — Next.js (App Router) static export, hosted on bgipfs
  - Privy embedded wallets (email / Google / Apple) + RainbowKit fallback for crypto-native users
  - Coinbase Onramp for fiat on-ramp to ETH or USDC on Base
  - Pages: Home, Collection, Pack Shop, Deck Builder, Battle, Trait Shop, Profile
- **Game server** — `/server/` (ships in Stage 4b) — TypeScript WebSocket server for AI battles + pack rolling

## Local development

```bash
yarn install
yarn chain        # local anvil
yarn deploy       # deploy contracts to localhost
yarn start        # next dev at http://localhost:3000
```

## Build for IPFS

```bash
cd packages/nextjs
NEXT_PUBLIC_IPFS_BUILD=true NODE_OPTIONS="--require ./polyfill-localstorage.cjs" yarn build
# output in packages/nextjs/out/
```

## Frontend env vars

See `packages/nextjs/.env.example` for the full list and where to obtain each value. All are optional; missing values surface as disabled-button "not configured" states rather than crashes.

## License

MIT
