<?php

// Lost in Translation — translation service.
//
// Everything goes through translate(). All external API calls happen here, in
// PHP (never in the browser). Every hop is cached against its text and language
// pair, so a sentence already sent through the chain costs no more API calls.
// Two providers sit behind translate(): MyMemory (free, no key) and Claude.

// --- provider: MyMemory (free, no key) via cURL GET -----------------------
// returns the translated string, or null on any failure. MyMemory reports some
// failures INSIDE a 200 response, so we check the body's status, not just HTTP.
function mymemory_translate($text, $from, $to, $email)
{
    $query = [
        "q" => $text,
        "langpair" => $from . "|" . $to,
    ];
    if ($email !== "") {
        $query["de"] = $email;   // a valid email raises the daily character limit
    }
    $url = "https://api.mymemory.translated.net/get?" . http_build_query($query);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $raw = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $http !== 200) {
        return null;
    }

    $data = json_decode($raw, true);

    // check the status reported in the body (not only the HTTP code)
    if (!isset($data["responseStatus"]) || (int) $data["responseStatus"] !== 200) {
        return null;
    }
    if (!empty($data["quotaFinished"])) {
        return null;   // daily free quota used up
    }
    if (!isset($data["responseData"]["translatedText"])) {
        return null;
    }

    $out = trim($data["responseData"]["translatedText"]);
    if ($out === "" || stripos($out, "MYMEMORY WARNING") !== false) {
        return null;
    }
    return $out;
}

// --- provider: Claude (Anthropic Messages API) via cURL POST --------------
// returns the translated string, or null on any failure.
function claude_translate($text, $from, $to, $api_key, $model)
{
    $prompt = "Translate the following text from $from to $to. "
        . "Output only the translation, with no quotes, notes, or explanation.\n\n" . $text;

    $body = [
        "model" => $model,
        "max_tokens" => 256,
        "messages" => [
            ["role" => "user", "content" => $prompt],
        ],
    ];

    $ch = curl_init("https://api.anthropic.com/v1/messages");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "x-api-key: " . $api_key,
        "anthropic-version: 2023-06-01",
        "content-type: application/json",
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $raw = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $http !== 200) {
        return null;
    }

    $data = json_decode($raw, true);
    if (!isset($data["content"][0]["text"])) {
        return null;
    }

    $out = trim($data["content"][0]["text"]);
    return $out === "" ? null : $out;
}

// --- pick the configured provider ---------------------------------------
function call_provider($provider, $text, $from, $to, $api_key, $model, $email)
{
    if ($provider === "mymemory") {
        return mymemory_translate($text, $from, $to, $email);
    }
    return claude_translate($text, $from, $to, $api_key, $model);
}

// --- cache --------------------------------------------------------------
function cache_get($mysql, $from, $to, $text)
{
    $sql = "SELECT translated_text FROM cache WHERE from_lang = ? AND to_lang = ? AND source_text = ?";
    $query = $mysql->prepare($sql);
    $query->bind_param("sss", $from, $to, $text);
    $query->execute();
    $array = $query->get_result();
    $hit = null;
    while ($row = $array->fetch_assoc()) {
        $hit = $row["translated_text"];
    }
    return $hit;
}

function cache_put($mysql, $from, $to, $text, $translated)
{
    // INSERT IGNORE so a repeat/racey write never throws
    $sql = "INSERT IGNORE INTO cache (from_lang, to_lang, source_text, translated_text, created_on)
            VALUES (?, ?, ?, ?, NOW())";
    $query = $mysql->prepare($sql);
    $query->bind_param("ssss", $from, $to, $text, $translated);
    $query->execute();
}

// --- quota accounting ---------------------------------------------------
// count one real API call and the characters sent, per provider per day
function record_usage($mysql, $provider, $chars)
{
    $sql = "INSERT INTO api_usage (day, provider, calls, chars, updated_on)
            VALUES (CURDATE(), ?, 1, ?, NOW())
            ON DUPLICATE KEY UPDATE calls = calls + 1, chars = chars + ?, updated_on = NOW()";
    $query = $mysql->prepare($sql);
    $query->bind_param("sii", $provider, $chars, $chars);
    $query->execute();
}

// --- translate one hop: cache, then provider, with one retry -------------
// returns the translated string, or null if the hop failed (after one retry).
function translate($mysql, $text, $from, $to, $provider, $api_key, $model, $email)
{
    // 1) cache first — a repeated hop costs no API call
    $cached = cache_get($mysql, $from, $to, $text);
    if ($cached !== null) {
        return $cached;
    }

    // 2) call the configured provider; retry once on failure
    $out = call_provider($provider, $text, $from, $to, $api_key, $model, $email);
    if ($out === null) {
        $out = call_provider($provider, $text, $from, $to, $api_key, $model, $email);
    }
    if ($out === null) {
        return null; // hop failed even after the retry
    }

    // 3) count the real call (cache hits above never reach here), store, return
    record_usage($mysql, $provider, mb_strlen($text));
    cache_put($mysql, $from, $to, $text, $out);
    return $out;
}

?>
