CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- =========================
-- KAISOUL ID SEQUENCE
-- =========================

CREATE TABLE IF NOT EXISTS kaisoul_sequences (
    id INTEGER PRIMARY KEY,
    last_number BIGINT NOT NULL DEFAULT 0
);

INSERT INTO kaisoul_sequences (id, last_number)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;


-- =========================
-- USERS
-- =========================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- KAISOUL ID
    kaisoul_id VARCHAR(40) NOT NULL UNIQUE,
    random_number INTEGER NOT NULL,
    sequence_number BIGINT NOT NULL UNIQUE,

    -- Identity
    username VARCHAR(30) NOT NULL,
    display_name VARCHAR(50) NOT NULL,

    -- Authentication
    password_hash TEXT NOT NULL,

    -- Contact
    email VARCHAR(255),
    phone VARCHAR(20),

    -- Profile
    avatar_url TEXT,
    bio VARCHAR(160),

    -- Privacy
    profile_visibility VARCHAR(20)
        NOT NULL DEFAULT 'public'
        CHECK (profile_visibility IN ('public', 'private')),

    allow_username_search BOOLEAN
        NOT NULL DEFAULT TRUE,

    -- Account
    account_status VARCHAR(20)
        NOT NULL DEFAULT 'active'
        CHECK (
            account_status IN (
                'active',
                'suspended',
                'deleted'
            )
        ),

    -- Verification
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================
-- UNIQUE USERNAME
-- =========================

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
ON users (LOWER(username));


-- =========================
-- UNIQUE EMAIL
-- =========================

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
ON users (LOWER(email))
WHERE email IS NOT NULL;


-- =========================
-- UNIQUE PHONE
-- =========================

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
ON users (phone)
WHERE phone IS NOT NULL;


-- =========================
-- SESSIONS
-- =========================

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- SHA-256 hash của session token
    token_hash VARCHAR(64) NOT NULL UNIQUE,

    -- Device information
    device_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,

    -- Activity
    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    last_active TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ
);


CREATE INDEX IF NOT EXISTS sessions_user_id_idx
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
ON sessions(expires_at);


-- =========================
-- LOGIN HISTORY
-- =========================

CREATE TABLE IF NOT EXISTS login_history (
    id BIGSERIAL PRIMARY KEY,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    timestamp TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    ip_address INET,
    user_agent TEXT,

    success BOOLEAN NOT NULL
);


CREATE INDEX IF NOT EXISTS login_history_user_id_idx
ON login_history(user_id);

CREATE INDEX IF NOT EXISTS login_history_timestamp_idx
ON login_history(timestamp DESC);


-- =========================
-- BLOCKED USERS
-- =========================

CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    blocked_user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        blocker_user_id,
        blocked_user_id
    ),

    CHECK (
        blocker_user_id <> blocked_user_id
    )
);


-- =========================
-- EMAIL / PHONE VERIFICATION
-- =========================

CREATE TABLE IF NOT EXISTS verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash VARCHAR(64) NOT NULL UNIQUE,

    type VARCHAR(30) NOT NULL
        CHECK (
            type IN (
                'email_verification',
                'phone_verification'
            )
        ),

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS verification_tokens_user_id_idx
ON verification_tokens(user_id);


-- =========================
-- PASSWORD RESET
-- =========================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash VARCHAR(64) NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
ON password_reset_tokens(user_id);


-- =========================
-- UPDATED_AT TRIGGER
-- =========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS users_updated_at ON users;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


COMMIT;
