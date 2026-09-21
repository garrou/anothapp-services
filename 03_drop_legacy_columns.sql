-- Step 3/3 - destructive, run ONLY once the new app code has been live and stable for a while
-- (no rollback to the old code planned) and step 2 has been re-run at least once after the
-- deploy. Take a backup/snapshot before running this - there is no undo.
--
-- Before running the constraint drop below, verify the real name with:
--   \d users
-- "users_username_key" is Postgres's default auto-generated name for the column-level
-- `username ... UNIQUE` from the original CREATE TABLE - correct unless it was ever renamed.

BEGIN;

ALTER TABLE users
    DROP COLUMN email,
    DROP COLUMN password,
    DROP COLUMN email_verified,
    DROP COLUMN pending_email,
    DROP COLUMN login_challenge_id,
    DROP COLUMN login_code_hash,
    DROP COLUMN login_code_expires_at,
    DROP COLUMN login_code_attempts;
-- Dropping `email` also drops the old idx_users_email_ci (UPPER(email)) functional index and the
-- old users_email_key UNIQUE constraint automatically - both are defined solely on this column,
-- so Postgres removes them along with it, no separate statement needed.

-- Same redundancy as email had: idx_users_username_ci (UPPER(username), already in place) already
-- guarantees uniqueness case-insensitively, which is strictly stronger than this plain UNIQUE -
-- keeping both just pays for a second index maintained on every write for no extra guarantee.
ALTER TABLE users DROP CONSTRAINT users_username_key;

COMMIT;
