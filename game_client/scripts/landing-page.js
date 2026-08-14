/* Landing controller: advertises the correct action for a saved five-round session. */
(function () {
    const startGame = document.querySelector("#start-game");
    const sessionMessage = document.querySelector("#session-message");
    const howItWorksLinks = [...document.querySelectorAll('a[href="#how-it-works"]')];
    const howItWorks = document.querySelector("#how-it-works");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Enables CSS initial states before the browser performs its first full paint. */
    document.body.classList.add("landing-motion-ready");

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

    /* Starts the one-time hero boot sequence and scroll-triggered card stagger. */
    function startLandingMotion() {
        const stepCards = [...document.querySelectorAll(".steps article")];

        /* Keep the 120ms stagger editable from one value in this loop. */
        stepCards.forEach((card, index) => {
            card.style.setProperty("--card-delay", `${index * 120}ms`);
        });

        /* Start the hero after its initial CSS state has been registered. */
        window.requestAnimationFrame(() => document.body.classList.add("landing-motion-play"));

        /* Reveal immediately when motion is reduced or observers are unavailable. */
        if (reducedMotion || !("IntersectionObserver" in window)) {
            stepCards.forEach((card) => card.classList.add("is-visible"));
            return;
        }

        /* Watch the group once, then reveal all three cards in their assigned order. */
        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) {
                return;
            }

            stepCards.forEach((card) => card.classList.add("is-visible"));
            observer.disconnect();
        }, { threshold: 0.18, rootMargin: "0px 0px -8%" });

        observer.observe(document.querySelector(".steps"));
    }

    /* Initializes the landing-page enhancements after the session helper is available. */
    renderSessionCta();
    wireHowItWorksNavigation();
    startLandingMotion();
}());
