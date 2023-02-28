CREATE TABLE users (
    id VARCHAR(50),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    picture VARCHAR(255),
    PRIMARY KEY(id)
);

CREATE TABLE shows (
    id INTEGER,
    title VARCHAR(255) UNIQUE NOT NULL,
    poster VARCHAR(255),
    PRIMARY KEY(id)
);

CREATE TABLE users_shows (
    continue BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(50),
    show_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, show_id)
);

CREATE TABLE seasons (
    number INTEGER NOT NULL,
    episode INTEGER NOT NULL,
    ep_duration INTEGER NOT NULL,
    image VARCHAR(255),
    show_id INTEGER,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    PRIMARY KEY(number, show_id)
);

CREATE TABLE users_seasons (
    id SERIAL PRIMARY KEY,
    added_at TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(50),
    show_id INTEGER,
    number INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(show_id, number) REFERENCES seasons(show_id, number) ON DELETE CASCADE,
    FOREIGN KEY(user_id, show_id) REFERENCES users_shows(user_id, show_id) ON DELETE CASCADE
);