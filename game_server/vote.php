<?php

// POST -> upvote a Hall of Fame entry. One vote per player is enforced here on
// the server (and backed by a UNIQUE key on the votes table).
// Inputs: entry_id, player_id.

include(__DIR__ . "/database/connection.php");

$response = [];

try {
    if (isset($_POST["entry_id"], $_POST["player_id"])) {
        $entry_id = $_POST["entry_id"];
        $player_id = $_POST["player_id"];

        // has this player already voted for this entry?
        $sql = "SELECT id FROM votes WHERE entry_id = ? AND player_id = ?";
        $query = $mysql->prepare($sql);
        $query->bind_param("is", $entry_id, $player_id);
        $query->execute();
        $array = $query->get_result();
        $already = false;
        while ($row = $array->fetch_assoc()) {
            $already = true;
        }

        if ($already) {
            $response["success"] = false;
            $response["message"] = "already voted";
        } else {
            // does the entry exist?
            $sql = "SELECT id FROM hall_of_fame WHERE id = ?";
            $query = $mysql->prepare($sql);
            $query->bind_param("i", $entry_id);
            $query->execute();
            $array = $query->get_result();
            $exists = false;
            while ($row = $array->fetch_assoc()) {
                $exists = true;
            }

            if (!$exists) {
                $response["success"] = false;
                $response["message"] = "entry not found";
            } else {
                $sql = "INSERT INTO votes (entry_id, player_id, created_on) VALUES (?, ?, NOW())";
                $query = $mysql->prepare($sql);
                $query->bind_param("is", $entry_id, $player_id);
                $query->execute();

                $sql = "UPDATE hall_of_fame SET votes = votes + 1 WHERE id = ?";
                $query = $mysql->prepare($sql);
                $query->bind_param("i", $entry_id);
                $query->execute();

                $sql = "SELECT votes FROM hall_of_fame WHERE id = ?";
                $query = $mysql->prepare($sql);
                $query->bind_param("i", $entry_id);
                $query->execute();
                $array = $query->get_result();
                $votes = 0;
                while ($row = $array->fetch_assoc()) {
                    $votes = (int) $row["votes"];
                }

                $response["success"] = true;
                $response["data"] = ["votes" => $votes];
            }
        }
    } else {
        $response["success"] = false;
        $response["message"] = "missing entry_id or player_id";
    }
} catch (mysqli_sql_exception $e) {
    $response["success"] = false;
    $response["message"] = "database error";
}

echo json_encode($response);

?>
