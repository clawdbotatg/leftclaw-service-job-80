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

## Stage 3 — User Journey

**Status:** PASS

**Deliverable:** `USERJOURNEY.md` at the repo root.

### What was written

A single canonical document covering all 10 flows requested in the Stage 3 spec, each with explicit happy path AND error-state tables. Every error state names the exact UX surface (Toast / inline error banner / disabled button + helper text / empty state component / modal) so Stage 4 has zero ambiguity about what to render.

The flows, in order:

1. **First-time player onboarding (Privy email/Google)** — landing → Sign Up CTA → Privy modal → embedded wallet → first-pack prompt → routed to `/pack`
2. **Crypto-native onboarding (RainbowKit)** — Connect button → wallet picker → wrong-network handled with explicit Switch button (one-step, never combined)
3. **Buying a pack with fiat (Coinbase Onramp)** — pack picker → Buy with USD → Onramp widget → KYC → card → ETH delivery → auto-buy via `buyPack`. Error states: `NEXT_PUBLIC_ONRAMP_APP_ID` missing (button disabled with helper, NOT a crash), KYC declined, payment failed, ETH delivery delayed > 2 min, USDC delivered instead of ETH (auto-falls-through to Flow 5), gas-buffer too small (auto top-up).
4. **Buying a pack with ETH** — `writeContract` `buyPack(packType)` with `value: priceWei`, mobile `writeAndOpen` 2s setTimeout, listen for `PackOpened` to drive reveal. Errors: insufficient ETH (disabled w/ helper + Buy ETH link), `PackInactive`, `EthForwardFailed`, event-never-arrives (graceful "creatures will appear" fallback).
5. **Buying a pack with USDC** — explicit two-step Approve→Buy with: spender = `PackShop` address (the same address that calls `transferFrom`), 1-block + 2s cooldown before Buy enables, allowance recheck before Buy. Errors mapped to OZ v5 custom errors `ERC20InsufficientAllowance` / `ERC20InsufficientBalance`.
6. **Building a deck** — collection grid via `tokenOfOwnerByIndex` + `tokenURI` parse, 4 tap-to-add slots, live team totals, save to localStorage. Edge cases: < 4 owned creatures (helper text disables save), duplicates allowed (Toast info), localStorage disabled (Safari Private Mode → warning Toast).
7. **Entering a battle vs AI** — explicit 5-state WS state machine: NOT_CONFIGURED (empty state, NO `new WebSocket()` ever, defends static export), CONNECTING, CONNECTED idle, CONNECTED in match, RECONNECTING (banner + auto-retry), DISCONNECTED. Action selection with Momentum secondary commit, 30s turn timer, simultaneous reveal, server-authoritative resolution. Auto-defend on timeout.
8. **Buying a trait** — TraitShop `buyTrait(tokenId, traitId)` with payable + ownership check + role-gated `fuseTrait` call. Specifically calls out the deploy-time misconfig case: TraitShop missing `TRAIT_FUSER_ROLE` → reverts with `AccessControlUnauthorizedAccount` (must be in the AnimalKingdomCard ABI for clean decode). 32-trait `MAX_TRAITS_PER_TOKEN` cap surfaced in UI.
9. **Profile / match history** — chain-derived stats + game-server-derived match log; empty states for both. `<Address/>` component for the wallet, OpenSea links built against the deployed card address.
10. **Mobile flows** — `writeAndOpen` 2-second setTimeout after every write call, RainbowKit deep-link recovery, reduced-motion fallback.

### Cross-flow invariants section

The document closes with an explicit "cross-flow invariants" section that pre-codifies every Stage-7 ship-blocker:
- Connect button is always a `<button>`, never text
- Wrong-network is one explicit Switch button, not a buried modal
- Approve buttons hold disabled through block confirmation + 2s cooldown
- USDC approve spender is exactly the PackShop address that calls `transferFrom`
- All OZ v5 custom errors are listed by name and required in the frontend ABI
- All token amounts have USD context
- No module-level `localStorage` or `new WebSocket()` (defends static export, mirrors the `_blockexplorer-disabled` defensive pattern)

### Decisions made (logged for the build)

- **Duplicates allowed in deck building.** The contract supports it and the battle engine totals just multiply; we surface a small info Toast on the second add so the user knows, but it's not blocked. Build plan does not require uniqueness.
- **Auto-buy after fiat onramp.** The fiat flow auto-fires `buyPack` once balance covers the price. User does NOT have to click again — explicit "we'll auto-buy" copy in the modal sets that expectation.
- **Auto-fall-through fiat ETH→USDC.** If Onramp delivers USDC instead of ETH (config drift), the auto-buy switches to the USDC approve+buyPackUSDC flow seamlessly with copy update only. No error.
- **Persisted pending pack purchase.** If a user closes the tab during delayed ETH delivery, we save the intent in `localStorage` and on next visit a banner offers to complete the purchase. Solves the "they paid but never got a pack" complaint.
- **5-state WS machine (vs 3 or 4).** Explicit RECONNECTING + DISCONNECTED separation; reconnects auto-retry with exponential backoff up to 30s before flipping to DISCONNECTED. Battle actions are queued client-side and replayed with `actionId` for idempotency.
- **Auto-defend on turn timeout.** Server-enforced; UI shows "Turn missed — auto-defended" so the user understands a flaky network didn't punish them.
- **`NEXT_PUBLIC_GAME_SERVER_WSS` empty is a first-class state, not a hidden bug.** Battle screen renders a clear empty-state component with link to the README. Critically, no `new WebSocket()` ever runs in this branch — the same defensive discipline as the disabled block explorer.
- **Fiat payment unavailable when `NEXT_PUBLIC_ONRAMP_APP_ID` is missing** — surfaced as a disabled button with helper text, not a crash. The crypto buttons remain active.

### Files changed

| Path | Change |
| --- | --- |
| `USERJOURNEY.md` | NEW — canonical user journey for all 10 flows |
| `HANDOFF.md` | This Stage 3 section appended |

No code, no contracts, no frontend, no deploys — Stage 4 picks those up.

### Pass/fail vs Stage 3 spec

- [x] All 10 requested flows covered with happy + error paths
- [x] Every error state names the exact UX surface (Toast / inline / disabled button / empty state)
- [x] Surface aligned with the actual contract surface in `packages/foundry/contracts/*.sol` (verified function names, payable signatures, custom errors)
- [x] Mobile `writeAndOpen` pattern documented
- [x] WS-not-configured state is a first-class branch with explicit no-WebSocket guarantee
- [x] Cross-flow invariants section pre-codifies Stage 7 ship-blockers
- [x] Committed and pushed as `clawdbotatg`

### What Stage 4 (prototype) should pick up

- USERJOURNEY.md at the repo root is the spec for what to render and how to handle errors. Build to it.
- The cross-flow invariants section is the Stage 7 audit checklist, baked in early — implement those defensively from day 1, not as fix-ups.
- The 5-state WS machine and the `NEXT_PUBLIC_GAME_SERVER_WSS` empty-state behavior is non-negotiable for static export safety. No module-level `new WebSocket()`.

---

## Stage 4a — Frontend MVP (non-battle)

**Status:** PASS (Stage 4a only — Stage 4b ships the battle screen + WS server)

**Build cmd:** `cd packages/nextjs && NEXT_PUBLIC_IPFS_BUILD=true NODE_OPTIONS="--require ./polyfill-localstorage.cjs" yarn build` — exit 0.
**Static export size:** 15M at `packages/nextjs/out/`. 12 routes prerendered.

### What was built

Six pages under `packages/nextjs/app/` (Home, Collection, Pack Shop, Deck, Traits, Profile, plus a Battle stub for Stage 4b). Provider chain: `PrivyProvider` → `QueryClientProvider` → `@privy-io/wagmi` `WagmiProvider` → `RainbowKitProvider`. When `NEXT_PUBLIC_PRIVY_APP_ID` is empty the `PrivyProvider` is **skipped entirely** (Privy's SDK throws on a placeholder app ID — we cannot pass `"placeholder-app-id-not-configured"`); the app falls back to plain wagmi + RainbowKit and the header sign-in button renders disabled. This was the only deviation from the original spec wording, recorded here as a fix.

### Files added

| Path | Purpose |
| --- | --- |
| `packages/nextjs/app/page.tsx` | Home — hero, owned-creature count for connected users, feature cards |
| `packages/nextjs/app/collection/page.tsx` | Owned creatures grid, filter by creatureId, sort by id / total / traits |
| `packages/nextjs/app/pack/page.tsx` | Pack catalog (1..5), ETH + USDC purchase flows, Onramp button, pending-purchase banner, recent CreatureMinted strip |
| `packages/nextjs/app/deck/page.tsx` | 4-slot tap-to-add deck builder with live totals, CHG counter, Active Trick, save/load to localStorage |
| `packages/nextjs/app/traits/page.tsx` | Catalog read for traitIds 1..32, modal creature picker, buyTrait flow with 32-trait cap enforcement |
| `packages/nextjs/app/profile/page.tsx` | Identity, stats, recent creatures strip, OpenSea links |
| `packages/nextjs/app/battle/page.tsx` | Stage 4b stub — "server not configured" state when `NEXT_PUBLIC_GAME_SERVER_WSS` empty, "coming soon" otherwise. NO `new WebSocket()` here |
| `packages/nextjs/app/icon.tsx` | Lion-emoji favicon via `next/og`, `dynamic = "force-static"` for static export |
| `packages/nextjs/components/PrivyLoginButton.tsx` | Always renders a button. Disabled "Sign In (unavailable)" when Privy not configured |
| `packages/nextjs/components/PrivyLoginButtonInner.tsx` | Real Privy hook consumer, only mounted when `PrivyProvider` is in the tree |
| `packages/nextjs/utils/animalKingdom.ts` | Creature emoji map, ETH/USDC formatters with USD context, Onramp URL builder, mobile UA detect |
| `packages/nextjs/hooks/useWriteAndOpen.ts` | `writeAndOpen` mobile pattern — fires write, then nudges focus with 2s delay |
| `packages/nextjs/.env.example` | Documents every env var with where to obtain each value |

### Files modified

| Path | Change |
| --- | --- |
| `packages/nextjs/scaffold.config.ts` | `targetNetworks: [chains.base]`, `appName: "Animal Kingdom TCG"`, `pollingInterval: 4000`, added `privyAppId` / `onrampAppId` / `gameServerWss` / `productionUrl` env reads, `burnerWalletMode: "disabled"` (Base mainnet only) |
| `packages/nextjs/services/web3/wagmiConfig.tsx` | `createConfig` swapped to `@privy-io/wagmi`'s drop-in (so embedded wallets register as connectors) |
| `packages/nextjs/services/web3/wagmiConnectors.tsx` | Added `phantomWallet`, `appName` swapped from `"scaffold-eth-2"` → `scaffoldConfig.appName` |
| `packages/nextjs/components/ScaffoldEthAppWithProviders.tsx` | New provider chain (Privy → wagmi → RainbowKit) with conditional fallback when Privy unconfigured |
| `packages/nextjs/components/Header.tsx` | Lion-emoji logo, project name, nav links (Collection / Pack Shop / Deck / Battle / Traits / Profile), Privy + RainbowKit buttons |
| `packages/nextjs/components/Footer.tsx` | Removed SE2 Fork-me / BuidlGuidl / Support / `nativeCurrencyPrice` badge entirely. Now: project name, year, GitHub link, Basescan card-contract link |
| `packages/nextjs/app/layout.tsx` | `next/font/google` Inter (sans) + Press_Start_2P (display) — no `<link>` tags |
| `packages/nextjs/utils/scaffold-eth/getMetadata.ts` | Title template `"%s | Animal Kingdom TCG"`, `NEXT_PUBLIC_PRODUCTION_URL` checked first for OG image absolute URL |
| `packages/nextjs/styles/globals.css` | `--radius-field: 0.5rem` in BOTH theme blocks, `.btn` border-radius `9999rem` → `0.5rem`, font CSS vars hooked to `next/font` |
| `packages/nextjs/contracts/deployedContracts.ts` | Stage-4a placeholder — ABIs from `forge build` for AnimalKingdomCard / PackShop / TraitShop at chainId 8453, addresses `0x000…000`. Stage 5 (deploy) regenerates with real addresses |
| `packages/nextjs/contracts/externalContracts.ts` | USDC on Base mainnet with full ERC-20 ABI **including OZ v5 custom errors** (`ERC20InsufficientAllowance`, `ERC20InsufficientBalance`, `ERC20InvalidSpender`, etc.) so `getParsedError` decodes reverts into human messages |
| `packages/nextjs/.env.example` | Documents Privy / Onramp / WS / Alchemy / WalletConnect env vars |
| `README.md` | Replaced SE2 README with project description (full client-facing README ships in Stage `readme`) |

### Cross-flow invariants implemented (Stage 7 ship-blockers, baked in)

- Connect Wallet always renders as a `<button>` — `RainbowKitCustomConnectButton` is unchanged from SE2 (already correct).
- Wrong-network shows the SE2 `WrongNetworkDropdown` "Switch network" button — already correct in the scaffold.
- USDC approve spender is **exactly** the deployed `PackShop` address — verified end-to-end in `app/pack/page.tsx::PackCard::handleApprove`. The same `packShopAddress` is used both for the `approve(spender, amount)` call and is the address `transferFrom` is invoked from inside `buyPackUSDC` (verified in `packages/foundry/contracts/PackShop.sol:165`).
- Approve button stays disabled through block confirmation **and** a 3-second cooldown after `useWaitForTransactionReceipt.isSuccess` flips. State-enforced — clicking is impossible during the cooldown.
- USDC ABI in `externalContracts.ts` includes **`ERC20InsufficientAllowance`** and **`ERC20InsufficientBalance`** so reverts decode cleanly via `getParsedErrorWithAllAbis`.
- All token amounts have USD context — `formatEthWithUsd` uses Coinbase's spot endpoint, `formatUsdc` is `1.00 USDC ≈ $1.00`.
- Footer: SE2 branding fully removed (Fork-me / BuidlGuidl / Support links AND the `nativeCurrencyPrice` badge). The whole `Footer.tsx` was rewritten — verified the badge does NOT render on Base mainnet (the original footer rendered it everywhere).
- Tab title template: `"%s | Animal Kingdom TCG"` (was `"%s | Scaffold-ETH 2"`).
- `appName` in `wagmiConnectors.tsx` is `"Animal Kingdom TCG"` (was `"scaffold-eth-2"`) — affects the WalletConnect modal title.
- Phantom added to RainbowKit wallet list.
- `--radius-field` set to `0.5rem` in both theme blocks (was `1rem` — note: the original CLAUDE.md referenced `9999rem` but the SE2 v2.0.15 default was actually `1rem`; the `.btn` rule was `9999rem` and that has been fixed too).
- Mobile `writeAndOpen` pattern wraps every write in `app/pack/page.tsx`, `app/traits/page.tsx`. 2s `setTimeout` after fire — focus event nudge.
- No module-level `localStorage` access. No module-level `new WebSocket()`. The Battle page reads `gameServerWss` as a string only.
- `app/_blockexplorer-disabled` rename from Stage 1 still in place — confirmed.
- `useScaffoldEventHistory.ts:132` `deployedOnBlock` cast from Stage 1 still in place — confirmed.

### Build issues encountered + fixes

1. **Privy throws on placeholder app ID.** Initial implementation passed `"placeholder-app-id-not-configured"` when env was empty. Privy SDK rejects this with `Cannot initialize the Privy provider with an invalid Privy app ID`, breaking SSG prerender. **Fix:** wrap `<PrivyProvider>` conditionally in `ScaffoldEthAppWithProviders` and skip it entirely when `privyAppId` is empty. The `PrivyLoginButton` was also split into a presence-checking outer component and a hook-using inner component so `usePrivy()` is never called outside the provider tree.
2. **Conditional Privy wallet hook violated rules of hooks.** Initial `useWriteAndOpen` tried `if (enabled) useWallets()`. **Fix:** dropped the embedded-wallet detection — the focus-nudge is harmless on embedded wallets, the cost of a missed deep-link on real mobile wallets is real. The hook now always nudges on `isMobileUserAgent()`.
3. **`app/icon.tsx` rejected by static export.** Next.js requires `export const dynamic = "force-static"` for any non-page route under `output: "export"`. **Fix:** added it to the icon module.
4. **TypeScript `Address` narrowing in localStorage object literal.** `PendingPurchase.buyer: \`0x\${string}\`` failed to assign from a `string`-narrowed prop. **Fix:** typed the field as `string` since it round-trips through JSON anyway.

### Env vars the client must set (or accept the disabled state)

| Env | Required for | If unset |
| --- | --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Email / Google sign-in + embedded wallets | Header `Sign In` button disabled with `(unavailable)` hint; RainbowKit `Connect Wallet` still works |
| `NEXT_PUBLIC_ONRAMP_APP_ID` | Coinbase Onramp button on `/pack` | "Buy with USD" button disabled with helper text pointing to cdp.coinbase.com |
| `NEXT_PUBLIC_GAME_SERVER_WSS` | Battle screen | `/battle` shows "server not configured" empty state; no WebSocket instantiated |
| `NEXT_PUBLIC_PRODUCTION_URL` | Absolute OG image URLs in social previews | Falls back to `localhost:3000` for dev metadata |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Production-grade RPC | Uses SE2's shared default key (rate-limited) |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect connector | Uses SE2's shared default ID |

### What Stage 4b should pick up

- Battle screen with the 5-state WS machine documented in USERJOURNEY.md flow 7. State must be `NOT_CONFIGURED` when `gameServerWss` is empty — no `new WebSocket()` calls module-level. All WS code in `useEffect`.
- `/server/` folder skeleton: `package.json`, `src/index.ts` (WS server), `src/battle-engine.ts`, `src/pack-roll.ts`, `src/db.ts`, `.env.example`, README explaining Railway/Fly.io deploy + role grants.
- The frontend already imports nothing from `/server/`. Battle UI will read from `wagmiConfig.gameServerWss` and connect lazily.

### Pass/fail vs Stage 4a spec

- [x] Privy + OnchainKit installed (`@privy-io/react-auth`, `@privy-io/wagmi`, `@coinbase/onchainkit`)
- [x] Provider chain wired (Privy → wagmi → RainbowKit) with graceful fallback when Privy unconfigured
- [x] `scaffold.config.ts` updated (Base mainnet, appName, pollingInterval, env reads)
- [x] `wagmiConnectors.tsx` updated (appName, Phantom)
- [x] `deployedContracts.ts` populated with placeholder addresses + real ABIs from `forge build`
- [x] All 6 pages built (Home, Collection, Pack, Deck, Traits, Profile) + Battle stub
- [x] Footer / Header / favicon / radius / tab title branding cleanup
- [x] `.env.example` documents every env var
- [x] Mobile `writeAndOpen` wrapper applied to all writes
- [x] `yarn build` exits 0, static export to `packages/nextjs/out/` (15M, 12 routes)
- [x] Committed and pushed as `clawdbotatg`

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
| `create_user_journey` (Stage 3 USERJOURNEY.md) | ✅ done | (logged by orchestrator after Stage 3 returned) |
| `prototype` (frontend MVP) | 🟡 PARTIAL — Stage 4a done (providers + 6 pages + branding); Stage 4b pending (battle screen + WS server) |  |
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

2026-04-28 by Opus subagent after Stage 4a (`prototype` — frontend MVP non-battle) completed. Edit this date when you append a new section.

