/**
 * Seed the on-chain trait catalog.
 *
 * Run ONCE after deploying contracts. Same caveats as seed-pack-pool.ts:
 *   - chain-config.json populated (TraitShop address)
 *   - HOT_WALLET_PRIVATE_KEY must correspond to the TraitShop owner.
 *
 * Edit the TRAIT_TEMPLATES table in `src/traits.ts` to change the catalog.
 */

import { config as loadDotenv } from "dotenv";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { ADD_TRAIT_FN, loadChainConfig } from "../src/chain.js";
import { logger } from "../src/logger.js";
import { TRAIT_TEMPLATES } from "../src/traits.js";

loadDotenv();

const main = async () => {
  const cfg = loadChainConfig();
  if (!cfg) throw new Error("chain-config.json missing — populate it first.");
  const RPC = process.env.ALCHEMY_RPC_URL;
  if (!RPC) throw new Error("ALCHEMY_RPC_URL not set");
  const pk = process.env.HOT_WALLET_PRIVATE_KEY ?? "";
  if (!pk) throw new Error("HOT_WALLET_PRIVATE_KEY not set");

  const account = privateKeyToAccount(pk as Hex);
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC) });

  for (const t of TRAIT_TEMPLATES) {
    logger.info({ trait: t }, "addTrait");
    const hash = await wallet.writeContract({
      address: cfg.traitShop as Address,
      abi: [ADD_TRAIT_FN],
      functionName: "addTrait",
      args: [BigInt(t.id), t.priceWei, t.metadataURI],
    });
    logger.info({ hash, traitId: t.id }, "submitted");
  }
  logger.info("trait seed complete");
};

main().catch(err => {
  logger.error({ err }, "seed-traits failed");
  process.exit(1);
});
