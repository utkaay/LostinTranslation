const timer = document.querySelector("#timer");
const guessForm = document.querySelector(".decode-console");
const guessInput = document.querySelector("#guess-input");
const feedbackMessage = document.querySelector("#feedback-message");
const hintButton = document.querySelector(".hint-button");
const routeNodes = document.querySelectorAll(".route-node");
const replayCards = document.querySelectorAll(".replay-cards"); 

let secondsRemaining = 60;

function updateTimer() {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;

    timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    if(secondsRemaining > 0) {
        secondsRemaining--;
    }
}

updateTimer();
setInterval(updateTimer, 1000);