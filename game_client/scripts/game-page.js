/* Game page UI: owns only timer, feedback, decoder controls, and page-level rendering. */
(function () {
    const timer = document.querySelector("#timer");
    const roundProgress = document.querySelector("#round-progress");
    const scoreElement = document.querySelector("#score");
    const phrase = document.querySelector("#mangled-phrase");
    const description = document.querySelector("#panel-description");
    const guessForm = document.querySelector(".decode-console");
    const guessInput = document.querySelector("#guess-input");
    const feedbackMessage = document.querySelector("#feedback-message");
    const hintButton = document.querySelector(".hint-button");
    const submitButton = document.querySelector(".submit-button");
    const routeNodes = [...document.querySelectorAll(".route-node")];
    const replayCards = [...document.querySelectorAll(".replay-card")];
    const actionArea = document.querySelector("#round-action");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timerId = null;

    /* Keeps the live phrase and its CSS glitch copies in sync, replaying acquisition on change. */
    function setPhrase(text) {
        const changed = phrase.dataset.text !== text;
        if (!changed && phrase.querySelector(".glitch-character")) return;

        const characters = document.createDocumentFragment();
        [...text].forEach((character, index) => {
            const letter = document.createElement("span");
            letter.className = "glitch-character";
            letter.setAttribute("aria-hidden", "true");
            letter.textContent = character === " " ? "\u00a0" : character;
            letter.style.setProperty("--letter-delay", `${-((index * 0.37) % 3.1)}s`);
            letter.style.setProperty("--letter-speed", `${2.2 + ((index % 5) * 0.31)}s`);
            characters.append(letter);
        });

        phrase.replaceChildren(characters);
        phrase.dataset.text = text;
        phrase.setAttribute("aria-label", text);
        if (!changed || reducedMotion) return;
        phrase.classList.remove("signal-acquired");
        window.requestAnimationFrame(() => phrase.classList.add("signal-acquired"));
    }

    /* Formats seconds in the compact HUD clock format. */
    function formatTime(totalSeconds) {
        const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
        const seconds = Math.max(0, totalSeconds) % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    /* Displays a visual countdown while round.js periodically refreshes it from PHP. */
    function startTimer(secondsRemaining) {
        window.clearInterval(timerId);
        let seconds = secondsRemaining;
        timer.textContent = formatTime(seconds);
        timerId = window.setInterval(() => {
            seconds = Math.max(0, seconds - 1);
            timer.textContent = formatTime(seconds);
            if (seconds === 0) window.clearInterval(timerId);
        }, 1000);
    }

    /* Stops the currently displayed timer when a round ends or changes. */
    function stopTimer() {
        window.clearInterval(timerId);
    }

    /* Renders session-owned score and progress using the focused score module. */
    function renderSession(session) {
        roundProgress.textContent = `${session.currentRound} / ${session.totalRounds}`;
        GameScore.render(scoreElement, session);
    }

    /* Updates the accessible feedback output beneath the decoder. */
    function setFeedback(message, status = "info") {
        feedbackMessage.textContent = message;
        feedbackMessage.dataset.status = status;
    }

    /* Enables or disables decoder controls according to round.js and hint.js state. */
    function setControls(enabled, hintAvailable) {
        guessInput.disabled = !enabled;
        hintButton.disabled = !enabled || !hintAvailable;
        submitButton.disabled = !enabled;
    }

    /* Resets the static route and replay cards before round-specific modules fill them. */
    function resetRound() {
        routeNodes.forEach((node, index) => {
            node.classList.toggle("active", index === 0);
            node.classList.toggle("revealed", index === 0);
        });
        replayCards.forEach((card, index) => {
            card.classList.remove("revealed", "active");
            card.classList.toggle("active", index === 0);
            card.querySelector("p").textContent = index === 0 ? "Awaiting trace" : "Locked";
        });
        actionArea.replaceChildren();
    }

    /* Creates the explicit next, retry, or restart action supplied by round.js. */
    function showAction(label, onClick) {
        actionArea.replaceChildren();
        const button = document.createElement("button");
        button.type = "button";
        button.className = "round-action-button";
        button.textContent = label;
        button.addEventListener("click", onClick);
        actionArea.append(button);
    }

    /* Publishes the small UI contract consumed by the game behavior modules. */
    setPhrase(phrase.textContent);
    const ui = { timer, scoreElement, phrase, description, guessForm, guessInput, hintButton, submitButton, routeNodes, replayCards, reducedMotion, startTimer, stopTimer, renderSession, setFeedback, setControls, resetRound, showAction, setPhrase, setDescription: (text) => { description.textContent = text; } };

    /* Starts modules only after the page-level timer and decoder UI contract exists. */
    GameRound.initialize(ui);
    GameSubmit.attach(ui, GameRound);
    GameHint.attach(ui, GameRound);
    GameRound.start();
}());
