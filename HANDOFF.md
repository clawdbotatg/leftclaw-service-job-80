# LeftClaw Job #80 — Animal Kingdom TCG — Handoff

This file is the living handoff between AI sessions building Job #80. Each stage appends a section.

---

## Stage 1 — Scaffold + Repo

**Status:** PASS

**Repo on disk:** `/Users/austingriffith/clawd/ethereum-servicer/builds/leftclaw-service-job-80`
**GitHub URL:** https://github.com/clawdbotatg/leftclaw-service-job-80
**Solidity framework:** Foundry
**Frontend:** Next.js (App Router) — already inside `packages/nextjs`
**SE2 version:** create-eth 2.0.15

### What was done

1. Scaffolded a fresh SE-2 project (Foundry flavor) at the path above using:
   ```
   npx create-eth@latest leftclaw-service-job-80 --skip-install -s foundry
   ```
   (run from `/Users/austingriffith/clawd/ethereum-servicer/builds`).
2. Ran `yarn install` at the project root. Yarn 4.13.0 completed with the usual non-blocking peer-dep warnings for SE-2 (react 19 vs next-themes wanting older react). Build succeeds.
3. Verified `forge build` exits 0 in `packages/foundry`. Only warnings emitted are SE-2 default lint notes (`unused-import` on `console`, `unsafe-cheatcode` on `vm.readFile` in the bundled `VerifyAll.s.sol` script). No errors.
4. Applied the SE2 footgun fixes preemptively:
   - **`packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts`** — fixed the `deployedOnBlock` typing on line 132. The scaffold uses `deployedContractData.deployedOnBlock` directly inside `BigInt(...)`; in this scaffold the type narrows to `{}` and breaks `tsc`. Replaced with an explicit cast: `((deployedContractData.deployedOnBlock as bigint | number | string | undefined) ?? 0)`.
   - **`packages/nextjs/polyfill-localstorage.cjs`** — created. This is the Node 25+ localStorage polyfill that must live inside `packages/nextjs/` because the build command runs `NODE_OPTIONS="--require ./polyfill-localstorage.cjs"` from that directory. Same content as prior builds (Job #75/#76/#77).
   - **`packages/nextjs/app/blockexplorer` → `packages/nextjs/app/_blockexplorer-disabled`** — renamed to disable the route. The block explorer touches `localStorage` at module init and crashes static export.
5. Committed footgun fixes locally and pushed. GitHub repo created via `gh repo create clawdbotatg/leftclaw-service-job-80 --public --source=. --description "..." --push`.

### Exact commands run (key ones)

```bash
# scaffold
cd /Users/austingriffith/clawd/ethereum-servicer/builds && \
  npx create-eth@latest leftclaw-service-job-80 --skip-install -s foundry

# install
cd /Users/austingriffith/clawd/ethereum-servicer/builds/leftclaw-service-job-80 && yarn install

# verify foundry compile
cd packages/foundry && forge build   # exit 0

# footgun fixes
# (1) edit packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts line ~132
# (2) write packages/nextjs/polyfill-localstorage.cjs
# (3) mv packages/nextjs/app/blockexplorer packages/nextjs/app/_blockexplorer-disabled

# commit + create remote + push (all in one block per CLAUDE.md git rules)
git config user.email "clawd@buidlguidl.com" && \
  git config user.name "clawdbotatg" && \
  git add -A && \
  git commit -m "chore: scaffold SE2 base for Job #80 — Animal Kingdom TCG" && \
  gh repo create clawdbotatg/leftclaw-service-job-80 --public --source=. \
    --description "LeftClaw Job #80 — Animal Kingdom TCG (Build)" --push
```

### Files modified vs default scaffold

| Path | Change |
| --- | --- |
| `packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts` | Type-asserted `deployedOnBlock` to fix the TS-error footgun |
| `packages/nextjs/polyfill-localstorage.cjs` | NEW — Node 25 localStorage polyfill (required for static export) |
| `packages/nextjs/app/_blockexplorer-disabled/...` | RENAMED from `packages/nextjs/app/blockexplorer/...` so the route is excluded from static export |

No contract code, no frontend page changes, no ABI edits, no deploys — those are later stages.

### Pass/fail vs Stage 1 spec

- [x] Repo exists on disk: `/Users/austingriffith/clawd/ethereum-servicer/builds/leftclaw-service-job-80`
- [x] Repo exists on GitHub: https://github.com/clawdbotatg/leftclaw-service-job-80 (verified with `gh repo view`)
- [x] `forge build` exit 0
- [x] All three footgun fixes applied
- [x] Pushed to `clawdbotatg` (HTTPS, git config set inline)

### What Stage 2 should pick up next

- Read the on-chain job description and `https://leftclaw.services/api/job/80/messages` for the TCG game design before writing contracts.
- Stage 2 = write Solidity in `packages/foundry/contracts/`, write the deploy script in `packages/foundry/script/`, run `forge build`. **Do not deploy** in Stage 2.
- The scaffold ships with `YourContract.sol` and `DeployYourContract.s.sol` as defaults — replace those with the Animal Kingdom TCG contracts.
- Owner of every deployed contract must be set to `job.client`. Resolve `job.client` by reading the LeftClaw services contract (see `~/clawd/ethereum-servicer/scripts/jobs.ts get 80`). Worker is `0x5430757ee25f25D11987B206C1789d394a779200` — never set the worker as owner.

---

## Stage 2 — Contracts (compile only)

**Status:** PASS
**Client / admin owner:** `0xFE968dE21eb0E77d5877477C31a04A3075c0086E`
**Solidity:** `^0.8.20` (compiled with solc 0.8.30 inherited from foundry)
**OpenZeppelin:** v5.6.1 (`packages/foundry/lib/openzeppelin-contracts`)

### Files added

| Path | Purpose |
| --- | --- |
| `packages/foundry/contracts/AnimalKingdomCard.sol` | ERC-721 NFT — immutable rolled stats per token + append-only fused traits + onchain JSON `tokenURI`, ERC-2981 royalties, AccessControl roles |
| `packages/foundry/contracts/PackShop.sol` | Pack vending — buy in ETH or USDC, emits `PackPurchased` for the off-chain pack-opening service to mint via `AnimalKingdomCard.batchMintPack` |
| `packages/foundry/contracts/TraitShop.sol` | Trait vending — buyer pays ETH, contract verifies token ownership, forwards funds, calls `fuseTrait` on the card contract |
| `packages/foundry/test/Test_AnimalKingdomCard.t.sol` | Foundry smoke test — 15 cases covering mint / batch / fuse / role gating / royalty / tokenURI |

`packages/foundry/contracts/YourContract.sol`, `packages/foundry/script/DeployYourContract.s.sol`, `packages/foundry/script/Deploy.s.sol`, and `packages/foundry/test/YourContract.t.sol` are **untouched** — Stage 5 will add a new deploy script (`DeployAnimalKingdom.s.sol`) and update `Deploy.s.sol`.

### `AnimalKingdomCard.sol` — public surface

Inherits: `ERC721`, `ERC721Enumerable`, `AccessControl`, `ERC2981`, `Ownable2Step`.

Roles:
- `DEFAULT_ADMIN_ROLE` — rotates other roles. Granted to `admin` (= `job.client`) at construction.
- `MINTER_ROLE = keccak256("MINTER_ROLE")` — gates minting. Granted to `admin` at construction.
- `TRAIT_FUSER_ROLE = keccak256("TRAIT_FUSER_ROLE")` — gates `fuseTrait`. Granted to `admin` at construction. **At deploy time, also grant this role to the deployed `TraitShop` address — see Stage 5 setup.**

Storage:
- `mapping(uint256 => CreatureStats) public stats` — written exactly once per token at mint, no mutation path exists.
- `mapping(uint256 => uint256[]) public traits` — append-only, capped at `MAX_TRAITS_PER_TOKEN = 32`.
- `string public imageBaseURI` — set by owner; used to compose `{base}{creatureId}.png` inside `tokenURI`.
- `uint256 private _nextTokenId` — starts at 1.

Constants:
- `MAX_PACK_SIZE = 10` — bound on `batchMintPack` array length.
- `MAX_TRAITS_PER_TOKEN = 32` — bound on per-token trait array growth.

Functions:
- `constructor(address admin)` — grants admin DEFAULT_ADMIN_ROLE / MINTER_ROLE / TRAIT_FUSER_ROLE, sets `Ownable2Step` owner = admin, sets default royalty to (admin, 500 bps = 5%).
- `mintCreature(address to, uint8 creatureId, uint8 atk, uint8 def, uint8 chg, uint8 trk) onlyRole(MINTER_ROLE) returns (uint256)` — write stats once, `_safeMint`, emit `CreatureMinted`.
- `batchMintPack(address to, CreatureStats[] calldata creatures) onlyRole(MINTER_ROLE) returns (uint256[])` — bounded loop (`MAX_PACK_SIZE`), one `CreatureMinted` per token, one final `PackOpened`.
- `fuseTrait(uint256 tokenId, uint256 traitId) onlyRole(TRAIT_FUSER_ROLE)` — append-only; reverts `NonexistentToken` if token does not exist; reverts `TraitLimitReached` if `>= 32` traits.
- `traitCount(uint256)` / `getTraits(uint256)` — view helpers (the auto-generated `traits(uint256, uint256)` mapping accessor only returns one element at a time).
- `tokenURI(uint256)` — base64 data URI containing JSON with name / description / image (composed from `imageBaseURI + creatureId + ".png"`) / stats / traits / OpenSea `attributes` array. Implementation is split into `_buildJson` / `_headerJson` / `_statsJson` / `_tailJson` / `_traitsArrayJson` / `_attributesJson` to avoid stack-too-deep without `via_ir`.
- `setImageBaseURI(string) onlyOwner`.
- `setDefaultRoyalty(address receiver, uint96 feeBps) onlyOwner` — wraps OZ `_setDefaultRoyalty`.
- `deleteDefaultRoyalty() onlyOwner` — wraps OZ `_deleteDefaultRoyalty`.
- `royaltyInfo(uint256, uint256)` — inherited from ERC2981.
- `_update`, `_increaseBalance`, `supportsInterface` — overrides composing ERC721 / ERC721Enumerable / AccessControl / ERC2981.

Events: `CreatureMinted`, `PackOpened`, `TraitFused`, `ImageBaseURIUpdated`, `DefaultRoyaltyUpdated`.

### `PackShop.sol` — public surface

Inherits: `Ownable2Step`, `ReentrancyGuard`. Uses `SafeERC20` for the USDC pull.

Storage:
- `mapping(uint8 => PackType) public packs` where `PackType { uint256 priceWei; uint256 priceUsdc; bool active; string name; }`.
- `mapping(address => uint256) public buyerNonce` — per-buyer monotonic nonce so two same-block purchases produce different `requestId`s.
- `address public immutable usdc` — Base mainnet USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Set in constructor.
- `address public revenueWallet` — initial value = `admin`. Owner-mutable.

Functions:
- `constructor(address admin, address usdcToken)` — `Ownable(admin)`, sets `usdc` and `revenueWallet`.
- `addPack(uint8 packType, uint256 priceWei, uint256 priceUsdc, string name) onlyOwner` — replaces or creates a pack and activates it. `priceWei == 0` disables ETH purchases for that pack; `priceUsdc == 0` disables USDC purchases.
- `setPackActive(uint8 packType, bool active) onlyOwner`.
- `setRevenueWallet(address) onlyOwner`.
- `buyPack(uint8 packType) external payable nonReentrant` — checks active + price; bumps nonce; emits `PackPurchased(buyer, packType, requestId)` where `requestId = keccak256(abi.encodePacked(buyer, packType, block.number, address(this), nonce))`; **forwards `priceWei` to `revenueWallet` via low-level `call` immediately** then refunds excess to buyer (CEI: nonce + event before transfers).
- `buyPackUSDC(uint8 packType) external nonReentrant` — pulls `priceUsdc` USDC from buyer **directly to `revenueWallet`** via `safeTransferFrom`. Same `PackPurchased` event.
- `sweepEth() onlyOwner` / `sweepToken(IERC20 token) onlyOwner` — defensive recovery; funds normally do not accumulate here.
- `getPack(uint8) view` — returns the full struct (auto-getter in Solidity unpacks fields in the public mapping accessor; this returns the struct in one call).

Events: `PackPurchased`, `PackUpdated`, `PackActiveChanged`, `RevenueWalletUpdated`, `EthSwept`, `TokenSwept`.

**No mint logic in this contract** — it is purely a payment + event source. The off-chain pack-opening service watches `PackPurchased` and calls `AnimalKingdomCard.batchMintPack` from a wallet holding `MINTER_ROLE`.

### `TraitShop.sol` — public surface

Inherits: `Ownable2Step`, `ReentrancyGuard`. Uses `SafeERC20` (only used by `sweepToken`). References the card contract via a minimal `IAnimalKingdomCardFuser` interface (`fuseTrait(uint256,uint256)`).

Storage:
- `mapping(uint256 => TraitInfo) public traitCatalog` where `TraitInfo { uint256 priceWei; bool available; string metadataURI; }`.
- `address public card` — AnimalKingdomCard address; constructor-set, owner-mutable via `setCard`.
- `address public revenueWallet` — initial value = `admin`. Owner-mutable.

Functions:
- `constructor(address admin, address cardAddr)` — `Ownable(admin)`, sets `card` and `revenueWallet`.
- `addTrait(uint256 traitId, uint256 priceWei, string metadataURI) onlyOwner`.
- `setTraitAvailable(uint256 traitId, bool available) onlyOwner`.
- `setRevenueWallet(address) onlyOwner`.
- `setCard(address) onlyOwner` — for migrations.
- `buyTrait(uint256 tokenId, uint256 traitId) external payable nonReentrant` — verifies `IERC721(card).ownerOf(tokenId) == msg.sender`, verifies trait is available, checks `msg.value >= priceWei`, emits `TraitPurchased`, calls `fuseTrait` on the card, forwards `priceWei` to `revenueWallet`, refunds excess.
- `sweepEth() onlyOwner` / `sweepToken(IERC20) onlyOwner` — defensive.
- `getTrait(uint256) view` — full struct.

Events: `TraitPurchased`, `TraitAdded`, `TraitAvailabilityChanged`, `RevenueWalletUpdated`, `CardUpdated`, `EthSwept`, `TokenSwept`.

### Security notes

- **Stats are write-once.** No function on `AnimalKingdomCard` mutates `stats` post-mint. This is the core onchain trust guarantee promised in the build plan and is non-negotiable.
- **Traits are append-only.** No remove or replace. Capped at `MAX_TRAITS_PER_TOKEN = 32` to prevent unbounded growth that would break `tokenURI` gas budgets.
- **Pack size is bounded.** `batchMintPack` reverts on `> MAX_PACK_SIZE = 10` to prevent unbounded loops.
- **Role rotation.** Admin (`job.client`) holds DEFAULT_ADMIN_ROLE and can grant / revoke MINTER_ROLE and TRAIT_FUSER_ROLE. The plan is for admin to rotate these to operational hot wallets / Safe at deploy time.
- **Ownable2Step.** Used on all three contracts. Owner change requires a two-step accept on `transferOwnership` → `acceptOwnership`, eliminating typos.
- **Fund forwarding.** Both PackShop ETH purchases and TraitShop ETH purchases forward to `revenueWallet` immediately in the same call (low-level `call`). USDC purchases use `safeTransferFrom(buyer, revenueWallet, amount)` directly — funds never sit in the shop. Sweep functions exist as defensive recovery only.
- **CEI pattern.** PackShop / TraitShop write all storage effects (nonce bump, event emit) before external transfers. Both are `nonReentrant`.
- **Refunds.** `buyPack` and `buyTrait` refund `msg.value - priceWei` to the buyer on overpayment.
- **`requestId` uniqueness.** Includes buyer, pack type, block number, the shop address, and a per-buyer monotonic `buyerNonce` so two purchases by the same buyer in the same block produce different ids.
- **TraitShop privilege requirement (deploy-time setup).** TraitShop must hold `TRAIT_FUSER_ROLE` on the deployed `AnimalKingdomCard` for `buyTrait` to succeed. Stage 5 deploy script must call `card.grantRole(card.TRAIT_FUSER_ROLE(), traitShopAddress)` after both contracts are deployed. Document this clearly in the deploy script.
- **Ownership.** All three contracts set `admin = job.client = 0xFE968dE21eb0E77d5877477C31a04A3075c0086E` as Ownable2Step owner and (on the card) DEFAULT_ADMIN_ROLE / MINTER_ROLE / TRAIT_FUSER_ROLE. Worker `0x5430757ee25f25D11987B206C1789d394a779200` must NOT be set as owner anywhere.

### Stack-too-deep note

The first compile attempt of `tokenURI` failed with a Yul stack-too-deep error because of the long single-expression `abi.encodePacked` containing all metadata fields plus the inline traits / attributes JSON. Solved by splitting into `_buildJson` / `_headerJson` / `_statsJson` / `_tailJson` private helpers — each helper has a small enough stack frame that solc 0.8.30 with `optimizer_runs = 200` compiles cleanly without `via_ir`. **No `foundry.toml` change needed.** Recorded here as a reference for any future Stage-4 fix work that touches `tokenURI`.

### Compile + test outcomes

```
$ cd packages/foundry && forge build --force
Compiling 36 files with Solc 0.8.30
Compiler run successful with warnings:
  Warning (6321) script/VerifyAll.s.sol:190 (pre-existing scaffold warning)
  Warning (2018) script/VerifyAll.s.sol:186 (pre-existing scaffold warning)
exit 0

$ forge test
Ran 2 test suites: 16 tests passed, 0 failed, 0 skipped
  test/Test_AnimalKingdomCard.t.sol::TestAnimalKingdomCard — 15 passed
  test/YourContract.t.sol::YourContractTest — 1 passed (pre-existing)
exit 0
```

Forge-lint informational notes were also emitted (`mixed-case-function` on `buyPackUSDC`, `asm-keccak256` on PackShop's `requestId` hashing). These are style suggestions, not errors or warnings. `buyPackUSDC` matches the build-plan spec verbatim and is intentionally kept.

### What Stage 3 (audit) should pick up

- Three contracts under `packages/foundry/contracts/`: `AnimalKingdomCard.sol`, `PackShop.sol`, `TraitShop.sol`.
- Smoke tests under `packages/foundry/test/Test_AnimalKingdomCard.t.sol` — read these to understand intended behavior; do NOT treat them as the audit target.
- Audit per `https://ethskills.com/audit/SKILL.md`. Focus areas: write-once stats invariant, append-only traits invariant, bounded loops (`MAX_PACK_SIZE`, `MAX_TRAITS_PER_TOKEN`), CEI / reentrancy on payable functions, refund safety, role gating, deploy-time TRAIT_FUSER_ROLE requirement on TraitShop, ERC-2981 default royalty, `tokenURI` gas under maxed-out trait counts.
- Stage 3 must NOT modify any files. Report findings only — Stage 4 fixes them.

---

# 📋 PICK-UP-AND-CONTINUE GUIDE FOR THE NEXT AI SESSION

**Read this section first if you're a new Claude Code session inheriting this build.**

## You are

The CLAWD `clawdbotatg` worker bot continuing LeftClaw Job #80. Identity, RPC rules, and bgipfs rules in `~/clawd/ethereum-servicer/CLAUDE.md` and `~/.claude/CLAUDE.md` — read both before doing anything.

## Where things are

| Thing | Location |
| --- | --- |
| Repo on disk | `/Users/austingriffith/clawd/ethereum-servicer/builds/leftclaw-service-job-80` |
| Repo on GitHub | https://github.com/clawdbotatg/leftclaw-service-job-80 |
| LeftClaw servicer (home of `scripts/jobs.ts`, `scripts/work.ts`, `.env`) | `/Users/austingriffith/clawd/ethereum-servicer/` |
| Job description (build-plan.md) | On-chain — read with `npx tsx scripts/jobs.ts get 80` |
| Worker wallet | `0x5430757ee25f25D11987B206C1789d394a779200` |
| Client wallet (= every contract owner) | `0xFE968dE21eb0E77d5877477C31a04A3075c0086E` |
| Service contract | `0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a` on Base 8453 |

## Where we are

| Stage | Status | logWork tx |
| --- | --- | --- |
| acceptJob | ✅ done | `0xdb274ff2d246283b5f88d613d9092f3c05f26b083ff9161ea98a4e407f8c78c1` |
| `create_repo` (Stage 1) | ✅ done | `0xdcb54d09c7564692fe158ae309e9fba63083718a298e84651cef586bb6312730` |
| `create_plan` (Stage 2 contracts compile) | ✅ done | `0xa3a60b30730f3efd7073e1ca5b6632bf1a04e457bcee5ed1018ff11519b878ef` |
| `create_user_journey` | ⏭ next |  |
| `prototype` (frontend MVP) |  |  |
| `contract_audit` |  |  |
| `contract_fix` |  |  |
| `frontend_audit` |  |  |
| `frontend_fix` |  |  |
| `full_audit` / `full_audit_fix` |  |  |
| `deploy_contract` |  |  |
| `livecontract_fix` |  |  |
| `deploy_app` (bgipfs) |  |  |
| `liveapp_fix` |  |  |
| `liveuserjourney` |  |  |
| `readme` |  |  |
| `ready` + `completeJob` |  |  |

Confirm on-chain: `npx tsx scripts/jobs.ts get 80` (look at `Stage` field) before moving forward — don't trust this table alone.

## Architecture decisions already locked in

These were the user-confirmed scope decisions before accepting the job. Do NOT redo them, do NOT ask Opus to redo them — they're committed:

1. **Three contracts on Base mainnet** (`AnimalKingdomCard`, `PackShop`, `TraitShop`) — all owned by `job.client`. Already written + compiled in Stage 2.
2. **Frontend on bgipfs only** (per CLAUDE.md). Static export. No Vercel.
3. **WebSocket game server is documented, not deployed.** It lives in `/server/` inside the repo and the README hands it off to the client to run on Railway/Fly.io. The frontend has a configurable `NEXT_PUBLIC_GAME_SERVER_WSS` env var; if unset, the battle screen shows a "server not configured" state instead of crashing.
4. **Privy + Coinbase Onramp are integrated in the frontend** (config-driven via `NEXT_PUBLIC_PRIVY_APP_ID` and the Onramp app key). Client supplies their own keys via `.env`; we ship `.env.example` only.
5. **Server-side hot wallet** (MINTER_ROLE / TRAIT_FUSER_ROLE recipient) is **not generated by us**. We document the deploy-time role-grant procedure; client rotates roles to their own KMS wallet later. At initial deploy, all roles = client.
6. **TraitShop must be granted TRAIT_FUSER_ROLE on AnimalKingdomCard at deploy time.** Stage 5 deploy script must do this.
7. **AI opponents only in v1.** PvP matchmaking is out of scope; documented in README as v2 work.
8. **Battle engine logic lives in the WS server source we ship**, not in the frontend.

## Scope to deliver vs explicitly out of scope

| In scope (you must build) | Out of scope (document only) |
| --- | --- |
| 3 contracts deployed + verified | Running the WS server |
| Static SE2 frontend on bgipfs | Setting up the client's KMS hot wallet |
| Pages: Home, Collection, Pack Shop (Onramp + crypto), Deck Builder, Trait Shop, Profile | PvP matchmaking |
| Battle screen UI present, WS-URL-configurable, with disabled state if no server | Coinbase Onramp account ownership (client-side widget only) |
| Privy embedded wallets + RainbowKit fallback | Persistent player accounts (Privy handles, server stores cache) |
| WS server source (`/server/`) + Postgres schema + setup README | Hosting Privy / Onramp / Postgres |
| OG image, README, .env.example for both `nextjs` and `server` |  |

## Remaining stages — Opus prompt templates

Each stage = one Opus subagent invocation. **Never combine stages.** Always update HANDOFF.md from inside the subagent. Always commit + push at the end of each stage. Always `logWork` on-chain after the subagent returns.

### Stage 3 — `create_user_journey`

```
You are Opus. Stage 3 for LeftClaw Job #80.

Read first:
- /Users/austingriffith/clawd/ethereum-servicer/CLAUDE.md
- /Users/austingriffith/clawd/ethereum-servicer/builds/leftclaw-service-job-80/HANDOFF.md
- the job description: cd /Users/austingriffith/clawd/ethereum-servicer && npx tsx scripts/jobs.ts get 80

Write USERJOURNEY.md at the repo root covering, step-by-step:
- New player onboarding: open site → Privy email signup → embedded wallet created → first pack opened
- Crypto-native player onboarding: connect external wallet via RainbowKit
- Buying a pack with fiat (Coinbase Onramp) — full flow with error states (KYC, payment fail, network mismatch)
- Buying a pack with ETH and with USDC — approve flow, confirmation, mint reveal
- Building a deck from the collection
- Entering a battle vs AI — connection states (WS up, WS down, server URL not configured)
- Buying a trait, seeing it fused
- Mobile deep-linking flows (writeAndOpen pattern)

Cover error scenarios: insufficient ETH/USDC, wrong network, allowance not set, WS reconnect, mint event delayed.

Append a Stage 3 section to HANDOFF.md. Commit + push as clawdbotatg.
Stop conditions: do not write code, do not edit contracts, do not deploy.
```

### Stage 4 — `prototype` (frontend MVP)

This is the largest stage. Split it across multiple Opus invocations if needed — Opus has a 200K context window, this UI is large.

```
You are Opus. Stage 4 (prototype) for LeftClaw Job #80.

Read first:
- /Users/austingriffith/clawd/ethereum-servicer/CLAUDE.md (footguns)
- /Users/austingriffith/clawd/ethereum-servicer/builds/leftclaw-service-job-80/HANDOFF.md
- repo's AGENTS.md (SE2 conventions, hook names, ~~ alias)
- packages/foundry/contracts/*.sol (so the UI matches the actual ABIs we'll deploy)
- USERJOURNEY.md

Build the frontend:
1) Install: @privy-io/react-auth, @coinbase/onchainkit (for Onramp), @tanstack/react-query is already in SE2.
2) Wrap providers in app/providers.tsx (or scaffold-eth-app.tsx): Privy first, then wagmi/RainbowKit so Privy's embedded wallet works alongside external connectors.
3) scaffold.config.ts: targetNetworks=[chains.base], appName="Animal Kingdom TCG".
4) Pages (under app/, App Router):
   - / (Home) — collection summary + quick play CTA
   - /collection — grid of owned creatures via tokenOfOwnerByIndex paged + tokenURI parse
   - /pack — Pack Shop. Two payment paths: ETH (writeContract buyPack) and USDC (approve → buyPackUSDC). Coinbase Onramp button for fiat. Listen for PackPurchased event on the user's address; show a 5-second optimistic "rolling..." animation, then watch CreatureMinted for the resulting tokenIds.
   - /deck — drag-to-slot or tap-to-add 4-creature deck builder. Live total ATK/DEF/CHG/TRK. Save in localStorage.
   - /battle — connect to NEXT_PUBLIC_GAME_SERVER_WSS (env-configurable). If not set, show a clear "Server not configured — contact game admin" state. Battle UI: HP bars, Momentum, Action buttons (Attack/Defend/Charge), simultaneous reveal.
   - /traits — trait catalog (read from TraitShop.traitCatalog), preview, buyTrait flow.
   - /profile — match history (from server), owned creatures, link to OpenSea collection.
5) Use ONLY hooks from packages/nextjs/hooks/scaffold-eth.
6) ALL token amounts shown WITH USD context where possible (Coinbase price API or off-chain fetch). Pack ETH price next to USD equivalent.
7) Branding cleanup (ship-blockers from CLAUDE.md):
   - Remove SE2 footer (Fork me, BuidlGuidl, Support, nativeCurrencyPrice badge in Footer.tsx).
   - Layout title → "%s | Animal Kingdom TCG" (or just "%s").
   - Replace favicon (use a creature silhouette).
   - Replace README with project-specific content (Stage readme will fill it out fully later — placeholder OK now).
   - appName in wagmiConnectors.tsx → "Animal Kingdom TCG".
   - Add Phantom to RainbowKit wallet list.
   - --radius-field 9999rem → 0.5rem in both globals.css theme blocks.
8) Mobile deep linking: writeAndOpen pattern — fire TX first, setTimeout(openWallet, 2000).
9) Scaffold a /server/ folder at repo root with: package.json, src/index.ts (WS server skeleton), src/battle-engine.ts (turn loop + damage formula from build-plan), src/pack-roll.ts (event listener + batchMintPack call), src/db.ts (Postgres schema migrations), .env.example, README.md. The README must explain: how to deploy on Railway/Fly.io, how to fund the hot wallet, how to grant MINTER_ROLE to the hot wallet, how to seed the pack pool / trait catalog, and how to set NEXT_PUBLIC_GAME_SERVER_WSS in the frontend .env.

Run: cd packages/nextjs && yarn build (must exit 0). Static export to packages/nextjs/out/.

Append a Stage 4 section to HANDOFF.md. Commit + push as clawdbotatg.

Stop conditions: do not deploy contracts, do not bgipfs upload, do not modify contract source.
```

### Stage 5 — `contract_audit`

```
You are Opus. Stage 5 (contract_audit) for LeftClaw Job #80.

Audit the three contracts at packages/foundry/contracts/ following https://ethskills.com/audit/SKILL.md exactly.

Read the SKILL.md, then read each contract end-to-end. For each finding, file a GitHub issue on clawdbotatg/leftclaw-service-job-80 with labels `job-80` and `contract-audit`. Include severity (Critical/High/Medium/Low/Info), location (file + line), description, recommended fix.

Specific concerns from Stage 2 to verify:
- Is `tokenURI` actually safe under MAX_TRAITS_PER_TOKEN=32 traits? Compute gas.
- Is `requestId` collision-resistant given block.number + buyer + nonce? (we deliberately exclude block.timestamp; verify this is fine)
- Is `_safeMint` reentrancy in batchMintPack a problem? (CEI: stats written before _safeMint? verify)
- ERC721Enumerable + role rotation — any way to brick the contract by revoking DEFAULT_ADMIN_ROLE from sole admin?
- TraitShop's call into AnimalKingdomCard.fuseTrait — what if card is later replaced via setCard to a malicious contract? (admin-only, but still worth flagging)

Stop conditions: do not modify any source file. Do not close issues. Audit-only.

Append a Stage 5 section to HANDOFF.md with finding counts by severity and a list of issue URLs. Commit + push.
```

### Stage 6 — `contract_fix`

```
You are Opus. Stage 6 (contract_fix) for LeftClaw Job #80.

Read every open issue with labels `job-80` + `contract-audit` (gh issue list --label "job-80" --label "contract-audit" --state open).

Fix every Critical and High finding. Fix Medium findings unless the fix would change the architecture meaningfully (in which case, comment on the issue and leave open with rationale).

After each fix:
- Update the contract
- Run `forge build` and `forge test` — both must exit 0
- Reference the issue in the commit message ("fix: <issue title> (closes #N)")
- gh issue close N

Append a Stage 6 section to HANDOFF.md listing every issue, status (fixed / wontfix + reason), commit hash. Commit + push.

Stop conditions: do not deploy.
```

### Stage 7 — `frontend_audit`

```
You are Opus. Stage 7 (frontend_audit) for LeftClaw Job #80.

Audit the frontend per https://ethskills.com/qa/SKILL.md.

CRITICAL: do NOT pattern-match. TRACE every write flow with real values. Quoting CLAUDE.md verbatim:
- For every token approval flow: what address is passed to approve()? What contract calls transferFrom()? Are they the same?
- For every external contract call: enumerate every error type that contract can throw. Verify every error is in the ABI used by the frontend. OZ v5 uses custom errors (ERC20InsufficientAllowance, ERC721InsufficientApproval, etc.) — they will not decode without explicit ABI entries.
- A try/catch + getParsedError is NOT "errors mapped" unless the ABI covers all errors in the call chain.

Ship-blockers (must all PASS) from CLAUDE.md Stage 7 section:
- Wallet connect shows a button, not text
- Wrong network shows a Switch button (one-at-a-time flow)
- Approve button stays disabled through block confirmation + cooldown
- Approve flow traced end-to-end (USDC.approve(PackShop) → PackShop.transferFrom(buyer))
- Contracts verified on Basescan (Stage 9 will do this; here just check Stage 8 didn't break the verify path)
- SE2 branding fully removed (Fork me, BuidlGuidl, Support, nativeCurrencyPrice badge in Footer.tsx ALL networks)
- Tab title: "%s | Scaffold-ETH 2" → "%s"
- README replaced (will be done in stage `readme`)
- Favicon replaced

Should-fix items: Address component, OG image absolute URL, --radius-field 0.5rem, USD context on token amounts, error mapping ABI coverage, Phantom in RainbowKit, writeAndOpen mobile pattern, appName in wagmiConnectors.

File issues with labels `job-80` + `frontend-audit`. Append Stage 7 section to HANDOFF.md.
Stop conditions: audit only, no fixes.
```

### Stage 8 — `frontend_fix`

```
You are Opus. Stage 8 (frontend_fix) for LeftClaw Job #80.

Fix every open issue labeled `job-80` + `frontend-audit`. After each, run `cd packages/nextjs && yarn build` and verify it still exits 0.

Append Stage 8 section to HANDOFF.md. Commit + push.
Stop conditions: do not deploy contracts, do not bgipfs upload.
```

### Stage 9 — `deploy_contract`

```
You are Opus. Stage 9 (deploy_contract) for LeftClaw Job #80.

Read /Users/austingriffith/clawd/ethereum-servicer/CLAUDE.md (deploy footguns).

1) Verify .env at /Users/austingriffith/clawd/ethereum-servicer/.env has PRIVATE_KEY and ALCHEMY_RPC_URL. Worker has Base mainnet ETH for gas (verify with `cast balance $WORKER --rpc-url $ALCHEMY_RPC_URL`).

2) Write packages/foundry/script/DeployAnimalKingdom.s.sol that:
   a) Reads `CLIENT_ADDRESS` env var (default to 0xFE968dE21eb0E77d5877477C31a04A3075c0086E for this job).
   b) Deploys AnimalKingdomCard(client).
   c) Deploys PackShop(client, USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
   d) Deploys TraitShop(client, address(card)).
   e) Calls card.grantRole(card.TRAIT_FUSER_ROLE(), address(traitShop)) so TraitShop can fuse traits.
   f) (Optional) Seeds an initial pack via packShop.addPack(...) with a sane default. If you do this, document it in HANDOFF.
   Do NOT seed the trait catalog — leave that to the client.

3) Update packages/foundry/script/Deploy.s.sol to invoke DeployAnimalKingdom only. Remove the YourContract default deploy.

4) Run from the repo root:
   yarn deploy --network base
   This auto-generates packages/nextjs/contracts/deployedContracts.ts. Confirm it has all three contracts at chainId 8453.

5) yarn verify --network base — wait for green checkmarks on Basescan for all three. (No API key required per SE2 built-in verify.)

6) Smoke test against the live contracts:
   - Read packShop.owner() = client
   - Read card.owner() = client
   - Read card.hasRole(TRAIT_FUSER_ROLE, traitShop) = true
   - Read traitShop.card() = address(card)

Append Stage 9 section to HANDOFF.md with deployed addresses + Basescan verification links. Commit + push.

Stop conditions: do not write frontend code, do not deploy frontend.
```

### Stage 10 — `livecontract_fix`

Likely empty for this build, but the pipeline expects it. If smoke tests pass, log it and move on.

### Stage 11 — `deploy_app` (bgipfs)

```
You are Opus. Stage 11 (deploy_app) for LeftClaw Job #80.

Pre-flight:
- Confirm packages/nextjs/contracts/deployedContracts.ts has the three Base addresses (Stage 9 wrote these).
- cd packages/nextjs && yarn build — exit 0, output at packages/nextjs/out/.
- Verify no localStorage-at-import-time crashes (the _blockexplorer-disabled rename should prevent this; double-check by grepping for uses of localStorage at module level).

Init bgipfs ONCE per machine (skip if already done): 
  npx bgipfs upload config init -k $BGIPFS_TOKEN -u https://upload.bgipfs.com

Upload:
  cd packages/nextjs && npx bgipfs upload out

Capture the new CID. Build the URL: https://<CID>.ipfs.community.bgipfs.com/

curl -I https://<CID>.ipfs.community.bgipfs.com/ — must be 200.

Critical check: confirm CID is different from any prior upload CID (none expected here, but always check).

Append Stage 11 section to HANDOFF.md with the CID + live URL. Commit + push.
Stop conditions: do not call completeJob yet.
```

### Stage 12 — `liveapp_fix` and `liveuserjourney`

Walk through USERJOURNEY.md as a real user (use a fresh browser, the worker wallet, and a tiny amount of ETH/USDC). Note any failures, file `job-80` + `liveuserjourney` issues, fix with another Opus pass, redeploy frontend if needed (NEW CID — verify it changed).

### Stage 13 — `readme`

```
You are Opus. Stage 13 (readme) for LeftClaw Job #80.

Replace README.md at the repo root with comprehensive client-facing docs:
- What the app is, link to live URL
- Deployed contract addresses (Base mainnet) with Basescan links
- Architecture diagram (text-based)
- Frontend env vars: NEXT_PUBLIC_PRIVY_APP_ID, NEXT_PUBLIC_GAME_SERVER_WSS, NEXT_PUBLIC_ONRAMP_APP_ID — what each does, how the client gets one
- Server setup section: how to deploy /server/ on Railway/Fly.io, what env vars it needs, how to fund the hot wallet, how to grantRole MINTER_ROLE + TRAIT_FUSER_ROLE to the hot wallet (cast send commands), how to seed the pack pool, how to seed the trait catalog
- Database setup: Postgres schema, migrations
- "What you own / what we hand off" table per CLAUDE.md
- Local dev: yarn chain, yarn deploy --network localhost, yarn start
- Verification: yarn verify --network base (no API key needed)
- Security notes: never commit private keys, never share mnemonic, etc.

Append Stage 13 section to HANDOFF.md.
Commit + push.
```

### Stage 14 — `ready` + `completeJob`

```bash
# Final on-chain steps. Do these manually in the orchestrator (Sonnet), NOT inside an Opus subagent.

cd /Users/austingriffith/clawd/ethereum-servicer
npx tsx scripts/work.ts log 80 "Stage X complete: ..." readme
npx tsx scripts/work.ts log 80 "ready: live at https://<CID>.ipfs.community.bgipfs.com/" ready
npx tsx scripts/work.ts complete 80 "https://<CID>.ipfs.community.bgipfs.com/"

# Verify on-chain status flipped to COMPLETE:
npx tsx scripts/jobs.ts get 80
```

If `completeJob` returns success but status doesn't flip to COMPLETE, that's the same on-chain anomaly we saw on Job #79 — flag to the user, don't try to "fix" it by re-calling.

## Known risks specific to this build

1. **Privy + RainbowKit provider order matters.** Privy must wrap before wagmi or the embedded wallet won't show up in the wallet list. Test on a fresh Chrome profile with no extensions.
2. **Coinbase Onramp app ID is required.** Without one, the Onramp button must show a "fiat purchase requires admin setup" state — don't crash.
3. **PackShop USDC path requires explicit USDC approve first.** Standard ERC-20 approve flow. Test with 0 → some → max → 0 sequence.
4. **`tokenURI` gas under 32 traits is unverified.** Stage 5 audit must verify. If it's too expensive, drop MAX_TRAITS_PER_TOKEN to 16 and re-audit.
5. **Battle screen with no WS server.** When `NEXT_PUBLIC_GAME_SERVER_WSS` is empty, the battle button must be disabled with explanatory text. Do NOT let the WS code throw at module-init time — that breaks static export the way the block explorer did.
6. **Privy app ID, Onramp app ID, WS URL all flow through `.env.example`** — never commit real values. Per CLAUDE.md: "NEVER Put Private Keys or Secrets in Client Projects".
7. **bgipfs CID rotation.** Every frontend redeploy mints a new CID. Verify it changed before claiming "deployed" — uploading the same `out/` produces the same CID, which means you didn't actually rebuild.
8. **completeJob anomaly on Job #79** — status didn't flip even though tx succeeded. If it happens again, this is a contract-level issue, not a worker bug.

## How to invoke each stage

The orchestrator (Sonnet) does NOT write code. Each stage:

1. Read the on-chain `Stage` field via `npx tsx scripts/jobs.ts get 80` to confirm where you are.
2. Spawn one Opus subagent with the stage's prompt template above. Wait for it to return.
3. Verify the stage actually passed (build clean, tests pass, etc.) — don't trust the subagent's self-report alone.
4. `npx tsx scripts/work.ts log 80 "<note>" <stage-name>` to advance the on-chain stage.
5. Move to the next stage.

If a stage fails, do not advance the on-chain stage. Spawn a new Opus pass with the failure context appended to the prompt.

## Last updated

2026-04-28 by Sonnet orchestrator after Stage 2 completed. Edit this date when you append a new section.

