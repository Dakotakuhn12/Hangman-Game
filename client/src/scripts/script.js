document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const difficulty_dropdown = document.getElementById("diffictuly_drop");
  const wordDisplay = document.getElementById("word-display");
  const keyboard = document.getElementById("keyboard");
  const remainingGuessesEl = document.getElementById("remaining-guesses");
  const gameMessageEl = document.getElementById("game-message");
  const resetBtn = document.getElementById("reset-btn");
  const categoryContainer = document.getElementById("category");

  // Score + Timer Elements
  const currentScoreEl = document.getElementById("current-score");
  const highScoreEl = document.getElementById("high-score");
  const timerEl = document.getElementById("timer");

  // Hangman SVG Parts
  const hangmanParts = {
    head: document.getElementById("head"),
    body: document.getElementById("body"),
    leftArm: document.getElementById("left-arm"),
    rightArm: document.getElementById("right-arm"),
    leftLeg: document.getElementById("left-leg"),
    rightLeg: document.getElementById("right-leg"),
    face: document.getElementById("face"),
  };

  // Game Variables
  let selectedWord = "";
  let correctLetters = [];
  let wrongLetters = [];
  let remainingGuesses;
  let gameOver = false;
  let difficulty;

  // Score Variables
  let currentScore = 0;
  let highScore = Number(localStorage.getItem("hangmanHighScore")) || 0;
  let startTime;
  let timerInterval;

  highScoreEl.textContent = highScore;
  currentScoreEl.textContent = currentScore;

  async function chooseWordfromDB() {
    try {
      const response = await fetch("/api/words");
      if (!response.ok) throw new Error("failed to fetch words");
      const data = await response.json();
      const randomIndex = Math.floor(Math.random() * data.length);
      return data[randomIndex];
    } catch (err) {
      console.error("Error choosing word:", err);
      return null;
    }
  }

  async function initGame() {
    correctLetters = [];
    wrongLetters = [];
    gameOver = false;
    gameMessageEl.textContent = "";

    const d = get_difficulty(difficulty_dropdown);
    remainingGuesses = d.remainingGuesses;
    difficulty = d.difficulty;

    const data = await chooseWordfromDB();
    if (!data) return;

    selectedWord = data.word;
    console.log("Selected word:", selectedWord); // For debugging
    categoryContainer.textContent = "Category: " + data.category;
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;

    // Hide hangman parts
    Object.values(hangmanParts).forEach(
      (part) => (part.style.display = "none"),
    );

    // Build word display
    wordDisplay.innerHTML = "";
    const phrase = selectedWord.split(" ");

    phrase.forEach((word, index) => {
      const wordContainer = document.createElement("div");
      wordContainer.classList.add("word-group");

      for (let char of word) {
        const letterEl = document.createElement("div");
        letterEl.classList.add("word-letter");
        letterEl.dataset.letter = char.toUpperCase();

        if (/[A-Z]/i.test(char)) {
          letterEl.textContent = "_";
        } else {
          letterEl.textContent = char;
          correctLetters.push(char.toUpperCase());
        }

        wordContainer.appendChild(letterEl);
      }

      wordDisplay.appendChild(wordContainer);

      if (index < phrase.length - 1) {
        const spaceEl = document.createElement("div");
        spaceEl.classList.add("word-space");
        wordDisplay.appendChild(spaceEl);
      }
    });

    // Build keyboard
    keyboard.innerHTML = "";
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const keyEl = document.createElement("button");
      keyEl.classList.add("keyboard-letter");
      keyEl.textContent = letter;
      keyEl.dataset.letter = letter;
      keyEl.addEventListener("click", () => handleGuess(letter));
      keyboard.appendChild(keyEl);
    }

    // Start timer
    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      timerEl.textContent = seconds;
    }, 1000);

    difficulty_dropdown.hidden = true;
  }

  function handleGuess(letter) {
    if (
      gameOver ||
      correctLetters.includes(letter) ||
      wrongLetters.includes(letter)
    )
      return;

    if (selectedWord.toUpperCase().includes(letter)) {
      correctLetters.push(letter);
      updateWordDisplay();

      const key = document.querySelector(
        `.keyboard-letter[data-letter="${letter}"]`,
      );
      if (key) key.classList.add("correct", "used");

      if (checkWin()) {
        gameOver = true;
        clearInterval(timerInterval);

        const timeTaken = (Date.now() - startTime) / 1000;
        const timeBonus = Math.max(0, 150 - timeTaken * 8);
        const difficultyBonus = remainingGuesses * 20;
        const wordBonus = selectedWord.replace(/ /g, "").length * 10;

        const roundPoints = Math.floor(timeBonus + difficultyBonus + wordBonus);

        currentScore += roundPoints;
        currentScoreEl.textContent = currentScore;

        if (currentScore > highScore) {
          highScore = currentScore;
          localStorage.setItem("hangmanHighScore", highScore);
          highScoreEl.textContent = highScore;
        }

        gameMessageEl.textContent = `You Won! +${roundPoints} points!`;
        gameMessageEl.style.color = "green";

        difficulty_dropdown.hidden = false;
      }
    } else {
      wrongLetters.push(letter);
      remainingGuesses--;
      remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;

      const key = document.querySelector(
        `.keyboard-letter[data-letter="${letter}"]`,
      );
      if (key) key.classList.add("wrong", "used");

      updateHangmanDrawing(difficulty);

      if (remainingGuesses === 0) {
        gameOver = true;
        clearInterval(timerInterval);

        gameMessageEl.textContent = `Game Over! The word was: ${selectedWord}`;
        gameMessageEl.style.color = "red";

        hangmanParts.face.style.display = "block";

        document.querySelectorAll(".word-letter").forEach((el) => {
          el.textContent = el.dataset.letter;
        });

        // Reset score on full loss
        currentScore = 0;
        currentScoreEl.textContent = currentScore;

        difficulty_dropdown.hidden = false;
      }
    }
  }

  function updateWordDisplay() {
    document.querySelectorAll(".word-letter").forEach((el) => {
      const letter = el.dataset.letter;
      if (correctLetters.includes(letter)) {
        el.textContent = letter;
      }
    });
  }

  function checkWin() {
    return selectedWord
      .toUpperCase()
      .split("")
      .every((letter) => letter === " " || correctLetters.includes(letter));
  }

  function updateHangmanDrawing(difficulty) {
    if (difficulty === "Easy") {
      switch (wrongLetters.length) {
        case 1:
          hangmanParts.head.style.display = "block";
          break;
        case 2:
          hangmanParts.body.style.display = "block";
          break;
        case 3:
          hangmanParts.leftArm.style.display = "block";
          break;
        case 4:
          hangmanParts.rightArm.style.display = "block";
          break;
        case 5:
          hangmanParts.leftLeg.style.display = "block";
          break;
        case 6:
          hangmanParts.rightLeg.style.display = "block";
          break;
      }
    }

    if (difficulty === "Medium") {
      switch (wrongLetters.length) {
        case 1:
          hangmanParts.head.style.display = "block";
          break;
        case 2:
          hangmanParts.body.style.display = "block";
          break;
        case 3:
          hangmanParts.leftArm.style.display = "block";
          hangmanParts.rightArm.style.display = "block";
          break;
        case 4:
          hangmanParts.leftLeg.style.display = "block";
          break;
        case 5:
          hangmanParts.rightLeg.style.display = "block";
          break;
      }
    }

    if (difficulty === "Hard") {
      switch (wrongLetters.length) {
        case 1:
          hangmanParts.head.style.display = "block";
          break;
        case 2:
          hangmanParts.body.style.display = "block";
          break;
        case 3:
          hangmanParts.leftArm.style.display = "block";
          hangmanParts.rightArm.style.display = "block";
          break;
        case 4:
          hangmanParts.leftLeg.style.display = "block";
          hangmanParts.rightLeg.style.display = "block";
          break;
      }
    }

    if (difficulty === "Advanced") {
      switch (wrongLetters.length) {
        case 1:
          hangmanParts.head.style.display = "block";
          break;
        case 2:
          hangmanParts.body.style.display = "block";
          hangmanParts.leftArm.style.display = "block";
          hangmanParts.rightArm.style.display = "block";
          break;
        case 3:
          hangmanParts.leftLeg.style.display = "block";
          hangmanParts.rightLeg.style.display = "block";
          break;
      }
    }
  }

  document.addEventListener("keydown", (e) => {
    if (/^[a-z]$/i.test(e.key)) {
      handleGuess(e.key.toUpperCase());
    }
  });

  resetBtn.addEventListener("click", initGame);

  difficulty_dropdown.addEventListener("change", () => {
    const d = get_difficulty(difficulty_dropdown);
    remainingGuesses = d.remainingGuesses;
    difficulty = d.difficulty;
    timerEl.textContent = 0;
    currentScoreEl.textContent = 0;

    highScoreEl.textContent =
      localStorage.getItem("hangmanHighScore_" + d.difficulty) || 0; //note if this data is saved/loaded from local storage, this should be updated. //note if this data is saved/loaded from local storage, this should be updated.
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
  });
});

function get_difficulty(difficulty_dropdown) {
  const diff = difficulty_dropdown.value;

  if (diff === "easy") return { difficulty: "Easy", remainingGuesses: 6 };
  if (diff === "Medium") return { difficulty: "Medium", remainingGuesses: 5 };
  if (diff === "Hard") return { difficulty: "Hard", remainingGuesses: 4 };
  if (diff === "Advanced")
    return { difficulty: "Advanced", remainingGuesses: 3 };

  return { difficulty: "Easy", remainingGuesses: 6 };
}
