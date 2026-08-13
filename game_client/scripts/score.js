/* Score module: owns score persistence updates and score HUD output. */
(function () {
    /* Renders the server-confirmed cumulative score in the game HUD. */
    function render(scoreElement, session) {
        scoreElement.textContent = session.score;
    }

    /* Applies awarded points through user state, then refreshes the visible total. */
    function apply(scoreElement, points) {
        const session = GameUser.completeRound(points);
        render(scoreElement, session);
        return session;
    }

    /* Exposes score behavior without mixing it into round or page UI code. */
    window.GameScore = { render, apply };
}());
