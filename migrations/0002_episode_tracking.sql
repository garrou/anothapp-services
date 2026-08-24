-- Adds optional per-episode tracking, on top of the existing per-season tracking.
-- Run manually against the live database (no migration runner exists in this project,
-- see migrations/init.sql) then keep init.sql in sync for fresh environments.

-- Global episode catalog, synced from BetaSeries (mirrors `seasons`).
CREATE TABLE episodes (
    id INTEGER,
    show_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    number INTEGER NOT NULL,
    title VARCHAR(255),
    code VARCHAR(10),
    global INTEGER,
    length INTEGER,
    date DATE,
    PRIMARY KEY(id),
    FOREIGN KEY(show_id, season_number) REFERENCES seasons(show_id, number)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_episodes_show_season ON episodes(show_id, season_number);

-- Per-user watch state. Multiple rows per (user_id, episode_id) represent rewatches.
-- `watched_at IS NULL` is a placeholder row created when a season is added while
-- tracking is enabled, meaning "tracked but not watched yet". The partial unique
-- index guarantees at most one such placeholder per (user, episode).
CREATE TABLE users_episodes (
    id SERIAL,
    watched_at TIMESTAMP DEFAULT NULL,
    user_id UUID NOT NULL,
    episode_id INTEGER NOT NULL,
    platform_id INTEGER,
    PRIMARY KEY(id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(platform_id) REFERENCES platforms(id) ON UPDATE CASCADE
);

CREATE INDEX idx_users_episodes_user_id ON users_episodes(user_id);

CREATE UNIQUE INDEX idx_users_episodes_unwatched_unique
    ON users_episodes(user_id, episode_id) WHERE watched_at IS NULL;

ALTER TABLE users ADD COLUMN episode_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE;
