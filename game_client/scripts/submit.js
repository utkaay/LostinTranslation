/* Submit module: owns decoder form submission and PHP guess verdict handling. */
(function () {
    /* Connects the decoder form to the active round without mixing it into page UI code. */
    function attach(ui, round) {
        ui.guessForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const guess = ui.guessInput.value.trim();
            if (!guess || !round.beginRequest()) return;
            ui.setFeedback("Comparing your decode...");
            try {
                const result = await GameApi.submitGuess(round.getSession().activeRoundId, GameUser.getPlayerId(), guess);
                if (result.solved) {
                    ui.guessInput.value = "";
                    await round.finish(`Signal recovered! +${result.points} points.`, result.points);
                } else if (result.verdict === "close") {
                    ui.setFeedback("Very close - adjust your decode and try again.");
                    ui.guessInput.focus();
                } else {
                    ui.setFeedback("That decode does not match the original signal. Try again.", "error");
                    ui.guessInput.focus();
                }
            } catch (error) {
                if (error.message === "round is closed") await round.finish("The round is already closed. The full journey is now revealed.");
                else ui.setFeedback(error.message, "error");
            } finally {
                round.endRequest();
            }
        });
    }

    /* Exposes the submit behavior to the game-page bootstrap. */
    window.GameSubmit = { attach };
}());
