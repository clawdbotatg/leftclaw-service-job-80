"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { Address as AddressType } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { creatureEmoji, creatureName } from "~~/utils/animalKingdom";

type SortKey = "id" | "total" | "traits";

const Collection: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [sortBy, setSortBy] = useState<SortKey>("id");
  const [filterCreatureId, setFilterCreatureId] = useState<number | null>(null);

  const { data: balance } = useScaffoldReadContract({
    contractName: "AnimalKingdomCard",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const balanceNum = balance !== undefined ? Number(balance) : 0;
  const { data: cardContract } = useDeployedContractInfo({ contractName: "AnimalKingdomCard" });

  // Build list of (owner, index) read calls — `tokenOfOwnerByIndex` for i in 0..balance.
  const indexCalls = useMemo(() => {
    if (!connectedAddress || !cardContract || balanceNum === 0) return [];
    return Array.from({ length: balanceNum }, (_, i) => ({
      address: cardContract.address,
      abi: cardContract.abi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [connectedAddress, BigInt(i)] as const,
    }));
  }, [connectedAddress, cardContract, balanceNum]);

  const { data: tokenIdsRaw } = useReadContracts({
    contracts: indexCalls as any,
    query: { enabled: indexCalls.length > 0 },
  });

  const tokenIds: bigint[] = useMemo(() => {
    if (!tokenIdsRaw) return [];
    return tokenIdsRaw
      .map(r => (r.status === "success" ? (r.result as bigint) : null))
      .filter((v): v is bigint => v !== null);
  }, [tokenIdsRaw]);

  // For each token, fetch stats(tokenId) and traitCount(tokenId).
  const statsCalls = useMemo(() => {
    if (!cardContract || tokenIds.length === 0) return [];
    return tokenIds.flatMap(id => [
      {
        address: cardContract.address,
        abi: cardContract.abi,
        functionName: "stats" as const,
        args: [id] as const,
      },
      {
        address: cardContract.address,
        abi: cardContract.abi,
        functionName: "traitCount" as const,
        args: [id] as const,
      },
    ]);
  }, [cardContract, tokenIds]);

  const { data: statsRaw } = useReadContracts({
    contracts: statsCalls as any,
    query: { enabled: statsCalls.length > 0 },
  });

  type CreatureCard = {
    tokenId: bigint;
    creatureId: number;
    atk: number;
    def: number;
    chg: number;
    trk: number;
    traits: number;
  };

  const cards: CreatureCard[] = useMemo(() => {
    if (!statsRaw) return [];
    return tokenIds.map((id, i) => {
      const statsRes = statsRaw[i * 2];
      const traitRes = statsRaw[i * 2 + 1];
      // stats returns a tuple [creatureId, atk, def, chg, trk]
      const s =
        statsRes?.status === "success"
          ? (statsRes.result as readonly [number, number, number, number, number])
          : [0, 0, 0, 0, 0];
      const t = traitRes?.status === "success" ? Number(traitRes.result as bigint) : 0;
      return {
        tokenId: id,
        creatureId: Number(s[0]),
        atk: Number(s[1]),
        def: Number(s[2]),
        chg: Number(s[3]),
        trk: Number(s[4]),
        traits: t,
      };
    });
  }, [tokenIds, statsRaw]);

  const visibleCards = useMemo(() => {
    const arr = filterCreatureId !== null ? cards.filter(c => c.creatureId === filterCreatureId) : [...cards];
    if (sortBy === "total") arr.sort((a, b) => b.atk + b.def + b.chg + b.trk - (a.atk + a.def + a.chg + a.trk));
    else if (sortBy === "traits") arr.sort((a, b) => b.traits - a.traits);
    else arr.sort((a, b) => Number(a.tokenId - b.tokenId));
    return arr;
  }, [cards, sortBy, filterCreatureId]);

  // Distinct creature ids for the filter dropdown.
  const creatureIds = useMemo(() => Array.from(new Set(cards.map(c => c.creatureId))).sort((a, b) => a - b), [cards]);

  const isLoading = (indexCalls.length > 0 && !tokenIdsRaw) || (statsCalls.length > 0 && !statsRaw);

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="font-display text-xl mb-2">Collection</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="opacity-70">Wallet:</span>
          <Address address={connectedAddress as AddressType | undefined} />
          <span className="opacity-70">·</span>
          <span>{balanceNum} creatures</span>
        </div>
      </header>

      {!isConnected && (
        <EmptyCard title="Connect a wallet" body="Connect or sign in to see your creatures." cta={null} />
      )}

      {isConnected && balanceNum === 0 && !isLoading && (
        <EmptyCard
          title="No creatures yet"
          body="Open your first pack to start the collection."
          cta={{ href: "/pack", label: "Open a pack" }}
        />
      )}

      {isConnected && balanceNum > 0 && (
        <>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <label className="form-control">
              <span className="text-xs opacity-70">Sort by</span>
              <select
                className="select select-bordered select-sm"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
              >
                <option value="id">Token ID</option>
                <option value="total">Stat total</option>
                <option value="traits">Trait count</option>
              </select>
            </label>
            <label className="form-control">
              <span className="text-xs opacity-70">Filter by creature</span>
              <select
                className="select select-bordered select-sm"
                value={filterCreatureId ?? ""}
                onChange={e => setFilterCreatureId(e.target.value === "" ? null : Number(e.target.value))}
              >
                <option value="">All ({cards.length})</option>
                {creatureIds.map(id => (
                  <option key={id} value={id}>
                    {creatureEmoji(id)} {creatureName(id)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isLoading ? (
            <SkeletonGrid />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleCards.map(c => (
                <CreatureGridCard key={c.tokenId.toString()} c={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const CreatureGridCard = ({
  c,
}: {
  c: { tokenId: bigint; creatureId: number; atk: number; def: number; chg: number; trk: number; traits: number };
}) => {
  return (
    <div className="card bg-base-100 shadow-md p-3">
      <div className="flex justify-between items-start">
        <div className="text-5xl" aria-hidden>
          {creatureEmoji(c.creatureId)}
        </div>
        <span className="text-[10px] opacity-50">#{c.tokenId.toString()}</span>
      </div>
      <div className="font-display text-xs mt-2">{creatureName(c.creatureId)}</div>
      <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
        <Stat label="ATK" v={c.atk} />
        <Stat label="DEF" v={c.def} />
        <Stat label="CHG" v={c.chg} />
        <Stat label="TRK" v={c.trk} />
      </div>
      {c.traits > 0 && <div className="badge badge-secondary badge-sm mt-2 self-start">{c.traits} traits</div>}
    </div>
  );
};

const Stat = ({ label, v }: { label: string; v: number }) => (
  <div className="bg-base-200 rounded-md px-2 py-0.5 flex justify-between">
    <span className="opacity-70">{label}</span>
    <span className="font-bold">{v}</span>
  </div>
);

const SkeletonGrid = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="card bg-base-100 p-3 animate-pulse">
        <div className="h-12 bg-base-200 rounded mb-2" />
        <div className="h-4 bg-base-200 rounded w-2/3 mb-2" />
        <div className="grid grid-cols-2 gap-1">
          <div className="h-4 bg-base-200 rounded" />
          <div className="h-4 bg-base-200 rounded" />
          <div className="h-4 bg-base-200 rounded" />
          <div className="h-4 bg-base-200 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyCard = ({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string } | null;
}) => (
  <div className="card bg-base-200 p-8 text-center">
    <h2 className="font-display text-base mb-1">{title}</h2>
    <p className="opacity-70 mb-4">{body}</p>
    {cta && (
      <Link href={cta.href} className="btn btn-primary btn-sm self-center">
        {cta.label}
      </Link>
    )}
  </div>
);

export default Collection;
