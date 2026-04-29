import React from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import { SwitchTheme } from "~~/components/SwitchTheme";
import deployedContracts from "~~/contracts/deployedContracts";

const BASE_CHAIN_ID = 8453;

const cardAddress: string | undefined =
  // deployedContracts is a generated map; AnimalKingdomCard may or may not exist yet.
  (deployedContracts as Record<number, Record<string, { address?: string }>>)?.[BASE_CHAIN_ID]?.AnimalKingdomCard
    ?.address;

const GITHUB_URL = "https://github.com/clawdbotatg/leftclaw-service-job-80";

/**
 * Site footer — Animal Kingdom TCG
 *
 * Replaces the SE2 default footer entirely (Fork-me / BuidlGuidl / Support links and the
 * `useFetchNativeCurrencyPrice` badge are removed; the badge rendered on every network
 * including Base mainnet, which is a CLAUDE.md ship-blocker).
 *
 * Contract address rendered with the SE2 `<Address/>` component (Issue #10) so users see
 * the truncated address with blockie, copy button, and explorer link inline.
 */
export const Footer = () => {
  return (
    <footer className="w-full px-4 pb-6 pt-3 mt-8">
      <div className="flex justify-end mb-2">
        <SwitchTheme />
      </div>
      <div className="border-t border-base-300 pt-3 flex flex-col md:flex-row items-center justify-center gap-2 text-xs text-base-content/70">
        <span className="font-medium">Animal Kingdom TCG</span>
        <span className="hidden md:inline">·</span>
        <span>© {new Date().getFullYear()}</span>
        <span className="hidden md:inline">·</span>
        <Link href={GITHUB_URL} target="_blank" rel="noreferrer" className="link">
          GitHub
        </Link>
        {cardAddress && (
          <>
            <span className="hidden md:inline">·</span>
            <span className="flex items-center gap-1">
              <span className="opacity-70">Card:</span>
              <Address address={cardAddress as `0x${string}`} size="xs" />
            </span>
          </>
        )}
      </div>
    </footer>
  );
};
