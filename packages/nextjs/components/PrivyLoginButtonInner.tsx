"use client";

import { usePrivy } from "@privy-io/react-auth";

/**
 * Inner Privy login button. Only mounted when `scaffoldConfig.privyAppId` is set, so
 * `usePrivy` is guaranteed to find a `PrivyProvider` ancestor.
 */
export const PrivyLoginButtonInner = () => {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return (
      <button type="button" className="btn btn-sm btn-ghost" disabled>
        <span className="loading loading-spinner loading-xs" />
      </button>
    );
  }

  if (authenticated) {
    const identifier =
      user?.email?.address ??
      user?.google?.email ??
      (user?.wallet?.address ? user.wallet.address.slice(0, 6) + "…" : "Account");
    return (
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => logout()} title={identifier}>
        Sign Out
      </button>
    );
  }

  return (
    <button type="button" className="btn btn-sm btn-primary" onClick={() => login()}>
      Sign In
    </button>
  );
};
