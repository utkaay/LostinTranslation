/* Reveal module: owns replay requests, replay cards, and final original-phrase output. */
(function () {
    /* Renders the complete translation chain after the backend permits a reveal. */
    async function show(roundId, routeNodes, replayCards, reducedMotion) {
        const reveal = await GameApi.getReveal(roundId);
        for (const [index, step] of (reveal.steps || []).entries()) {
            const node = routeNodes[index + 1];
            const card = replayCards[index];
            if (node) node.classList.add("revealed");
            if (card) {
                card.classList.remove("active");
                card.classList.add("revealed");
                card.querySelector("h3").textContent = `${step.from.toUpperCase()} -> ${step.to.toUpperCase()}`;
                card.querySelector("p").textContent = step.text_out;
            }
            if (!reducedMotion) await new Promise((resolve) => window.setTimeout(resolve, 140));
        }
        const finalCard = replayCards[7];
        if (finalCard) {
            finalCard.classList.remove("active");
            finalCard.classList.add("revealed");
            finalCard.querySelector("h3").textContent = "Original English";
            finalCard.querySelector("p").textContent = reveal.seed;
        }
        return reveal;
    }

    /* Exposes replay behavior to the round controller. */
    window.GameReveal = { show };
}());
