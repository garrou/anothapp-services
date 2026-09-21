-- Step 1/3 - additive only, safe to run anytime, BEFORE deploying the new app code.
-- Old code keeps reading/writing users.email/password/... exactly as before; it never touches
-- these new tables, so this step has zero effect on the currently running app.

BEGIN;

CREATE TABLE users_auth (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    pending_email VARCHAR(255)
);

CREATE TABLE login_challenges (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX idx_login_challenges_user_id_created_at ON login_challenges(user_id, created_at DESC);

COMMIT;

-- The case-insensitive unique index on users_auth.email is deliberately NOT created here - it's
-- built once in step 2, after the backfill, so Postgres doesn't pay to maintain it row-by-row
-- during the bulk INSERT (and CREATE INDEX CONCURRENTLY can't run inside a transaction anyway).
