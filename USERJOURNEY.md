# Animal Kingdom TCG — User Journey

This document is the canonical step-by-step description of every user-facing flow in the app. It exists so the frontend implementation (Stage 4) and the QA pass (Stage 7) have one source of truth for "what the user sees, in what order, and what happens when something goes wrong".

Every flow is written as: trigger → happy-path steps → branching error states → exact UX component used to surface each error.

**Key context the journey is written against:**

- Network: Base mainnet (chainId 8453). Privy + RainbowKit are configured for Base only. Any other chain is "wrong network".
- Currency surfaces: ETH and USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`). Pack prices have BOTH `priceWei` and `priceUsdc` fields per pack type — either can be 0 to disable that path. Trait prices are ETH only.
- Three deployed contracts: `AnimalKingdomCard` (ERC-721), `PackShop`, `TraitShop`. All owned by the client multisig. PackShop and TraitShop forward funds immediately to `revenueWallet`.
- Mint authority: PackShop never mints. It emits `PackPurchased(buyer, packType, requestId)`; the off-chain pack-opening service watches that event and calls `AnimalKingdomCard.batchMintPack(buyer, creatures[])` from a hot wallet that holds `MINTER_ROLE`. The reveal animation is therefore "fire-and-watch": purchase tx returns immediately, the UI listens for `CreatureMinted` events on the buyer's address.
- WS server is configurable. `NEXT_PUBLIC_GAME_SERVER_WSS` is the only knob; if empty, the battle screen does not crash — it shows an explicit "server not configured" empty state.

**Common UX primitives referenced throughout:**

- **Toast** — `notification.success/error/warning/info` from `~~/utils/scaffold-eth`. Auto-dismiss, stacks at top-right.
- **Inline error banner** — red DaisyUI `alert alert-error` rendered above the action button it relates to. Persists until the user changes input.
- **Disabled button + helper text** — DaisyUI `btn btn-primary` with `disabled` attribute + a small `<span class="text-xs opacity-70">` directly under it explaining why.
- **Empty state component** — DaisyUI `card bg-base-200` with an icon, headline, sub-copy, and optional CTA. Used when there's nothing to show (no creatures, server offline, no decks saved).
- **Modal** — DaisyUI `modal modal-open` with backdrop. Used for pack reveal, deck save confirmation, Onramp widget.
- **`<RainbowKitConnectButton />`** — Always renders as a styled BUTTON (one of: "Connect Wallet" → "Wrong network — Switch to Base" → account chip). Never as text-only.

---

## 1. First-time player onboarding (Privy email / Google)

**Persona:** Has never touched crypto. Found the game from a friend or social post. Wants to play in under 60 seconds.

### Happy path

1. User lands on `/` (Home). Above the fold:
   - Hero panel with the project name, a 1-sentence pitch, and a primary CTA button: **"Sign Up to Play"**.
   - A secondary, smaller link: "Already have a wallet? Connect →".
2. Clicking **Sign Up to Play** opens the Privy modal (`usePrivy().login()`).
3. Privy modal offers: **Email**, **Google**, **Apple**, **Phone**. User picks one (most pick email or Google).
4. For email: user enters address, receives a 6-digit code, enters it. Privy creates an embedded wallet on Base behind the scenes — the user is never shown a seed phrase.
5. The Privy modal closes. The Home page now shows:
   - Top-right: account chip with the user's email truncated (e.g. `alice@…com`) and a tiny avatar generated from the wallet address.
   - Center: a new module — **"Open Your First Pack"** with a large CTA → routes to `/pack`.
6. User clicks the CTA. They land on `/pack` with the default pack pre-selected and a banner: *"Welcome — your first pack is on us in spirit. Choose how to pay."*
7. From here they continue into Flow 3 (fiat) or Flow 4 (ETH) or Flow 5 (USDC). Most first-time users go Flow 3.

### Error / branching states

| What goes wrong | UX surface |
| --- | --- |
| Privy modal fails to open (script blocked / `NEXT_PUBLIC_PRIVY_APP_ID` missing) | **Inline error banner** below the CTA: "Sign-up is temporarily unavailable. Try refreshing, or use Connect Wallet instead." Plus a Toast: "Privy not configured." Logs `console.error` for the dev. |
| User closes the email-code modal without entering a code | Silent — they remain unauthenticated. The CTA stays as **Sign Up to Play**. |
| User enters the wrong code 3 times | Privy's modal handles this with its own inline error. We do not duplicate. |
| Privy succeeds but embedded wallet creation fails | Toast `notification.error("Wallet setup failed — please try again.")`. The `useUser()` hook stays unauthenticated; we do not advance to `/pack`. |
| Network connectivity drops mid-signup | Privy SDK shows its own retry; if it gives up, we show a Toast "Sign-up timed out — please retry." |
| User signs up but the embedded wallet has 0 ETH (always true at this point) | Pack page shows fiat option as the primary CTA; ETH and USDC options are visible but secondary. **No error** — this is expected. |

---

## 2. Crypto-native onboarding (RainbowKit)

**Persona:** Has MetaMask / Phantom / Coinbase Wallet on desktop or mobile. Wants to use their existing identity.

### Happy path

1. User lands on `/`. Clicks the secondary link **"Connect Wallet →"** (or the top-right `<RainbowKitConnectButton />` which renders as **Connect Wallet** when disconnected).
2. RainbowKit modal opens. Shows: MetaMask, Coinbase Wallet, Phantom, WalletConnect, plus the embedded Privy option labeled "Sign in with Email/Google".
3. User picks MetaMask. MetaMask popup → user approves connection on whatever chain they were on.
4. If the wallet is on Base (chainId 8453): the modal closes, the Connect button morphs into the account chip showing the address (or ENS) and ETH balance, the user is on Home.
5. If the wallet is **not** on Base: the connect button morphs into a **red `Switch to Base` button** (rendered by `<RainbowKitConnectButton />` automatically when `chain.id !== targetNetworks[0].id`). Home content is partially gated — pages that require the chain (Pack, Trait, Battle write actions) show a banner: *"Switch to Base to continue"*.
6. User clicks **Switch to Base**. Their wallet shows a "Switch network" prompt. User approves.
7. The button morphs back to the account chip; banners disappear; user lands on Home.

### Error / branching states

| What goes wrong | UX surface |
| --- | --- |
| User rejects the connection in their wallet | RainbowKit modal stays open; user can retry or pick a different connector. No Toast — RainbowKit handles its own UX. |
| User's wallet doesn't have Base configured | When they click **Switch to Base**, MetaMask asks "Add Base to your wallet?". They approve, then network auto-switches. No error from us. |
| User rejects the network switch | The button stays as **Switch to Base** (red). Every gated action (Buy Pack, Buy Trait, Battle) shows the banner *"Switch to Base to continue"* and its primary button is **disabled with helper text**: "Switch network first." |
| Wallet on a chain we don't recognize at all | Same Switch button — wagmi/RainbowKit handles unknown chains uniformly. |
| WalletConnect QR scan fails / times out | RainbowKit's own modal handles this. We do not surface anything else. |
| Phantom not installed but selected | RainbowKit auto-redirects to Phantom's install page. |
| Mobile: user picks a wallet that's not installed on the device | RainbowKit deep-links to the wallet's install URL. If the redirect itself fails, RainbowKit shows its own modal error. |

---

## 3. Buying a pack with fiat (Coinbase Onramp)

**Persona:** New player from Flow 1. Has $0 ETH, $0 USDC. Wants to pay with a credit card.

### Happy path

1. User on `/pack`. Sees a card grid of pack types, each rendered from `PackShop.getPack(packType)`. Each card shows: pack name, ETH price (with USD equivalent below it), USDC price, an **"Open"** button.
2. User clicks a pack card. Side panel slides in showing three payment options:
   - **Buy with USD** (Coinbase Onramp) — primary button, large.
   - **Pay with ETH** — secondary.
   - **Pay with USDC** — secondary.
3. User clicks **Buy with USD**. A modal opens with the Coinbase Onramp widget (using `@coinbase/onchainkit` / Onramp SDK). The widget is preloaded with: destination = the user's wallet address, requested asset = ETH on Base, suggested amount = `priceWei` converted to USD via the embedded ETH/USD price feed plus a 5% buffer for slippage and gas.
4. First-time KYC: Coinbase asks for name, DOB, last-4 of SSN (US flow). User completes; KYC clears in a few seconds.
5. Card payment screen. User enters card details, completes 3DS challenge, gets confirmation.
6. Onramp widget shows "Funds delivered" with a pending state. Our modal updates: *"ETH on its way to your wallet — usually 30s. We'll auto-buy your pack as soon as it lands."*
7. Frontend polls `useBalance({ address: user })` every 5 seconds. As soon as `balance.value >= packPriceWei + estimatedGas`, the modal flips to **"Buying your pack now…"** and triggers the `buyPack(packType)` write call (Flow 4 from step 4 onward). The user does NOT have to click again — the auto-buy is the whole point of the fiat flow.
8. Pack reveal animation runs (see Flow 4 step 6).

### Error / branching states

| What goes wrong | UX surface |
| --- | --- |
| `NEXT_PUBLIC_ONRAMP_APP_ID` env var missing at build time | The **Buy with USD** button is **disabled with helper text**: "Fiat purchase requires admin setup." Tooltip on hover: "Contact the game administrator." The two crypto buttons remain active. No crash. |
| Onramp widget fails to load (network blocked, CSP misconfig) | Modal shows an **inline error banner**: "Couldn't load Coinbase Onramp. Please check your connection and try again." Plus a "Try ETH or USDC instead" button that closes the modal and highlights the crypto options. |
| KYC declined | Onramp's own UI shows the rejection. Our modal listens for the `onramp.event === "rejected"` callback and shows a Toast: "Coinbase couldn't verify your identity. Try a different payment, or contact Coinbase support." |
| Card payment failed (declined / insufficient funds / 3DS rejected) | Onramp surface handles it. On dismiss we Toast: "Payment didn't go through. Try again or pick a different card." |
| ETH delivery delayed > 2 minutes | After 120 seconds of polling without balance change, the modal flips to a **warning state**: "ETH is taking longer than expected. Coinbase will deliver it within 10 minutes — we'll auto-buy your pack as soon as it arrives. You can leave this tab open or come back later." A small "Cancel auto-buy" link is shown. |
| User leaves the page during delayed delivery | The auto-buy intent is persisted in `localStorage` keyed by wallet address + pack type. On next visit to `/pack`, if balance now covers price, a top-of-page banner offers: "We saved your pending pack purchase. Buy now?" — one click to fire. |
| ETH arrives but user is on wrong chain (e.g. they switched while waiting) | Auto-buy refuses to fire; banner appears: "ETH delivered — switch to Base to complete." The Switch button (Flow 2) takes over. |
| Onramp delivers USDC instead of ETH (config drift) | Auto-buy detects USDC balance >= `priceUsdc`, switches to Flow 5 (approve + `buyPackUSDC`). UX is identical — modal copy says "Buying with USDC" instead. |
| User has enough ETH for the pack but not for gas | Auto-buy runs `estimateGas`; if `balance < priceWei + gas`, the modal flips to: "We need a tiny bit more ETH for the network fee. Adding $1 to cover gas…" then re-opens the Onramp widget pre-filled with $1 ETH. |
| `buyPack` reverts after auto-fire (e.g. pack disabled mid-flow) | Toast `notification.error` mapping the revert reason via the parsed contract errors (e.g. `PackInactive(uint8)` → "This pack is no longer available."). Refund is automatic on-chain (PackShop refunds excess only on success; on revert no funds move). User keeps their ETH. |

---

## 4. Buying a pack with ETH (crypto-native)

**Persona:** Crypto-native user from Flow 2. Has ETH on Base.

### Happy path

1. User on `/pack`. Connected. Pack grid as in Flow 3.
2. User clicks a pack → side panel → **Pay with ETH**.
3. We show a confirmation row with: pack name, ETH price, USD equivalent, current ETH balance. Below: a single **Buy Pack** button.
4. User clicks **Buy Pack**. We call:
   ```ts
   writeContractAsync({
     contractName: "PackShop",
     functionName: "buyPack",
     args: [packType],
     value: pack.priceWei,
   });
   ```
   On mobile, we apply the **`writeAndOpen` pattern**: fire the tx, then `setTimeout(() => openWallet(), 2000)` so the deep link to MetaMask/Phantom mobile fires reliably after the SDK has the request queued.
5. Wallet popup → user approves. Button switches to spinner state: **"Confirming…"** with the tx hash linked underneath.
6. Tx confirmed. Page transitions into the **Pack Reveal Modal**:
   - Step A: 5-second "rolling" animation (CSS-driven pack-card flip + dust particles). Copy: *"Rolling your creatures…"*.
   - Step B: We subscribe to `useScaffoldWatchContractEvent({ contractName: "AnimalKingdomCard", eventName: "PackOpened" })` filtered to `player == user.address`. Once received, we read `tokenIds`, fetch each `tokenURI`, parse the base64-JSON, decode stats and creatureId, and reveal each card one at a time with a flip animation. Stats are shown in big numbers. After all cards revealed: **"Add to Collection"** CTA → routes to `/collection`.
7. Toast on success: `notification.success("Welcome to the kingdom! +N creatures added.")`.

### Error / branching states

| What goes wrong | UX surface |
| --- | --- |
| Insufficient ETH | Buy button is **disabled with helper text**: "You need {X} more ETH" (computed on the client from `balance` vs `priceWei + estimatedGas`). A small **"Buy ETH"** link is shown that opens the Coinbase Onramp modal pre-filled to top up the gap. |
| Wrong network | Button replaced by the **Switch to Base** button (Flow 2). Helper text: "Switch network to buy." |
| User rejects the wallet popup | Toast: `notification.warning("Transaction cancelled.")`. Button returns to ready state. No error log. |
| Tx reverts on-chain (`PackInactive` — pack got deactivated between page-load and submit) | Toast: `notification.error("This pack is no longer available — try a different one.")` mapped from the `PackInactive(uint8)` custom error via the PackShop ABI. |
| Tx reverts (`InsufficientPayment` — UI computed wrong price somehow) | Toast: `notification.error("Price changed — refresh and retry.")`. We also auto-refresh the pack catalog. |
| Tx reverts (`EthForwardFailed` — revenue wallet rejected funds, e.g. it's a contract that reverted on receive) | Toast: `notification.error("Couldn't process payment. Contact game admin.")`. Logs the error. |
| Tx confirmed but `PackOpened` event never arrives within 60 seconds | Reveal modal flips to: **"Your pack purchase is confirmed on-chain — the rolling service is delayed. Your creatures will appear in your Collection within a few minutes."** Plus a *"View on Basescan"* link. The user can dismiss; their creatures will appear automatically once the server catches up (we keep listening for `PackOpened` for that wallet address with a longer-window event subscription). |
| `PackOpened` event arrives but `tokenURI` parse fails for one card (malformed JSON, traits array gibberish) | That card's reveal slot shows: a generic creature silhouette + "Stats loading…" with a retry button. Other cards reveal normally. |
| Server is down (no MINTER_ROLE wallet listening) — same as event-never-arrives, but we add an extra check: an admin "server health" endpoint. If health=down, the post-tx state shows **inline error banner**: "Mint service is offline — your purchase is safe and will mint when service resumes." |  |
| User has the modal open and switches accounts in their wallet | Reveal listener re-subscribes to the new address. Toast: "Switched accounts — pending pack will appear on the original account." Reveal still completes for the original buyer. |

---

## 5. Buying a pack with USDC

**Persona:** Has USDC on Base, prefers stablecoin.

### Happy path

1. User on `/pack` → pack card → side panel → **Pay with USDC**.
2. Confirmation row shows: pack name, USDC price (with USD parity), current USDC balance (read via `useReadContract` on USDC.balanceOf), and the current allowance (`useReadContract` on USDC.allowance(user, PackShop)`). Two-step button group:
   - **Step 1: Approve USDC** (only visible if `allowance < priceUsdc`)
   - **Step 2: Buy Pack** (always visible, disabled until allowance is enough AND not currently transacting)

   The two steps render side-by-side with subtle visual progress (a connecting line), so the user understands they are sequential.
3. **Step 1.** User clicks **Approve USDC**. We call:
   ```ts
   writeContractAsync({
     // raw wagmi useWriteContract since SE2's hook is keyed to "deployedContracts"
     address: USDC,
     abi: erc20Abi,
     functionName: "approve",
     args: [packShopAddress, priceUsdc],
   });
   ```
   The `spender` argument is the deployed `PackShop` address — the same address that calls `transferFrom` inside `buyPackUSDC`. We verify this end-to-end in QA Stage 7.
4. Wallet popup → approve. Button → **"Approving… (1 of 2)"** spinner. Tx confirmed.
5. `useBlockNumber` watch keeps the **Buy Pack** button disabled for **1 additional block confirmation + a 2-second cooldown** after the approve confirms — this protects against the well-known SE2 footgun of firing the buy before the new allowance has propagated to the user's RPC.
6. Step 1 collapses to a green checkmark: **"USDC approved ✓"**. Step 2 button enables.
7. **Step 2.** User clicks **Buy Pack**. We call:
   ```ts
   writeContractAsync({
     contractName: "PackShop",
     functionName: "buyPackUSDC",
     args: [packType],
   });
   ```
8. Wallet popup → approve. Tx confirmed. Pack Reveal Modal opens (same as Flow 4 step 6).

### Error / branching states

| What goes wrong | UX surface |
| --- | --- |
| User has USDC balance but balance < price | Step 1 button **disabled with helper text**: "You need {X} more USDC." A "Buy USDC" link opens the Coinbase Onramp widget configured for USDC delivery on Base. |
| User has 0 USDC | Same as above; the gap is the full `priceUsdc`. |
| User rejects the approve popup | Toast: `notification.warning("Approval cancelled.")`. Step 1 returns to ready state. Step 2 stays disabled. |
| Approve tx reverts (extremely rare for USDC on Base — only if user's wallet is paused, etc.) | Toast: `notification.error("Approval failed: <parsed reason>")`. ABI used by the frontend includes ERC-20 standard errors AND the OZ v5 custom errors (`ERC20InsufficientAllowance`, `ERC20InsufficientBalance`) so messages decode cleanly. |
| Allowance set but smaller than price (user manually set a smaller value via wallet UI) | After approve confirms, `allowance < priceUsdc` recheck fails. Step 1 stays visible: **"Allowance too small. Re-approve required ({approved} / {needed})."** A click re-fires `approve` with the full price. |
| User clicks Buy before the cooldown finishes | Button is disabled — the click is a no-op. Helper text: "Waiting for approval to settle…" (The disabled state is enforced via state, not just CSS — clicking is impossible.) |
| `buyPackUSDC` reverts with `ERC20InsufficientAllowance` (allowance was decreased by another tx between our approve and our buy) | Toast: "Approval changed — re-approving USDC." We auto-trigger Step 1 again. Buy button stays disabled. |
| `buyPackUSDC` reverts with `ERC20InsufficientBalance` (USDC balance dropped between approve and buy) | Toast: "USDC balance changed — top up and try again." Step 2 button updates its helper text with the new gap. |
| `PackInactive` revert mid-flow | Same Toast as Flow 4. |
| `safeTransferFrom` fails because USDC blacklisted the user (Circle's compliance) | Toast: "Your address can't transact USDC. Contact Circle support." This is a hard-stop; we surface the Coinbase address that caused the block (from the revert data) if available. |

---

## 6. Building a deck

**Persona:** User who has at least one pack opened. Wants to choose a 4-creature team for battle.

### Happy path

1. User navigates to `/deck`. Page layout:
   - Left: **Collection grid** — all owned tokens, fetched via `tokenOfOwnerByIndex` (paginated 20 at a time) → `tokenURI` → parsed JSON. Each card shows: creature thumbnail, ATK/DEF/CHG/TRK in a compact stat-block, traits count badge.
   - Right: **Deck slots** — 4 large empty slots labeled `1`, `2`, `3`, `4`. Below the slots: a **Team Totals** panel that live-updates with sum of ATK / DEF / CHG / TRK as creatures are placed.
2. User taps a creature in the collection. The selected card highlights. The next empty deck slot fills with that creature. (Drag-to-slot also works on desktop; tap-to-add is the canonical mobile flow.)
3. As slots fill, **Team Totals** updates in real time. A small "Active Trick" indicator shows: "Active Trick — Highest TRK: {creature name} ({trk})".
4. User can tap a creature in the deck slots to **remove** it; the slot empties and totals recompute.
5. Once 4 slots are filled, the **Save Deck** button (bottom of page) enables. User taps → modal: name your deck (default: "Deck 1"). Confirms.
6. Deck saved to `localStorage` keyed by wallet address + deck name. List of saved decks appears below the slots, each with a "Load", "Edit", "Delete" affordance.
7. Toast: `notification.success("Deck saved.")`.

### Error / branching states

| What goes wrong | UX surface |
| --- | --- |
| User owns 0 creatures | Collection grid shows the **Empty state component**: cute creature silhouette + headline "No creatures yet" + sub-copy "Open a pack to start your collection" + CTA **"Open a Pack"** routing to `/pack`. Deck slots remain visible but greyed. Save button disabled with helper "Add 4 creatures to save a deck." |
| User owns 1–3 creatures | Collection shows what they own. Deck slots accept whatever they have. Save button **disabled with helper text**: "Need {N} more creatures — open a pack." |
| User attempts to save with empty deck | Save button is disabled — no error possible. |
| User attempts to add the same creature twice | Allowed in v1 (the contract supports it; team totals just multiply). A small Toast on the second add: `notification.info("Same creature added — totals doubled.")`. **Decision logged:** the build plan does not forbid duplicates and the battle engine does not require uniqueness. |
| `tokenOfOwnerByIndex` reverts mid-pagination (RPC blip) | Affected page slot shows a small "Couldn't load — Retry" inline error. Other already-loaded creatures remain visible. |
| `tokenURI` returns malformed base64 | That card renders a fallback: silhouette + token id + "Stats loading…" + Retry button. They cannot be added to the deck until stats load. |
| User on a different wallet than the one with creatures | Standard "Connect Wallet" gate — `/deck` requires connection. If disconnected, the page shows the Empty state with **"Connect Wallet"** CTA. |
| `localStorage` is full / disabled (Safari Private Mode) | Save button shows a Toast: `notification.warning("Couldn't save locally — your browser blocks storage.")`. Deck still loads in-session but won't persist. Helper text under Save: "Decks not saved across sessions in private mode." |
| User has many creatures (100+) | Collection grid virtualizes (`react-window` or Intersection Observer batched fetches). Pagination footer shows "Showing {n} of {total}". |

---

## 7. Entering a battle vs AI

**Persona:** User who has saved at least one deck.

### Connection state machine

The battle screen is the only WebSocket consumer. Its state machine has 5 explicit states; the UI surfaces each one differently.

| WS state | UX |
| --- | --- |
| **NOT_CONFIGURED** (`NEXT_PUBLIC_GAME_SERVER_WSS` empty) | **Empty state component**: "Battle server not configured" + sub-copy "The game admin hasn't connected the battle server yet. Your creatures and packs still work normally." + a small link to the project README. **No WS code runs at all** in this state — module-level `if (!url) return null` guards all `new WebSocket()` calls so static export does not crash (same defensive pattern as the disabled block explorer). |
| **CONNECTING** | Spinner + copy "Connecting to battle server…" |
| **CONNECTED, idle** | Lobby UI: deck picker dropdown, "Queue for Battle" button. |
| **CONNECTED, in match** | Battle UI (see happy path below). |
| **RECONNECTING** | Yellow banner at top: "Connection lost — reconnecting…" + auto-retry every 2s with exponential backoff up to 30s. Battle actions are queued client-side and replayed on reconnect using a server-issued `matchId` + `turnNumber`. |
| **DISCONNECTED** (gave up after N retries) | Red banner: "Couldn't reach battle server. Check your connection or try again later." + manual **Retry** button. Match state is preserved; on successful reconnect we resume. |

### Happy path (lobby → match → end)

1. User on `/battle`. WS state = NOT_CONFIGURED → see empty state. Otherwise WS state = CONNECTING for ~500ms then CONNECTED, idle.
2. Lobby UI: a deck dropdown auto-loads from localStorage. **Queue for Battle** button enabled when a deck is selected.
3. User clicks **Queue for Battle**. UI shows "Finding opponent…" with a 5-second AI-matchmaking animation.
4. Match starts. WS state = CONNECTED, in match. Battle UI:
   - Top: opponent HP bar, opponent team stat-block, opponent Momentum.
   - Bottom: own HP bar, own team stat-block, own Momentum.
   - Center: turn counter, 30-second turn timer (large, ticking), action buttons **Attack** / **Defend** / **Charge**.
   - Right sidebar: rolling match log ("Turn 1 — You attacked, Opponent defended. -2 HP to opponent.").
5. User clicks an action (e.g. **Attack**). Button locks. Copy: "Action committed — waiting for opponent…"
6. **Momentum branch:** if user's `Momentum > 0`, a secondary modal pops up immediately after the main action lock: "Commit Momentum to ATK / DEF / TRK / Skip". User picks. The modal closes; both choices are sent to server in one WS message.
7. Server resolves (simultaneous reveal). UI runs a 2-second flip animation showing both players' choices side-by-side, then numbers appear: "Damage: -3" or "Healed: +5". HP bars animate.
8. Match log appends. Turn counter increments. New 30-second timer starts. Repeat from step 5.
9. Match ends when an HP bar reaches 0 OR turn 30 is reached (timeout draw). Result modal: "Victory!" / "Defeat" / "Draw" with: turns played, damage dealt, link to share. Server sends final match record; UI persists it for `/profile` history.
10. Modal CTAs: **Battle Again** (re-queue) or **Back to Lobby**.

### Error / branching states

| What goes wrong | UX surface |
| --- | --- |
| `NEXT_PUBLIC_GAME_SERVER_WSS` not set | NOT_CONFIGURED empty state (above). No JS error; no `new WebSocket()` is ever instantiated. |
| WS URL set but server unreachable (DNS fail / 502 / connection refused) | After 5 connect attempts (10s total), DISCONNECTED state. Retry button. |
| WS connection drops mid-match | RECONNECTING banner. On reconnect, frontend sends `{ type: "resume", matchId, turnNumber, lastClientChoice }`. Server replays current turn state. Banner clears. If reconnection takes > 60s, match is auto-forfeited server-side; UI shows "Match expired." |
| User loses focus on the tab during a turn | Browser pauses the timer animation but server keeps real time. On return, UI re-syncs from server state. If turn timed out, action defaults to **Defend** (server-enforced). UI shows: "Turn missed — auto-defended." |
| User submits an action twice (network jitter) | Client deduplicates via `actionId` (uuid per click). Server idempotently accepts the first. No UX surface needed. |
| User has no decks saved | Deck dropdown is empty; lobby shows **Empty state**: "No decks yet — build one first" with CTA to `/deck`. |
| User loaded a deck but later sold one of those creatures (no longer owns it) | On Queue, server validates ownership via cached chain state. If invalid, we Toast: `notification.error("Deck contains creatures you no longer own. Edit your deck.")`. Lobby unlocks the dropdown. |
| Server rejects the WS auth handshake (Privy session expired) | DISCONNECTED state with copy: "Session expired — please refresh the page." Retry button refreshes Privy session token first. |
| Action button clicked while RECONNECTING | Click is queued but button shows a small loading dot. On reconnect, the queued action sends. If the server says "turn already resolved", we show: "Reconnected — your action arrived after the turn ended. Defending automatically next turn." (graceful catch-up) |
| Both players time out same turn | Server resolves with both **Defend**. UI shows it normally — no explicit "double timeout" message needed. |
| WS sends a malformed message (server bug) | UI catches the parse error in a try/catch, logs to console, ignores the message. Banner: "Connection issue — refresh if it persists." |

---

## 8. Buying a trait

**Persona:** Player who wants to customize a specific creature.

### Happy path

1. User navigates to `/traits`. Page shows trait catalog. Each trait card is rendered from `TraitShop.getTrait(traitId)` for every known traitId (the catalog is enumerated via a list configured at build time, since the contract has no enumeration helper).
2. Each card shows: trait name (parsed from `metadataURI`), thumbnail, ETH price (with USD), and an **Equip on…** button. Disabled traits show a faded card with "Sold out" badge.
3. User clicks **Equip on…**. A modal opens listing the user's owned creatures (same pagination as `/deck` collection). User picks one.
4. **Preview composite** — modal shows the creature image with the trait layered on top (composited client-side via a Canvas2D `drawImage` on the base creature PNG + the trait PNG). Copy: "Preview — your {creatureName} with {traitName}". Confirmation row shows price.
5. User clicks **Buy & Fuse**. We call:
   ```ts
   writeContractAsync({
     contractName: "TraitShop",
     functionName: "buyTrait",
     args: [tokenId, traitId],
     value: trait.priceWei,
   });
   ```
6. Wallet popup → approve. Tx confirmed. The `buyTrait` call internally:
   - Verifies `ownerOf(tokenId) == msg.sender`.
   - Verifies `traitCatalog[traitId].available`.
   - Forwards `priceWei` to revenue wallet.
   - Calls `AnimalKingdomCard.fuseTrait(tokenId, traitId)` — requires TraitShop to hold `TRAIT_FUSER_ROLE` on the card (granted at deploy in Stage 5).
7. UI listens for `TraitFused(tokenId, traitId)` event on the card contract. On arrival: confetti animation + Toast `notification.success("Trait fused onto {creatureName}!")`. Modal closes; user lands on the creature's detail page (`/collection/[tokenId]`) with the new trait now in the trait list, sourced fresh from `getTraits(tokenId)`.

### Error / branching states

| What goes wrong | UX surface |
| --- | --- |
| User selects a creature they don't own (race condition: they sold it on OpenSea between page-load and click) | Tx reverts with `NotTokenOwner(tokenId, caller)` custom error. Toast: `notification.error("You don't own this creature.")` — mapped from the TraitShop ABI custom error. The creature picker re-fetches ownership and the sold creature disappears. |
| Trait disabled mid-flow (admin toggled `setTraitAvailable(traitId, false)`) | Tx reverts with `TraitUnavailable(traitId)`. Toast: "This trait was just disabled. Try a different one." Catalog refreshes and the card grays out. |
| Insufficient ETH | **Buy & Fuse** button **disabled with helper text**: "You need {X} more ETH" (computed client-side from `balance` vs `priceWei + estimatedGas`). Same "Buy ETH" Onramp link as Flow 4. |
| Wrong network | Switch to Base button replaces Buy & Fuse. |
| User rejects wallet popup | Toast `notification.warning("Cancelled.")`. Button returns to ready. |
| Tx reverts with `EthForwardFailed` (revenue wallet contract rejected) | Toast: "Couldn't process payment. Contact game admin." |
| Tx reverts with `TraitLimitReached(tokenId, 32)` (creature already has 32 traits — cap from `MAX_TRAITS_PER_TOKEN`) | Toast: "This creature is fully decorated — 32 trait limit reached." Creature picker disables that creature for future trait purchases (visual: badge "MAX"). |
| **Deploy-time misconfig — TraitShop missing `TRAIT_FUSER_ROLE` on AnimalKingdomCard.** Tx reverts with the OZ AccessControl error: `AccessControlUnauthorizedAccount(account, role)`. The frontend ABI for AnimalKingdomCard includes that custom error so it decodes cleanly. Toast: "Trait fusion is misconfigured — contact game admin." Logs the missing role so the admin can fix with `grantRole`. | This is a deploy-time bug, not a user bug — the inline copy is intentional and matches the recovery path. |
| `TraitFused` event takes > 30s to arrive | Modal flips to: "Tx confirmed — trait will appear on your creature shortly." With a Basescan link. The reveal completes silently in the background once the event arrives (we keep a long-running listener while the modal is open or until manually dismissed). |
| Trait image fails to load (broken `metadataURI`) | Preview composite falls back to creature-only image with a small inline note: "Trait preview unavailable." User can still buy. Post-purchase, the on-chain trait id is appended; rendering catches up later when the asset resolves. |

---

## 9. Profile / match history

**Persona:** Returning player checking stats and the OpenSea page.

### Happy path

1. User navigates to `/profile`. Page sections:
   - **Identity:** username (Privy-supplied if email signup, else first 6+last 4 of address), avatar, **`<Address/>`** component showing the wallet address (with ENS resolution + Basescan link).
   - **Stats card:** total wins, total losses, win-rate %, total creatures owned (`balanceOf(user)`), total traits fused (sum of `traitCount(tokenId)` across owned tokens).
   - **Match history list:** rolling list of last 50 matches from the game server (paginated). Each row: timestamp, opponent (AI deck name), result, turns played, damage in/out.
   - **Collection summary:** thumbnail strip of the 8 most recently minted creatures.
   - **External links:** "View collection on OpenSea" → `https://opensea.io/assets/base/{cardAddress}/{tokenId}` for the most recent token, and a "View all on OpenSea" link to the contract page.

### Error / branching states

| What goes wrong | UX surface |
| --- | --- |
| Game server unreachable (match history endpoint fails) | Match history section shows **Empty state**: "Match history unavailable — try again later." Other sections (chain-derived data) render normally. |
| User has 0 matches played | Match history shows: "No matches yet — head to /battle to play your first." |
| User has 0 creatures | Collection summary shows "Open a pack to start collecting" with CTA. Stats card still shows totals (all zero). |
| ENS lookup fails | `<Address/>` falls back to the truncated address. No error UX. |
| OpenSea link clicked before contract is verified on OpenSea (very early after deploy) | OpenSea may show "Listings unavailable" — that's their UI, not ours. Link still works. |

---

## 10. Mobile flows

Mobile gets specific attention because deep-linking to wallets is the #1 flow that breaks on iOS Safari and Android Chrome.

### Wallet connect on mobile

1. RainbowKit modal on mobile shows recommended wallets (MetaMask, Coinbase Wallet, Phantom, Rainbow). User taps one.
2. RainbowKit deep-links to the wallet's app (e.g. `https://metamask.app.link/dapp/<our-domain>`). The wallet opens, presents the connection request.
3. User approves. Returns to our domain (the wallet auto-redirects). Modal closes.

### Transaction confirmation — `writeAndOpen` pattern

For every write call (Flow 4 step 4, Flow 5 step 7, Flow 8 step 5), the mobile-aware code path is:

```ts
const isMobile = /iPhone|Android/i.test(navigator.userAgent);
await writeContractAsync({ /* ...args... */ });
if (isMobile) {
  setTimeout(() => {
    // Open the user's connected wallet via its native deep link.
    // Coinbase Wallet exposes window.coinbaseWalletExtension or a known scheme;
    // for WalletConnect-paired wallets, RainbowKit's connector exposes a `getProvider` we use.
    openConnectedWallet();
  }, 2000);
}
```

The 2-second delay is critical: it gives the wallet RPC time to register the request before we deep-link, so the wallet opens directly to the pending request screen (no manual navigation to the queued tx). Without this delay, iOS often opens the wallet with no pending request visible, and the user thinks the click failed.

### Mobile-specific error states

| What goes wrong | UX surface |
| --- | --- |
| User taps a wallet but it's not installed | RainbowKit deep-links to the App Store / Play Store. After install + return, RainbowKit auto-retries. |
| User completes the tx in the wallet but doesn't return to the dapp | The dapp is still listening; on return, the spinner has already flipped to confirmed. Reveal modal opens normally. |
| `setTimeout(openWallet)` fires before the wallet has the request queued | Wallet opens without showing the tx. We log this to telemetry. UX-wise, the user is on the wallet's home screen — they can tap the pending-request indicator manually. We do NOT race the deep-link further; 2s is the empirically-tuned floor. |
| iOS Safari blocks the deep-link (Cross-origin restriction) | The browser shows its own "Open in MetaMask?" prompt. User taps Open. No additional UX from us. |
| User on a desktop that we mis-detected as mobile | Worst case: `setTimeout` fires `openWallet`, which on desktop is a no-op or opens the extension's popup. Harmless. |
| Pack reveal animation jank on low-end Android | We use CSS-only animations (no canvas, no heavy JS) so 60fps is achievable on 2019+ devices. Fallback: `prefers-reduced-motion` shrinks animation to a fade. |
| Battle WS over flaky mobile networks | RECONNECTING state (Flow 7) handles all transient drops. The auto-Defend on missed turn (server-side) protects users from being punished for a 5G hiccup. |

---

## Cross-flow invariants

These hold across every flow above and are the basis for the Stage 7 QA audit:

- **Connect Wallet always renders as a `<button>`**, never as text. `<RainbowKitConnectButton />` is the only connect surface.
- **Wrong-network state is one button**, not buried in a modal. The flow is: connect → switch network → approve → action — each step gated, never combined.
- **Approve buttons stay disabled** through both the block confirmation AND a 2-second cooldown after `useWriteContract.isSuccess` flips. No race conditions where the buy fires before the allowance has propagated to the user's RPC.
- **The spender passed to `USDC.approve()` is exactly the deployed `PackShop` address** — the same address that calls `transferFrom(buyer, revenueWallet, priceUsdc)` inside `buyPackUSDC`. Verified by tracing the call chain in QA, not just by checking that some approve call exists.
- **All custom errors decode**: the frontend ABI for `PackShop`, `TraitShop`, `AnimalKingdomCard`, AND the OZ-v5 errors emitted from inherited contracts (`AccessControlUnauthorizedAccount`, `ERC20InsufficientAllowance`, `ERC20InsufficientBalance`, `ERC721InsufficientApproval`, etc.) are all included so `getParsedError` produces human messages, not raw hex.
- **All token amounts have USD context.** ETH amounts show "X ETH ≈ $Y" using a price feed (Coinbase `/v2/exchange-rates?currency=ETH`). USDC amounts show "X USDC = $X" trivially.
- **Funds never sit in PackShop or TraitShop.** ETH purchases call-forward to revenueWallet in the same tx; USDC purchases use `safeTransferFrom(buyer, revenueWallet, amount)` directly. The reveal animation is purely off-chain UX — no fund-custody implication.
- **All write flows that the user might walk away from (fiat purchase, pack reveal, trait fusion) persist their pending state in `localStorage`** keyed by wallet address, so coming back to the tab resumes correctly.
- **No module-level `localStorage` access, no module-level `new WebSocket()`.** Both are deferred to `useEffect` so static export does not crash. Same defensive discipline as the disabled block explorer.
