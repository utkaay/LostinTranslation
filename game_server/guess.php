<?php

// POST -> score a guess against the round's seed. Rejects guesses on a closed
// round. Points (only for a correct guess) use the server's elapsed time and the
// hint count recorded on the server. A correct guess closes the round so the
// player can see the reveal right away.
// Inputs: round_id, player_id, guess.

include(__DIR__ . "/database/connection.php");
include(__DIR__ . "/scoring.php");

$response = [];

try {
    if (isset($_POST["round_id"], $_POST["player_id"], $_POST["guess"])) {
        $round_id = $_POST["round_id"];
        $player_id = $_POST["player_id"];
        $guess = $_POST["guess"];

        // load the round, with server-side elapsed seconds
        $sql = "SELECT seed_text, closed, TIMESTAMPDIFF(SECOND, started_on, NOW()) AS elapsed
                FROM rounds WHERE id = ?";
        $query = $mysql->prepare($sql);
        $query->bind_param("i", $round_id);
        $query->execute();
        $array = $query->get_result();
        $round = null;
        while ($row = $array->fetch_assoc()) {
            $round = $row;
        }

        if ($round === null) {
            $response["success"] = false;
            $response["message"] = "round not found";
        } elseif ($round["closed"] == 1) {
            $response["success"] = false;
            $response["message"] = "round is closed";
        } else {
            // count this player's hints on this round (server-side, not trusted from the client)
            $sql = "SELECT COUNT(*) AS n FROM hints WHERE round_id = ? AND player_id = ?";
            $query = $mysql->prepare($sql);
            $query->bind_param("is", $round_id, $player_id);
            $query->execute();
            $array = $query->get_result();
            $hints_used = 0;
            while ($row = $array->fetch_assoc()) {
                $hints_used = (int) $row["n"];
            }

            $sim = similarity($round["seed_text"], $guess);
            $band = verdict($sim);
            $elapsed = (int) $round["elapsed"];
            $points = $band === "correct" ? guess_points($elapsed, $hints_used) : 0;
            $sim_store = round($sim, 3);

            // store the guess
            $sql = "INSERT INTO guesses (round_id, player_id, guess_text, similarity, points, hints_used, created_on)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())";
            $query = $mysql->prepare($sql);
            $query->bind_param("issdii", $round_id, $player_id, $guess, $sim_store, $points, $hints_used);
            $query->execute();

            // a correct guess ends the round (single-player) so the reveal unlocks now
            $solved = $band === "correct";
            if ($solved) {
                $sql = "UPDATE rounds SET closed = 1 WHERE id = ?";
                $query = $mysql->prepare($sql);
                $query->bind_param("i", $round_id);
                $query->execute();
            }

            $response["success"] = true;
            $response["data"] = [
                "verdict" => $band,
                "similarity" => $sim_store,
                "points" => $points,
                "solved" => $solved,
            ];
        }
    } else {
        $response["success"] = false;
        $response["message"] = "missing round_id, player_id or guess";
    }
} catch (mysqli_sql_exception $e) {
    $response["success"] = false;
    $response["message"] = "database error";
}

echo json_encode($response);

?>
