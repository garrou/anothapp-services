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

CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid(),
    username VARCHAR(25) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    picture VARCHAR(255),
    last_export TIMESTAMP,
    PRIMARY KEY(id)
);

CREATE TABLE shows (
    id INTEGER,
    title VARCHAR(255) UNIQUE NOT NULL,
    poster VARCHAR(255),
    kinds VARCHAR(255) NOT NULL,
    duration INTEGER NOT NULL,
    seasons INTEGER NOT NULL,
    country VARCHAR(50) NOT NULL,
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    next_episode VARCHAR(10),
    PRIMARY KEY(id)
);

CREATE TABLE users_shows (
    continue BOOLEAN NOT NULL DEFAULT TRUE,
    added_at TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id UUID,
    show_id INTEGER,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    note_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(show_id) REFERENCES shows(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE SET NULL,
    PRIMARY KEY(user_id, show_id)
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
    added_at TIMESTAMP DEFAULT NOW(),
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

CREATE TABLE friends (
    fst_user_id UUID,
    sec_user_id UUID,
    friend_at TIMESTAMP DEFAULT NOW(),
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

CREATE INDEX idx_users_shows_user_id ON users_shows(user_id);
CREATE INDEX idx_users_seasons_user_id ON users_seasons(user_id);
CREATE INDEX idx_friends_sec_user_id ON friends(sec_user_id);
CREATE INDEX idx_users_list_user_id ON users_list(user_id);