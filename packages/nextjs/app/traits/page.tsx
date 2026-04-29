"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { Address as AddressType } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/useWriteAndOpen";
import { creatureEmoji, creatureName, fetchEthUsdPrice, formatEthWithUsd } from "~~/utils/animalKingdom";
import { notification } from "~~/utils/scaffold-eth";

const TRAIT_IDS_TO_CHECK: readonly bigint[] = Array.from({ length: 32 }, (_, i) => BigInt(i + 1));

type Trait = {
  traitId: bigint;
  priceWei: bigint;
  available: boolean;
  metadataURI: string;
};

const TraitsPage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: traitShop } = useDeployedContractInfo({ contractName: "TraitShop" });

  const [ethUsd, setEthUsd] = useState<number | null>(null);
  useEffect(() => {
    fetchEthUsdPrice().then(setEthUsd);
  }, []);

  // Pull catalog [1..32].
  const traitCalls = useMemo(() => {
    if (!traitShop) return [];
    return TRAIT_IDS_TO_CHECK.map(id => ({
      address: traitShop.address,
      abi: traitShop.abi,
      functionName: "getTrait" as const,
      args: [id] as const,
    }));
  }, [traitShop]);

  const { data: traitsRaw } = useReadContracts({
    contracts: traitCalls as any,
    query: { enabled: traitCalls.length > 0 },
  });

  const traits: Trait[] = useMemo(() => {
    if (!traitsRaw) return [];
    return TRAIT_IDS_TO_CHECK.map((id, i) => {
      const r = traitsRaw[i];
      if (r?.status !== "success") return null;

      const v = r.result as any;
      return {
        traitId: id,
        priceWei: BigInt(v.priceWei ?? v[0] ?? 0),
        available: Boolean(v.available ?? v[1]),
        metadataURI: String(v.metadataURI ?? v[2] ?? ""),
      };
    })
      .filter((t): t is Trait => t !== null)
      .filter(t => t.available);
  }, [traitsRaw]);

  const [picker, setPicker] = useState<Trait | null>(null);

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto w-full">
      <h1 className="font-display text-xl mb-1">Trait Shop</h1>
      <p className="opacity-70 text-sm mb-6">
        Buy a trait and fuse it onto one of your creatures. Append-only — no remove or replace. Capped at 32 traits per
        creature.
      </p>

      {!isConnected && (
        <div className="card bg-base-200 p-6 text-center">
          <p className="opacity-70">Connect or sign in to browse traits.</p>
        </div>
      )}

      {isConnected && traits.length === 0 && (
        <div className="card bg-base-200 p-8 text-center">
          <h2 className="font-display text-base mb-1">No traits available</h2>
          <p className="opacity-70">The game admin hasn&apos;t seeded the catalog yet.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {traits.map(t => (
          <button
            key={t.traitId.toString()}
            type="button"
            className="card bg-base-100 shadow-md p-4 text-left hover:shadow-lg transition-shadow"
            onClick={() => setPicker(t)}
          >
            <div className="text-3xl mb-2" aria-hidden>
              ✨
            </div>
            <div className="font-display text-xs">Trait #{t.traitId.toString()}</div>
            {t.metadataURI && <div className="text-[10px] opacity-50 truncate">{t.metadataURI}</div>}
            <div className="text-sm font-bold mt-1">{formatEthWithUsd(t.priceWei, ethUsd)}</div>
            <span className="btn btn-primary btn-xs mt-2 self-start">Equip on…</span>
          </button>
        ))}
      </div>

      {picker && (
        <CreaturePickerModal
          trait={picker}
          owner={connectedAddress as AddressType | undefined}
          ethUsd={ethUsd}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
};

const CreaturePickerModal = ({
  trait,
  owner,
  ethUsd,
  onClose,
}: {
  trait: Trait;
  owner: AddressType | undefined;
  ethUsd: number | null;
  onClose: () => void;
}) => {
  const { data: balance } = useScaffoldReadContract({
    contractName: "AnimalKingdomCard",
    functionName: "balanceOf",
    args: [owner],
  });
  const balanceNum = balance !== undefined ? Number(balance) : 0;
  const { data: card } = useDeployedContractInfo({ contractName: "AnimalKingdomCard" });

  const indexCalls = useMemo(() => {
    if (!owner || !card || balanceNum === 0) return [];
    return Array.from({ length: balanceNum }, (_, i) => ({
      address: card.address,
      abi: card.abi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [owner, BigInt(i)] as const,
    }));
  }, [owner, card, balanceNum]);

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

  const detailCalls = useMemo(() => {
    if (!card || tokenIds.length === 0) return [];
    return tokenIds.flatMap(id => [
      { address: card.address, abi: card.abi, functionName: "stats" as const, args: [id] as const },
      { address: card.address, abi: card.abi, functionName: "traitCount" as const, args: [id] as const },
    ]);
  }, [card, tokenIds]);

  const { data: detailsRaw } = useReadContracts({
    contracts: detailCalls as any,
    query: { enabled: detailCalls.length > 0 },
  });

  type Owned = { tokenId: bigint; creatureId: number; traits: number };
  const owned: Owned[] = useMemo(() => {
    if (!detailsRaw) return [];
    return tokenIds.map((id, i) => {
      const stats = detailsRaw[i * 2];
      const tc = detailsRaw[i * 2 + 1];

      const s: any = stats?.status === "success" ? stats.result : [0];
      const t = tc?.status === "success" ? Number(tc.result as bigint) : 0;
      return { tokenId: id, creatureId: Number(s[0] ?? 0), traits: t };
    });
  }, [tokenIds, detailsRaw]);

  const [selected, setSelected] = useState<bigint | null>(null);
  const selectedCreature = owned.find(o => o.tokenId === selected) ?? null;
  const traitsMaxed = selectedCreature ? selectedCreature.traits >= 32 : false;

  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "TraitShop" });
  const { writeAndOpen } = useWriteAndOpen();

  const handleBuy = async () => {
    if (!selected) return;
    if (traitsMaxed) {
      notification.error("This creature has 32 traits already — limit reached.");
      return;
    }
    try {
      await writeAndOpen(() =>
        writeContractAsync({
          functionName: "buyTrait",
          args: [selected, trait.traitId],
          value: trait.priceWei,
        }),
      );
      notification.success("Trait fused!");
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box max-w-2xl">
        <h3 className="font-display text-base mb-2">Equip Trait #{trait.traitId.toString()}</h3>
        <p className="text-sm opacity-70 mb-4">
          Price: <strong>{formatEthWithUsd(trait.priceWei, ethUsd)}</strong>. Pick the creature to fuse onto.
        </p>

        {balanceNum === 0 ? (
          <div className="text-center py-6">
            <p className="opacity-70 mb-3">You don&apos;t own any creatures yet.</p>
            <Link href="/pack" className="btn btn-primary btn-sm">
              Open a pack
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
            {owned.map(o => {
              const max = o.traits >= 32;
              const isSel = selected === o.tokenId;
              return (
                <button
                  key={o.tokenId.toString()}
                  type="button"
                  disabled={max}
                  onClick={() => setSelected(o.tokenId)}
                  className={`card p-2 text-left ${isSel ? "ring-2 ring-primary" : "bg-base-100"} ${max ? "opacity-50" : ""}`}
                >
                  <div className="text-2xl">{creatureEmoji(o.creatureId)}</div>
                  <div className="text-[10px] opacity-60">#{o.tokenId.toString()}</div>
                  <div className="text-[10px]">{creatureName(o.creatureId)}</div>
                  {max && <span className="badge badge-xs badge-error mt-1">MAX</span>}
                  {!max && o.traits > 0 && <span className="text-[10px] opacity-60">{o.traits} traits</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!selected || traitsMaxed || isMining}
            onClick={handleBuy}
          >
            {isMining ? <span className="loading loading-spinner loading-xs" /> : "Buy & Fuse"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
};

export default TraitsPage;
