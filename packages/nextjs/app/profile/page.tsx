"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { Address as AddressType } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { creatureEmoji } from "~~/utils/animalKingdom";

const ProfilePage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();

  const { data: balance } = useScaffoldReadContract({
    contractName: "AnimalKingdomCard",
    functionName: "balanceOf",
    args: [connectedAddress],
  });
  const balanceNum = balance !== undefined ? Number(balance) : 0;

  const { data: card } = useDeployedContractInfo({ contractName: "AnimalKingdomCard" });

  // First few owned creatures for the strip + OpenSea link.
  const indexCalls = useMemo(() => {
    if (!connectedAddress || !card || balanceNum === 0) return [];
    const n = Math.min(balanceNum, 8);
    return Array.from({ length: n }, (_, i) => ({
      address: card.address,
      abi: card.abi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [connectedAddress, BigInt(i)] as const,
    }));
  }, [connectedAddress, card, balanceNum]);

  const { data: idsRaw } = useReadContracts({
    contracts: indexCalls as any,
    query: { enabled: indexCalls.length > 0 },
  });

  const tokenIds: bigint[] = useMemo(() => {
    if (!idsRaw) return [];
    return idsRaw
      .map(r => (r.status === "success" ? (r.result as bigint) : null))
      .filter((v): v is bigint => v !== null);
  }, [idsRaw]);

  const statsCalls = useMemo(() => {
    if (!card || tokenIds.length === 0) return [];
    return tokenIds.map(id => ({
      address: card.address,
      abi: card.abi,
      functionName: "stats" as const,
      args: [id] as const,
    }));
  }, [card, tokenIds]);

  const { data: statsRaw } = useReadContracts({
    contracts: statsCalls as any,
    query: { enabled: statsCalls.length > 0 },
  });

  const recent = useMemo(() => {
    if (!statsRaw) return [];
    return tokenIds.map((id, i) => {
      const r = statsRaw[i];

      const s: any = r?.status === "success" ? r.result : [0];
      return { tokenId: id, creatureId: Number(s[0] ?? 0) };
    });
  }, [tokenIds, statsRaw]);

  const cardAddress = card?.address;
  const firstTokenId = tokenIds[0]?.toString();
  const openSeaCollectionUrl = cardAddress ? `https://opensea.io/assets/base/${cardAddress}` : null;
  const openSeaFirstTokenUrl =
    cardAddress && firstTokenId ? `https://opensea.io/assets/base/${cardAddress}/${firstTokenId}` : null;

  const isWsConfigured = Boolean(scaffoldConfig.gameServerWss);
  const [serverReachable, setServerReachable] = useState<"unknown" | "checking" | "down" | "n/a">(
    isWsConfigured ? "checking" : "n/a",
  );

  useEffect(() => {
    if (!isWsConfigured) {
      setServerReachable("n/a");
      return;
    }
    setServerReachable("checking");
    // We do NOT open a WebSocket here — Stage 4b owns the live battle connection.
    // Profile only shows a placeholder. After 1.5s flip to "down" so the user knows
    // history isn't available yet.
    const t = setTimeout(() => setServerReachable("down"), 1500);
    return () => clearTimeout(t);
  }, [isWsConfigured]);

  return (
    <div className="px-4 py-8 max-w-4xl mx-auto w-full">
      <h1 className="font-display text-xl mb-1">Profile</h1>
      <p className="opacity-70 text-sm mb-6">Your kingdom at a glance.</p>

      {!isConnected && (
        <div className="card bg-base-200 p-6 text-center">
          <p className="opacity-70">Connect or sign in to view your profile.</p>
        </div>
      )}

      {isConnected && (
        <>
          <section className="card bg-base-100 shadow-md p-5 mb-4">
            <h2 className="font-display text-sm mb-2">Identity</h2>
            <Address address={connectedAddress as AddressType | undefined} />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card bg-base-100 shadow-md p-5">
              <h2 className="font-display text-sm mb-2">Stats</h2>
              <div>
                <div className="text-xs opacity-70">Creatures owned</div>
                <div className="text-3xl font-bold">{balanceNum}</div>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                <Link href="/collection" className="btn btn-sm btn-outline">
                  Collection
                </Link>
                <Link href="/deck" className="btn btn-sm btn-outline">
                  Decks
                </Link>
              </div>
            </div>

            <div className="card bg-base-100 shadow-md p-5">
              <h2 className="font-display text-sm mb-2">Match history</h2>
              {serverReachable === "n/a" && <p className="text-sm opacity-70">Game server not configured.</p>}
              {serverReachable === "checking" && <p className="text-sm opacity-70">Connecting to game server…</p>}
              {serverReachable === "down" && (
                <p className="text-sm opacity-70">
                  Match history will appear once the battle screen connects to the game server.
                </p>
              )}
            </div>
          </section>

          <section className="card bg-base-100 shadow-md p-5 mt-4">
            <h2 className="font-display text-sm mb-3">Recent creatures</h2>
            {recent.length === 0 ? (
              <p className="text-sm opacity-70">
                You haven&apos;t opened any packs.{" "}
                <Link href="/pack" className="link">
                  Start your collection.
                </Link>
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {recent.map(c => (
                  <div key={c.tokenId.toString()} className="card bg-base-200 p-2 text-center">
                    <div className="text-2xl">{creatureEmoji(c.creatureId)}</div>
                    <div className="text-[10px] opacity-60">#{c.tokenId.toString()}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card bg-base-100 shadow-md p-5 mt-4">
            <h2 className="font-display text-sm mb-3">External</h2>
            <div className="flex gap-2 flex-wrap">
              {openSeaFirstTokenUrl ? (
                <a href={openSeaFirstTokenUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">
                  View first creature on OpenSea
                </a>
              ) : (
                <button type="button" className="btn btn-sm btn-disabled" disabled>
                  No creatures yet
                </button>
              )}
              {openSeaCollectionUrl && (
                <a href={openSeaCollectionUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">
                  View collection on OpenSea
                </a>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default ProfilePage;
