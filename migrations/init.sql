SET client_encoding = "UTF8";

CREATE TABLE users (
    id VARCHAR(50),
    username VARCHAR(25) UNIQUE NOT NULL,
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
    seasons INTEGER NOT NULL,
    country VARCHAR(50) NOT NULL,
    PRIMARY KEY(id)
);

CREATE TABLE users_shows (
    continue BOOLEAN NOT NULL DEFAULT TRUE,
    added_at TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id VARCHAR(50),
    show_id INTEGER,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, show_id)
);

CREATE TABLE seasons (
    number INTEGER NOT NULL,
    episodes INTEGER NOT NULL,
    image VARCHAR(255) NOT NULL,
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

CREATE TABLE friends (
    fst_user_id VARCHAR(50),
    sec_user_id VARCHAR(50),
    friend_at TIMESTAMP DEFAULT NOW(),
    accepted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY(fst_user_id, sec_user_id),
    FOREIGN KEY(fst_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(sec_user_id) REFERENCES users(id) ON DELETE CASCADE
);