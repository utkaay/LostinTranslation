<?php

// GET ?sort=mangle|votes -> the Hall of Fame list.

include(__DIR__ . "/database/connection.php");

$response = [];

try {
    // whitelist the sort so nothing user-supplied touches the SQL
    $sort = isset($_GET["sort"]) ? $_GET["sort"] : "mangle";
    if ($sort === "votes") {
        $order = "votes DESC, mangle_score DESC";
    } else {
        $order = "mangle_score DESC, votes DESC";
    }

    $sql = "SELECT id, seed_text, final_text, mangle_score, votes
            FROM hall_of_fame ORDER BY $order LIMIT 50";
    $query = $mysql->prepare($sql);
    $query->execute();
    $array = $query->get_result();
    $entries = [];
    while ($row = $array->fetch_assoc()) {
        $entries[] = [
            "entry_id" => (int) $row["id"],
            "seed" => $row["seed_text"],
            "mangled" => $row["final_text"],
            "mangle_score" => (int) $row["mangle_score"],
            "votes" => (int) $row["votes"],
        ];
    }

    $response["success"] = true;
    $response["data"] = $entries;
} catch (mysqli_sql_exception $e) {
    $response["success"] = false;
    $response["message"] = "database error";
}

echo json_encode($response);

?>
