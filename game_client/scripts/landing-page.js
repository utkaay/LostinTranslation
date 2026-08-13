/* Landing controller: advertises the correct action for a saved five-round session. */
(function () {
    const startGame = document.querySelector("#start-game");
    const sessionMessage = document.querySelector("#session-message");
    const howItWorksLinks = [...document.querySelectorAll('a[href="#how-it-works"]')];
    const howItWorks = document.querySelector("#how-it-works");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Updates the primary CTA without starting or clearing a session until the player clicks it. */
    function renderSessionCta() {
        const session = GameUser.getSession();

        if (session && !session.completed && (session.activeRoundId || session.currentRound > 1)) {
            startGame.textContent = "Resume session";
            sessionMessage.textContent = `Round ${session.currentRound} of ${session.totalRounds} is ready to continue.`;
        } else if (session && session.completed) {
            startGame.textContent = "Start new session";
            sessionMessage.textContent = `Your last five-round score was ${session.score}.`;
            startGame.addEventListener("click", () => GameUser.startNewSession());
        }
    }

    /* Adds focused, motion-aware navigation to the instructional section for keyboard users. */
    function wireHowItWorksNavigation() {
        howItWorksLinks.forEach((link) => link.addEventListener("click", (event) => {
            event.preventDefault();
            howItWorks.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
            howItWorks.setAttribute("tabindex", "-1");
            howItWorks.focus({ preventScroll: true });
            howItWorks.addEventListener("blur", () => howItWorks.removeAttribute("tabindex"), { once: true });
        }));
    }

    /* Initializes the landing-page enhancements after the session helper is available. */
    renderSessionCta();
    wireHowItWorksNavigation();
}());
