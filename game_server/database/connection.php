<?php

// Database connection. Secrets come from .env (gitignored); settings from config.php.
// Every endpoint does: include(__DIR__ . "/database/connection.php");

ini_set("serialize_precision", "-1");   // clean JSON floats (0.4 not 0.40000000002)

require_once __DIR__ . "/../config.php";

$env = parse_ini_file(__DIR__ . "/../.env");

$db_host = "localhost";
$db_user = "root";
$db_pass = $env["DB_PASS"];
$db_name = "lost_in_translation";

$mysql = new mysqli($db_host, $db_user, $db_pass, $db_name);
$mysql->set_charset("utf8mb4");   // needed so JA/AR/KO text round-trips without mojibake

$claude_api_key = $env["ANTHROPIC_API_KEY"];   // used when $provider = "claude"

?>
