/**
 * viem clients + contract bindings for the game server.
 *
 * Addresses come from `chain-config.json` at the /server/ root, populated by
 * the client AFTER deploy (Stage 5). We deliberately do NOT read
 * `packages/nextjs/contracts/deployedContracts.ts` because the server is a
 * separate Node project — coupling them would force the server to live inside
 * the yarn workspace, which complicates Railway / Fly.io deploys.
 *
 * Expected `chain-config.json` shape:
 *   {
 *     "chainId": 8453,
 *     "card": "0x...",
 *     "packShop": "0x...",
 *     "traitShop": "0x..."
 *   }
 *
 * If the file is missing, the server logs a warning and pack-roll / fuse
 * features stay disabled — the WS battle loop still works.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, getAddress, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// -------------------------------------------------------------------------
// chain-config.json loader
// -------------------------------------------------------------------------

export type ChainConfig = {
  chainId: number;
  card: Address;
  packShop: Address;
  traitShop: Address;
};

let cachedConfig: ChainConfig | null = null;

export const loadChainConfig = (): ChainConfig | null => {
  if (cachedConfig) return cachedConfig;
  // Look for chain-config.json in common locations relative to /server/ root.
  const candidatePaths = [
    join(__dirname, "..", "chain-config.json"),
    join(__dirname, "..", "..", "chain-config.json"),
    join(process.cwd(), "chain-config.json"),
  ];
  for (const p of candidatePaths) {
    try {
      const raw = readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw) as ChainConfig;
      cachedConfig = {
        chainId: parsed.chainId,
        card: getAddress(parsed.card),
        packShop: getAddress(parsed.packShop),
        traitShop: getAddress(parsed.traitShop),
      };
      logger.info({ path: p, addresses: cachedConfig }, "loaded chain-config.json");
      return cachedConfig;
    } catch {
      // try next
    }
  }
  logger.warn(
    { searched: candidatePaths },
    "chain-config.json not found — pack-roll listener and trait fuser will not start. Battle loop still works.",
  );
  return null;
};

// -------------------------------------------------------------------------
// Viem clients
// -------------------------------------------------------------------------

const RPC_URL = process.env.ALCHEMY_RPC_URL ?? "";

if (!RPC_URL) {
  logger.warn("ALCHEMY_RPC_URL not set — chain-side features will not work.");
}

const buildPublicClient = () => createPublicClient({ chain: base, transport: http(RPC_URL) });
const buildWalletClient = (pk: Hex) =>
  createWalletClient({ account: privateKeyToAccount(pk), chain: base, transport: http(RPC_URL) });

export type PublicClientT = ReturnType<typeof buildPublicClient>;
export type WalletClientT = ReturnType<typeof buildWalletClient>;

export const publicClient: PublicClientT | null = RPC_URL ? buildPublicClient() : null;

let _walletClient: WalletClientT | null = null;
let _walletAddress: Address | null = null;

export const getWalletClient = (): { client: WalletClientT; address: Address } | null => {
  if (_walletClient && _walletAddress) return { client: _walletClient, address: _walletAddress };
  const pk = process.env.HOT_WALLET_PRIVATE_KEY;
  if (!pk || !RPC_URL) return null;
  _walletClient = buildWalletClient(pk as Hex);
  _walletAddress = _walletClient.account.address;
  return { client: _walletClient, address: _walletAddress };
};

// -------------------------------------------------------------------------
// Minimal ABIs — enough for the server's needs (mint + listen for purchase)
// -------------------------------------------------------------------------

export const PACK_PURCHASED_EVENT = {
  type: "event",
  name: "PackPurchased",
  inputs: [
    { name: "buyer", type: "address", indexed: true },
    { name: "packType", type: "uint8", indexed: true },
    { name: "requestId", type: "bytes32", indexed: false },
  ],
} as const;

export const BATCH_MINT_PACK_FN = {
  type: "function",
  name: "batchMintPack",
  stateMutability: "nonpayable",
  inputs: [
    { name: "to", type: "address" },
    {
      name: "creatures",
      type: "tuple[]",
      components: [
        { name: "creatureId", type: "uint8" },
        { name: "atk", type: "uint8" },
        { name: "def", type: "uint8" },
        { name: "chg", type: "uint8" },
        { name: "trk", type: "uint8" },
      ],
    },
  ],
  outputs: [{ name: "", type: "uint256[]" }],
} as const;

export const FUSE_TRAIT_FN = {
  type: "function",
  name: "fuseTrait",
  stateMutability: "nonpayable",
  inputs: [
    { name: "tokenId", type: "uint256" },
    { name: "traitId", type: "uint256" },
  ],
  outputs: [],
} as const;

export const STATS_FN = {
  type: "function",
  name: "stats",
  stateMutability: "view",
  inputs: [{ name: "tokenId", type: "uint256" }],
  outputs: [
    { name: "creatureId", type: "uint8" },
    { name: "atk", type: "uint8" },
    { name: "def", type: "uint8" },
    { name: "chg", type: "uint8" },
    { name: "trk", type: "uint8" },
  ],
} as const;

export const OWNER_OF_FN = {
  type: "function",
  name: "ownerOf",
  stateMutability: "view",
  inputs: [{ name: "tokenId", type: "uint256" }],
  outputs: [{ name: "", type: "address" }],
} as const;

export const GET_TRAITS_FN = {
  type: "function",
  name: "getTraits",
  stateMutability: "view",
  inputs: [{ name: "tokenId", type: "uint256" }],
  outputs: [{ name: "", type: "uint256[]" }],
} as const;

export const ADD_PACK_FN = {
  type: "function",
  name: "addPack",
  stateMutability: "nonpayable",
  inputs: [
    { name: "packType", type: "uint8" },
    { name: "priceWei", type: "uint256" },
    { name: "priceUsdc", type: "uint256" },
    { name: "name", type: "string" },
  ],
  outputs: [],
} as const;

export const ADD_TRAIT_FN = {
  type: "function",
  name: "addTrait",
  stateMutability: "nonpayable",
  inputs: [
    { name: "traitId", type: "uint256" },
    { name: "priceWei", type: "uint256" },
    { name: "metadataURI", type: "string" },
  ],
  outputs: [],
} as const;

export const CARD_ABI = [BATCH_MINT_PACK_FN, FUSE_TRAIT_FN, STATS_FN, OWNER_OF_FN, GET_TRAITS_FN] as const;
export const PACKSHOP_ABI = [PACK_PURCHASED_EVENT, ADD_PACK_FN] as const;
export const TRAITSHOP_ABI = [ADD_TRAIT_FN] as const;
