/* Player/session store: owns the browser player ID and persisted five-round progress. */
(function () {
    const PLAYER_KEY = "lost-in-translation:player:v1";
    const SESSION_KEY = "lost-in-translation:session:v1";
    const VOTES_KEY = "lost-in-translation:votes:v1";

    /* Returns one durable player ID for guesses, hints, and Hall votes. */
    function getPlayerId() {
        let id = localStorage.getItem(PLAYER_KEY);
        if (!id) {
            id = window.crypto?.randomUUID?.() || `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            localStorage.setItem(PLAYER_KEY, id);
        }
        return id;
    }

    /* Reads a valid saved game session without trusting malformed browser data. */
    function getSession() {
        try {
            const session = JSON.parse(localStorage.getItem(SESSION_KEY));
            return session && session.totalRounds === 5 ? session : null;
        } catch {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
    }

    /* Saves the small session snapshot used to recover a game after refresh. */
    function save(session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }

    /* Starts a clean session while deliberately preserving the browser player ID. */
    function startNewSession() {
        return save({ totalRounds: 5, currentRound: 1, score: 0, activeRoundId: null, activeRoundComplete: false, playedRoundIds: [], hintIndexes: [], hintDetails: [], completed: false });
    }

    /* Records a newly created PHP round and excludes it from later new-round requests. */
    function setActiveRound(roundId) {
        const session = getSession() || startNewSession();
        session.activeRoundId = Number(roundId);
        session.activeRoundComplete = false;
        session.hintIndexes = [];
        session.hintDetails = [];
        if (!session.playedRoundIds.includes(Number(roundId))) session.playedRoundIds.push(Number(roundId));
        return save(session);
    }

    /* Records one confirmed hint so it can be displayed after refresh without another request. */
    function addHint(hint) {
        const session = getSession();
        if (!session || session.hintIndexes.includes(hint.step_index)) return session;
        session.hintIndexes.push(hint.step_index);
        session.hintDetails.push(hint);
        return save(session);
    }

    /* Applies server-confirmed points once and marks the active round ready to advance. */
    function completeRound(points = 0) {
        const session = getSession();
        if (!session || session.activeRoundComplete) return session;
        session.score += Number(points) || 0;
        session.activeRoundComplete = true;
        return save(session);
    }

    /* Advances only after a completed round, ending the session after round five. */
    function advanceRound() {
        const session = getSession();
        if (!session || !session.activeRoundComplete) return session;
        if (session.currentRound === session.totalRounds) {
            session.completed = true;
            session.activeRoundId = null;
        } else {
            session.currentRound += 1;
            session.activeRoundId = null;
            session.activeRoundComplete = false;
            session.hintIndexes = [];
            session.hintDetails = [];
        }
        return save(session);
    }

    /* Reads entry IDs already voted for in this browser to keep Hall buttons accurate. */
    function getVotedEntries() {
        try {
            return JSON.parse(localStorage.getItem(VOTES_KEY)) || [];
        } catch {
            return [];
        }
    }

    /* Remembers a successful or duplicate-confirmed Hall vote in browser storage. */
    function rememberVote(entryId) {
        const entries = getVotedEntries();
        const id = Number(entryId);
        if (!entries.includes(id)) localStorage.setItem(VOTES_KEY, JSON.stringify([...entries, id]));
    }

    /* Publishes one focused user/session interface for every frontend page. */
    window.GameUser = { getPlayerId, getSession, startNewSession, setActiveRound, addHint, completeRound, advanceRound, getVotedEntries, rememberVote };
}());
