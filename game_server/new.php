<?php

// POST -> generate a new round. Runs the chain, stores every hop, opens the
// timer, and archives very mangled rounds. Returns the round id + mangled phrase.

include(__DIR__ . "/database/connection.php");
include(__DIR__ . "/chain.php");
include(__DIR__ . "/scoring.php");

$response = [];

try {
    // optional: exclude the seeds already played this sprint. the client sends the
    // round ids it has already played (it can't send seed texts — those are hidden).
    $exclude_ids = [];
    if (isset($_POST["exclude"]) && $_POST["exclude"] !== "") {
        foreach (explode(",", $_POST["exclude"]) as $part) {
            $part = trim($part);
            if (ctype_digit($part)) {
                $exclude_ids[] = (int) $part;   // ints only -> safe to inline below
            }
        }
    }

    // Re-roll guard: some idioms survive the chain almost intact (mangle ~0), which
    // makes for a dull round. Try a few seeds and keep the most mangled one, stopping
    // early as soon as one clears $min_mangle. Capped at $max_reroll_attempts so the
    // extra chain runs (each is real API work) stay bounded.
    $sprint_filter = "";
    if (count($exclude_ids) > 0) {
        $list = implode(",", $exclude_ids);
        $sprint_filter = "text NOT IN (SELECT seed_text FROM rounds WHERE id IN ($list))";
    }

    $tried = [];        // seed texts already attempted this call — never re-pick within one request
    $seed = null;       // best (most mangled) seed so far
    $result = null;     // its chain result
    $mangle = -1;       // its mangle score
    $chain_failed = false;

    for ($attempt = 0; $attempt < $max_reroll_attempts; $attempt++) {
        // build the WHERE from the sprint filter plus this call's already-tried seeds
        $clauses = [];
        if ($sprint_filter !== "") {
            $clauses[] = $sprint_filter;
        }
        if (count($tried) > 0) {
            $marks = implode(",", array_fill(0, count($tried), "?"));
            $clauses[] = "text NOT IN ($marks)";
        }
        $where = count($clauses) > 0 ? "WHERE " . implode(" AND ", $clauses) : "";

        $query = $mysql->prepare("SELECT text FROM seeds $where ORDER BY RAND() LIMIT 1");
        if (count($tried) > 0) {
            $query->bind_param(str_repeat("s", count($tried)), ...$tried);
        }
        $query->execute();
        $array = $query->get_result();
        $candidate = null;
        while ($row = $array->fetch_assoc()) {
            $candidate = $row["text"];
        }
        if ($candidate === null) {
            break;      // ran out of eligible seeds — use the best we already have (if any)
        }
        $tried[] = $candidate;

        // run the chain (provider chosen in config: mymemory / claude / stub)
        $attempt_result = run_chain($mysql, $candidate, $chain, $provider, $claude_api_key, $claude_model, $mymemory_email);
        if ($attempt_result === false) {
            $chain_failed = true;   // a hop failed after a retry; try another seed
            continue;
        }

        $attempt_mangle = mangle_score($candidate, $attempt_result["final"]);
        if ($attempt_mangle > $mangle) {
            $seed = $candidate;
            $result = $attempt_result;
            $mangle = $attempt_mangle;
        }
        if ($attempt_mangle >= $min_mangle) {
            break;      // mangled enough — good to show
        }
    }

    if ($seed === null) {
        // never produced a usable chain this call
        $response["success"] = false;
        $response["message"] = $chain_failed
            ? "round generation failed, please try again"
            : "no seeds available";
    } else {
        $final = $result["final"];
        $steps = $result["steps"];

        // create the round with a server-owned deadline
        $sql = "INSERT INTO rounds (seed_text, final_text, mangle_score, closed, started_on, closes_on, created_on)
                VALUES (?, ?, ?, 0, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND), NOW())";
        $query = $mysql->prepare($sql);
        $query->bind_param("ssii", $seed, $final, $mangle, $round_seconds);
        $query->execute();
        $round_id = $mysql->insert_id;

        // store every hop
        $sql = "INSERT INTO steps (round_id, step_index, from_lang, to_lang, text_in, text_out, char_delta)
                VALUES (?, ?, ?, ?, ?, ?, ?)";
        $query = $mysql->prepare($sql);
        foreach ($steps as $step) {
            $index = $step["step_index"];
            $from = $step["from"];
            $to = $step["to"];
            $text_in = $step["text_in"];
            $text_out = $step["text_out"];
            $delta = $step["char_delta"];
            $query->bind_param("iissssi", $round_id, $index, $from, $to, $text_in, $text_out, $delta);
            $query->execute();
        }

        // archive very mangled rounds into the Hall of Fame
        if ($mangle >= $hof_threshold) {
            $sql = "INSERT INTO hall_of_fame (round_id, seed_text, final_text, mangle_score, votes, created_on)
                    VALUES (?, ?, ?, ?, 0, NOW())";
            $query = $mysql->prepare($sql);
            $query->bind_param("issi", $round_id, $seed, $final, $mangle);
            $query->execute();
        }

        $response["success"] = true;
        $response["data"] = [
            "round_id" => $round_id,
            "mangled" => $final,
            "round_seconds" => $round_seconds,
        ];
    }
} catch (mysqli_sql_exception $e) {
    $response["success"] = false;
    $response["message"] = "database error";
}

echo json_encode($response);

?>
