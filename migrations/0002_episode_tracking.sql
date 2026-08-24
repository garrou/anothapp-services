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

CREATE TABLE users_episodes (
    id SERIAL,
    watched_at TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL,
    episode_id INTEGER NOT NULL,
    users_seasons_id INTEGER NOT NULL,
    platform_id INTEGER,
    PRIMARY KEY(id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(users_seasons_id) REFERENCES users_seasons(id) ON DELETE CASCADE,
    FOREIGN KEY(platform_id) REFERENCES platforms(id) ON UPDATE CASCADE,
    UNIQUE(episode_id, users_seasons_id)
);

CREATE INDEX idx_users_episodes_user_id ON users_episodes(user_id);
CREATE INDEX idx_users_episodes_users_seasons_id ON users_episodes(users_seasons_id);

ALTER TABLE users ADD COLUMN episode_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE;
