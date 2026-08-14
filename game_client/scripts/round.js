/* Round module: owns new rounds, server-state checks, round completion, and progression. */
(function () {
    let ui;
    let session;
    let pending = false;
    let finishing = false;
    let pollId = null;

    /* Returns the current browser session to submit and hint modules. */
    function getSession() {
        return session;
    }

    /* Accepts session changes made by score and hint modules. */
    function setSession(nextSession) {
        session = nextSession;
        ui.renderSession(session);
    }

    /* Starts one exclusive network interaction and locks decoder controls. */
    function beginRequest() {
        if (pending || !session?.activeRoundId || session.activeRoundComplete) return false;
        pending = true;
        ui.setControls(false, false);
        return true;
    }

    /* Ends a request and restores controls only while the round remains playable. */
    function endRequest() {
        pending = false;
        if (!session.activeRoundComplete) ui.setControls(true, GameHint.next(session) !== null);
    }

    /* Stops polling before a closed round switches into reveal state. */
    function stopPolling() {
        window.clearInterval(pollId);
        ui.stopTimer();
    }

    /* Resolves after ms so a fast backend still shows the loading transmission glitch. */
    function hold(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    /* Checks server-owned time and closes the round when PHP reports it is finished. */
    async function checkState() {
        if (pending || !session?.activeRoundId || session.activeRoundComplete) return;
        try {
            const state = await GameApi.getRoundState(session.activeRoundId);
            ui.setPhrase(state.mangled);
            ui.startTimer(state.seconds_remaining);
            if (state.status === "closed") await finish("The timer expired. The original signal is now revealed.");
        } catch (error) {
            ui.setFeedback(error.message, "error");
        }
    }

    /* Requests a fresh PHP round and initializes the session and decoder UI. */
    async function create() {
        pending = true;
        ui.setControls(false, false);
        /* Shows the glitching "Loading transmission…" state on every new round, not just first load. */
        ui.setPhrase("Loading transmission…");
        ui.setDescription("Preparing a new translation chain.");
        ui.setFeedback("Generating a corrupted transmission...");
        try {
            /* Holds the loading glitch for a visible minimum even when the backend responds instantly. */
            const [round] = await Promise.all([
                GameApi.createRound(session.playedRoundIds || []),
                hold(ui.reducedMotion ? 0 : 700),
            ]);
            session = GameUser.setActiveRound(round.round_id);
            ui.resetRound();
            ui.renderSession(session);
            ui.setPhrase(round.mangled);
            ui.setDescription("Decode the original English phrase before time expires.");
            ui.startTimer(round.round_seconds);
            pollId = window.setInterval(checkState, 2500);
            ui.setFeedback("Transmission acquired. Decode it before the signal fades.", "success");
            ui.setControls(true, true);
            ui.guessInput.focus();
        } catch (error) {
            ui.setFeedback(error.message, "error");
            ui.setDescription("The round could not be loaded. Start a new session and try again.");
            ui.showAction("Try again", () => { session = GameUser.startNewSession(); start(); });
        } finally {
            pending = false;
        }
    }

    /* Completes once, applies points through score.js, and delegates cards to reveal.js. */
    async function finish(message, points = 0) {
        if (finishing) return;
        finishing = true;
        stopPolling();
        ui.setControls(false, false);
        session = GameScore.apply(ui.scoreElement, points);
        ui.renderSession(session);
        ui.setFeedback(message, points > 0 ? "success" : "info");
        ui.setDescription("Round closed. Reconstructing the full translation journey...");
        try {
            const reveal = await GameReveal.show(session.activeRoundId, ui.routeNodes, ui.replayCards, ui.reducedMotion);
            ui.setDescription(`Original phrase: ${reveal.seed}`);
            ui.showAction(session.currentRound === session.totalRounds ? "Finish session" : "Next round", advance);
        } catch (error) {
            ui.setFeedback(error.message, "error");
            ui.showAction("Retry replay", () => finish("Retrying the full translation journey..."));
        } finally {
            finishing = false;
        }
    }

    /* Advances only after replay, ending on the final round or starting the next server puzzle. */
    function advance() {
        session = GameUser.advanceRound();
        if (session.completed) {
            ui.setPhrase("Session complete");
            ui.setDescription(`Final recovered score: ${session.score} points.`);
            ui.setFeedback("All five signals have been decoded. Start a new session when you are ready.", "success");
            ui.showAction("Start new session", () => { session = GameUser.startNewSession(); start(); });
        } else {
            start();
        }
    }

    /* Creates a missing round or restores an active server round after refresh. */
    async function start() {
        stopPolling();
        session = GameUser.getSession() || GameUser.startNewSession();
        ui.resetRound();
        ui.renderSession(session);
        GameHint.restore(session, ui.routeNodes, ui.replayCards);
        if (session.completed) return advance();
        if (!session.activeRoundId) return create();
        pending = true;
        ui.setControls(false, false);
        ui.setFeedback("Restoring your active transmission...");
        try {
            const state = await GameApi.getRoundState(session.activeRoundId);
            ui.setPhrase(state.mangled);
            if (session.activeRoundComplete || state.status === "closed") await finish("This round is complete. The full journey is available below.");
            else {
                ui.startTimer(state.seconds_remaining);
                pollId = window.setInterval(checkState, 2500);
                ui.setControls(true, GameHint.next(session) !== null);
                ui.setFeedback("Transmission restored.", "success");
            }
        } catch (error) {
            ui.setFeedback(error.message, "error");
        } finally {
            pending = false;
        }
    }

    /* Exposes the round lifecycle required by submit.js, hint.js, and game-page.js. */
    window.GameRound = { start, finish, getSession, setSession, beginRequest, endRequest };

    /* Receives the game-page UI contract before any round behavior can begin. */
    window.GameRound.initialize = (pageUi) => { ui = pageUi; };
}());
