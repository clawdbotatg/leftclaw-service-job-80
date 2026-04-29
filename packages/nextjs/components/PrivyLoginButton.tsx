"use client";

import { PrivyLoginButtonInner } from "~~/components/PrivyLoginButtonInner";
import scaffoldConfig from "~~/scaffold.config";

/**
 * Privy login button. Always renders as a `<button>` — never raw text.
 *
 * Two surfaces:
 *   - Privy unconfigured (`NEXT_PUBLIC_PRIVY_APP_ID` empty) → disabled button with helper.
 *     We do NOT call `usePrivy()` in this branch because `PrivyProvider` isn't mounted —
 *     calling it would throw.
 *   - Privy configured → defer to the inner component which uses Privy hooks.
 */
export const PrivyLoginButton = () => {
  const isConfigured = Boolean(scaffoldConfig.privyAppId);

  if (!isConfigured) {
    return (
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        disabled
        title="Privy sign-in is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID in your .env."
      >
        Sign In
        <span className="text-[10px] opacity-60 ml-1">(unavailable)</span>
      </button>
    );
  }

  return <PrivyLoginButtonInner />;
};
