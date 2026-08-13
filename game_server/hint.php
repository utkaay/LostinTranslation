<?php

// POST -> reveal one intermediate step of the chain. The hint is recorded on the
// server (one row per round+player+step), so its 30-point cost is counted by
// guess.php and cannot be faked by the client.
// Inputs: round_id, player_id, step_index (0-based).

include(__DIR__ . "/database/connection.php");

$response = [];

try {
    if (isset($_POST["round_id"], $_POST["player_id"], $_POST["step_index"])) {
        $round_id = $_POST["round_id"];
        $player_id = $_POST["player_id"];
        $step_index = $_POST["step_index"];

        $sql = "SELECT step_index, from_lang, to_lang, text_out
                FROM steps WHERE round_id = ? AND step_index = ?";
        $query = $mysql->prepare($sql);
        $query->bind_param("ii", $round_id, $step_index);
        $query->execute();
        $array = $query->get_result();
        $step = null;
        while ($row = $array->fetch_assoc()) {
            $step = $row;
        }

        if ($step === null) {
            $response["success"] = false;
            $response["message"] = "step not found";
        } else {
            // record the hint (INSERT IGNORE so re-asking the same step is not double-charged)
            $sql = "INSERT IGNORE INTO hints (round_id, player_id, step_index, created_on)
                    VALUES (?, ?, ?, NOW())";
            $query = $mysql->prepare($sql);
            $query->bind_param("isi", $round_id, $player_id, $step_index);
            $query->execute();

            // how many distinct hints this player has used on this round
            $sql = "SELECT COUNT(*) AS n FROM hints WHERE round_id = ? AND player_id = ?";
            $query = $mysql->prepare($sql);
            $query->bind_param("is", $round_id, $player_id);
            $query->execute();
            $array = $query->get_result();
            $hints_used = 0;
            while ($row = $array->fetch_assoc()) {
                $hints_used = (int) $row["n"];
            }

            $response["success"] = true;
            $response["data"] = [
                "step_index" => (int) $step["step_index"],
                "from" => $step["from_lang"],
                "to" => $step["to_lang"],
                "text" => $step["text_out"],
                "cost" => 30,
                "hints_used" => $hints_used,
            ];
        }
    } else {
        $response["success"] = false;
        $response["message"] = "missing round_id, player_id or step_index";
    }
} catch (mysqli_sql_exception $e) {
    $response["success"] = false;
    $response["message"] = "database error";
}

echo json_encode($response);

?>
