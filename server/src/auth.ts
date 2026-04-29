/**
 * WS auth handler.
 *
 * Two paths:
 *   1. Privy access-token validation via @privy-io/server-auth.
 *      Used when PRIVY_APP_ID + PRIVY_APP_SECRET env vars are set.
 *
 *   2. Address-only stub: trust the address. Insecure on its own — anyone
 *      can claim any address. Stage 7 will require a SIWE flow:
 *        a) server issues a nonce on connect
 *        b) client signs `Sign in to Animal Kingdom — nonce: <nonce>`
 *        c) server verifies signature via viem.verifyMessage and binds the
 *           connection to the recovered address.
 *      Until then, address-auth is for local development only. Production
 *      MUST use Privy.
 */

import { upsertPlayer, type PlayerRecord } from "./db.js";
import { logger } from "./logger.js";
import type { AuthMessage } from "./types.js";

const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";

// Lazy-load the Privy server SDK. Skipping the import when unconfigured keeps
// the server bootable in dev environments without Privy credentials.
type PrivyClient = {
  verifyAuthToken: (token: string) => Promise<{ userId: string; appId: string }>;
};

let _privyClient: PrivyClient | null = null;

const getPrivyClient = async (): Promise<PrivyClient | null> => {
  if (_privyClient) return _privyClient;
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) return null;
  const mod = await import("@privy-io/server-auth").catch(err => {
    logger.warn({ err }, "could not load @privy-io/server-auth — install it or unset PRIVY_APP_ID");
    return null as any;
  });
  if (!mod) return null;
  _privyClient = new mod.PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  return _privyClient;
};

export type AuthResult =
  | { ok: true; player: PlayerRecord }
  | { ok: false; reason: string };

const isAddressMessage = (m: AuthMessage): m is { type: "auth"; address: `0x${string}`; signature?: `0x${string}` } =>
  "address" in m && typeof (m as any).address === "string";

export const authenticate = async (msg: AuthMessage): Promise<AuthResult> => {
  // Path 1: Privy token
  if ("token" in msg && msg.token) {
    const client = await getPrivyClient();
    if (!client) {
      return {
        ok: false,
        reason: "Privy not configured on server. Contact admin.",
      };
    }
    try {
      const claims = await client.verifyAuthToken(msg.token);
      const player = await upsertPlayer({ privyDid: claims.userId });
      return { ok: true, player };
    } catch (err) {
      logger.warn({ err }, "privy auth failed");
      return { ok: false, reason: "Invalid Privy token." };
    }
  }

  // Path 2: address-only stub
  if (isAddressMessage(msg)) {
    if (PRIVY_APP_ID && PRIVY_APP_SECRET) {
      // Privy is configured but the client sent address-only. Reject — an
      // attacker could claim any address against a Privy-protected backend.
      return {
        ok: false,
        reason: "This server requires Privy auth. Sign in via the Privy modal.",
      };
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(msg.address)) {
      return { ok: false, reason: "Invalid address." };
    }
    if (msg.address.toLowerCase() === "0x0000000000000000000000000000000000000000") {
      return { ok: false, reason: "Connect a wallet first." };
    }
    const player = await upsertPlayer({ address: msg.address.toLowerCase() });
    return { ok: true, player };
  }

  return { ok: false, reason: "Unrecognized auth message." };
};
