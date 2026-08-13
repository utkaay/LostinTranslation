<?php

// GET ?id= -> the full step-by-step chain, only once the round has closed.
// Feeds the reveal animation (each hop's text + how far it moved).

include(__DIR__ . "/database/connection.php");

$response = [];

try {
    if (isset($_GET["id"])) {
        $id = $_GET["id"];

        $sql = "SELECT seed_text, final_text, mangle_score, closed, (NOW() >= closes_on) AS times_up
                FROM rounds WHERE id = ?";
        $query = $mysql->prepare($sql);
        $query->bind_param("i", $id);
        $query->execute();
        $array = $query->get_result();
        $round = null;
        while ($row = $array->fetch_assoc()) {
            $round = $row;
        }

        if ($round === null) {
            $response["success"] = false;
            $response["message"] = "round not found";
        } elseif ($round["closed"] == 0 && $round["times_up"] == 0) {
            // never let the reveal reach a player before the round ends
            // (a correct guess sets closed=1, which unlocks the reveal early)
            $response["success"] = false;
            $response["message"] = "round still open";
        } else {
            // make sure it's marked closed
            if ($round["closed"] == 0) {
                $sql = "UPDATE rounds SET closed = 1 WHERE id = ?";
                $query = $mysql->prepare($sql);
                $query->bind_param("i", $id);
                $query->execute();
            }

            $sql = "SELECT step_index, from_lang, to_lang, text_in, text_out, char_delta
                    FROM steps WHERE round_id = ? ORDER BY step_index";
            $query = $mysql->prepare($sql);
            $query->bind_param("i", $id);
            $query->execute();
            $array = $query->get_result();
            $steps = [];
            while ($row = $array->fetch_assoc()) {
                $steps[] = [
                    "step_index" => (int) $row["step_index"],
                    "from" => $row["from_lang"],
                    "to" => $row["to_lang"],
                    "text_in" => $row["text_in"],
                    "text_out" => $row["text_out"],
                    "char_delta" => (int) $row["char_delta"],
                ];
            }

            $response["success"] = true;
            $response["data"] = [
                "seed" => $round["seed_text"],
                "final" => $round["final_text"],
                "mangle_score" => (int) $round["mangle_score"],
                "steps" => $steps,
            ];
        }
    } else {
        $response["success"] = false;
        $response["message"] = "missing id";
    }
} catch (mysqli_sql_exception $e) {
    $response["success"] = false;
    $response["message"] = "database error";
}

echo json_encode($response);

?>
