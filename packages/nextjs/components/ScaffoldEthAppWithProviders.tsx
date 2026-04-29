"use client";

import { useEffect, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { base } from "viem/chains";
import { WagmiProvider } from "wagmi";
import { Footer } from "~~/components/Footer";
import { Header } from "~~/components/Header";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="relative flex flex-col flex-1">{children}</main>
        <Footer />
      </div>
      <Toaster />
    </>
  );
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Provider chain.
 *
 * Privy must wrap wagmi so its embedded wallet flows into the wagmi connector list.
 * When `NEXT_PUBLIC_PRIVY_APP_ID` is empty (not configured by the deployer), we skip
 * `<PrivyProvider>` and `<PrivyWagmiProvider>` entirely — Privy's SDK throws on a
 * placeholder app ID. The `PrivyLoginButton` in the header detects this state via
 * `scaffoldConfig.privyAppId` and renders a disabled "Sign In (unavailable)" button.
 *
 * In both branches:
 *   - The same `wagmiConfig` is used (built from `@privy-io/wagmi`'s `createConfig`,
 *     which is a drop-in for `wagmi`'s `createConfig`).
 *   - RainbowKit wraps the wagmi provider so its `Connect Wallet` button still works.
 */
export const ScaffoldEthAppWithProviders = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const privyAppId = scaffoldConfig.privyAppId;
  const rkTheme = mounted ? (isDarkMode ? darkTheme() : lightTheme()) : lightTheme();

  const wagmiTree = (
    <RainbowKitProvider avatar={BlockieAvatar} theme={rkTheme}>
      <ProgressBar height="3px" color="#2299dd" />
      <ScaffoldEthApp>{children}</ScaffoldEthApp>
    </RainbowKitProvider>
  );

  if (!privyAppId) {
    // Privy unconfigured: fall back to plain wagmi. Embedded-wallet sign-in is unavailable
    // (the header button is disabled), but RainbowKit and contract interactions still work.
    return (
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{wagmiTree}</WagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: isDarkMode ? "dark" : "light",
          accentColor: "#93bbfb",
          logo: "/logo.svg",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={wagmiConfig}>{wagmiTree}</PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
};
