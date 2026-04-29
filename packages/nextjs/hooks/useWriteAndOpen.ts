"use client";

import { isMobileUserAgent, openConnectedWallet } from "~~/utils/animalKingdom";

/**
 * Wrap any async write call with the mobile `writeAndOpen` pattern. The 2-second
 * delay is critical: it gives the wallet's mobile RPC time to register the queued
 * request before the deep-link fires.
 *
 * For Privy embedded wallets there is no native app to deep-link to, but the nudge
 * is harmless (just dispatches a focus event). We don't bother detecting embedded
 * here — the harm of an extra focus event is zero, the cost of a missed deep-link
 * on a regular mobile wallet is real.
 */
export const useWriteAndOpen = () => {
  const writeAndOpen = async <T>(write: () => Promise<T>): Promise<T> => {
    const result = await write();
    if (isMobileUserAgent()) {
      openConnectedWallet(2000);
    }
    return result;
  };

  return { writeAndOpen };
};
