SET client_encoding = "UTF8";

CREATE TABLE users (
    id VARCHAR(50),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    picture VARCHAR(255),
    PRIMARY KEY(id)
);

CREATE TABLE shows (
    id INTEGER,
    title VARCHAR(255) UNIQUE NOT NULL,
    poster VARCHAR(255) NOT NULL,
    kinds VARCHAR(255) NOT NULL,
    duration INTEGER NOT NULL,
    PRIMARY KEY(id)
);

CREATE TABLE users_shows (
    continue BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(50),
    show_id INTEGER,
    favorite BOOLEAN DEFAULT FALSE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, show_id)
);

CREATE TABLE seasons (
    number INTEGER NOT NULL,
    episode INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    image VARCHAR(255),
    show_id INTEGER,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    PRIMARY KEY(number, show_id)
);

CREATE TABLE users_seasons (
    id SERIAL,
    added_at TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(50),
    show_id INTEGER,
    number INTEGER,
    PRIMARY KEY(id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(show_id, number) REFERENCES seasons(show_id, number) ON DELETE CASCADE,
    FOREIGN KEY(user_id, show_id) REFERENCES users_shows(user_id, show_id) ON DELETE CASCADE
);

CREATE TABLE users_towatch (
    user_id VARCHAR(50),
    show_id INTEGER,
    nb INTEGER NOT NULL,
    PRIMARY KEY(user_id, show_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE
);

CREATE TABLE friends (
    fst_user_id VARCHAR(50),
    sec_user_id VARCHAR(50),
    friend_at TIMESTAMP DEFAULT NOW(),
    accepted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY(fst_user_id, sec_user_id),
    FOREIGN KEY(fst_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(sec_user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE users_shows
ADD COLUMN favorite BOOLEAN
DEFAULT FALSE;

DROP TABLE favorites;

ALTER TABLE seasons
RENAME COLUMN episode TO episodes;

ALTER TABLE seasons
RENAME COLUMN ep_duration TO duration;

ALTER TABLE shows
ADD COLUMN duration INTEGER DEFAULT 0;

UPDATE shows
SET duration = (SELECT duration FROM seasons WHERE show_id = shows.id LIMIT 1);

ALTER TABLE shows
ALTER COLUMN poster SET NOT NULL;

ALTER TABLE shows
ALTER COLUMN kinds SET NOT NULL;