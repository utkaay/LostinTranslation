/* Shared API client: resolves the PHP backend from this script's stable location. */
(function () {
    const scriptUrl = document.currentScript ? document.currentScript.src : window.location.href;
    const apiBase = new URL("../../game_server/", scriptUrl);

    /* Converts successful PHP JSON responses into data and gives every failure a useful Error. */
    async function request(endpoint, options = {}) {
        let response;

        try {
            response = await fetch(new URL(endpoint, apiBase), {
                credentials: "same-origin",
                ...options,
            });
        } catch {
            throw new Error("Unable to reach the game server. Check your connection and try again.");
        }

        let payload;

        try {
            payload = await response.json();
        } catch {
            throw new Error("The game server returned an invalid response.");
        }

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || "The game server could not complete that request.");
        }

        return payload.data;
    }
    
    /* Sends URL-encoded POST fields because the existing PHP endpoints read $_POST. */
    function post(endpoint, fields) {
        const body = new URLSearchParams();

        Object.entries(fields).forEach(([key, value]) => body.set(key, String(value)));

        return request(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body,
        });
    }

    /* Exposes the only backend operations needed by the page controllers. */
    window.GameApi = {
        createRound: (exclude = []) => post("new.php", { exclude: exclude.join(",") }),
        getRoundState: (roundId) => request(`state.php?id=${encodeURIComponent(roundId)}`),
        submitGuess: (roundId, playerId, guess) => post("guess.php", { round_id: roundId, player_id: playerId, guess }),
        useHint: (roundId, playerId, stepIndex) => post("hint.php", { round_id: roundId, player_id: playerId, step_index: stepIndex }),
        getReveal: (roundId) => request(`reveal.php?id=${encodeURIComponent(roundId)}`),
        getHall: (sort) => request(`hall.php?sort=${encodeURIComponent(sort)}`),
        vote: (entryId, playerId) => post("vote.php", { entry_id: entryId, player_id: playerId }),
    };
}());
