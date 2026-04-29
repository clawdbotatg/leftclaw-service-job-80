"use client";

import Link from "next/link";
import type { NextPage } from "next";
import scaffoldConfig from "~~/scaffold.config";

/**
 * Stage 4a stub. Stage 4b will wire the WS state machine, lobby, and battle UI.
 *
 * Important: do NOT instantiate `new WebSocket(...)` from this file or any module
 * imported at top-level. The WS server URL is read here only as a string. Stage 4b
 * will mount the WS client lazily inside `useEffect`, gated on `gameServerWss` being
 * set, so the static export does not crash with a NOT_CONFIGURED env.
 */
const BattlePage: NextPage = () => {
  const wssUrl = scaffoldConfig.gameServerWss;
  const isConfigured = Boolean(wssUrl);

  return (
    <div className="px-4 py-8 max-w-3xl mx-auto w-full">
      <h1 className="font-display text-xl mb-1">Battle</h1>
      <p className="opacity-70 text-sm mb-6">Queue against AI opponents — coming soon.</p>

      {!isConfigured ? (
        <div className="card bg-base-200 p-8 text-center">
          <h2 className="font-display text-base mb-1">Battle server not configured</h2>
          <p className="opacity-70 mb-3">
            The game admin hasn&apos;t connected the battle server yet. Your creatures and packs still work normally.
          </p>
          <Link href="/" className="btn btn-sm btn-outline self-center">
            Back home
          </Link>
        </div>
      ) : (
        <div className="card bg-base-200 p-8 text-center">
          <h2 className="font-display text-base mb-1">Battle screen — server connection coming soon</h2>
          <p className="opacity-70">
            The lobby + battle UI ships in Stage 4b. The configured server endpoint is recorded for that stage to wire
            up.
          </p>
        </div>
      )}
    </div>
  );
};

export default BattlePage;
