<?php

// Lost in Translation — non-secret settings (safe to commit).
// Secrets (DB password, API key) live in .env, loaded by connection.php.

$round_seconds = 60;                                       // guessing window length (seconds)

$chain = ["en", "ja", "ar", "fi", "sw", "hu", "ko", "en"]; // the translation chain — edit to change the languages

$hof_threshold = 60;                                       // min mangle score to enter the Hall of Fame

// translation provider:
//   "mymemory" = free, no key (default)
//   "claude"   = Anthropic, needs ANTHROPIC_API_KEY in .env
//   "stub"     = fake local mangling, no network
$provider = "claude";

$mymemory_email = "";                                      // optional: valid email raises MyMemory's daily limit

$claude_model = "claude-haiku-4-5-20251001";               // Anthropic model (when $provider = "claude")

?>
