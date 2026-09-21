-- Step 2/3 - backfill. Idempotent (ON CONFLICT DO NOTHING everywhere), so it's safe to run this
-- script MORE THAN ONCE. Recommended timing:
--   1. Run it once, right after step 1, while the OLD app code is still live.
--   2. Deploy the new app code (this branch) - from that moment on, register()/login() write
--      directly to users_auth/login_challenges and never touch the old flat columns again.
--   3. Run this script a SECOND time immediately after the deploy finishes, to catch whatever
--      landed on the old columns in the brief window between step 2's run and the code actually
--      switching over (a registration or a login() call from the still-draining old instances).
--      ON CONFLICT DO NOTHING means it will just no-op for every row already migrated.

BEGIN;

INSERT INTO users_auth (user_id, email, password_hash, email_verified, pending_email)
SELECT id, email, password, email_verified, pending_email
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Only accounts with a still-open (unconfirmed) challenge at migration time carry one over.
-- confirmLoginChallenge always cleared these 4 columns back to NULL once a code was confirmed
-- (see the pre-split UserRepository.confirmLoginChallenge), so NULL here has always meant
-- "no active challenge" - exactly what the new schema expresses by simply having no row.
-- The id is carried over as-is: an approval token already emailed to a user encodes this
-- exact id as its `jti`, and LoginChallengeRepository.confirm looks it up by that id.
INSERT INTO login_challenges (id, user_id, code_hash, expires_at, attempts, confirmed_at)
SELECT login_challenge_id, id, login_code_hash, login_code_expires_at, login_code_attempts, NULL
FROM users
WHERE login_challenge_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- IF NOT EXISTS makes this safe on a second run too (e.g. the post-deploy pass above).
-- CONCURRENTLY avoids locking users_auth for writes while the index builds, but can't run inside
-- a transaction block, hence it being its own statement, outside BEGIN/COMMIT - run it once,
-- after the backfill above has landed (ideally after its second, post-deploy pass).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_email_ci ON users_auth(UPPER(email));
