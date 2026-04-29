/**
 * Animal Kingdom TCG game server entrypoint.
 *
 * Layout:
 *   - WebSocket server on $PORT (default 8080)
 *   - Per-connection auth handler with 30s timeout
 *   - Match registry: userId -> Match (one match per player at a time)
 *   - AI matches: when a player calls `find_match`, we immediately spawn an AI
 *     opponent and run the match (no PvP queue in v1).
 *   - Heartbeat ping every 30s to detect dead sockets
 *   - Pack-roll listener subscribes on boot if chain-config.json exists.
 *
 * Server-authoritative: client only commits one of three actions per turn.
 * Damage is computed in `battle-engine.ts` and the result mirrored to both
 * sides via `turn_reveal`.
 */

import { config as loadDotenv } from "dotenv";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

import { authenticate } from "./auth.js";
import {
  TURN_SECONDS,
  autoDefendUnsubmitted,
  createMatch,
  isReadyToResolve,
  resolveAndAdvance,
  submitAction,
  type Match,
} from "./battle-engine.js";
import { AI_DECKS, buildAiTeam, pickAiAction } from "./ai.js";
import { getCreatureTemplate } from "./creatures.js";
import { getPool, runMigrations, type PlayerRecord } from "./db.js";
import { logger } from "./logger.js";
import { startPackRollListener } from "./pack-roll.js";
import type {
  ClientToServerMessage,
  ServerToClientMessage,
  CreatureRecord,
} from "./types.js";

loadDotenv();

const PORT = Number(process.env.PORT ?? 8080);
const AUTH_TIMEOUT_MS = Number(process.env.AUTH_TIMEOUT_MS ?? 30_000);
const HEARTBEAT_MS = 30_000;

// -------------------------------------------------------------------------
// Per-connection state
// -------------------------------------------------------------------------

type ConnState = {
  id: string;
  ws: WebSocket;
  authed: boolean;
  player: PlayerRecord | null;
  authTimeout: ReturnType<typeof setTimeout> | null;
  match: Match | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  isAlive: boolean;
};

const connections = new Map<string, ConnState>();
/** userId -> connection id (so we can find a player's socket from anywhere). */
const userConn = new Map<string, string>();
/** matchId -> { conn (player), ai (handle) } */
const matchOwner = new Map<string, { connId: string }>();

// -------------------------------------------------------------------------
// Server send helpers
// -------------------------------------------------------------------------

const send = (ws: WebSocket, msg: ServerToClientMessage): void => {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(msg));
  } catch (err) {
    logger.warn({ err }, "ws send failed");
  }
};

const closeWith = (state: ConnState, code: number, reason: string) => {
  try {
    state.ws.close(code, reason);
  } catch {
    /* ignore */
  }
};

// -------------------------------------------------------------------------
// Match management
// -------------------------------------------------------------------------

const startTurnTimer = (state: ConnState) => {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (!state.match || state.match.ended) return;
  state.turnTimer = setTimeout(() => {
    if (!state.match || state.match.ended) return;
    autoDefendUnsubmitted(state.match);
    aiCommitIfNeeded(state.match);
    advanceMatch(state);
  }, TURN_SECONDS * 1000);
};

const aiCommitIfNeeded = (match: Match) => {
  if (match.b.isAi && match.b.pendingAction === null) {
    const choice = pickAiAction(match.b);
    submitAction(match, "b", choice.action, choice.momentumCommit);
  }
};

const advanceMatch = (state: ConnState) => {
  if (!state.match) return;
  if (state.turnTimer) {
    clearTimeout(state.turnTimer);
    state.turnTimer = null;
  }
  if (!isReadyToResolve(state.match)) return;
  const out = resolveAndAdvance(state.match);
  send(state.ws, out.revealForA);
  if (out.matchEnded) {
    send(state.ws, out.matchEnded);
    matchOwner.delete(state.match.id);
    state.match = null;
  } else {
    // Trigger AI's next move for the next turn (AI commits first; player
    // submission then triggers resolve).
    aiCommitIfNeeded(state.match);
    startTurnTimer(state);
  }
};

const findMatchAi = (state: ConnState, deckTokenIds: string[]) => {
  if (!state.player) return;

  // Build the player's team. In v1 we don't enforce strict ownership against
  // chain (no chain-config.json may be present) — server logs a warning if
  // it can't validate. Stage 6 will plumb cache/refresh.
  // Team is composed deterministically from token-id hashes for v1.
  const team: CreatureRecord[] = deckTokenIds.slice(0, 4).map((tokenId, i) => {
    // Hash tokenId to a creature template index. Real builds read from
    // creatures_cache; v1 fallback gives a deterministic team.
    const seed = Number(BigInt(tokenId) % BigInt(16));
    const tpl = getCreatureTemplate(seed);
    return {
      tokenId,
      creatureId: tpl.id,
      atk: tpl.base.atk,
      def: tpl.base.def,
      chg: tpl.base.chg,
      trk: tpl.base.trk,
      traits: [],
    };
  });

  if (team.length < 4) {
    send(state.ws, { type: "error", message: "Deck must have 4 creatures." });
    return;
  }

  const aiDeck = AI_DECKS[Math.floor(Math.random() * AI_DECKS.length)]!;
  const aiTeam = buildAiTeam(aiDeck);
  const aiUserId = `ai-${randomUUID()}`;

  const match = createMatch(
    { userId: state.player.user_id, isAi: false, team },
    { userId: aiUserId, isAi: true, team: aiTeam },
  );

  state.match = match;
  matchOwner.set(match.id, { connId: state.id });

  // Send match_started — the player is "you" (side A in the match struct).
  send(state.ws, {
    type: "match_started",
    matchId: match.id,
    turnSeconds: TURN_SECONDS,
    you: {
      hp: match.a.hp,
      momentum: match.a.momentum,
      teamStats: match.a.teamStats,
      trickName: getCreatureTemplate(match.a.activeTrickCreature.creatureId).trickName,
    },
    opponent: {
      hp: match.b.hp,
      momentum: match.b.momentum,
      teamStats: match.b.teamStats,
      trickName: getCreatureTemplate(match.b.activeTrickCreature.creatureId).trickName,
      name: aiDeck.name,
    },
  });

  // Pre-commit AI's first turn so when the player submits, both are ready.
  aiCommitIfNeeded(match);
  startTurnTimer(state);
};

// -------------------------------------------------------------------------
// Message dispatch
// -------------------------------------------------------------------------

const handleMessage = async (state: ConnState, raw: string): Promise<void> => {
  let msg: ClientToServerMessage;
  try {
    msg = JSON.parse(raw) as ClientToServerMessage;
  } catch {
    send(state.ws, { type: "error", message: "Invalid JSON." });
    return;
  }

  if (!state.authed) {
    if (msg.type !== "auth") {
      send(state.ws, { type: "auth_fail", reason: "Not authed yet." });
      closeWith(state, 4001, "not authed");
      return;
    }
    const result = await authenticate(msg);
    if (!result.ok) {
      send(state.ws, { type: "auth_fail", reason: result.reason });
      closeWith(state, 4002, result.reason);
      return;
    }
    state.authed = true;
    state.player = result.player;
    if (state.authTimeout) {
      clearTimeout(state.authTimeout);
      state.authTimeout = null;
    }
    // Disconnect any prior connection from the same user
    const prior = userConn.get(result.player.user_id);
    if (prior && prior !== state.id) {
      const priorConn = connections.get(prior);
      if (priorConn) closeWith(priorConn, 4003, "replaced by newer connection");
    }
    userConn.set(result.player.user_id, state.id);
    send(state.ws, { type: "auth_ok", userId: result.player.user_id });
    return;
  }

  switch (msg.type) {
    case "auth":
      // Already authed — no-op
      send(state.ws, { type: "auth_ok", userId: state.player!.user_id });
      return;
    case "ping":
      send(state.ws, { type: "pong", ts: msg.ts });
      return;
    case "find_match":
      if (state.match) {
        send(state.ws, { type: "error", message: "Already in a match." });
        return;
      }
      findMatchAi(state, msg.deck);
      return;
    case "submit_action":
      if (!state.match || state.match.ended) {
        send(state.ws, { type: "error", message: "No active match." });
        return;
      }
      submitAction(state.match, "a", msg.action, msg.momentumCommit ?? null);
      // AI side committed at match-start / on previous resolve. Both ready ⇒ resolve.
      if (isReadyToResolve(state.match)) {
        advanceMatch(state);
      }
      return;
    case "leave_match":
      if (state.match) {
        matchOwner.delete(state.match.id);
        state.match = null;
        if (state.turnTimer) {
          clearTimeout(state.turnTimer);
          state.turnTimer = null;
        }
      }
      return;
    default:
      send(state.ws, { type: "error", message: "Unknown message type." });
  }
};

// -------------------------------------------------------------------------
// HTTP + WS plumbing
// -------------------------------------------------------------------------

const httpServer = createServer((req, res) => {
  // Healthcheck endpoint — Railway / Fly.io periodically GET /
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, connections: connections.size, matches: matchOwner.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  const id = randomUUID();
  const state: ConnState = {
    id,
    ws,
    authed: false,
    player: null,
    authTimeout: null,
    match: null,
    turnTimer: null,
    isAlive: true,
  };
  connections.set(id, state);

  state.authTimeout = setTimeout(() => {
    if (!state.authed) {
      logger.info({ id }, "auth timeout — closing");
      closeWith(state, 4000, "auth timeout");
    }
  }, AUTH_TIMEOUT_MS);

  logger.info({ id, ip: req.socket.remoteAddress }, "ws open");

  ws.on("pong", () => {
    state.isAlive = true;
  });

  ws.on("message", async data => {
    state.isAlive = true;
    const raw = typeof data === "string" ? data : data.toString();
    try {
      await handleMessage(state, raw);
    } catch (err) {
      logger.error({ err, id }, "message handler crashed");
      send(ws, { type: "error", message: "Internal server error." });
    }
  });

  ws.on("close", () => {
    if (state.authTimeout) clearTimeout(state.authTimeout);
    if (state.turnTimer) clearTimeout(state.turnTimer);
    if (state.player) {
      const cur = userConn.get(state.player.user_id);
      if (cur === id) userConn.delete(state.player.user_id);
    }
    if (state.match) matchOwner.delete(state.match.id);
    connections.delete(id);
    logger.info({ id }, "ws closed");
  });

  ws.on("error", err => {
    logger.warn({ err, id }, "ws error");
  });
});

// Heartbeat sweep — drop dead connections.
const heartbeat = setInterval(() => {
  for (const state of connections.values()) {
    if (!state.isAlive) {
      logger.info({ id: state.id }, "heartbeat — terminating dead conn");
      try {
        state.ws.terminate();
      } catch {
        /* ignore */
      }
      continue;
    }
    state.isAlive = false;
    try {
      state.ws.ping();
    } catch {
      /* ignore */
    }
  }
}, HEARTBEAT_MS);

// -------------------------------------------------------------------------
// Boot
// -------------------------------------------------------------------------

const main = async () => {
  try {
    // Ensure DB is ready (migrations + first connection).
    if (process.env.DATABASE_URL) {
      await runMigrations();
      await getPool().query("SELECT 1");
      logger.info("db ready");
    } else {
      logger.warn("DATABASE_URL not set — db features disabled");
    }
  } catch (err) {
    logger.error({ err }, "db init failed — exiting");
    process.exit(1);
  }

  // Start chain listener (no-op if chain-config.json is missing)
  await startPackRollListener();

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, "server listening");
  });
};

const shutdown = async (signal: string) => {
  logger.info({ signal }, "shutting down");
  clearInterval(heartbeat);
  for (const state of connections.values()) closeWith(state, 1001, "server shutdown");
  wss.close();
  httpServer.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
