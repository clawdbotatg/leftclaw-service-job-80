"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import type {
  BattleAction,
  ClientToServerMessage,
  MatchEndedMessage,
  MatchStartedMessage,
  MomentumCommit,
  ServerToClientMessage,
  SideSnapshot,
  TurnRevealMessage,
  WsState,
} from "~~/types/battle";
import { notification } from "~~/utils/scaffold-eth";

// -------------------------------------------------------------------------
// localStorage deck list (mirrors /deck page persistence shape)
// -------------------------------------------------------------------------

const DECKS_KEY_PREFIX = "akc:decks:";

type SavedDeck = {
  name: string;
  slots: (string | null)[]; // tokenIds as strings (bigint serialization)
  savedAt: number;
};

// -------------------------------------------------------------------------
// Reconnect backoff (1s, 2s, 4s, 8s, capped at 30s, give up after 6 attempts)
// -------------------------------------------------------------------------

const MAX_RECONNECT_ATTEMPTS = 6;
const RECONNECT_BACKOFF_MS = (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000);

const TURN_SECONDS_DEFAULT = 30;

// -------------------------------------------------------------------------
// Match-state shape held in React state
// -------------------------------------------------------------------------

type MatchState = {
  matchId: string;
  turn: number;
  you: SideSnapshot;
  opponent: SideSnapshot & { name: string };
  lastReveal: TurnRevealMessage | null;
  history: TurnRevealMessage[];
  turnSeconds: number;
  // submission state for the current turn
  pendingAction: BattleAction | null;
  pendingMomentum: MomentumCommit;
  awaitingOpponent: boolean;
  finalResult: MatchEndedMessage | null;
};

const BattlePage: NextPage = () => {
  const wssUrl = scaffoldConfig.gameServerWss;
  const isConfigured = Boolean(wssUrl);

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto w-full">
      <h1 className="font-display text-xl mb-1">Battle</h1>
      <p className="opacity-70 text-sm mb-6">Queue against AI opponents and battle with your saved deck.</p>

      {!isConfigured ? <NotConfiguredState /> : <BattleClient wssUrl={wssUrl} />}
    </div>
  );
};

export default BattlePage;

// =========================================================================
// NOT_CONFIGURED — no WebSocket ever instantiated in this branch
// =========================================================================

const NotConfiguredState = () => (
  <div className="card bg-base-200 p-8 text-center">
    <h2 className="font-display text-base mb-1">Battle server not configured</h2>
    <p className="opacity-70 mb-4">
      The game admin hasn&apos;t connected the battle server yet. Your creatures and packs still work normally.
    </p>
    <button type="button" className="btn btn-primary self-center" disabled>
      Find AI Match
    </button>
    <p className="text-xs opacity-60 mt-2">
      Set <code>NEXT_PUBLIC_GAME_SERVER_WSS</code> in <code>.env</code> to enable battles. See README for setup.
    </p>
    <Link href="/" className="btn btn-sm btn-ghost mt-3 self-center">
      Back home
    </Link>
  </div>
);

// =========================================================================
// BattleClient — owns the WS instance and the state machine
// =========================================================================

type BattleClientProps = { wssUrl: string };

const BattleClient = ({ wssUrl }: BattleClientProps) => {
  const { address: connectedAddress } = useAccount();

  // ---------------------------------------------------------------------
  // Connection state machine
  // ---------------------------------------------------------------------
  const [state, setState] = useState<WsState>("CONNECTING");
  const [authError, setAuthError] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Refs that must NOT trigger re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);
  const matchStateRef = useRef<MatchState | null>(null);
  matchStateRef.current = matchState;

  // ---------------------------------------------------------------------
  // Saved decks (only read inside an effect — never at module load)
  // ---------------------------------------------------------------------
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [selectedDeckName, setSelectedDeckName] = useState<string | null>(null);

  useEffect(() => {
    if (!connectedAddress) {
      setSavedDecks([]);
      setSelectedDeckName(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(DECKS_KEY_PREFIX + connectedAddress.toLowerCase());
      const parsed = raw ? (JSON.parse(raw) as SavedDeck[]) : [];
      setSavedDecks(parsed);
      if (parsed.length > 0 && !selectedDeckName) setSelectedDeckName(parsed[0].name);
    } catch {
      setSavedDecks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAddress]);

  // ---------------------------------------------------------------------
  // Send helper — guarded against closed sockets
  // ---------------------------------------------------------------------
  const send = useCallback((msg: ClientToServerMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch (err) {
      console.warn("[battle] send failed", err);
      return false;
    }
  }, []);

  // ---------------------------------------------------------------------
  // Connect logic — never runs at module scope; only inside useEffect
  // ---------------------------------------------------------------------
  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    if (typeof window === "undefined") return; // SSR / static export safety

    let ws: WebSocket;
    try {
      ws = new WebSocket(wssUrl);
    } catch (err) {
      console.error("[battle] ws constructor threw", err);
      setState("DISCONNECTED");
      return;
    }
    wsRef.current = ws;

    // --- auth timeout: server has 30s to send `auth_ok`
    if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = setTimeout(() => {
      if (state !== "CONNECTED_IDLE" && state !== "CONNECTED_IN_MATCH") {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    }, 30_000);

    ws.addEventListener("open", () => {
      if (unmountedRef.current) return;
      // Send auth on open
      const privyConfigured = Boolean(scaffoldConfig.privyAppId);
      if (privyConfigured) {
        // Best-effort: read Privy access token if available.
        // We don't import getAccessToken statically because that pulls Privy into
        // the static-export tree even when unconfigured. Read from the dynamic
        // global the SDK installs once authenticated.
        const token = (typeof window !== "undefined" && (window as any).__privyAccessToken) || "";
        send({ type: "auth", token });
      } else if (connectedAddress) {
        send({ type: "auth", address: connectedAddress as `0x${string}` });
      } else {
        // No identity available. Send an address-auth with a zero address so the
        // server can decide whether to allow guest spectating, otherwise it'll
        // reject and we'll surface auth_fail.
        send({ type: "auth", address: "0x0000000000000000000000000000000000000000" });
      }
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      if (unmountedRef.current) return;
      let msg: ServerToClientMessage;
      try {
        msg = JSON.parse(typeof event.data === "string" ? event.data : "") as ServerToClientMessage;
      } catch (err) {
        console.warn("[battle] malformed server message", err);
        return;
      }
      handleServerMessage(msg);
    });

    ws.addEventListener("error", () => {
      // Browsers don't surface useful info on `error`; the `close` handler picks
      // up the actual close + drives the reconnect logic.
    });

    ws.addEventListener("close", () => {
      if (unmountedRef.current) return;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }

      setState(prev => {
        // If we were connected (idle or in-match), retry with backoff.
        // From CONNECTING -> also retry.
        // After MAX attempts, give up.
        if (reconnectAttempt + 1 >= MAX_RECONNECT_ATTEMPTS) {
          return "DISCONNECTED";
        }
        return prev === "CONNECTED_IN_MATCH" || prev === "CONNECTED_IDLE" || prev === "CONNECTING"
          ? "RECONNECTING"
          : prev;
      });

      // Schedule reconnect.
      if (reconnectAttempt + 1 < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_BACKOFF_MS(reconnectAttempt);
        reconnectTimerRef.current = setTimeout(() => {
          if (unmountedRef.current) return;
          setReconnectAttempt(a => a + 1);
          connect();
        }, delay);
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wssUrl, send, connectedAddress, state, reconnectAttempt]);

  // ---------------------------------------------------------------------
  // Server message handler
  // ---------------------------------------------------------------------
  const handleServerMessage = useCallback(
    (msg: ServerToClientMessage) => {
      switch (msg.type) {
        case "auth_ok": {
          if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
          setAuthError(null);
          setReconnectAttempt(0);
          // Start heartbeat
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
          heartbeatRef.current = setInterval(() => {
            send({ type: "ping", ts: Date.now() });
          }, 30_000);
          setState(matchStateRef.current ? "CONNECTED_IN_MATCH" : "CONNECTED_IDLE");
          break;
        }
        case "auth_fail": {
          setAuthError(msg.reason);
          setState("DISCONNECTED");
          notification.error(`Auth failed: ${msg.reason}`);
          try {
            wsRef.current?.close();
          } catch {
            /* ignore */
          }
          break;
        }
        case "match_started": {
          handleMatchStarted(msg);
          break;
        }
        case "turn_reveal": {
          handleTurnReveal(msg);
          break;
        }
        case "match_ended": {
          handleMatchEnded(msg);
          break;
        }
        case "pong": {
          // no-op for v1; could compute RTT off `Date.now() - msg.ts`
          break;
        }
        case "error": {
          notification.error(msg.message);
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send],
  );

  const handleMatchStarted = useCallback((msg: MatchStartedMessage) => {
    setMatchState({
      matchId: msg.matchId,
      turn: 1,
      you: msg.you,
      opponent: msg.opponent,
      lastReveal: null,
      history: [],
      turnSeconds: msg.turnSeconds || TURN_SECONDS_DEFAULT,
      pendingAction: null,
      pendingMomentum: null,
      awaitingOpponent: false,
      finalResult: null,
    });
    setState("CONNECTED_IN_MATCH");
    notification.success("Match started!");
  }, []);

  const handleTurnReveal = useCallback((msg: TurnRevealMessage) => {
    setMatchState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        turn: msg.turn + 1,
        lastReveal: msg,
        history: [msg, ...prev.history].slice(0, 20),
        you: {
          ...prev.you,
          hp: msg.you.hp,
          momentum: msg.you.momentum,
        },
        opponent: {
          ...prev.opponent,
          hp: msg.opponent.hp,
          momentum: msg.opponent.momentum,
        },
        pendingAction: null,
        pendingMomentum: null,
        awaitingOpponent: false,
      };
    });
  }, []);

  const handleMatchEnded = useCallback((msg: MatchEndedMessage) => {
    setMatchState(prev => (prev ? { ...prev, finalResult: msg, awaitingOpponent: false } : prev));
    if (msg.winner === "you") notification.success("Victory!");
    else if (msg.winner === "opponent") notification.error("Defeat.");
    else notification.info("Draw.");
  }, []);

  // ---------------------------------------------------------------------
  // Mount: connect ONCE per wssUrl. Cleanup closes the socket.
  // ---------------------------------------------------------------------
  useEffect(() => {
    unmountedRef.current = false;
    setState("CONNECTING");
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wssUrl]);

  // ---------------------------------------------------------------------
  // Find-match action
  // ---------------------------------------------------------------------
  const onFindMatch = useCallback(() => {
    if (!selectedDeckName) {
      notification.warning("Pick a deck first.");
      return;
    }
    const deck = savedDecks.find(d => d.name === selectedDeckName);
    if (!deck) {
      notification.warning("Deck not found.");
      return;
    }
    const tokenIds = deck.slots.filter((s): s is string => Boolean(s));
    if (tokenIds.length !== 4) {
      notification.warning("Deck must have 4 creatures. Edit on /deck.");
      return;
    }
    const ok = send({ type: "find_match", deck: tokenIds, deckName: deck.name });
    if (ok) notification.info("Searching for opponent…");
  }, [selectedDeckName, savedDecks, send]);

  // ---------------------------------------------------------------------
  // Submit action — used by Attack/Defend/Charge buttons
  // ---------------------------------------------------------------------
  const [showMomentumModal, setShowMomentumModal] = useState(false);
  const [pendingActionDraft, setPendingActionDraft] = useState<BattleAction | null>(null);

  const onPickAction = useCallback((action: BattleAction) => {
    setPendingActionDraft(action);
    if ((matchStateRef.current?.you.momentum ?? 0) > 0) {
      setShowMomentumModal(true);
    } else {
      submitAction(action, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAction = useCallback(
    (action: BattleAction, momentumCommit: MomentumCommit) => {
      const actionId =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const ok = send({
        type: "submit_action",
        action,
        momentumCommit,
        actionId,
      });
      if (ok) {
        setMatchState(prev =>
          prev
            ? {
                ...prev,
                pendingAction: action,
                pendingMomentum: momentumCommit,
                awaitingOpponent: true,
              }
            : prev,
        );
      } else {
        notification.warning("Connection lost — your action will retry on reconnect.");
      }
      setShowMomentumModal(false);
      setPendingActionDraft(null);
    },
    [send],
  );

  // ---------------------------------------------------------------------
  // Turn timer
  // ---------------------------------------------------------------------
  const [secondsLeft, setSecondsLeft] = useState<number>(TURN_SECONDS_DEFAULT);
  useEffect(() => {
    if (state !== "CONNECTED_IN_MATCH" || !matchState) return;
    if (matchState.finalResult || matchState.awaitingOpponent) return;
    setSecondsLeft(matchState.turnSeconds);
    const timer = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, matchState?.turn, matchState?.finalResult, matchState?.awaitingOpponent]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  if (state === "DISCONNECTED") {
    return <DisconnectedView authError={authError} onRetry={() => window.location.reload()} />;
  }

  if (state === "CONNECTING") {
    return <ConnectingView />;
  }

  if (state === "RECONNECTING") {
    return (
      <>
        <ReconnectingBanner attempt={reconnectAttempt} />
        {matchState ? <MatchView state={matchState} secondsLeft={secondsLeft} onPickAction={onPickAction} /> : null}
      </>
    );
  }

  if (state === "CONNECTED_IDLE") {
    return (
      <IdleLobby
        savedDecks={savedDecks}
        selectedDeckName={selectedDeckName}
        setSelectedDeckName={setSelectedDeckName}
        onFindMatch={onFindMatch}
      />
    );
  }

  // CONNECTED_IN_MATCH
  if (matchState) {
    return (
      <>
        <MatchView state={matchState} secondsLeft={secondsLeft} onPickAction={onPickAction} />
        {showMomentumModal && pendingActionDraft && (
          <MomentumModal
            action={pendingActionDraft}
            onCommit={c => submitAction(pendingActionDraft, c)}
            onCancel={() => {
              setShowMomentumModal(false);
              setPendingActionDraft(null);
            }}
          />
        )}
        {matchState.finalResult && (
          <MatchEndedModal
            result={matchState.finalResult}
            onPlayAgain={() => {
              setMatchState(null);
              setState("CONNECTED_IDLE");
            }}
          />
        )}
      </>
    );
  }

  // Connected but no match — back to lobby
  return (
    <IdleLobby
      savedDecks={savedDecks}
      selectedDeckName={selectedDeckName}
      setSelectedDeckName={setSelectedDeckName}
      onFindMatch={onFindMatch}
    />
  );
};

// =========================================================================
// Sub-views
// =========================================================================

const ConnectingView = () => (
  <div className="card bg-base-200 p-8 text-center">
    <span className="loading loading-spinner loading-lg self-center mb-3" />
    <p className="opacity-70">Connecting to battle server…</p>
  </div>
);

const DisconnectedView = ({ authError, onRetry }: { authError: string | null; onRetry: () => void }) => (
  <div className="card bg-base-200 p-8 text-center">
    <h2 className="font-display text-base mb-1">Disconnected</h2>
    <p className="opacity-70 mb-3">
      {authError ? `Auth failed: ${authError}` : "Couldn't reach the battle server. Check your connection."}
    </p>
    <button type="button" className="btn btn-primary self-center" onClick={onRetry}>
      Refresh to retry
    </button>
  </div>
);

const ReconnectingBanner = ({ attempt }: { attempt: number }) => (
  <div className="alert alert-warning mb-4">
    <span className="loading loading-spinner loading-xs" />
    <span>
      Connection lost — reconnecting (attempt {attempt + 1}/{MAX_RECONNECT_ATTEMPTS})…
    </span>
  </div>
);

const IdleLobby = ({
  savedDecks,
  selectedDeckName,
  setSelectedDeckName,
  onFindMatch,
}: {
  savedDecks: SavedDeck[];
  selectedDeckName: string | null;
  setSelectedDeckName: (n: string) => void;
  onFindMatch: () => void;
}) => {
  if (savedDecks.length === 0) {
    return (
      <div className="card bg-base-200 p-8 text-center">
        <h2 className="font-display text-base mb-1">No decks saved</h2>
        <p className="opacity-70 mb-4">Build a 4-creature deck on /deck before queuing for battle.</p>
        <Link href="/deck" className="btn btn-primary self-center">
          Go to Deck Builder
        </Link>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 p-8 max-w-md mx-auto">
      <h2 className="font-display text-base mb-3 text-center">Lobby</h2>
      <label className="form-control w-full mb-4">
        <span className="label-text mb-1">Select deck</span>
        <select
          className="select select-bordered w-full"
          value={selectedDeckName ?? ""}
          onChange={e => setSelectedDeckName(e.target.value)}
        >
          {savedDecks.map(d => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn-primary w-full" onClick={onFindMatch} disabled={!selectedDeckName}>
        Find AI Match
      </button>
      <p className="text-xs opacity-60 mt-3 text-center">Battles are server-authoritative. AI opponents only in v1.</p>
    </div>
  );
};

const HpBar = ({ hp, max = 100, label }: { hp: number; max?: number; label: string }) => {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const color = pct > 60 ? "bg-success" : pct > 30 ? "bg-warning" : "bg-error";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="opacity-70">{label}</span>
        <span>{hp} HP</span>
      </div>
      <div className="w-full bg-base-300 h-3 rounded">
        <div className={`h-3 rounded transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const StatBadges = ({ stats }: { stats: { atk: number; def: number; chg: number; trk: number } }) => (
  <div className="flex flex-wrap gap-1 text-xs">
    <span className="badge badge-error badge-sm">ATK {stats.atk}</span>
    <span className="badge badge-info badge-sm">DEF {stats.def}</span>
    <span className="badge badge-warning badge-sm">CHG {stats.chg}</span>
    <span className="badge badge-success badge-sm">TRK {stats.trk}</span>
  </div>
);

const MatchView = ({
  state,
  secondsLeft,
  onPickAction,
}: {
  state: MatchState;
  secondsLeft: number;
  onPickAction: (a: BattleAction) => void;
}) => {
  const lockedOut = state.awaitingOpponent || Boolean(state.finalResult);

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4">
      <div className="space-y-4">
        {/* Opponent panel */}
        <div className="card bg-base-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-display text-sm">{state.opponent.name || "AI Opponent"}</p>
              <p className="text-xs opacity-70">Active Trick: {state.opponent.trickName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-70">Momentum</p>
              <p className="text-sm">●●●●●</p>
            </div>
          </div>
          <HpBar hp={state.opponent.hp} label="Opponent HP" />
          <div className="mt-2">
            <StatBadges stats={state.opponent.teamStats} />
          </div>
        </div>

        {/* Center reveal panel */}
        <div className="card bg-base-100 border border-base-300 p-4 min-h-[120px]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs opacity-70">Turn {state.turn}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">Time left</span>
              <span className={`badge ${secondsLeft <= 5 ? "badge-error" : "badge-neutral"}`}>{secondsLeft}s</span>
            </div>
          </div>
          {state.lastReveal ? (
            <RevealAnimation reveal={state.lastReveal} />
          ) : state.awaitingOpponent ? (
            <div className="text-center py-3">
              <span className="loading loading-dots loading-md" />
              <p className="text-sm opacity-70 mt-1">Waiting for opponent…</p>
            </div>
          ) : (
            <p className="text-center text-sm opacity-60 py-3">Pick an action below to commit.</p>
          )}
        </div>

        {/* You panel */}
        <div className="card bg-base-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-display text-sm">You</p>
              <p className="text-xs opacity-70">Active Trick: {state.you.trickName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-70">Momentum</p>
              <p className="text-sm">{state.you.momentum}</p>
            </div>
          </div>
          <HpBar hp={state.you.hp} label="Your HP" />
          <div className="mt-2 mb-3">
            <StatBadges stats={state.you.teamStats} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button type="button" className="btn btn-error" disabled={lockedOut} onClick={() => onPickAction("ATK")}>
              Attack
            </button>
            <button type="button" className="btn btn-info" disabled={lockedOut} onClick={() => onPickAction("DEF")}>
              Defend
            </button>
            <button type="button" className="btn btn-warning" disabled={lockedOut} onClick={() => onPickAction("CHG")}>
              Charge
            </button>
          </div>
        </div>
      </div>

      {/* Match log sidebar */}
      <aside className="card bg-base-200 p-3 max-h-[600px] overflow-y-auto hidden lg:block">
        <p className="font-display text-xs mb-2">Match Log</p>
        {state.history.length === 0 ? (
          <p className="text-xs opacity-60">No turns yet.</p>
        ) : (
          <ol className="text-xs space-y-1 list-decimal list-inside">
            {state.history.map((h, i) => (
              <li key={`${h.turn}-${i}`}>
                T{h.turn}: You {h.you.action}
                {h.you.momentumCommit ? `+${h.you.momentumCommit}` : ""} vs Opp {h.opponent.action}
                {h.opponent.momentumCommit ? `+${h.opponent.momentumCommit}` : ""} (
                {h.opponent.damageDealt > 0 ? `-${h.opponent.damageDealt}HP` : ""})
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
};

const RevealAnimation = ({ reveal }: { reveal: TurnRevealMessage }) => (
  <div className="grid grid-cols-2 gap-2 text-center animate-fade-in">
    <div className="bg-base-200 rounded p-2">
      <p className="text-xs opacity-70 mb-1">You</p>
      <p className="font-display text-sm">
        {reveal.you.action}
        {reveal.you.momentumCommit ? <span className="opacity-60"> +{reveal.you.momentumCommit}</span> : null}
      </p>
      {reveal.you.damageTaken > 0 && <p className="text-xs text-error">-{reveal.you.damageTaken} HP</p>}
      {reveal.you.healing > 0 && <p className="text-xs text-success">+{reveal.you.healing} HP</p>}
    </div>
    <div className="bg-base-200 rounded p-2">
      <p className="text-xs opacity-70 mb-1">Opponent</p>
      <p className="font-display text-sm">
        {reveal.opponent.action}
        {reveal.opponent.momentumCommit ? <span className="opacity-60"> +{reveal.opponent.momentumCommit}</span> : null}
      </p>
      {reveal.opponent.damageDealt > 0 && <p className="text-xs text-error">-{reveal.opponent.damageDealt} HP</p>}
      {reveal.opponent.healing > 0 && <p className="text-xs text-success">+{reveal.opponent.healing} HP</p>}
    </div>
  </div>
);

const MomentumModal = ({
  action,
  onCommit,
  onCancel,
}: {
  action: BattleAction;
  onCommit: (c: MomentumCommit) => void;
  onCancel: () => void;
}) => (
  <dialog open className="modal modal-open">
    <div className="modal-box">
      <h3 className="font-display text-base mb-2">Commit Momentum?</h3>
      <p className="text-sm opacity-70 mb-4">
        Your action <b>{action}</b> is locked in. Spend a momentum point to boost a lane this turn.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button type="button" className="btn btn-error btn-sm" onClick={() => onCommit("ATK")}>
          Boost ATK
        </button>
        <button type="button" className="btn btn-info btn-sm" onClick={() => onCommit("DEF")}>
          Boost DEF
        </button>
        <button type="button" className="btn btn-success btn-sm" onClick={() => onCommit("TRK")}>
          Boost TRK
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCommit(null)}>
          Skip
        </button>
      </div>
      <div className="modal-action">
        <button type="button" className="btn btn-sm" onClick={onCancel}>
          Cancel action
        </button>
      </div>
    </div>
    <div className="modal-backdrop" />
  </dialog>
);

const MatchEndedModal = ({ result, onPlayAgain }: { result: MatchEndedMessage; onPlayAgain: () => void }) => {
  const banner = result.winner === "you" ? "Victory!" : result.winner === "opponent" ? "Defeat" : "Draw";
  const cls = result.winner === "you" ? "text-success" : result.winner === "opponent" ? "text-error" : "text-warning";
  return (
    <dialog open className="modal modal-open">
      <div className="modal-box text-center">
        <h3 className={`font-display text-2xl mb-2 ${cls}`}>{banner}</h3>
        <p className="text-sm opacity-70 mb-1">{result.summary.turns} turns</p>
        <p className="text-sm opacity-70 mb-1">Damage dealt: {result.summary.damageDealt}</p>
        <p className="text-sm opacity-70 mb-1">Damage taken: {result.summary.damageTaken}</p>
        {result.summary.mvpName && (
          <p className="text-sm opacity-70 mb-3">
            MVP: <b>{result.summary.mvpName}</b>
          </p>
        )}
        <div className="modal-action justify-center">
          <button type="button" className="btn btn-primary" onClick={onPlayAgain}>
            Play again
          </button>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </div>
      <div className="modal-backdrop" />
    </dialog>
  );
};
