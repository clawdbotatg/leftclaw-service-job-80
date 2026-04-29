/**
 * Animal Kingdom TCG — battle WebSocket protocol.
 *
 * This file is the single source of truth for the message shape exchanged between
 * the frontend `/battle` page and the WS game server in `/server`. The server
 * mirrors these types in `/server/src/types.ts` — keep them in lock-step.
 *
 * Discriminated union on `type` so a single switch statement is exhaustive.
 */

// -------------------------------------------------------------------------
// Action vocabulary
// -------------------------------------------------------------------------

export type BattleAction = "ATK" | "DEF" | "CHG";

/** A side may commit reserved Momentum to one of three lanes, or skip the bonus. */
export type MomentumCommit = "ATK" | "DEF" | "TRK" | null;

/** Connection state machine for the battle screen. Five explicit states + NOT_CONFIGURED. */
export type WsState =
  | "NOT_CONFIGURED"
  | "CONNECTING"
  | "CONNECTED_IDLE"
  | "CONNECTED_IN_MATCH"
  | "RECONNECTING"
  | "DISCONNECTED";

// -------------------------------------------------------------------------
// Stat / creature shapes echoed in match messages
// -------------------------------------------------------------------------

export type TeamStats = {
  atk: number;
  def: number;
  chg: number;
  trk: number;
};

export type SideSnapshot = {
  hp: number;
  momentum: number;
  teamStats: TeamStats;
  trickName: string;
};

// -------------------------------------------------------------------------
// Client → Server messages
// -------------------------------------------------------------------------

/** Privy access-token auth (preferred when Privy is configured). */
export type AuthPrivyMessage = {
  type: "auth";
  token: string;
};

/**
 * Address-only auth (v1 fallback when Privy isn't configured).
 *
 * v1 only: the server trusts the address. Stage 7 will require a SIWE flow:
 * the client will sign a server-issued nonce + the server will verify the
 * signature with `viem.verifyMessage` before considering the connection
 * authenticated. Until then, this branch is for local testing only.
 */
export type AuthAddressMessage = {
  type: "auth";
  address: `0x${string}`;
  /** Reserved for the SIWE upgrade path. Not validated in v1. */
  signature?: `0x${string}`;
};

export type AuthMessage = AuthPrivyMessage | AuthAddressMessage;

export type FindMatchMessage = {
  type: "find_match";
  /** tokenIds chosen for the deck, exactly 4. Server validates ownership. */
  deck: string[];
  deckName?: string;
};

export type SubmitActionMessage = {
  type: "submit_action";
  action: BattleAction;
  momentumCommit?: MomentumCommit;
  /** Client-issued uuid for idempotency on retries. */
  actionId: string;
};

export type LeaveMatchMessage = {
  type: "leave_match";
};

export type PingMessage = {
  type: "ping";
  /** Echoed back as `pong.ts` so client can compute RTT if it wants to. */
  ts: number;
};

export type ClientToServerMessage =
  | AuthMessage
  | FindMatchMessage
  | SubmitActionMessage
  | LeaveMatchMessage
  | PingMessage;

// -------------------------------------------------------------------------
// Server → Client messages
// -------------------------------------------------------------------------

export type AuthOkMessage = {
  type: "auth_ok";
  userId: string;
};

export type AuthFailMessage = {
  type: "auth_fail";
  reason: string;
};

export type MatchStartedMessage = {
  type: "match_started";
  matchId: string;
  opponent: SideSnapshot & { name: string };
  you: SideSnapshot;
  /** Server tells the client how long it has to commit each turn. */
  turnSeconds: number;
};

export type TurnRevealMessage = {
  type: "turn_reveal";
  matchId: string;
  turn: number;
  you: {
    action: BattleAction;
    momentumCommit: MomentumCommit;
    damageTaken: number;
    healing: number;
    hp: number;
    momentum: number;
  };
  opponent: {
    action: BattleAction;
    momentumCommit: MomentumCommit;
    damageDealt: number;
    healing: number;
    hp: number;
    momentum: number;
  };
};

export type MatchEndedMessage = {
  type: "match_ended";
  matchId: string;
  winner: "you" | "opponent" | "draw";
  summary: {
    turns: number;
    damageDealt: number;
    damageTaken: number;
    /** Token id of the creature with the highest contribution score. */
    mvpTokenId?: string;
    mvpName?: string;
  };
};

export type PongMessage = {
  type: "pong";
  ts: number;
};

export type ErrorMessage = {
  type: "error";
  message: string;
  code?: string;
};

export type ServerToClientMessage =
  | AuthOkMessage
  | AuthFailMessage
  | MatchStartedMessage
  | TurnRevealMessage
  | MatchEndedMessage
  | PongMessage
  | ErrorMessage;
