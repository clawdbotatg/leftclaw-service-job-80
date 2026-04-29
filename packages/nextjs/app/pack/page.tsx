"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { Address as AddressType, formatUnits } from "viem";
import { base } from "viem/chains";
import { useAccount, useChainId, useReadContracts, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import {
  useDeployedContractInfo,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { useWriteAndOpen } from "~~/hooks/useWriteAndOpen";
import scaffoldConfig from "~~/scaffold.config";
import { buildOnrampBuyUrl, fetchEthUsdPrice, formatEthWithUsd, formatUsdc } from "~~/utils/animalKingdom";
import { notification } from "~~/utils/scaffold-eth";

// Baseline block for `useScaffoldEventHistory`. Stage 5 will redeploy and update
// `deployedContracts.ts` with a real `deployedOnBlock` (the scaffold hook prefers
// that value when present); until then we use a hardcoded recent baseline so we
// don't ask Alchemy to scan the entire Base history per page mount.
// Base head as of Stage 7 audit is ~45.3M; 45M is a safe lower bound for any
// deploy that will happen in Stage 5 or later.
const BASE_EVENT_HISTORY_FALLBACK_BLOCK = 45_000_000n;

const PACK_IDS_TO_CHECK: readonly number[] = [1, 2, 3, 4, 5];

type Pack = {
  packType: number;
  priceWei: bigint;
  priceUsdc: bigint;
  active: boolean;
  name: string;
};

type PendingPurchase = {
  txHash: `0x${string}`;
  blockNumber: number | null;
  packType: number;
  buyer: string;
  timestamp: number;
};

const PENDING_KEY = "akc:pendingPackPurchase";

const PackPage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: packShop } = useDeployedContractInfo({ contractName: "PackShop" });

  const [ethUsd, setEthUsd] = useState<number | null>(null);
  useEffect(() => {
    fetchEthUsdPrice().then(setEthUsd);
  }, []);

  // Fetch pack catalog: read packs[1..5] in one batch.
  const packCalls = useMemo(() => {
    if (!packShop) return [];
    return PACK_IDS_TO_CHECK.map(id => ({
      address: packShop.address,
      abi: packShop.abi,
      functionName: "getPack" as const,
      args: [id] as const,
    }));
  }, [packShop]);

  const { data: packsRaw, refetch: refetchPacks } = useReadContracts({
    contracts: packCalls as any,
    query: { enabled: packCalls.length > 0 },
  });

  const packs: Pack[] = useMemo(() => {
    if (!packsRaw) return [];
    return PACK_IDS_TO_CHECK.map((id, i) => {
      const r = packsRaw[i];
      if (r?.status !== "success") return null;
      // getPack returns the struct as { priceWei, priceUsdc, active, name } — viem represents it positionally.

      const v = r.result as any;
      return {
        packType: id,
        priceWei: BigInt(v.priceWei ?? v[0] ?? 0),
        priceUsdc: BigInt(v.priceUsdc ?? v[1] ?? 0),
        active: Boolean(v.active ?? v[2]),
        name: String(v.name ?? v[3] ?? ""),
      };
    }).filter((p): p is Pack => p !== null && p.active);
  }, [packsRaw]);

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto w-full">
      <h1 className="font-display text-xl mb-1">Pack Shop</h1>
      <p className="opacity-70 text-sm mb-6">
        Each pack rolls creatures with permanent onchain stats. Pay in ETH, USDC, or fiat.
      </p>

      <PendingPurchaseBanner />

      {!isConnected && (
        <div className="card bg-base-200 p-6 mb-4 text-center">
          <p className="opacity-70 mb-3">Connect a wallet or sign in to buy packs.</p>
        </div>
      )}

      {packs.length === 0 && (
        <div className="card bg-base-200 p-8 text-center">
          <h2 className="font-display text-base mb-1">No active packs</h2>
          <p className="opacity-70">
            The game admin hasn&apos;t seeded any packs yet, or the contract isn&apos;t deployed on this network.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packs.map(p => (
          <PackCard
            key={p.packType}
            pack={p}
            packShopAddress={packShop?.address}
            buyer={connectedAddress as AddressType | undefined}
            ethUsd={ethUsd}
            onPurchaseSettled={() => refetchPacks()}
          />
        ))}
      </div>

      <FiatOnrampSection buyer={connectedAddress as AddressType | undefined} />

      <PackOpenedListener buyer={connectedAddress as AddressType | undefined} />
    </div>
  );
};

const PendingPurchaseBanner = () => {
  const [pending, setPending] = useState<PendingPurchase | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PENDING_KEY);
      if (raw) setPending(JSON.parse(raw));
    } catch {
      // ignore — Safari Private Mode etc.
    }
  }, []);
  if (!pending) return null;
  const ageSec = Math.floor((Date.now() - pending.timestamp) / 1000);
  if (ageSec > 600) {
    // Stale — clear it.
    if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_KEY);
    return null;
  }
  return (
    <div className="alert alert-info mb-4">
      <div className="flex flex-col text-sm">
        <strong>Pending pack roll</strong>
        <span className="opacity-80">
          We&apos;re still waiting for the off-chain roller to mint your creatures from{" "}
          <a href={`https://basescan.org/tx/${pending.txHash}`} target="_blank" rel="noreferrer" className="link">
            this purchase
          </a>
          . They will appear in your collection automatically. ({ageSec}s elapsed)
        </span>
      </div>
    </div>
  );
};

const PackCard = ({
  pack,
  packShopAddress,
  buyer,
  ethUsd,
  onPurchaseSettled,
}: {
  pack: Pack;
  packShopAddress: string | undefined;
  buyer: AddressType | undefined;
  ethUsd: number | null;
  onPurchaseSettled: () => void;
}) => {
  // Wrong-network gate (QA SKILL ship-blocker, Issue #7): when connected on a non-Base
  // chain, the primary CTA must be a Switch button — not a disabled Buy or a header-only
  // dropdown. We render a single Switch CTA in the same slot as the buy stack.
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const onWrongNetwork = Boolean(buyer) && chainId !== base.id;

  const { writeContractAsync: writePack, isMining: isBuyingEth } = useScaffoldWriteContract({
    contractName: "PackShop",
  });
  const { writeContractAsync: writeUsdcPack, isMining: isBuyingUsdc } = useScaffoldWriteContract({
    contractName: "PackShop",
  });
  const { writeContractAsync: writeUsdcApprove, isMining: isApproving } = useScaffoldWriteContract({
    contractName: "USDC",
  });
  const { writeAndOpen } = useWriteAndOpen();

  // Allowance + balance for USDC.
  const { data: allowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [buyer, packShopAddress as `0x${string}` | undefined],
  });
  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [buyer],
  });

  const allowanceEnough = allowance !== undefined && allowance >= pack.priceUsdc;
  const usdcBalanceEnough = usdcBalance !== undefined && usdcBalance >= pack.priceUsdc;

  // Cooldown after approve confirms — keeps the Buy button disabled even if the
  // user's RPC hasn't propagated the new allowance yet.
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const [cooldownActive, setCooldownActive] = useState(false);
  // Issue #14 — explicit `approvalSubmitting` state per QA SKILL pattern.
  // Bridges the click→hash gap and the wait-for-receipt path so `isApproving`
  // (from the scaffold hook) plus `cooldownActive` (after receipt) plus this
  // flag never have a window where they're all simultaneously false while the
  // approve transaction is in-flight.
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  useEffect(() => {
    if (!approveConfirmed) return;
    setCooldownActive(true);
    const t = setTimeout(() => {
      setCooldownActive(false);
      refetchAllowance();
    }, 3000);
    return () => clearTimeout(t);
  }, [approveConfirmed, refetchAllowance]);

  const persistPending = (txHash: `0x${string}`) => {
    if (typeof window === "undefined" || !buyer) return;
    const v: PendingPurchase = {
      txHash,
      blockNumber: null,
      packType: pack.packType,
      buyer,
      timestamp: Date.now(),
    };
    try {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify(v));
    } catch {
      // ignore
    }
  };

  const handleBuyEth = async () => {
    if (!buyer) return notification.warning("Connect your wallet first.");
    try {
      // expectedPriceWei pins the price the user saw — slippage guard against owner
      // price changes between read and execute (Stage 6 audit fix #6).
      const hash = await writeAndOpen(() =>
        writePack({
          functionName: "buyPack",
          args: [pack.packType, pack.priceWei],
          value: pack.priceWei,
        }),
      );
      if (hash) persistPending(hash);
      onPurchaseSettled();
    } catch (e) {
      // notification handled by useTransactor
      console.error(e);
    }
  };

  const handleApprove = async () => {
    if (!buyer || !packShopAddress) return;
    if (approvalSubmitting || cooldownActive) return;
    setApprovalSubmitting(true);
    try {
      const hash = await writeAndOpen(() =>
        writeUsdcApprove({
          functionName: "approve",
          args: [packShopAddress as `0x${string}`, pack.priceUsdc],
        }),
      );
      if (hash) setApproveTxHash(hash);
    } catch (e) {
      console.error(e);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleBuyUsdc = async () => {
    if (!buyer) return notification.warning("Connect your wallet first.");
    try {
      // expectedPriceUsdc pins the price the user saw — slippage guard against owner
      // price changes between read and execute (Stage 6 audit fix #6).
      const hash = await writeAndOpen(() =>
        writeUsdcPack({
          functionName: "buyPackUSDC",
          args: [pack.packType, pack.priceUsdc],
        }),
      );
      if (hash) persistPending(hash);
      onPurchaseSettled();
    } catch (e) {
      console.error(e);
    }
  };

  const ethDisabled = pack.priceWei === 0n;
  const usdcDisabled = pack.priceUsdc === 0n;
  // Issue #14 — single derived disabled boolean covering the full
  // approve→cooldown→buy flow. `approvalSubmitting` is the explicit
  // click→hash window; `cooldownActive` is the receipt→cache window;
  // `isBuyingUsdc` is the buy itself. With this gate the Buy button is
  // never clickable mid-approval.
  const buyUsdcDisabled =
    usdcDisabled || !allowanceEnough || !usdcBalanceEnough || approvalSubmitting || cooldownActive || isBuyingUsdc;

  // Validate spender end-to-end: the address passed to USDC.approve here is exactly
  // `packShopAddress`, which is the address PackShop calls `transferFrom` from inside
  // `buyPackUSDC` (verified by reading PackShop.sol). This is the cross-flow invariant
  // from USERJOURNEY.md.

  return (
    <div className="card bg-base-100 shadow-md p-5">
      <div className="flex items-start justify-between mb-2">
        <h2 className="font-display text-sm">{pack.name || `Pack #${pack.packType}`}</h2>
        <span className="text-[10px] opacity-50 uppercase">type {pack.packType}</span>
      </div>

      <div className="flex flex-col gap-2 my-3 text-sm">
        <div>
          <div className="opacity-70 text-xs">Price (ETH)</div>
          <div className="font-bold">{formatEthWithUsd(pack.priceWei, ethUsd)}</div>
        </div>
        <div>
          <div className="opacity-70 text-xs">Price (USDC)</div>
          <div className="font-bold">{formatUsdc(pack.priceUsdc)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        {onWrongNetwork ? (
          // Issue #7 — wrong-network gate. When connected to a non-Base chain, the
          // primary CTA in this slot must become a Switch button. The header dropdown
          // alone is not sufficient (per QA SKILL ship-blocker — one-button-at-a-time).
          <>
            <button
              className="btn btn-warning btn-sm"
              type="button"
              disabled={isSwitchingChain}
              onClick={() => switchChain({ chainId: base.id })}
            >
              {isSwitchingChain ? <span className="loading loading-spinner loading-xs" /> : "Switch to Base to buy"}
            </button>
            <span className="text-xs opacity-60">Animal Kingdom TCG runs on Base mainnet.</span>
          </>
        ) : (
          <>
            <button
              className="btn btn-primary btn-sm"
              disabled={!buyer || ethDisabled || isBuyingEth}
              onClick={handleBuyEth}
              type="button"
            >
              {isBuyingEth ? <span className="loading loading-spinner loading-xs" /> : "Buy with ETH"}
            </button>
            {ethDisabled && <span className="text-xs opacity-60">ETH purchases disabled for this pack.</span>}

            {!usdcDisabled && (
              <>
                {!allowanceEnough && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleApprove}
                    disabled={!buyer || isApproving || approvalSubmitting || cooldownActive}
                    type="button"
                  >
                    {isApproving || approvalSubmitting ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : cooldownActive ? (
                      "Waiting for approval to settle…"
                    ) : (
                      `Approve ${formatUnits(pack.priceUsdc, 6)} USDC`
                    )}
                  </button>
                )}
                <button
                  className="btn btn-accent btn-sm"
                  disabled={!buyer || buyUsdcDisabled}
                  onClick={handleBuyUsdc}
                  type="button"
                >
                  {isBuyingUsdc ? <span className="loading loading-spinner loading-xs" /> : "Buy with USDC"}
                </button>
                {!allowanceEnough && (
                  <span className="text-xs opacity-60">Approve USDC, wait one block + cooldown, then Buy.</span>
                )}
                {!usdcBalanceEnough && allowanceEnough && (
                  <span className="text-xs text-error">
                    You need {formatUnits(pack.priceUsdc - (usdcBalance ?? 0n), 6)} more USDC.
                  </span>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const FiatOnrampSection = ({ buyer }: { buyer: AddressType | undefined }) => {
  const onrampAppId = scaffoldConfig.onrampAppId;
  const isConfigured = Boolean(onrampAppId);

  // Build a simple Onramp URL. Static-export safe — pure URL construction.
  const onrampUrl = useMemo(() => {
    if (!isConfigured || !buyer) return null;
    return buildOnrampBuyUrl({
      appId: onrampAppId,
      destinationAddress: buyer,
      defaultAsset: "ETH",
      presetFiatAmount: 10,
    });
  }, [isConfigured, buyer, onrampAppId]);

  return (
    <div className="card bg-base-100 shadow-md p-5 mt-6">
      <h2 className="font-display text-sm mb-2">Pay with USD (Coinbase Onramp)</h2>
      <p className="text-xs opacity-70 mb-3">
        Buy ETH or USDC with a credit card, Apple Pay, or bank transfer. Coinbase delivers funds to your wallet — then
        come back to buy a pack.
      </p>
      {!isConfigured ? (
        <button
          type="button"
          className="btn btn-disabled btn-sm self-start"
          disabled
          title="Fiat purchase requires admin setup. Set NEXT_PUBLIC_ONRAMP_APP_ID."
        >
          Buy with USD (unavailable)
        </button>
      ) : !buyer ? (
        <button type="button" className="btn btn-disabled btn-sm self-start" disabled>
          Connect wallet to buy with USD
        </button>
      ) : (
        <a href={onrampUrl ?? "#"} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm self-start">
          Buy with USD
        </a>
      )}
      {!isConfigured && (
        <span className="text-[11px] opacity-60 mt-2">
          Game admin: configure <code>NEXT_PUBLIC_ONRAMP_APP_ID</code> at{" "}
          <a href="https://portal.cdp.coinbase.com/products/onramp" target="_blank" rel="noreferrer" className="link">
            cdp.coinbase.com
          </a>
          .
        </span>
      )}
    </div>
  );
};

const PackOpenedListener = ({ buyer }: { buyer: AddressType | undefined }) => {
  // Watch CreatureMinted for our buyer — when events flow in we know the pack rolled.
  const { data: events } = useScaffoldEventHistory({
    contractName: "AnimalKingdomCard",
    eventName: "CreatureMinted",
    watch: true,
    // Issue #13 — never scan from block 0 of Base mainnet. Use the recent
    // baseline so Alchemy isn't asked to chunk hundreds of millions of blocks.
    // The scaffold hook prefers `deployedOnBlock` from `deployedContracts.ts`
    // when set; this baseline is the floor for any deploy that hasn't yet
    // populated that field.
    fromBlock: BASE_EVENT_HISTORY_FALLBACK_BLOCK,
    filters: { to: buyer },
    blockData: false,
  });

  // Side effect: clear the pending banner when the most recent event timestamp is
  // newer than the pendingPurchase timestamp.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    try {
      const pending: PendingPurchase = JSON.parse(raw);
      // If we've seen any CreatureMinted event for this buyer since the purchase, clear it.
      if (events && events.length > 0) {
        const latest = events[events.length - 1];

        const blockNumber = Number((latest as any).blockNumber ?? 0);
        if (blockNumber > 0 && pending.timestamp < Date.now() - 5_000) {
          window.localStorage.removeItem(PENDING_KEY);
          notification.success("Your creatures have arrived!");
        }
      }
    } catch {
      // ignore
    }
  }, [events]);

  if (!buyer || !events || events.length === 0) return null;

  // Show the most recent 5 mints inline.
  const recent = events.slice(-5).reverse();
  return (
    <section className="mt-10">
      <h2 className="font-display text-sm mb-3">Recent mints to your wallet</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {recent.map((e, i) => {
          const args = (e as any).args ?? {};
          const tokenId = args.tokenId?.toString() ?? "?";
          return (
            <Link
              key={i}
              href="/collection"
              className="card bg-base-100 shadow p-3 text-center hover:shadow-md transition-shadow"
            >
              <div className="text-2xl">🎴</div>
              <div className="text-xs opacity-70">#{tokenId}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default PackPage;
