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
