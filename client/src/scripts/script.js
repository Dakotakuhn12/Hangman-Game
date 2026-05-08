// ============================================================
// HANGMAN GAME SCRIPT
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  // ============================================================
  // DOM ELEMENTS
  // ============================================================

  const difficulty_dropdown = document.getElementById("diffictuly_drop");
  const difficulty_dropdown_label = document.querySelector(
    "label[for='diffictuly_drop']",
  );
  const difficultyDisplay = document.getElementById("difficulty-display");
  const playerNameInput = document.getElementById("player-name");
  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleText = document.getElementById("theme-toggle-text");
  const themeToggleIcon = themeToggle?.querySelector("i");

  const wordDisplay = document.getElementById("word-display");
  const keyboard = document.getElementById("keyboard");
  const remainingGuessesEl = document.getElementById("remaining-guesses");
  const gameMessageEl = document.getElementById("game-message");
  const resetBtn = document.getElementById("reset-btn");
  const categoryContainer = document.getElementById("category");

  const currentScoreEl = document.getElementById("current-score");
  const highScoreEl = document.getElementById("high-score");
  const timerEl = document.getElementById("timer");
  const leaderboardSubtitle = document.getElementById("leaderboard-subtitle");
  const leaderboardList = document.getElementById("leaderboard-list");

  // ============================================================
  // HANGMAN BODY PARTS
  // ============================================================

  const hangmanParts = {
    head: document.getElementById("head"),
    body: document.getElementById("body"),
    leftArm: document.getElementById("left-arm"),
    rightArm: document.getElementById("right-arm"),
    leftLeg: document.getElementById("left-leg"),
    rightLeg: document.getElementById("right-leg"),
    face: document.getElementById("face"),
  };

  // ============================================================
  // GAME STATE
  // ============================================================

  let selectedWord = "";
  let correctLetters = [];
  let wrongLetters = [];

  let remainingGuesses;
  let difficulty;

  let gameOver = false;

  let wordList = []; // cached word list

  // ============================================================
  // SCORE + TIMER
  // ============================================================

  const GAME_TIME_LIMIT = 90;

  let currentScore = 0;
  let highScore = 0;

  let timeRemaining = GAME_TIME_LIMIT;
  let timerInterval;

  highScoreEl.textContent = highScore;
  currentScoreEl.textContent = currentScore;

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

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        resolvedTheme === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode",
      );
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
  renderLeaderboard(get_difficulty(difficulty_dropdown).difficulty);

  function getHighScoreKey(selectedDifficulty) {
    return `hangmanHighScore_${selectedDifficulty}`;
  }

  function getPlayerNameKey() {
    return "hangmanPlayerName";
  }

  function getPlayerName() {
    return playerNameInput?.value.trim() || "";
  }

  function normalizePlayerName(playerName) {
    return playerName.trim().toLocaleLowerCase();
  }

  function persistPlayerName() {
    const playerName = getPlayerName();

    if (playerName) {
      localStorage.setItem(getPlayerNameKey(), playerName);
    }
  }

  function initializePlayerName() {
    if (!playerNameInput) return;

    const savedName = localStorage.getItem(getPlayerNameKey()) || "";
    playerNameInput.value = savedName;

    playerNameInput.addEventListener("change", persistPlayerName);
    playerNameInput.addEventListener("blur", persistPlayerName);
  }

  function getLeaderboardKey(selectedDifficulty) {
    return `hangmanLeaderboard_${selectedDifficulty}`;
  }

  function getLeaderboardEntries(selectedDifficulty) {
    try {
      const raw = localStorage.getItem(getLeaderboardKey(selectedDifficulty));
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
        .slice(0, 5);
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      return [];
    }
  }

  function formatLeaderboardDate(timestamp) {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderLeaderboard(selectedDifficulty) {
    if (!leaderboardList || !leaderboardSubtitle) return;

    leaderboardSubtitle.textContent = `Top scores for ${selectedDifficulty}`;
    const entries = getLeaderboardEntries(selectedDifficulty).slice(0, 5);

    leaderboardList.innerHTML = "";

    if (!entries.length) {
      const emptyState = document.createElement("li");
      emptyState.className = "leaderboard-empty";
      emptyState.textContent = "No scores yet.";
      leaderboardList.appendChild(emptyState);
      return;
    }

    entries.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-entry";
      item.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span class="leaderboard-meta">
          <span class="leaderboard-word">${entry.playerName || "Anonymous"} - ${entry.word}</span>
          <span class="leaderboard-date">${formatLeaderboardDate(entry.timestamp)}</span>
        </span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      leaderboardList.appendChild(item);
    });
  }

  function saveLeaderboardEntry(selectedDifficulty, score, word, playerName) {
    if (!selectedDifficulty || score <= 0 || !playerName) return;

    const entries = getLeaderboardEntries(selectedDifficulty);
    const normalizedPlayerName = normalizePlayerName(playerName);
    const existingEntry = entries.find(
      (entry) => normalizePlayerName(entry.playerName || "") === normalizedPlayerName,
    );

    if (existingEntry) {
      if (score <= existingEntry.score) {
        renderLeaderboard(selectedDifficulty);
        return;
      }

      existingEntry.playerName = playerName;
      existingEntry.score = score;
      existingEntry.word = word;
      existingEntry.timestamp = Date.now();
    } else {
      entries.push({
        playerName,
        score,
        word,
        timestamp: Date.now(),
      });
    }

    entries.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
    const topEntries = entries.slice(0, 5);

    localStorage.setItem(
      getLeaderboardKey(selectedDifficulty),
      JSON.stringify(topEntries),
    );

    renderLeaderboard(selectedDifficulty);
  }

  function syncDifficultyDropdown(selectedDifficulty) {
    difficulty_dropdown.value = selectedDifficulty;

    Array.from(difficulty_dropdown.options).forEach((option) => {
      option.selected = option.value === selectedDifficulty;
    });

    // Force native select text to repaint consistently after being shown again.
    difficulty_dropdown.style.color = "var(--select-text)";
    difficulty_dropdown.style.backgroundColor = "var(--select-bg)";
    difficulty_dropdown.style.opacity = "1";
  }

  initializePlayerName();

  function loadHighScore(selectedDifficulty) {
    highScore =
      Number(localStorage.getItem(getHighScoreKey(selectedDifficulty))) || 0;
    highScoreEl.textContent = highScore;
    renderLeaderboard(selectedDifficulty);
  }

  function resetCurrentScore() {
    currentScore = 0;
    currentScoreEl.textContent = currentScore;
  }

  function awardWinPoints() {
    const elapsedSeconds = GAME_TIME_LIMIT - timeRemaining;
    const timeBonus = Math.max(0, 150 - elapsedSeconds * 8);
    const difficultyBonus = remainingGuesses * 20;
    const wordBonus = selectedWord.replace(/ /g, "").length * 10;
    const roundPoints = Math.floor(timeBonus + difficultyBonus + wordBonus);

    currentScore += roundPoints;
    currentScoreEl.textContent = currentScore;

    if (currentScore > highScore) {
      highScore = currentScore;
      localStorage.setItem(getHighScoreKey(difficulty), highScore);
      highScoreEl.textContent = highScore;
    }

    return roundPoints;
  }

  // ============================================================
  // LOAD WORDS FROM SERVER (RUNS ONCE)
  // ============================================================

  async function loadWords() {
    try {
      const response = await fetch("/api/words");

      if (!response.ok) throw new Error("Failed to fetch words");

      wordList = await response.json();

      console.log("Words loaded:", wordList.length);
    } catch (err) {
      console.error("Error loading words:", err);
    }
  }

  // ============================================================
  // PICK RANDOM WORD FROM CACHE
  // ============================================================

  function chooseWordfromDB() {
    if (!wordList.length) return null;

    const randomIndex = Math.floor(Math.random() * wordList.length);

    return wordList[randomIndex];
  }

  // ============================================================
  // START / RESET GAME
  // ============================================================

  async function initGame() {
    const playerName = getPlayerName();

    if (!playerName) {
      gameMessageEl.textContent = "Enter your name before starting a new game.";
      gameMessageEl.style.color = "red";
      playerNameInput?.focus();
      return;
    }

    persistPlayerName();
    correctLetters = [];
    wrongLetters = [];
    gameOver = false;

    gameMessageEl.textContent = "";
    difficulty_dropdown.disabled = true;

    const d = get_difficulty(difficulty_dropdown);

    difficulty = d.difficulty;
    remainingGuesses = d.remainingGuesses;
    syncDifficultyDropdown(difficulty);

    difficultyDisplay.textContent = "Difficulty: " + difficulty;
    loadHighScore(difficulty);

    // If the page was refreshed, make sure the word list is ready before starting.
    if (!wordList.length) {
      gameMessageEl.textContent = "Loading words...";
      await loadWords();
    }

    const data = chooseWordfromDB();

    if (!data) {
      gameMessageEl.textContent = "Unable to load words. Try again.";
      return;
    }

    // Clear any temporary loading message once the round is ready.
    gameMessageEl.textContent = "";

    selectedWord = data.word;

    categoryContainer.textContent = "Category: " + data.category;

    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;

    // Hide hangman parts
    Object.values(hangmanParts).forEach(
      (part) => (part.style.display = "none"),
    );

    // ============================================================
    // BUILD WORD DISPLAY
    // ============================================================

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

    // ============================================================
    // BUILD KEYBOARD
    // ============================================================

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

    // ============================================================
    // START TIMER
    // ============================================================

    startTimer();

    difficulty_dropdown.hidden = true;
    difficulty_dropdown_label.hidden = true;
  }

  // ============================================================
  // HANDLE PLAYER GUESS
  // ============================================================

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

          stopTimer();
          const roundPoints = awardWinPoints();

          gameMessageEl.textContent = `You Won! +${roundPoints} points!`;

        gameMessageEl.style.color = "green";

        syncDifficultyDropdown(difficulty);
        difficulty_dropdown.disabled = false;
        difficulty_dropdown.hidden = false;
        difficulty_dropdown_label.hidden = false;
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
        endGame(`Game Over! The word was: ${selectedWord}`);
      }
    }
  }

  // ============================================================
  // TIMER HELPERS
  // ============================================================

  function startTimer() {
    timeRemaining = GAME_TIME_LIMIT;
    timerEl.textContent = timeRemaining;

    stopTimer();

    // Count down from 90 seconds for every difficulty level.
    timerInterval = setInterval(() => {
      timeRemaining--;
      timerEl.textContent = Math.max(timeRemaining, 0);

      if (timeRemaining <= 0) {
        endGame(`Game Over! Time ran out. The word was: ${selectedWord}`);
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  // ============================================================
  // END GAME HELPERS
  // ============================================================

  function endGame(message) {
    gameOver = true;
    const finalScore = currentScore;

    stopTimer();

    gameMessageEl.textContent = message;
    gameMessageEl.style.color = "red";

    hangmanParts.face.style.display = "block";

    revealWord();
    saveLeaderboardEntry(difficulty, finalScore, selectedWord, getPlayerName());
    resetCurrentScore();

    syncDifficultyDropdown(difficulty);
    difficulty_dropdown.disabled = false;
    difficulty_dropdown.hidden = false;
    difficulty_dropdown_label.hidden = false;
  }

  function revealWord() {
    document.querySelectorAll(".word-letter").forEach((el) => {
      el.textContent = el.dataset.letter;
    });
  }

  // ============================================================
  // UPDATE WORD DISPLAY
  // ============================================================

  function updateWordDisplay() {
    document.querySelectorAll(".word-letter").forEach((el) => {
      const letter = el.dataset.letter;

      if (correctLetters.includes(letter)) {
        el.textContent = letter;
      }
    });
  }

  // ============================================================
  // CHECK WIN CONDITION
  // ============================================================

  function checkWin() {
    return selectedWord
      .toUpperCase()
      .split("")
      .every((letter) => letter === " " || correctLetters.includes(letter));
  }

  // ============================================================
  // UPDATE HANGMAN DRAWING
  // ============================================================

  function updateHangmanDrawing(difficulty) {
    const steps = Object.values(hangmanParts);

    if (wrongLetters.length <= steps.length) {
      steps[wrongLetters.length - 1].style.display = "block";
    }
  }

  // ============================================================
  // KEYBOARD SUPPORT
  // ============================================================

  document.addEventListener("keydown", (e) => {
    const activeElement = document.activeElement;

    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT")
    ) {
      return;
    }

    if (/^[a-z]$/i.test(e.key)) {
      handleGuess(e.key.toUpperCase());
    }
  });

  // ============================================================
  // DIFFICULTY CHANGES
  // ============================================================

  // Changing difficulty should only update the selection.
  // A new round begins when the player clicks the New Game button.
  difficulty_dropdown.addEventListener("change", () => {
    const roundInProgress = !gameOver && difficulty_dropdown.disabled;

    if (roundInProgress) {
      syncDifficultyDropdown(difficulty);
      return;
    }

    const d = get_difficulty(difficulty_dropdown);

    difficulty = d.difficulty;
    remainingGuesses = d.remainingGuesses;
    syncDifficultyDropdown(difficulty);

    difficultyDisplay.textContent = "Difficulty: " + difficulty;
    loadHighScore(difficulty);

    if (gameOver) {
      remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
    }
  });

  resetBtn.addEventListener("click", initGame);

  // ============================================================
  // LOAD WORDS ON PAGE START
  // ============================================================

  await loadWords();
});

// ============================================================
// DIFFICULTY SETTINGS
// ============================================================

function get_difficulty(dropdown) {
  const diff = dropdown.value;

  if (diff === "Easy") return { difficulty: "Easy", remainingGuesses: 6 };

  if (diff === "Medium") return { difficulty: "Medium", remainingGuesses: 5 };

  if (diff === "Hard") return { difficulty: "Hard", remainingGuesses: 4 };

  if (diff === "Advanced")
    return { difficulty: "Advanced", remainingGuesses: 3 };

  return { difficulty: "Easy", remainingGuesses: 6 };
}
