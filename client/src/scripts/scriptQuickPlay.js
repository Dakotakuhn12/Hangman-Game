// bot-hangman.js
document.addEventListener("DOMContentLoaded", async () => {
  // ===== DOM Elements =====
  const difficultyDropdown = document.getElementById("diffictuly_drop");
  const difficultyDisplay = document.getElementById("difficulty-display");
  const wordDisplay = document.getElementById("word-display");
  const keyboard = document.getElementById("keyboard");
  const remainingGuessesEl = document.getElementById("remaining-guesses");
  const gameMessageEl = document.getElementById("game-message");
  const resetBtn = document.getElementById("reset-btn");
  const categoryContainer = document.getElementById("category");
  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleText = document.getElementById("theme-toggle-text");
  const themeToggleIcon = themeToggle?.querySelector("i");

  // ===== Hangman SVG Parts =====
  const hangmanParts = {
    head: document.getElementById("head"),
    body: document.getElementById("body"),
    leftArm: document.getElementById("left-arm"),
    rightArm: document.getElementById("right-arm"),
    leftLeg: document.getElementById("left-leg"),
    rightLeg: document.getElementById("right-leg"),
    face: document.getElementById("face"),
  };

  // ===== Game State Variables =====
  let selectedWord = "";
  let correctLetters = [];
  let wrongLetters = [];
  let remainingGuesses;
  let gameOver = false;
  let difficulty;
  let botInterval;

  function applyTheme(theme) {
    const root = document.documentElement;
    const resolvedTheme = theme === "dark" ? "dark" : "light";

    root.setAttribute("data-theme", resolvedTheme);

    if (themeToggleText) {
      themeToggleText.textContent =
        resolvedTheme === "dark" ? "Light Mode" : "Dark Mode";
    }

    if (themeToggleIcon) {
      themeToggleIcon.className =
        resolvedTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }
  }

  function initializeTheme() {
    const savedTheme = localStorage.getItem("hangmanTheme");
    const preferredTheme =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    applyTheme(savedTheme || preferredTheme);
  }

  themeToggle?.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";

    localStorage.setItem("hangmanTheme", nextTheme);
    applyTheme(nextTheme);
  });

  initializeTheme();

  // ===== Fetch a random word from DB =====
  async function chooseWordFromDB() {
    try {
      const response = await fetch("/api/words");
      if (!response.ok) throw new Error("Failed to fetch words");
      const data = await response.json();
      const randomIndex = Math.floor(Math.random() * data.length);
      return data[randomIndex];
    } catch (err) {
      console.error("Error choosing word:", err);
      return null;
    }
  }

  // ===== Initialize Game =====
  async function initGame() {
    correctLetters = [];
    wrongLetters = [];
    gameOver = false;
    gameMessageEl.textContent = "";
    clearInterval(botInterval);

    const d = getDifficulty(difficultyDropdown);
    remainingGuesses = d.remainingGuesses;
    difficulty = d.difficulty;
    if (difficultyDisplay)
      difficultyDisplay.textContent = `Difficulty: ${difficulty}`;

    // Get word from DB
    const data = await chooseWordFromDB();
    selectedWord = data.word;
    if (categoryContainer)
      categoryContainer.textContent = "Category: " + data.category;

    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;

    // Hide hangman
    Object.values(hangmanParts).forEach(
      (part) => (part.style.display = "none")
    );

    // Show blanks for word
    displayWordBlanks(selectedWord);

    // Create keyboard
    createKeyboard();

    // Start bot guesses automatically
    startBotGuesses(difficulty);

    difficultyDropdown.hidden = true;
  }

  // ===== Display blanks for word =====
  function displayWordBlanks(word) {
    wordDisplay.innerHTML = "";
    const phrase = word.split(" ");
    phrase.forEach((w, i) => {
      const wordContainer = document.createElement("div");
      wordContainer.classList.add("word-group");

      for (let char of w) {
        const letterEl = document.createElement("div");
        letterEl.classList.add("word-letter");
        letterEl.dataset.letter = char.toUpperCase();
        letterEl.textContent = /[A-Z]/i.test(char) ? "_" : char;
        if (!/[A-Z]/i.test(char)) correctLetters.push(char.toUpperCase());
        wordContainer.appendChild(letterEl);
      }

      wordDisplay.appendChild(wordContainer);
      if (i < phrase.length - 1) {
        const spaceEl = document.createElement("div");
        spaceEl.classList.add("word-space");
        wordDisplay.appendChild(spaceEl);
      }
    });
  }

  // ===== Create on-screen keyboard =====
  function createKeyboard() {
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
  }

  // ===== Handle a guess (player or bot) =====
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
      markKey(letter, "correct");

      if (checkWin()) {
        gameOver = true;
        gameMessageEl.textContent = "Congrats! You Won!";
        gameMessageEl.style.color = "green";
        difficultyDropdown.hidden = false;
        clearInterval(botInterval);
      }
    } else {
      wrongLetters.push(letter);
      remainingGuesses--;
      remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
      markKey(letter, "wrong");
      updateHangmanDrawing(difficulty);

      if (remainingGuesses === 0) {
        gameOver = true;
        gameMessageEl.textContent = `Game Over! The word was: ${selectedWord}`;
        gameMessageEl.style.color = "red";
        hangmanParts.face.style.display = "block";
        revealWord();
        difficultyDropdown.hidden = false;
        clearInterval(botInterval);
      }
    }
  }

  // ===== Update word display =====
  function updateWordDisplay() {
    document.querySelectorAll(".word-letter").forEach((el) => {
      if (correctLetters.includes(el.dataset.letter))
        el.textContent = el.dataset.letter;
    });
  }

  // ===== Mark keyboard letter =====
  function markKey(letter, type) {
    const key = document.querySelector(
      `.keyboard-letter[data-letter="${letter}"]`
    );
    if (key) key.classList.add(type, "used");
  }

  // ===== Check if player won =====
  function checkWin() {
    return selectedWord
      .toUpperCase()
      .split("")
      .every((letter) => letter === " " || correctLetters.includes(letter));
  }

  // ===== Reveal the full word =====
  function revealWord() {
    document.querySelectorAll(".word-letter").forEach((el) => {
      el.textContent = el.dataset.letter;
    });
  }

  // ===== Hangman drawing update =====
  function updateHangmanDrawing(diff) {
    const parts = [
      "head",
      "body",
      "leftArm",
      "rightArm",
      "leftLeg",
      "rightLeg",
    ];
    const displayCount = {
      Easy: 6,
      Medium: 5,
      Hard: 4,
      Advanced: 3,
    }[diff];

    parts.slice(0, wrongLetters.length).forEach((part) => {
      if (hangmanParts[part]) hangmanParts[part].style.display = "block";
    });
  }

  // ===== Bot Guess Logic =====
  function startBotGuesses(diff) {
    let availableLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      .split("")
      .filter((l) => !correctLetters.includes(l) && !wrongLetters.includes(l));
    let speed = { Easy: 2000, Medium: 1500, Hard: 1000, Advanced: 600 }[diff];

    botInterval = setInterval(() => {
      if (gameOver) return clearInterval(botInterval);
      availableLetters = availableLetters.filter(
        (l) => !correctLetters.includes(l) && !wrongLetters.includes(l)
      );
      if (availableLetters.length === 0) return;

      // Bot guesses a letter
      let guessLetter;
      switch (diff) {
        case "Easy":
          guessLetter =
            availableLetters[
              Math.floor(Math.random() * availableLetters.length)
            ];
          break;
        case "Medium":
          guessLetter =
            availableLetters[
              Math.random() < 0.7
                ? mostCommonLetter(availableLetters)
                : randomLetter(availableLetters)
            ];
          break;
        case "Hard":
          guessLetter = mostCommonLetter(availableLetters);
          break;
        case "Advanced":
          guessLetter = mostCommonLetter(availableLetters);
          break;
      }
      handleGuess(guessLetter);
    }, speed);
  }

  // ===== Utility: Random letter =====
  function randomLetter(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ===== Utility: Most common English letter =====
  function mostCommonLetter(arr) {
    const frequency = "ETAOINSHRDLCUMWFGYPBVKJXQZ".split("");
    for (let letter of frequency) {
      if (arr.includes(letter)) return letter;
    }
    return arr[0];
  }

  // ===== Difficulty mapping =====
  function getDifficulty(dropdown) {
    const diff = dropdown.value;
    if (diff === "easy") return { difficulty: "Easy", remainingGuesses: 6 };
    if (diff === "medium") return { difficulty: "Medium", remainingGuesses: 5 };
    if (diff === "hard") return { difficulty: "Hard", remainingGuesses: 4 };
    if (diff === "advanced")
      return { difficulty: "Advanced", remainingGuesses: 3 };
  }

  // ===== Keyboard typing support =====
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") return;
    if (/^[a-z]$/i.test(e.key)) handleGuess(e.key.toUpperCase());
  });

  // ===== Reset button =====
  resetBtn.addEventListener("click", initGame);

  // ===== Difficulty change =====
  difficultyDropdown.addEventListener("change", () => {
    const d = getDifficulty(difficultyDropdown);
    remainingGuesses = d.remainingGuesses;
    difficulty = d.difficulty;
    if (difficultyDisplay)
      difficultyDisplay.textContent = `Difficulty: ${difficulty}`;
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
  });

  // ===== Start game automatically =====
  initGame();
});
