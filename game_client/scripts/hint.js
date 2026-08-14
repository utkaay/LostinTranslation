/* Hint module: owns sequential hint requests and partial route/replay updates. */
(function () {
    /* Returns the next untraced hop, or null after all seven hints are used. */
    function next(session) {
        return Array.from({ length: 7 }, (_, index) => index).find((index) => !(session.hintIndexes || []).includes(index)) ?? null;
    }

    /* Restores saved hint visuals without making another server request. */
    function restore(session, routeNodes, replayCards) {
        (session.hintDetails || []).forEach((hint) => render(hint, routeNodes, replayCards));
    }

    /* Renders one backend-confirmed trace without exposing the original phrase. */
    function render(hint, routeNodes, replayCards) {
        const node = routeNodes[hint.step_index + 1];
        const card = replayCards[hint.step_index];
        if (node) node.classList.add("revealed");
        if (card) {
            card.classList.remove("active");
            card.classList.add("revealed");
            card.querySelector("h3").textContent = `${hint.from.toUpperCase()} -> ${hint.to.toUpperCase()}`;
            card.querySelector("p").textContent = hint.text;
        }
    }

    /* Connects the hint button to the round controller's request lifecycle. */
    function attach(ui, round) {
        ui.hintButton.addEventListener("click", async () => {
            let session = round.getSession();
            if (next(session) === null || !round.beginRequest()) return;
            /* The first hint reveals the first two hops (through Arabic); later hints reveal one. */
            const count = (session.hintIndexes || []).length === 0 ? 2 : 1;
            ui.setFeedback("Tracing the next translation hop...");
            try {
                for (let i = 0; i < count; i += 1) {
                    const stepIndex = next(session);
                    if (stepIndex === null) break;
                    const hint = await GameApi.useHint(session.activeRoundId, GameUser.getPlayerId(), stepIndex);
                    session = GameUser.addHint(hint);
                    round.setSession(session);
                    render(hint, ui.routeNodes, ui.replayCards);
                }
                ui.setFeedback(count === 2
                    ? "Two hops traced — the Arabic reveal is free. Each further hint costs 30 points if you solve the round."
                    : "Trace unlocked. This hint costs 30 points if you solve the round.");
            } catch (error) {
                ui.setFeedback(error.message, "error");
            } finally {
                round.endRequest();
            }
        });
    }

    /* Exposes hint availability and behavior to page and round code. */
    window.GameHint = { next, restore, attach };
}());
