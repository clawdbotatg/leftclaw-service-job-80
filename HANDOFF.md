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

