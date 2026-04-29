/**
 * Pack-roll listener.
 *
 * Watches `PackPurchased(buyer, packType, requestId)` on the deployed PackShop
 * via viem `watchContractEvent`. On each event:
 *   1. Look up pack-type → creature count from PACK_TYPE_TO_COUNT.
 *   2. Roll N creatures: pick a creatureId uniformly, jitter base stats by ±1.
 *   3. Call `AnimalKingdomCard.batchMintPack(buyer, [...creatures])` from the
 *      hot wallet (HOT_WALLET_PRIVATE_KEY env). Wallet MUST hold MINTER_ROLE.
 *
 * Idempotency: we de-duplicate on (txHash, logIndex) using a small in-memory
 * set + a `processed_pack_purchases` table is left for Stage 6 if needed.
 * For v1 we restart-clean.
 *
 * Errors are logged + retried with exponential backoff. Mints that fail
 * permanently are surfaced via logs so the operator can re-run manually.
 */

import { decodeEventLog, parseAbiItem, type Address, type Log } from "viem";

import {
  CARD_ABI,
  PACK_PURCHASED_EVENT,
  getWalletClient,
  loadChainConfig,
  publicClient,
  type WalletClientT,
} from "./chain.js";
import { CREATURE_TEMPLATES, PACK_TYPE_TO_COUNT, rollStat } from "./creatures.js";
import { logger } from "./logger.js";

type Creature = {
  creatureId: number;
  atk: number;
  def: number;
  chg: number;
  trk: number;
};

const rollCreature = (): Creature => {
  const tpl = CREATURE_TEMPLATES[Math.floor(Math.random() * CREATURE_TEMPLATES.length)]!;
  return {
    creatureId: tpl.id,
    atk: rollStat(tpl.base.atk),
    def: rollStat(tpl.base.def),
    chg: rollStat(tpl.base.chg),
    trk: rollStat(tpl.base.trk),
  };
};

const rollPack = (packType: number): Creature[] => {
  const n = PACK_TYPE_TO_COUNT[packType] ?? 3;
  return Array.from({ length: n }, () => rollCreature());
};

const processedKeys = new Set<string>();

export const startPackRollListener = async (): Promise<() => void> => {
  const cfg = loadChainConfig();
  if (!cfg || !publicClient) {
    logger.warn("pack-roll listener disabled — missing chain-config.json or RPC");
    return () => {};
  }
  const wallet = getWalletClient();
  if (!wallet) {
    logger.warn("pack-roll listener disabled — HOT_WALLET_PRIVATE_KEY not set");
    return () => {};
  }

  logger.info({ packShop: cfg.packShop, card: cfg.card, hot: wallet.address }, "starting pack-roll listener");

  const eventAbi = parseAbiItem(
    "event PackPurchased(address indexed buyer, uint8 indexed packType, bytes32 requestId)",
  );

  const unwatch = publicClient.watchEvent({
    address: cfg.packShop as Address,
    event: eventAbi,
    onLogs: async logs => {
      for (const log of logs) {
        await handleLog(log, cfg, wallet);
      }
    },
    onError: err => logger.error({ err }, "pack-roll watchEvent error"),
  });

  return () => unwatch();
};

const handleLog = async (log: Log, cfg: { card: Address }, wallet: { client: WalletClientT; address: Address }) => {
  if (!wallet?.client) return;
  const dedupKey = `${log.transactionHash ?? "no-tx"}-${log.logIndex ?? 0}`;
  if (processedKeys.has(dedupKey)) return;
  processedKeys.add(dedupKey);

  let buyer: Address;
  let packType: number;
  try {
    const decoded = decodeEventLog({
      abi: [PACK_PURCHASED_EVENT],
      data: log.data,
      topics: log.topics,
    }) as unknown as { args: { buyer: Address; packType: number; requestId: `0x${string}` } };
    buyer = decoded.args.buyer;
    packType = decoded.args.packType;
  } catch (err) {
    logger.warn({ err, log }, "could not decode PackPurchased event");
    return;
  }

  const creatures = rollPack(packType);
  logger.info({ buyer, packType, count: creatures.length }, "rolling pack");

  await mintWithRetry(buyer, creatures, cfg.card, wallet.client);
};

const mintWithRetry = async (
  buyer: Address,
  creatures: Creature[],
  cardAddress: Address,
  wallet: WalletClientT,
  attempt = 0,
): Promise<void> => {
  try {
    if (!publicClient) throw new Error("publicClient not set");
    const hash = await wallet.writeContract({
      account: wallet.account!,
      chain: wallet.chain,
      address: cardAddress,
      abi: CARD_ABI,
      functionName: "batchMintPack",
      args: [buyer, creatures],
    });
    logger.info({ buyer, hash }, "batchMintPack submitted");
    await publicClient.waitForTransactionReceipt({ hash });
    logger.info({ buyer, hash }, "batchMintPack confirmed");
  } catch (err) {
    logger.error({ err, attempt, buyer }, "batchMintPack failed");
    if (attempt < 3) {
      const delay = 2 ** attempt * 5_000;
      await new Promise(r => setTimeout(r, delay));
      return mintWithRetry(buyer, creatures, cardAddress, wallet, attempt + 1);
    }
    logger.error({ buyer, creatures }, "batchMintPack permanently failed — operator must re-run manually");
  }
};
