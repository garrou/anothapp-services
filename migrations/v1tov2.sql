ALTER TABLE users_shows
ADD COLUMN favorite BOOLEAN
DEFAULT FALSE;

ALTER TABLE users_shows
ALTER COLUMN favorite SET NOT NULL;

UPDATE users_shows
SET favorite = TRUE
WHERE EXISTS (SELECT show_id FROM favorites WHERE user_id = users_shows.user_id AND show_id = users_shows.show_id);

DROP TABLE favorites;

ALTER TABLE seasons
RENAME COLUMN episode TO episodes;

ALTER TABLE seasons
RENAME COLUMN ep_duration TO duration;

UPDATE seasons
SET image = (SELECT poster FROM shows WHERE seasons.show_id = shows.id)
WHERE image IS NULL;

ALTER TABLE seasons
ALTER COLUMN image SET NOT NULL;

ALTER TABLE shows
ADD COLUMN duration INTEGER;

UPDATE shows
SET duration = (SELECT duration FROM seasons WHERE show_id = shows.id LIMIT 1);

ALTER TABLE shows
ALTER COLUMN duration SET NOT NULL;

ALTER TABLE shows
ALTER COLUMN poster SET NOT NULL;

ALTER TABLE shows
ALTER COLUMN kinds SET NOT NULL;

ALTER TABLE users_shows
ALTER COLUMN continue SET NOT NULL;

ALTER TABLE users_shows
ALTER COLUMN added_at SET NOT NULL;

ALTER TABLE users_shows
ADD COLUMN missing INTEGER NOT NULL DEFAULT 0;

UPDATE users_shows
SET missing = (SELECT nb FROM users_towatch WHERE show_id = users_shows.show_id);

ALTER TABLE users_shows
ALTER COLUMN missing SET NOT NULL;

DROP TABLE users_towatch;

ALTER TABLE users
ADD COLUMN username VARCHAR(25) UNIQUE;

UPDATE users
SET username = SUBSTR(email, 0, 26);

ALTER TABLE users
ALTER COLUMN username SET NOT NULL;