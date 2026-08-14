/* Hall controller: renders only backend data and lets the server enforce one vote per player. */
(function () {
    const sortButtons = [...document.querySelectorAll(".sort-button")];
    const results = document.querySelector("#hall-results");
    const voteNote = document.querySelector(".vote-note");
    const playerId = GameUser.getPlayerId();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let activeSort = "mangle";
    let loading = false;

    /* Enables the CSS terminal intro before the first full page paint. */
    document.body.classList.add("hall-motion-ready");

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
        const targetScore = Math.max(0, Math.round(Number(entry.mangle_score) || 0));

        row.className = "hall-row";
        row.dataset.scoreTarget = targetScore;
        if (!reducedMotion) {
            row.classList.add("row-enter");
            row.style.setProperty("--row-delay", `${Math.min(rank - 1, 10) * 85}ms`);
        }
        rankElement.className = `rank ${rankClass(rank)}`.trim();
        rankElement.textContent = rank;
        mangled.className = "mangled";
        mangled.textContent = entry.mangled;
        original.className = "original";
        original.textContent = entry.seed;
        score.className = "mangle-score";
        score.textContent = reducedMotion ? targetScore : "0";
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

    /* Counts a score quickly from zero once its row begins entering the terminal. */
    function animateScore(score, target, delay) {
        if (reducedMotion) {
            score.firstChild.nodeValue = target;
            return;
        }

        window.setTimeout(() => {
            if (!score.isConnected) {
                return;
            }

            const duration = 520;
            const startedAt = performance.now();
            score.classList.add("is-counting");

            function updateScore(now) {
                const progress = Math.min((now - startedAt) / duration, 1);
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                score.firstChild.nodeValue = Math.round(target * easedProgress);

                if (progress < 1) {
                    window.requestAnimationFrame(updateScore);
                } else {
                    score.firstChild.nodeValue = target;
                    score.classList.remove("is-counting");
                }
            }

            window.requestAnimationFrame(updateScore);
        }, delay);
    }

    /* Renders the backend list while preserving this browser's already-voted button states. */
    function renderEntries(entries) {
        if (!entries.length) {
            renderState("No archived signals yet. Finish a highly mangled round to populate the Hall.");
            return;
        }

        const votedEntries = GameUser.getVotedEntries();
        const fragment = document.createDocumentFragment();

        const rows = entries.map((entry, index) => createHallRow(entry, index + 1, votedEntries));
        rows.forEach((row) => fragment.append(row));
        results.replaceChildren(fragment);

        /* Force the starting positions to register before transitioning rows onscreen. */
        if (!reducedMotion) {
            void results.offsetWidth;
            rows.forEach((row, index) => {
                row.classList.add("row-enter-active");
                animateScore(
                    row.querySelector(".mangle-score"),
                    Number(row.dataset.scoreTarget),
                    Math.min(index, 10) * 85 + 90
                );
            });
        }
    }

    /* Fades the current order away before the newly sorted rows are rendered. */
    function animateRowsOut() {
        const rows = [...results.querySelectorAll(".hall-row")];

        if (reducedMotion || !rows.length) {
            return Promise.resolve();
        }

        rows.forEach((row, index) => {
            row.style.setProperty("--exit-delay", `${Math.min(index, 8) * 35}ms`);
            row.classList.add("row-exit");
        });

        const finalDelay = Math.min(rows.length - 1, 8) * 35;
        return new Promise((resolve) => window.setTimeout(resolve, 230 + finalDelay));
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
            button.disabled = true;
        });

        const hasVisibleRows = Boolean(results.querySelector(".hall-row"));
        if (!hasVisibleRows) {
            renderState("Loading archived signals…");
        }

        try {
            const entries = await GameApi.getHall(sort);
            if (hasVisibleRows) {
                await animateRowsOut();
            }
            renderEntries(entries);
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

    /* Starts the title glow independently from network loading time. */
    window.requestAnimationFrame(() => document.body.classList.add("hall-motion-play"));

    /* Loads the default most-mangled leaderboard on entry. */
    loadHall(activeSort);
}());
