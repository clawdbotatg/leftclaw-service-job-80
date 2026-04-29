/**
 * Helpers shared across Animal Kingdom TCG pages.
 */

/**
 * Creature emoji map. Indexed by `creatureId` (uint8 from the contract).
 * v1 ships emoji as placeholder art until the client uploads real PNGs to IPFS
 * and sets `imageBaseURI` on the AnimalKingdomCard contract.
 */
export const CREATURE_EMOJIS: readonly string[] = [
  "🦁", // 0
  "🐘", // 1
  "🐺", // 2
  "🐉", // 3
  "🦅", // 4
  "🐍", // 5
  "🐅", // 6
  "🦊", // 7
  "🐻", // 8
  "🦌", // 9
  "🦏", // 10
  "🦛", // 11
  "🐊", // 12
  "🦈", // 13
  "🐢", // 14
  "🦉", // 15
];

export const creatureEmoji = (creatureId: number | bigint | undefined): string => {
  if (creatureId === undefined) return "❓";
  const id = typeof creatureId === "bigint" ? Number(creatureId) : creatureId;
  return CREATURE_EMOJIS[id % CREATURE_EMOJIS.length] ?? "❓";
};

/**
 * Display name for a creature. v1 just appends the id; real builds would map to
 * named creatures from a constants table.
 */
export const creatureName = (creatureId: number | bigint | undefined): string => {
  if (creatureId === undefined) return "Unknown";
  const id = typeof creatureId === "bigint" ? Number(creatureId) : creatureId;
  return `Creature #${id}`;
};

/**
 * USD price feed used for ETH amounts. Reads Coinbase's public spot endpoint.
 * Static-export safe — fetched in `useEffect`, never at module scope.
 */
export const fetchEthUsdPrice = async (): Promise<number | null> => {
  try {
    const res = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=ETH");
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { rates?: { USD?: string } } };
    const usd = json?.data?.rates?.USD;
    return usd ? parseFloat(usd) : null;
  } catch {
    return null;
  }
};

/**
 * Format a wei amount to ETH with USD context. `usd` may be null when the price
 * feed is unavailable; in that case we omit the USD parenthetical.
 */
export const formatEthWithUsd = (wei: bigint | undefined, usd: number | null): string => {
  if (wei === undefined) return "—";
  const eth = Number(wei) / 1e18;
  const ethStr = eth.toFixed(eth < 0.01 ? 5 : eth < 1 ? 4 : 3);
  if (usd === null) return `${ethStr} ETH`;
  const usdAmt = (eth * usd).toFixed(2);
  return `${ethStr} ETH ≈ $${usdAmt}`;
};

/**
 * USDC has 6 decimals on Base.
 */
export const formatUsdc = (units: bigint | undefined): string => {
  if (units === undefined) return "—";
  const usdc = Number(units) / 1e6;
  return `${usdc.toFixed(2)} USDC ≈ $${usdc.toFixed(2)}`;
};

/**
 * Mobile-only deep-link helper used after `writeContractAsync`. Fires the wallet
 * after a 2-second delay so the wallet has the tx queued before opening.
 *
 * Note: for Privy embedded wallets there's no native app to open — the wallet
 * lives in the page itself. Caller checks `isEmbeddedWallet` before invoking.
 */
export const openConnectedWallet = (delayMs = 2000) => {
  if (typeof window === "undefined") return;
  setTimeout(() => {
    // The most reliable cross-wallet trigger is to nudge focus back; many wallet
    // SDKs listen for `focusin` to surface the pending request modal.
    try {
      window.dispatchEvent(new Event("focus"));
    } catch {
      // ignore
    }
  }, delayMs);
};

export const isMobileUserAgent = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

/**
 * Onramp Buy URL generator (legacy `appId` param style). The new OnchainKit
 * `getOnrampBuyUrl` requires a server-minted `sessionToken`; we don't have a
 * server in static-export mode, so we fall back to the older flow.
 *
 * Returns null if onrampAppId is not configured.
 */
export const buildOnrampBuyUrl = (params: {
  appId: string;
  destinationAddress: string;
  defaultAsset?: "ETH" | "USDC";
  presetFiatAmount?: number;
}): string | null => {
  if (!params.appId) return null;
  const url = new URL("https://pay.coinbase.com/buy/select-asset");
  url.searchParams.set("appId", params.appId);
  url.searchParams.set("addresses", JSON.stringify({ [params.destinationAddress]: ["base"] }));
  if (params.defaultAsset) {
    url.searchParams.set("assets", JSON.stringify([params.defaultAsset]));
    url.searchParams.set("defaultAsset", params.defaultAsset);
  }
  url.searchParams.set("defaultNetwork", "base");
  if (params.presetFiatAmount) {
    url.searchParams.set("presetFiatAmount", String(params.presetFiatAmount));
  }
  return url.toString();
};
