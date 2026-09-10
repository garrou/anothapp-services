SET client_encoding = 'UTF8';

CREATE TABLE platforms (
    id INTEGER,
    name VARCHAR(50) UNIQUE NOT NULL,
    logo VARCHAR(255),
    PRIMARY KEY(id)
);

INSERT INTO platforms (id, name, logo) VALUES
(999, 'Autres', ''),
(25, 'ADN', 'https://pictures.betaseries.com/platforms/25.jpg'),
(1, 'Netflix', 'https://pictures.betaseries.com/platforms/1.jpg'),
(278, 'Canal+', 'https://pictures.betaseries.com/platforms/278.jpg'),
(3, 'Prime Video', 'https://pictures.betaseries.com/platforms/3.jpg'),
(2, 'OCS', 'https://pictures.betaseries.com/platforms/2.jpg'),
(246, 'Disney+', 'https://pictures.betaseries.com/platforms/246.jpg'),
(255, 'Apple TV+', 'https://pictures.betaseries.com/platforms/255.jpg'),
(418, 'Max', 'https://pictures.betaseries.com/platforms/418.jpg'),
(33, 'Paramount+', 'https://pictures.betaseries.com/platforms/33.jpg'),
(221, 'Crunchyroll', 'https://pictures.betaseries.com/platforms/221.jpg'),
(252, 'Rakuten Viki', 'https://pictures.betaseries.com/platforms/252.jpg'),
(416, 'TF1+', 'https://pictures.betaseries.com/platforms/416.jpg'),
(26, 'Arte', 'https://pictures.betaseries.com/platforms/26.jpg'),
(17, 'M6+', 'https://pictures.betaseries.com/platforms/17.jpg'),
(27, 'france.tv', 'https://pictures.betaseries.com/platforms/27.jpg');

CREATE TABLE notes (
    id INTEGER,
    name VARCHAR(25) UNIQUE NOT NULL,
    PRIMARY KEY(id)
);

INSERT INTO notes (id, name) VALUES
(1, 'Nul'),
(2, 'Moyen'),
(3, 'Bien'),
(4, 'Très bien'),
(5, 'Excellent');

CREATE TABLE kinds (
    id VARCHAR(50),
    name VARCHAR(50) UNIQUE NOT NULL,
    PRIMARY KEY(id)
);

INSERT INTO kinds (id, name) VALUES
    ('Comedy', 'Comédie'),
    ('Drama', 'Drame'),
    ('Crime', 'Crime'),
    ('Horror', 'Horreur'),
    ('Anime', 'Anime'),
    ('Action', 'Action'),
    ('Adventure', 'Aventure'),
    ('Fantasy', 'Fantastique'),
    ('Animation', 'Animation'),
    ('Science_Fiction', 'Science-fiction'),
    ('Mini-Series', 'Mini-série'),
    ('Documentary', 'Documentaire'),
    ('Reality', 'Télé-réalité'),
    ('Romance', 'Romance'),
    ('Western', 'Western'),
    ('Talk_Show', 'Talk Show'),
    ('Game_Show', 'Game Show'),
    ('Thriller', 'Thriller'),
    ('Food', 'Cuisine'),
    ('Soap', 'Soap'),
    ('Children', 'Enfant'),
    ('Family', 'Famille'),
    ('Home_and_Garden', 'Maison et jardinage'),
    ('Mystery', 'Mystère'),
    ('News', 'Actualité'),
    ('Special_Interest', 'Intérêt particulier'),
    ('Sport', 'Sport'),
    ('Suspense', 'Suspense'),
    ('Travel', 'Voyage'),
    ('History', 'Histoire'),
    ('Indie', 'Indie'),
    ('Musical', 'Comédie musicale'),
    ('Podcast', 'Podcast'),
    ('War', 'Guerre'),
    ('Martial_Arts', 'Arts martiaux');

CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid(),
    username VARCHAR(25) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    picture VARCHAR(255),
    last_export TIMESTAMPTZ,
    episode_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(id)
);

CREATE TABLE refresh_tokens (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE shows (
    id INTEGER,
    title VARCHAR(255) UNIQUE NOT NULL,
    poster VARCHAR(255),
    duration INTEGER NOT NULL,
    seasons INTEGER NOT NULL,
    country VARCHAR(50) NOT NULL,
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    next_episode VARCHAR(10),
    description TEXT,
    creation SMALLINT,
    network VARCHAR(100),
    language VARCHAR(10),
    episodes INTEGER,
    PRIMARY KEY(id)
);

CREATE TABLE users_shows (
    continue BOOLEAN NOT NULL DEFAULT TRUE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID,
    show_id INTEGER,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    note_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE SET NULL,
    PRIMARY KEY(user_id, show_id)
);

CREATE TABLE shows_kinds (
    show_id INTEGER,
    kind_id VARCHAR(50),
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(kind_id) REFERENCES kinds(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY(show_id, kind_id)
);

CREATE TABLE seasons (
    number INTEGER NOT NULL,
    episodes INTEGER NOT NULL,
    image VARCHAR(255),
    show_id INTEGER,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY(number, show_id)
);

CREATE TABLE users_seasons (
    id SERIAL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID,
    show_id INTEGER,
    platform_id INTEGER,
    number INTEGER,
    PRIMARY KEY(id),
    FOREIGN KEY(platform_id) REFERENCES platforms(id) ON UPDATE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(show_id, number) REFERENCES seasons(show_id, number) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(user_id, show_id) REFERENCES users_shows(user_id, show_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE users_seasons_friends (
    users_season_id INTEGER NOT NULL,
    friend_user_id UUID NOT NULL,
    FOREIGN KEY(users_season_id) REFERENCES users_seasons(id) ON DELETE CASCADE,
    FOREIGN KEY(friend_user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY(users_season_id, friend_user_id)
);

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
    description TEXT,
    PRIMARY KEY(id),
    FOREIGN KEY(show_id, season_number) REFERENCES seasons(show_id, number) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE users_episodes (
    id SERIAL,
    watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

CREATE TABLE friends (
    fst_user_id UUID,
    sec_user_id UUID,
    friend_at TIMESTAMPTZ DEFAULT NOW(),
    accepted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY(fst_user_id, sec_user_id),
    FOREIGN KEY(fst_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(sec_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE users_list (
    user_id UUID,
    show_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY(user_id, show_id)
);

CREATE TABLE playlists (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    visible BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY(id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE playlists_shows (
    playlist_id UUID,
    show_id INTEGER,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY(playlist_id, show_id)
);

CREATE TABLE users_platforms (
    user_id UUID,
    platform_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(platform_id) REFERENCES platforms(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY(user_id, platform_id)
);

CREATE TABLE actors (
    id INTEGER,
    name VARCHAR(255) NOT NULL,
    picture VARCHAR(255),
    birthday DATE,
    deathday DATE,
    nationality VARCHAR(100),
    description TEXT,
    PRIMARY KEY(id)
);

CREATE TABLE users_favorite_actors (
    user_id UUID,
    actor_id INTEGER,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(actor_id) REFERENCES actors(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY(user_id, actor_id)
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    recipient_user_id UUID NOT NULL,
    actor_user_id UUID,
    type VARCHAR(50) NOT NULL,
    show_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE
);

CREATE TABLE achievement_tiers (
    code VARCHAR(50) NOT NULL,
    league SMALLINT NOT NULL,
    sub_tier SMALLINT NOT NULL,
    threshold NUMERIC NOT NULL,
    PRIMARY KEY(code, league, sub_tier)
);

-- league: 1=bronze 2=argent 3=or 4=diamant 5=master 6=champion 7=titan
-- sub_tier: 3 (entry of the league) down to 1 (top of the league)
INSERT INTO achievement_tiers (code, league, sub_tier, threshold) VALUES
    ('streak', 1, 3, 1),
    ('streak', 1, 2, 3),
    ('streak', 1, 1, 7),
    ('streak', 2, 3, 10),
    ('streak', 2, 2, 14),
    ('streak', 2, 1, 21),
    ('streak', 3, 3, 30),
    ('streak', 3, 2, 45),
    ('streak', 3, 1, 60),
    ('streak', 4, 3, 90),
    ('streak', 4, 2, 120),
    ('streak', 4, 1, 150),
    ('streak', 5, 3, 180),
    ('streak', 5, 2, 240),
    ('streak', 5, 1, 365),
    ('streak', 6, 3, 500),
    ('streak', 6, 2, 650),
    ('streak', 6, 1, 800),
    ('streak', 7, 3, 1000),
    ('streak', 7, 2, 1500),
    ('streak', 7, 1, 2000),
    ('watch_time', 1, 3, 5),
    ('watch_time', 1, 2, 10),
    ('watch_time', 1, 1, 20),
    ('watch_time', 2, 3, 35),
    ('watch_time', 2, 2, 50),
    ('watch_time', 2, 1, 75),
    ('watch_time', 3, 3, 100),
    ('watch_time', 3, 2, 150),
    ('watch_time', 3, 1, 200),
    ('watch_time', 4, 3, 300),
    ('watch_time', 4, 2, 400),
    ('watch_time', 4, 1, 500),
    ('watch_time', 5, 3, 700),
    ('watch_time', 5, 2, 900),
    ('watch_time', 5, 1, 1200),
    ('watch_time', 6, 3, 1500),
    ('watch_time', 6, 2, 2000),
    ('watch_time', 6, 1, 2500),
    ('watch_time', 7, 3, 3000),
    ('watch_time', 7, 2, 4000),
    ('watch_time', 7, 1, 5000),
    ('shows_started', 1, 3, 3),
    ('shows_started', 1, 2, 6),
    ('shows_started', 1, 1, 12),
    ('shows_started', 2, 3, 20),
    ('shows_started', 2, 2, 30),
    ('shows_started', 2, 1, 45),
    ('shows_started', 3, 3, 65),
    ('shows_started', 3, 2, 90),
    ('shows_started', 3, 1, 130),
    ('shows_started', 4, 3, 175),
    ('shows_started', 4, 2, 230),
    ('shows_started', 4, 1, 300),
    ('shows_started', 5, 3, 375),
    ('shows_started', 5, 2, 460),
    ('shows_started', 5, 1, 575),
    ('shows_started', 6, 3, 700),
    ('shows_started', 6, 2, 850),
    ('shows_started', 6, 1, 1000),
    ('shows_started', 7, 3, 1200),
    ('shows_started', 7, 2, 1500),
    ('shows_started', 7, 1, 1900),
    ('shows_completed', 1, 3, 1),
    ('shows_completed', 1, 2, 3),
    ('shows_completed', 1, 1, 7),
    ('shows_completed', 2, 3, 12),
    ('shows_completed', 2, 2, 20),
    ('shows_completed', 2, 1, 30),
    ('shows_completed', 3, 3, 45),
    ('shows_completed', 3, 2, 65),
    ('shows_completed', 3, 1, 90),
    ('shows_completed', 4, 3, 120),
    ('shows_completed', 4, 2, 160),
    ('shows_completed', 4, 1, 200),
    ('shows_completed', 5, 3, 250),
    ('shows_completed', 5, 2, 300),
    ('shows_completed', 5, 1, 375),
    ('shows_completed', 6, 3, 450),
    ('shows_completed', 6, 2, 550),
    ('shows_completed', 6, 1, 650),
    ('shows_completed', 7, 3, 800),
    ('shows_completed', 7, 2, 1000),
    ('shows_completed', 7, 1, 1250),
    ('countries', 1, 3, 2),
    ('countries', 1, 2, 4),
    ('countries', 1, 1, 6),
    ('countries', 2, 3, 8),
    ('countries', 2, 2, 10),
    ('countries', 2, 1, 13),
    ('countries', 3, 3, 16),
    ('countries', 3, 2, 19),
    ('countries', 3, 1, 22),
    ('countries', 4, 3, 25),
    ('countries', 4, 2, 28),
    ('countries', 4, 1, 31),
    ('countries', 5, 3, 34),
    ('countries', 5, 2, 37),
    ('countries', 5, 1, 40),
    ('countries', 6, 3, 43),
    ('countries', 6, 2, 45),
    ('countries', 6, 1, 47),
    ('countries', 7, 3, 48),
    ('countries', 7, 2, 49),
    ('countries', 7, 1, 50),
    ('friends_watched_with', 1, 3, 1),
    ('friends_watched_with', 1, 2, 2),
    ('friends_watched_with', 1, 1, 3),
    ('friends_watched_with', 2, 3, 4),
    ('friends_watched_with', 2, 2, 5),
    ('friends_watched_with', 2, 1, 6),
    ('friends_watched_with', 3, 3, 7),
    ('friends_watched_with', 3, 2, 9),
    ('friends_watched_with', 3, 1, 11),
    ('friends_watched_with', 4, 3, 13),
    ('friends_watched_with', 4, 2, 15),
    ('friends_watched_with', 4, 1, 17),
    ('friends_watched_with', 5, 3, 19),
    ('friends_watched_with', 5, 2, 22),
    ('friends_watched_with', 5, 1, 25),
    ('friends_watched_with', 6, 3, 28),
    ('friends_watched_with', 6, 2, 31),
    ('friends_watched_with', 6, 1, 34),
    ('friends_watched_with', 7, 3, 36),
    ('friends_watched_with', 7, 2, 38),
    ('friends_watched_with', 7, 1, 40),
    ('friends_count', 1, 3, 2),
    ('friends_count', 1, 2, 3),
    ('friends_count', 1, 1, 5),
    ('friends_count', 2, 3, 6),
    ('friends_count', 2, 2, 8),
    ('friends_count', 2, 1, 9),
    ('friends_count', 3, 3, 11),
    ('friends_count', 3, 2, 14),
    ('friends_count', 3, 1, 17),
    ('friends_count', 4, 3, 20),
    ('friends_count', 4, 2, 23),
    ('friends_count', 4, 1, 26),
    ('friends_count', 5, 3, 29),
    ('friends_count', 5, 2, 33),
    ('friends_count', 5, 1, 38),
    ('friends_count', 6, 3, 43),
    ('friends_count', 6, 2, 48),
    ('friends_count', 6, 1, 52),
    ('friends_count', 7, 3, 55),
    ('friends_count', 7, 2, 58),
    ('friends_count', 7, 1, 60),
    ('notes_count', 1, 3, 3),
    ('notes_count', 1, 2, 8),
    ('notes_count', 1, 1, 15),
    ('notes_count', 2, 3, 25),
    ('notes_count', 2, 2, 40),
    ('notes_count', 2, 1, 60),
    ('notes_count', 3, 3, 90),
    ('notes_count', 3, 2, 120),
    ('notes_count', 3, 1, 160),
    ('notes_count', 4, 3, 200),
    ('notes_count', 4, 2, 250),
    ('notes_count', 4, 1, 300),
    ('notes_count', 5, 3, 375),
    ('notes_count', 5, 2, 450),
    ('notes_count', 5, 1, 550),
    ('notes_count', 6, 3, 650),
    ('notes_count', 6, 2, 800),
    ('notes_count', 6, 1, 950),
    ('notes_count', 7, 3, 1100),
    ('notes_count', 7, 2, 1300),
    ('notes_count', 7, 1, 1500),
    ('account_age', 1, 3, 1),
    ('account_age', 1, 2, 3),
    ('account_age', 1, 1, 6),
    ('account_age', 2, 3, 12),
    ('account_age', 2, 2, 18),
    ('account_age', 2, 1, 24),
    ('account_age', 3, 3, 36),
    ('account_age', 3, 2, 48),
    ('account_age', 3, 1, 60),
    ('account_age', 4, 3, 72),
    ('account_age', 4, 2, 84),
    ('account_age', 4, 1, 96),
    ('account_age', 5, 3, 108),
    ('account_age', 5, 2, 120),
    ('account_age', 5, 1, 144),
    ('account_age', 6, 3, 168),
    ('account_age', 6, 2, 192),
    ('account_age', 6, 1, 216),
    ('account_age', 7, 3, 240),
    ('account_age', 7, 2, 270),
    ('account_age', 7, 1, 300),
    ('kinds', 1, 3, 3),
    ('kinds', 1, 2, 5),
    ('kinds', 1, 1, 8),
    ('kinds', 2, 3, 11),
    ('kinds', 2, 2, 14),
    ('kinds', 2, 1, 18),
    ('kinds', 3, 3, 22),
    ('kinds', 3, 2, 27),
    ('kinds', 3, 1, 32),
    ('platforms', 1, 3, 2),
    ('platforms', 1, 2, 4),
    ('platforms', 1, 1, 6),
    ('platforms', 2, 3, 8),
    ('platforms', 2, 2, 10),
    ('platforms', 2, 1, 12),
    ('platforms', 3, 3, 14),
    ('platforms', 3, 2, 16),
    ('platforms', 3, 1, 20),
    ('leaderboard_top3', 1, 1, 1);

CREATE TABLE users_achievements (
    user_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    league SMALLINT NOT NULL,
    sub_tier SMALLINT NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id, code),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_users_shows_user_id ON users_shows(user_id);
CREATE INDEX idx_users_seasons_user_id ON users_seasons(user_id);
CREATE INDEX idx_episodes_show_season ON episodes(show_id, season_number);
CREATE INDEX idx_users_episodes_user_id ON users_episodes(user_id);
CREATE INDEX idx_users_episodes_users_seasons_id ON users_episodes(users_seasons_id);
CREATE INDEX idx_friends_sec_user_id ON friends(sec_user_id);
CREATE INDEX idx_users_seasons_friends_friend ON users_seasons_friends(friend_user_id);
CREATE INDEX idx_users_list_user_id ON users_list(user_id);
CREATE INDEX idx_playlists_user_id ON playlists(user_id);
CREATE INDEX idx_notifications_recipient_unread ON notifications(recipient_user_id, read_at);
CREATE INDEX idx_users_achievements_user_id ON users_achievements(user_id);
CREATE INDEX idx_notifications_recipient_created ON notifications(recipient_user_id, created_at DESC);