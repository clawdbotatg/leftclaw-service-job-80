"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount, useReadContracts } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { creatureEmoji, creatureName } from "~~/utils/animalKingdom";
import { notification } from "~~/utils/scaffold-eth";

type Creature = {
  tokenId: bigint;
  creatureId: number;
  atk: number;
  def: number;
  chg: number;
  trk: number;
};

type Slot = bigint | null;

type SavedDeck = {
  name: string;
  slots: (string | null)[]; // tokenIds as strings (bigint serialization)
  savedAt: number;
};

const DECKS_KEY_PREFIX = "akc:decks:"; // suffixed by wallet address

const DeckPage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();

  const { data: balance } = useScaffoldReadContract({
    contractName: "AnimalKingdomCard",
    functionName: "balanceOf",
    args: [connectedAddress],
  });
  const balanceNum = balance !== undefined ? Number(balance) : 0;

  const { data: card } = useDeployedContractInfo({ contractName: "AnimalKingdomCard" });

  const indexCalls = useMemo(() => {
    if (!connectedAddress || !card || balanceNum === 0) return [];
    return Array.from({ length: balanceNum }, (_, i) => ({
      address: card.address,
      abi: card.abi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [connectedAddress, BigInt(i)] as const,
    }));
  }, [connectedAddress, card, balanceNum]);

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

  const owned: Creature[] = useMemo(() => {
    if (!statsRaw) return [];
    return tokenIds.map((id, i) => {
      const r = statsRaw[i];

      const s: any = r?.status === "success" ? r.result : [0, 0, 0, 0, 0];
      return {
        tokenId: id,
        creatureId: Number(s[0] ?? 0),
        atk: Number(s[1] ?? 0),
        def: Number(s[2] ?? 0),
        chg: Number(s[3] ?? 0),
        trk: Number(s[4] ?? 0),
      };
    });
  }, [tokenIds, statsRaw]);

  const ownedById = useMemo(() => new Map(owned.map(c => [c.tokenId.toString(), c])), [owned]);

  const [slots, setSlots] = useState<Slot[]>([null, null, null, null]);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [deckName, setDeckName] = useState<string>("Deck 1");

  // Load decks from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined" || !connectedAddress) return;
    try {
      const raw = window.localStorage.getItem(DECKS_KEY_PREFIX + connectedAddress.toLowerCase());
      if (raw) {
        const parsed = JSON.parse(raw) as SavedDeck[];
        setSavedDecks(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      // ignore
    }
  }, [connectedAddress]);

  const persistDecks = (next: SavedDeck[]) => {
    if (typeof window === "undefined" || !connectedAddress) return;
    try {
      window.localStorage.setItem(DECKS_KEY_PREFIX + connectedAddress.toLowerCase(), JSON.stringify(next));
      setSavedDecks(next);
    } catch {
      notification.warning("Couldn't save locally — your browser blocks storage.");
    }
  };

  const addToDeck = (id: bigint) => {
    setSlots(prev => {
      const idx = prev.findIndex(s => s === null);
      if (idx === -1) {
        notification.info("Deck is full — remove a slot first.");
        return prev;
      }
      const dup = prev.some(s => s !== null && s === id);
      if (dup) notification.info("Same creature added — totals doubled.");
      const next = [...prev];
      next[idx] = id;
      return next;
    });
  };

  const removeFromDeck = (slotIdx: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const slotsAsCreatures = slots.map(s => (s === null ? null : (ownedById.get(s.toString()) ?? null)));
  const totals = slotsAsCreatures.reduce(
    (acc, c) => {
      if (!c) return acc;
      return { atk: acc.atk + c.atk, def: acc.def + c.def, chg: acc.chg + c.chg, trk: acc.trk + c.trk };
    },
    { atk: 0, def: 0, chg: 0, trk: 0 },
  );
  // Highest TRK = active Trick.
  const activeTrick = slotsAsCreatures.reduce<Creature | null>((best, c) => {
    if (!c) return best;
    if (!best || c.trk > best.trk) return c;
    return best;
  }, null);
  // CHG counter: any creature whose highest base stat is CHG → +1 ATK.
  const chgBonus = slotsAsCreatures.reduce((acc, c) => {
    if (!c) return acc;
    const max = Math.max(c.atk, c.def, c.chg, c.trk);
    return c.chg === max ? acc + 1 : acc;
  }, 0);

  const filledSlots = slots.filter(s => s !== null).length;
  const canSave = filledSlots === 4 && deckName.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const next: SavedDeck = {
      name: deckName.trim(),
      slots: slots.map(s => (s === null ? null : s.toString())),
      savedAt: Date.now(),
    };
    const existing = savedDecks.findIndex(d => d.name === next.name);
    const updated = existing === -1 ? [...savedDecks, next] : savedDecks.map((d, i) => (i === existing ? next : d));
    persistDecks(updated);
    notification.success(`Saved deck "${next.name}".`);
  };

  const handleLoad = (d: SavedDeck) => {
    setSlots(d.slots.map(s => (s === null ? null : BigInt(s))));
    setDeckName(d.name);
  };

  const handleDelete = (name: string) => {
    persistDecks(savedDecks.filter(d => d.name !== name));
  };

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto w-full">
      <h1 className="font-display text-xl mb-1">Deck Builder</h1>
      <p className="opacity-70 text-sm mb-6">
        Pick four creatures. Live ATK / DEF / CHG / TRK totals. Decks save in this browser.
      </p>

      {!isConnected && (
        <div className="card bg-base-200 p-6 text-center">
          <p className="opacity-70">Connect or sign in to build a deck.</p>
        </div>
      )}

      {isConnected && balanceNum === 0 && (
        <div className="card bg-base-200 p-8 text-center">
          <h2 className="font-display text-base mb-1">No creatures yet</h2>
          <p className="opacity-70 mb-3">Open a pack first.</p>
          <Link href="/pack" className="btn btn-primary btn-sm self-center">
            Open a pack
          </Link>
        </div>
      )}

      {isConnected && balanceNum > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Collection */}
          <section className="lg:col-span-2">
            <h2 className="font-display text-sm mb-3">Collection ({owned.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {owned.map(c => (
                <button
                  key={c.tokenId.toString()}
                  className="card bg-base-100 shadow p-3 text-left hover:shadow-md transition-shadow"
                  onClick={() => addToDeck(c.tokenId)}
                  type="button"
                >
                  <div className="flex justify-between items-start">
                    <div className="text-3xl" aria-hidden>
                      {creatureEmoji(c.creatureId)}
                    </div>
                    <span className="text-[10px] opacity-50">#{c.tokenId.toString()}</span>
                  </div>
                  <div className="font-display text-xs mt-1">{creatureName(c.creatureId)}</div>
                  <div className="grid grid-cols-2 gap-0.5 mt-1 text-[11px]">
                    <span>ATK {c.atk}</span>
                    <span>DEF {c.def}</span>
                    <span>CHG {c.chg}</span>
                    <span>TRK {c.trk}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Deck slots */}
          <section>
            <h2 className="font-display text-sm mb-3">Your Deck</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {slotsAsCreatures.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => c && removeFromDeck(i)}
                  className={`card p-3 text-left ${c ? "bg-base-100 shadow" : "bg-base-200 border-2 border-dashed border-base-300"}`}
                >
                  {c ? (
                    <>
                      <div className="text-2xl" aria-hidden>
                        {creatureEmoji(c.creatureId)}
                      </div>
                      <div className="text-[11px] mt-1 opacity-70">#{c.tokenId.toString()}</div>
                    </>
                  ) : (
                    <div className="text-center text-xs opacity-60 py-3">Slot {i + 1}</div>
                  )}
                </button>
              ))}
            </div>

            <div className="card bg-base-100 p-3 mb-3">
              <h3 className="text-xs opacity-70 mb-1">Team Totals</h3>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <span>
                  ATK: <strong>{totals.atk}</strong>
                  {chgBonus > 0 && <span className="text-success"> +{chgBonus}</span>}
                </span>
                <span>
                  DEF: <strong>{totals.def}</strong>
                </span>
                <span>
                  CHG: <strong>{totals.chg}</strong>
                </span>
                <span>
                  TRK: <strong>{totals.trk}</strong>
                </span>
              </div>
              {activeTrick && (
                <div className="text-[11px] mt-2 opacity-80">
                  <span className="opacity-60">Active Trick:</span> {creatureEmoji(activeTrick.creatureId)}{" "}
                  {creatureName(activeTrick.creatureId)} (TRK {activeTrick.trk})
                </div>
              )}
              {chgBonus > 0 && (
                <div className="text-[11px] mt-1 opacity-80">
                  <span className="opacity-60">CHG counter bonus:</span> +{chgBonus} ATK to team
                </div>
              )}
            </div>

            <div className="card bg-base-100 p-3 mb-3">
              <label className="text-xs opacity-70 mb-1">Deck name</label>
              <input
                className="input input-bordered input-sm w-full mb-2"
                value={deckName}
                onChange={e => setDeckName(e.target.value)}
                placeholder="My deck"
              />
              <button type="button" className="btn btn-primary btn-sm w-full" disabled={!canSave} onClick={handleSave}>
                Save Deck
              </button>
              {filledSlots < 4 && (
                <span className="text-[11px] opacity-60 mt-1">
                  {balanceNum < 4
                    ? `Need ${4 - balanceNum} more creature${4 - balanceNum === 1 ? "" : "s"} — open more packs.`
                    : `Pick ${4 - filledSlots} more.`}
                </span>
              )}
            </div>

            {savedDecks.length > 0 && (
              <div className="card bg-base-100 p-3">
                <h3 className="text-xs opacity-70 mb-2">Saved decks</h3>
                <ul className="flex flex-col gap-1">
                  {savedDecks.map(d => (
                    <li key={d.name} className="flex items-center justify-between text-sm">
                      <span>{d.name}</span>
                      <span className="flex gap-1">
                        <button className="btn btn-ghost btn-xs" type="button" onClick={() => handleLoad(d)}>
                          Load
                        </button>
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          type="button"
                          onClick={() => handleDelete(d.name)}
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default DeckPage;
