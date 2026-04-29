/**
 * Mirror of `packages/nextjs/types/battle.ts`. Both files MUST stay in sync —
 * if you change a message shape here, change it there (and vice versa).
 *
 * Discriminated union on `type` so a single switch is exhaustive.
 */

export type BattleAction = "ATK" | "DEF" | "CHG";

export type MomentumCommit = "ATK" | "DEF" | "TRK" | null;

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
// Client -> Server
// -------------------------------------------------------------------------

export type AuthPrivyMessage = {
  type: "auth";
  token: string;
};

export type AuthAddressMessage = {
  type: "auth";
  address: `0x${string}`;
  signature?: `0x${string}`;
};

export type AuthMessage = AuthPrivyMessage | AuthAddressMessage;

export type FindMatchMessage = {
  type: "find_match";
  deck: string[];
  deckName?: string;
};

export type SubmitActionMessage = {
  type: "submit_action";
  action: BattleAction;
  momentumCommit?: MomentumCommit;
  actionId: string;
};

export type LeaveMatchMessage = { type: "leave_match" };

export type PingMessage = { type: "ping"; ts: number };

export type ClientToServerMessage =
  | AuthMessage
  | FindMatchMessage
  | SubmitActionMessage
  | LeaveMatchMessage
  | PingMessage;

// -------------------------------------------------------------------------
// Server -> Client
// -------------------------------------------------------------------------

export type AuthOkMessage = { type: "auth_ok"; userId: string };
export type AuthFailMessage = { type: "auth_fail"; reason: string };

export type MatchStartedMessage = {
  type: "match_started";
  matchId: string;
  opponent: SideSnapshot & { name: string };
  you: SideSnapshot;
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
    mvpTokenId?: string;
    mvpName?: string;
  };
};

export type PongMessage = { type: "pong"; ts: number };
export type ErrorMessage = { type: "error"; message: string; code?: string };

export type ServerToClientMessage =
  | AuthOkMessage
  | AuthFailMessage
  | MatchStartedMessage
  | TurnRevealMessage
  | MatchEndedMessage
  | PongMessage
  | ErrorMessage;

// -------------------------------------------------------------------------
// Internal server-side types (NOT sent over the wire)
// -------------------------------------------------------------------------

/** Full creature record loaded from the cache or the chain. */
export type CreatureRecord = {
  tokenId: string;
  creatureId: number;
  atk: number;
  def: number;
  chg: number;
  trk: number;
  traits: number[];
};

/** Per-side state held inside the battle engine. */
export type BattleSide = {
  userId: string;
  isAi: boolean;
  hp: number;
  momentum: number;
  team: CreatureRecord[];
  teamStats: TeamStats;
  /** Highest-TRK creature in the team (drives the active Trick effect). */
  activeTrickCreature: CreatureRecord;
  pendingAction: BattleAction | null;
  pendingMomentum: MomentumCommit;
  totalDamageDealt: number;
  totalDamageTaken: number;
  damageByTokenId: Record<string, number>;
};
