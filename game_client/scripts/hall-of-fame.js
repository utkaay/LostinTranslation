/* Hall controller: renders only backend data and lets the server enforce one vote per player. */
(function () {
    const sortButtons = [...document.querySelectorAll(".sort-button")];
    const results = document.querySelector("#hall-results");
    const voteNote = document.querySelector(".vote-note");
    const playerId = GameUser.getPlayerId();
    let activeSort = "mangle";
    let loading = false;

    /* Produces an accessible loading, empty, or error state instead of stale placeholder rows. */
    function renderState(message, className = "hall-state") {
        const state = document.createElement("p");
        state.className = className;
        state.textContent = message;
        results.replaceChildren(state);
    }

    /* Maps the top three ranks to the existing gold, silver, and bronze styling. */
    function rankClass(rank) {
        return ["gold", "silver", "bronze"][rank - 1] || "";
    }

    /* Builds a safe DOM row so server-provided phrase text is never interpreted as HTML. */
    function createHallRow(entry, rank, votedEntries) {
        const row = document.createElement("article");
        const rankElement = document.createElement("strong");
        const mangled = document.createElement("p");
        const original = document.createElement("p");
        const score = document.createElement("strong");
        const scoreSuffix = document.createElement("span");
        const votes = document.createElement("span");
        const button = document.createElement("button");
        const hasVoted = votedEntries.includes(entry.entry_id);

        row.className = "hall-row";
        rankElement.className = `rank ${rankClass(rank)}`.trim();
        rankElement.textContent = rank;
        mangled.className = "mangled";
        mangled.textContent = entry.mangled;
        original.className = "original";
        original.textContent = entry.seed;
        score.className = "mangle-score";
        score.textContent = entry.mangle_score;
        scoreSuffix.textContent = "/100";
        score.append(scoreSuffix);
        votes.className = "votes";
        votes.textContent = Number(entry.votes).toLocaleString();
        button.className = "upvote-button";
        button.type = "button";
        button.textContent = hasVoted ? "Voted" : "Upvote";
        button.disabled = hasVoted;
        button.addEventListener("click", () => castVote(entry.entry_id, button, votes));
        row.append(rankElement, mangled, original, score, votes, button);
        return row;
    }

    /* Renders the backend list while preserving this browser's already-voted button states. */
    function renderEntries(entries) {
        if (!entries.length) {
            renderState("No archived signals yet. Finish a highly mangled round to populate the Hall.");
            return;
        }

        const votedEntries = GameUser.getVotedEntries();
        const fragment = document.createDocumentFragment();

        entries.forEach((entry, index) => fragment.append(createHallRow(entry, index + 1, votedEntries)));
        results.replaceChildren(fragment);
    }

    /* Updates a vote count only after a confirmed server response and remembers duplicate votes. */
    async function castVote(entryId, button, votes) {
        if (button.disabled) {
            return;
        }

        button.disabled = true;
        button.textContent = "Voting…";

        try {
            const result = await GameApi.vote(entryId, playerId);
            GameUser.rememberVote(entryId);
            votes.textContent = Number(result.votes).toLocaleString();
            button.textContent = "Voted";
            voteNote.textContent = "Vote recorded. One vote per player is enforced by the server.";
        } catch (error) {
            if (error.message === "already voted") {
                GameUser.rememberVote(entryId);
                button.textContent = "Voted";
                voteNote.textContent = "You have already voted for this archived signal.";
            } else {
                button.disabled = false;
                button.textContent = "Upvote";
                voteNote.textContent = error.message;
            }
        }
    }

    /* Fetches a server-supported sort and avoids competing requests from rapid clicks. */
    async function loadHall(sort) {
        if (loading) {
            return;
        }

        loading = true;
        activeSort = sort;
        sortButtons.forEach((button) => {
            const selected = button.dataset.sort === sort;
            button.classList.toggle("active", selected);
            button.disabled = selected;
        });
        renderState("Loading archived signals…");

        try {
            renderEntries(await GameApi.getHall(sort));
            voteNote.textContent = "One vote per player is enforced by the server.";
        } catch (error) {
            renderState(error.message, "hall-state hall-state-error");
            voteNote.textContent = "Try changing the sort or refreshing once the server is available.";
        } finally {
            loading = false;
            sortButtons.forEach((button) => {
                button.disabled = button.dataset.sort === activeSort;
            });
        }
    }

    /* Wires the existing buttons to their precise API sort values. */
    sortButtons.forEach((button) => button.addEventListener("click", () => loadHall(button.dataset.sort)));

    /* Loads the default most-mangled leaderboard on entry. */
    loadHall(activeSort);
}());
