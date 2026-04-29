"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();

  const { data: balance } = useScaffoldReadContract({
    contractName: "AnimalKingdomCard",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  return (
    <div className="flex flex-col items-center grow pt-10 pb-16 px-4">
      <section className="text-center max-w-3xl">
        <h1 className="font-display text-2xl md:text-4xl mb-4 leading-snug">
          Animal Kingdom TCG
          <span className="block text-base md:text-lg opacity-80 mt-3 font-sans">Collect, Build, Battle</span>
        </h1>
        <p className="text-lg opacity-80 mb-8">
          A fully onchain trading-card game on Base. Open packs to roll creatures with permanent stats, fuse cosmetic
          traits, build a deck, and battle the wild.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {isConnected ? (
            <>
              <Link href="/pack" className="btn btn-primary">
                Open a Pack
              </Link>
              <Link href="/battle" className="btn btn-secondary">
                Battle
              </Link>
              <Link href="/collection" className="btn btn-ghost">
                Collection
              </Link>
            </>
          ) : (
            // Issue #11 — render the actual Connect button as the primary CTA, not a
            // paragraph telling the user where to look. Reuses the same component the
            // header uses so the connect modal behavior is identical.
            <div className="flex flex-col items-center gap-2">
              <RainbowKitCustomConnectButton />
              <p className="text-xs opacity-60">Connect a wallet to start collecting creatures.</p>
            </div>
          )}
        </div>
      </section>

      {isConnected && (
        <section className="card bg-base-100 shadow-md w-full max-w-2xl p-6">
          <h2 className="font-display text-base mb-3">Your Kingdom</h2>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs opacity-70">Creatures owned</div>
              <div className="text-3xl font-bold">{balance !== undefined ? balance.toString() : "—"}</div>
            </div>
            <div className="grow flex flex-wrap gap-2 justify-end">
              <Link href="/collection" className="btn btn-sm btn-outline">
                View collection
              </Link>
              <Link href="/deck" className="btn btn-sm btn-outline">
                Build a deck
              </Link>
              <Link href="/traits" className="btn btn-sm btn-outline">
                Buy traits
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-4xl w-full">
        <FeatureCard emoji="🎴" title="Open Packs">
          Pay in ETH, USDC, or fiat (Coinbase Onramp). The off-chain pack roller mints your creatures with
          onchain-permanent stats.
        </FeatureCard>
        <FeatureCard emoji="🛡️" title="Build Decks">
          Pick four creatures. Live ATK / DEF / CHG / TRK totals. Save unlimited deck presets locally.
        </FeatureCard>
        <FeatureCard emoji="⚔️" title="Battle the Wild">
          Queue against AI opponents. Simultaneous-reveal turns, Momentum mechanics, server-authoritative resolution.
        </FeatureCard>
      </section>
    </div>
  );
};

const FeatureCard = ({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) => (
  <div className="card bg-base-100 shadow-md p-5">
    <div className="text-3xl mb-2" aria-hidden>
      {emoji}
    </div>
    <h3 className="font-display text-sm mb-2">{title}</h3>
    <p className="text-sm opacity-80">{children}</p>
  </div>
);

export default Home;
