-- Initial schema for Animal Kingdom TCG game server.
-- All tables use TIMESTAMPTZ for monotonic ordering across deploys / regions.

-- Players: stable identity for matches + match history. user_id is the
-- internal stable handle. Either privy_did OR address must be non-null.
CREATE TABLE IF NOT EXISTS players (
    user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address     TEXT UNIQUE,
    privy_did   TEXT UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Creatures cache: mirror of on-chain stats so the battle engine doesn't
-- re-read every match. Refreshed lazily when we see a CreatureMinted event
-- or when a match-start ownership check misses the cache.
CREATE TABLE IF NOT EXISTS creatures_cache (
    token_id    NUMERIC PRIMARY KEY,
    owner       TEXT NOT NULL,
    creature_id INTEGER NOT NULL,
    atk         INTEGER NOT NULL,
    def         INTEGER NOT NULL,
    chg         INTEGER NOT NULL,
    trk         INTEGER NOT NULL,
    traits      INTEGER[] NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creatures_cache_owner_idx ON creatures_cache (owner);

-- Decks: persisted server-side mirror of localStorage decks (so they survive
-- device changes once the player is signed in via Privy).
CREATE TABLE IF NOT EXISTS decks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    token_ids    NUMERIC[] NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decks_user_idx ON decks (user_id);

-- Matches: completed match records. Drives /profile match history.
CREATE TABLE IF NOT EXISTS matches (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id     UUID NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
    opponent_id   UUID,                   -- NULL for AI matches; FK omitted on purpose
    is_ai         BOOLEAN NOT NULL DEFAULT TRUE,
    winner        TEXT NOT NULL,          -- 'player' | 'opponent' | 'draw'
    turns         INTEGER NOT NULL,
    damage_dealt  INTEGER NOT NULL,
    damage_taken  INTEGER NOT NULL,
    deck_token_ids NUMERIC[] NOT NULL,
    mvp_token_id  NUMERIC,
    started_at    TIMESTAMPTZ NOT NULL,
    ended_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS matches_player_idx ON matches (player_id, ended_at DESC);

-- Earned trait progress: each player accumulates points per trait that
-- unlocks a free `fuseTrait` reward when filled. Server hot wallet pays gas.
CREATE TABLE IF NOT EXISTS earned_trait_progress (
    user_id    UUID NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
    trait_id   INTEGER NOT NULL,
    progress   INTEGER NOT NULL DEFAULT 0,
    target     INTEGER NOT NULL DEFAULT 100,
    earned_at  TIMESTAMPTZ,
    PRIMARY KEY (user_id, trait_id)
);
