import * as chains from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  burnerWalletMode: "localNetworksOnly" | "allNetworks" | "disabled";
  appName: string;
  privyAppId: string;
  onrampAppId: string;
  gameServerWss: string;
  productionUrl: string;
};

export type ScaffoldConfig = BaseConfig;

export const DEFAULT_ALCHEMY_API_KEY = "cR4WnXePioePZ5fFrnSiR";

const scaffoldConfig = {
  // Animal Kingdom TCG ships only on Base mainnet.
  targetNetworks: [chains.base],
  // ~4s polling fits Base block time without hammering the RPC. Shorter than the SE2
  // default to keep the UI responsive on an L2 where blocks come every 2s.
  pollingInterval: 4000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  rpcOverrides: {},
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  burnerWalletMode: "disabled",
  appName: "Animal Kingdom TCG",
  // Privy + Onramp + game server are env-driven. Empty values are first-class:
  // the UI surfaces a clear "not configured" state instead of crashing.
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
  onrampAppId: process.env.NEXT_PUBLIC_ONRAMP_APP_ID || "",
  gameServerWss: process.env.NEXT_PUBLIC_GAME_SERVER_WSS || "",
  productionUrl: process.env.NEXT_PUBLIC_PRODUCTION_URL || "",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
