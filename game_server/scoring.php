<?php

// Lost in Translation — scoring helpers (similarity, verdict, points, mangle).
// Included by the game endpoints: include(__DIR__ . "/scoring.php");

// lowercase, strip punctuation, collapse whitespace
function normalize($text)
{
    $text = mb_strtolower($text);
    $text = preg_replace("/[^\p{L}\p{N}\s]/u", "", $text); // drop punctuation, keep letters/numbers/spaces
    $text = preg_replace("/\s+/u", " ", $text);            // collapse runs of whitespace
    return trim($text);
}

// similarity on a 0..1 scale using Levenshtein distance over normalized strings
function similarity($a, $b)
{
    $a = normalize($a);
    $b = normalize($b);

    if ($a === "" && $b === "") {
        return 1.0;
    }

    $longest = max(strlen($a), strlen($b));
    if ($longest === 0) {
        return 0.0;
    }

    $distance = levenshtein($a, $b);
    return (float) (1 - ($distance / $longest));
}

// verdict band from a similarity: correct / close / wrong
function verdict($sim)
{
    if ($sim >= 0.85) {
        return "correct";
    } elseif ($sim >= 0.60) {
        return "close";
    } else {
        return "wrong";
    }
}

// points for a correct guess: 100, minus 1 per second elapsed, minus 30 per hint (never below 0)
function guess_points($seconds_elapsed, $hints_used)
{
    $points = 100 - $seconds_elapsed - (30 * $hints_used);
    if ($points < 0) {
        $points = 0;
    }
    return $points;
}

// mangle score 0..100: how destroyed the final English is versus the seed (higher = worse)
function mangle_score($seed, $final)
{
    $sim = similarity($seed, $final);
    return (int) round((1 - $sim) * 100);
}

?>
