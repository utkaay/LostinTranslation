<?php

// GET -> today's API usage per provider (quota accounting). Only real API calls
// are counted; cache hits don't spend quota so they don't show up here.

include(__DIR__ . "/database/connection.php");

$response = [];

try {
    $sql = "SELECT provider, calls, chars FROM api_usage WHERE day = CURDATE() ORDER BY provider";
    $query = $mysql->prepare($sql);
    $query->execute();
    $array = $query->get_result();
    $rows = [];
    while ($row = $array->fetch_assoc()) {
        $rows[] = [
            "provider" => $row["provider"],
            "calls" => (int) $row["calls"],
            "chars" => (int) $row["chars"],
        ];
    }

    $response["success"] = true;
    $response["data"] = $rows;
} catch (mysqli_sql_exception $e) {
    $response["success"] = false;
    $response["message"] = "database error";
}

echo json_encode($response);

?>
