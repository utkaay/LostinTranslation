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

    // pick a random seed idiom (skipping this sprint's seeds if any were excluded)
    if (count($exclude_ids) > 0) {
        $list = implode(",", $exclude_ids);
        $sql = "SELECT text FROM seeds
                WHERE text NOT IN (SELECT seed_text FROM rounds WHERE id IN ($list))
                ORDER BY RAND() LIMIT 1";
    } else {
        $sql = "SELECT text FROM seeds ORDER BY RAND() LIMIT 1";
    }
    $query = $mysql->prepare($sql);
    $query->execute();
    $array = $query->get_result();
    $seed = null;
    while ($row = $array->fetch_assoc()) {
        $seed = $row["text"];
    }

    if ($seed === null) {
        $response["success"] = false;
        $response["message"] = "no seeds available";
    } else {
        // run the chain (provider chosen in config: mymemory / claude / stub)
        $result = run_chain($mysql, $seed, $chain, $provider, $claude_api_key, $claude_model, $mymemory_email);

        if ($result === false) {
            // a hop failed after a retry — abort cleanly, never show a half chain
            $response["success"] = false;
            $response["message"] = "round generation failed, please try again";
        } else {
            $final = $result["final"];
            $steps = $result["steps"];
            $mangle = mangle_score($seed, $final);

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
    }
} catch (mysqli_sql_exception $e) {
    $response["success"] = false;
    $response["message"] = "database error";
}

echo json_encode($response);

?>
