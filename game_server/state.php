<?php

// GET ?id= -> live round state. The SERVER owns the clock: seconds_remaining is
// computed from closes_on, and the round is closed here once time runs out.
// The page polls this every couple of seconds.

include(__DIR__ . "/database/connection.php");

$response = [];

try {
    if (isset($_GET["id"])) {
        $id = $_GET["id"];

        $sql = "SELECT id, final_text, closed,
                       GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), closes_on)) AS seconds_remaining,
                       (NOW() >= closes_on) AS times_up
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
        } else {
            // server owns the clock: close the round when time is up
            if ($round["times_up"] == 1 && $round["closed"] == 0) {
                $sql = "UPDATE rounds SET closed = 1 WHERE id = ?";
                $query = $mysql->prepare($sql);
                $query->bind_param("i", $id);
                $query->execute();
                $round["closed"] = 1;
            }

            $response["success"] = true;
            $response["data"] = [
                "status" => $round["closed"] == 1 ? "closed" : "open",
                "seconds_remaining" => (int) $round["seconds_remaining"],
                "mangled" => $round["final_text"],
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
