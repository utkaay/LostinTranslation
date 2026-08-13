<?php

// Lost in Translation — the language chain runner.
//
// Three modes, all returning the same shape:
//   "stub"     -> fake local mangling, no network
//   "mymemory" -> real translation via translate() (translate.php)
//   "claude"   -> real translation via translate() (translate.php)
//
// The chain comes from $chain in config.php — edit it there to change languages.

require_once __DIR__ . "/translate.php";

// deterministic, accumulating corruption to imitate meaning drift on one hop
function stub_mangle($text, $i)
{
    $maps = [
        ["the ", "a "],
        ["e", "i"],
        ["ou", "u"],
        ["a", "o"],
        ["ing", "in"],
        ["s ", " "],
        ["o", "u"],
    ];
    $m = $maps[$i % count($maps)];
    $out = str_replace($m[0], $m[1], $text);
    if ($out === $text) {
        $out = $text . " ..";   // guarantee at least a small change every hop
    }
    return $out;
}

// run the whole chain over a seed.
// returns ["final" => string, "steps" => [...]] on success,
// or false if any hop failed (so the round is aborted, never half-finished).
function run_chain($mysql, $seed, $chain, $provider, $api_key, $model, $email)
{
    // stage 0 is the seed; each hop produces the next stage
    $stages = [$seed];
    $text = $seed;
    $hops = count($chain) - 1;

    for ($i = 0; $i < $hops; $i++) {
        $from = $chain[$i];
        $to = $chain[$i + 1];

        if ($provider === "stub") {
            $next = stub_mangle($text, $i);
        } else {
            // real providers (mymemory / claude) go through translate() (cache + retry)
            $next = translate($mysql, $text, $from, $to, $provider, $api_key, $model, $email);
        }

        // a failed or empty hop aborts the whole round and is logged
        if ($next === null || $next === "") {
            $line = date("Y-m-d H:i:s") . " chain aborted at hop $i ($from->$to) for seed: $seed\n";
            file_put_contents(__DIR__ . "/round-errors.log", $line, FILE_APPEND);
            return false;
        }

        $stages[] = $next;
        $text = $next;
    }

    // one row per hop, storing the text entering and leaving that hop
    $steps = [];
    for ($i = 0; $i < $hops; $i++) {
        $in = $stages[$i];
        $out = $stages[$i + 1];
        $steps[] = [
            "step_index" => $i,
            "from" => $chain[$i],
            "to" => $chain[$i + 1],
            "text_in" => $in,
            "text_out" => $out,
            "char_delta" => mb_strlen($out) - mb_strlen($in),
        ];
    }

    return [
        "final" => $stages[$hops],
        "steps" => $steps,
    ];
}

?>
