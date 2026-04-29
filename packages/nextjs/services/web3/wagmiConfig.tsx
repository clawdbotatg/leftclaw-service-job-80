import { wagmiConnectors } from "./wagmiConnectors";
import { createConfig } from "@privy-io/wagmi";
import { Chain, createClient, fallback, http } from "viem";
import { hardhat, mainnet } from "viem/chains";
import scaffoldConfig, { ScaffoldConfig } from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const { targetNetworks } = scaffoldConfig;

// We always want mainnet enabled (ENS, ETH price). Add it once if not already in targetNetworks.
export const enabledChains = targetNetworks.find((network: Chain) => network.id === 1)
  ? targetNetworks
  : ([...targetNetworks, mainnet] as const);

// Mainnet ENS / price reads use the public buidlguidl RPC (NOT a public Base RPC) when
// no Alchemy URL is configured. This is intentional — it is a private SE2-friendly endpoint.
const MAINNET_FALLBACK_TRANSPORTS = [http("https://mainnet.rpc.buidlguidl.com")];

export const wagmiConfig = createConfig({
  chains: enabledChains,
  connectors: wagmiConnectors(),
  ssr: true,
  client: ({ chain }) => {
    // QA SKILL ship-blocker (Issue #8): NEVER fall through to a bare `http()` (which would
    // dial the chain's public default RPC list, including https://mainnet.base.org).
    // Only configured Alchemy / explicit overrides may carry traffic.
    const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id];
    const alchemyHttpUrl = !rpcOverrideUrl ? getAlchemyHttpUrl(chain.id) : undefined;

    const transports = [
      ...(rpcOverrideUrl ? [http(rpcOverrideUrl)] : []),
      ...(alchemyHttpUrl ? [http(alchemyHttpUrl)] : []),
      // Mainnet (chain.id === 1) gets the buidlguidl ENS/price fallback. No public RPCs anywhere.
      ...(chain.id === mainnet.id ? MAINNET_FALLBACK_TRANSPORTS : []),
    ];

    // If we somehow ended up with zero configured transports for the targetNetwork
    // (e.g. NEXT_PUBLIC_ALCHEMY_API_KEY missing AND no rpcOverride), surface the misconfig
    // by throwing here rather than silently dialing a public RPC. The throw bubbles up to the
    // dapp boot — visible failure beats invisible quota burn or rate-limit roulette.
    if (transports.length === 0) {
      throw new Error(
        `No RPC transport configured for chain ${chain.id}. Set NEXT_PUBLIC_ALCHEMY_API_KEY in the deployment environment, or add an rpcOverride in scaffold.config.ts. Public RPC fallback is disabled by policy.`,
      );
    }

    return createClient({
      chain,
      transport: fallback(transports),
      ...(chain.id !== (hardhat as Chain).id ? { pollingInterval: scaffoldConfig.pollingInterval } : {}),
    });
  },
});
