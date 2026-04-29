/**
 * Seed the on-chain pack catalog with sane defaults.
 *
 * Run ONCE after deploying contracts. Requires:
 *   - chain-config.json populated (PackShop address)
 *   - HOT_WALLET_PRIVATE_KEY corresponds to the PackShop owner OR has been
 *     temporarily delegated. (PackShop.addPack is onlyOwner.) Recommended:
 *     run this from the client's deployer wallet, NOT the server hot wallet.
 *
 * Edit the PACK_SEEDS table below before running for your deploy.
 */

import { config as loadDotenv } from "dotenv";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { ADD_PACK_FN, loadChainConfig } from "../src/chain.js";
import { logger } from "../src/logger.js";

loadDotenv();

type PackSeed = {
  packType: number;
  priceWei: bigint;
  priceUsdc: bigint;
  name: string;
};

// Edit me before running.
const PACK_SEEDS: PackSeed[] = [
  // Starter — 0.001 ETH / 4 USDC. 3 creatures.
  { packType: 1, priceWei: 1_000_000_000_000_000n, priceUsdc: 4_000_000n, name: "Starter Pack" },
  // Standard — 0.0025 ETH / 10 USDC. 5 creatures.
  { packType: 2, priceWei: 2_500_000_000_000_000n, priceUsdc: 10_000_000n, name: "Standard Pack" },
  // Premium — 0.005 ETH / 20 USDC. 7 creatures.
  { packType: 3, priceWei: 5_000_000_000_000_000n, priceUsdc: 20_000_000n, name: "Premium Pack" },
  // Legendary — 0.01 ETH / 40 USDC. 10 creatures.
  { packType: 4, priceWei: 10_000_000_000_000_000n, priceUsdc: 40_000_000n, name: "Legendary Pack" },
];

const main = async () => {
  const cfg = loadChainConfig();
  if (!cfg) throw new Error("chain-config.json missing — populate it first.");
  const RPC = process.env.ALCHEMY_RPC_URL;
  if (!RPC) throw new Error("ALCHEMY_RPC_URL not set");
  const pk = process.env.HOT_WALLET_PRIVATE_KEY ?? "";
  if (!pk) throw new Error("HOT_WALLET_PRIVATE_KEY not set");

  const account = privateKeyToAccount(pk as Hex);
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC) });

  for (const p of PACK_SEEDS) {
    logger.info({ pack: p }, "addPack");
    const hash = await wallet.writeContract({
      address: cfg.packShop as Address,
      abi: [ADD_PACK_FN],
      functionName: "addPack",
      args: [p.packType, p.priceWei, p.priceUsdc, p.name],
    });
    logger.info({ hash, packType: p.packType }, "submitted");
  }
  logger.info("seed complete");
};

main().catch(err => {
  logger.error({ err }, "seed-pack-pool failed");
  process.exit(1);
});
