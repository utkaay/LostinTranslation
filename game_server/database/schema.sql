-- Lost in Translation — database schema
-- Import: /opt/lampp/bin/mysql -u root -p < schema.sql
-- (or phpMyAdmin: Import tab). utf8mb4 is required so Japanese/Arabic/Korean
-- text stores correctly; tables inherit it from the database default.

CREATE DATABASE IF NOT EXISTS lost_in_translation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lost_in_translation;

-- the pool of short English idioms a round is generated from (>= 40)
CREATE TABLE IF NOT EXISTS seeds (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    text VARCHAR(120) NOT NULL,
    UNIQUE KEY uq_seed_text (text)
);

-- one generated puzzle. the server owns the clock via closes_on.
-- closed: 0 = open for guessing, 1 = closed and revealable.
CREATE TABLE IF NOT EXISTS rounds (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    seed_text    VARCHAR(120) NOT NULL,
    final_text   TEXT DEFAULT NULL,
    mangle_score INT DEFAULT NULL,
    closed       TINYINT NOT NULL DEFAULT 0,
    started_on   DATETIME NOT NULL,
    closes_on    DATETIME NOT NULL,
    created_on   DATETIME NOT NULL
);

-- every hop of the chain (step_index 0..6). reveal + hints read from here.
CREATE TABLE IF NOT EXISTS steps (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    round_id   INT NOT NULL,
    step_index INT NOT NULL,
    from_lang  VARCHAR(8) NOT NULL,
    to_lang    VARCHAR(8) NOT NULL,
    text_in    TEXT NOT NULL,
    text_out   TEXT NOT NULL,
    char_delta INT NOT NULL,
    UNIQUE KEY uq_round_step (round_id, step_index),
    INDEX idx_steps_round (round_id)
);

-- a player's submitted attempt + its scoring
CREATE TABLE IF NOT EXISTS guesses (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    round_id   INT NOT NULL,
    player_id  VARCHAR(64) NOT NULL,
    guess_text VARCHAR(120) NOT NULL,
    similarity DECIMAL(4,3) NOT NULL,
    points     INT NOT NULL DEFAULT 0,
    hints_used INT NOT NULL DEFAULT 0,
    created_on DATETIME NOT NULL,
    INDEX idx_guesses_round (round_id)
);

-- one hint reveal per (round, player, step). guess.php counts these server-side
-- so the 30-point cost can't be faked by the client.
CREATE TABLE IF NOT EXISTS hints (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    round_id   INT NOT NULL,
    player_id  VARCHAR(64) NOT NULL,
    step_index INT NOT NULL,
    created_on DATETIME NOT NULL,
    UNIQUE KEY uq_round_player_step (round_id, player_id, step_index)
);

-- one row per (from, to, text) hop. a repeated seed costs 0 API calls.
-- 191 is the utf8mb4-safe prefix length for a unique index.
CREATE TABLE IF NOT EXISTS cache (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    from_lang       VARCHAR(8) NOT NULL,
    to_lang         VARCHAR(8) NOT NULL,
    source_text     VARCHAR(512) NOT NULL,
    translated_text TEXT NOT NULL,
    created_on      DATETIME NOT NULL,
    UNIQUE KEY uq_hop (from_lang, to_lang, source_text(191))
);

-- quota accounting: one row per (day, provider), counting only the real API
-- calls (cache hits don't spend quota, so they aren't counted here).
CREATE TABLE IF NOT EXISTS api_usage (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    day        DATE NOT NULL,
    provider   VARCHAR(16) NOT NULL,
    calls      INT NOT NULL DEFAULT 0,
    chars      INT NOT NULL DEFAULT 0,
    updated_on DATETIME NOT NULL,
    UNIQUE KEY uq_day_provider (day, provider)
);

-- the most-mangled rounds, ranked by mangle_score / votes
CREATE TABLE IF NOT EXISTS hall_of_fame (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    round_id     INT NOT NULL,
    seed_text    VARCHAR(120) NOT NULL,
    final_text   TEXT NOT NULL,
    mangle_score INT NOT NULL,
    votes        INT NOT NULL DEFAULT 0,
    created_on   DATETIME NOT NULL,
    UNIQUE KEY uq_hof_round (round_id),
    INDEX idx_hof_mangle (mangle_score),
    INDEX idx_hof_votes (votes)
);

-- one upvote per player per hall entry (enforced by the unique key)
CREATE TABLE IF NOT EXISTS votes (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    entry_id   INT NOT NULL,
    player_id  VARCHAR(64) NOT NULL,
    created_on DATETIME NOT NULL,
    UNIQUE KEY uq_entry_player (entry_id, player_id)
);
