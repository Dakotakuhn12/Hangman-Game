document.addEventListener("DOMContentLoaded", async () => {
  const difficultyDropdown = document.getElementById("diffictuly_drop");
  const difficultyDisplay = document.getElementById("difficulty-display");
  const wordDisplay = document.getElementById("word-display");
  const keyboard = document.getElementById("keyboard");
  const remainingGuessesEl = document.getElementById("remaining-guesses");
  const gameMessageEl = document.getElementById("game-message");
  const resetBtn = document.getElementById("reset-btn");
  const categoryContainer = document.getElementById("category");
  const timerEl = document.getElementById("quickplay-timer");
  const playerScoreEl = document.getElementById("playerScore");
  const topBotScoreEl = document.getElementById("botScore");
  const botStatusEl = document.getElementById("bot-status");
  const botScoreListEl = document.getElementById("bot-score-list");
  const roundDisplayEl = document.getElementById("round-display");
  const resultsModal = document.getElementById("match-results");
  const resultsTitle = document.getElementById("results-title");
  const resultsSummary = document.getElementById("results-summary");
  const resultsList = document.getElementById("results-list");
  const playAgainBtn = document.getElementById("play-again-btn");
  const timerPanel = timerEl?.closest(".score-item");
  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleText = document.getElementById("theme-toggle-text");
  const themeToggleIcon = themeToggle?.querySelector("i");

  const hangmanParts = {
    head: document.getElementById("head"),
    body: document.getElementById("body"),
    leftArm: document.getElementById("left-arm"),
    rightArm: document.getElementById("right-arm"),
    leftLeg: document.getElementById("left-leg"),
    rightLeg: document.getElementById("right-leg"),
    face: document.getElementById("face"),
  };

  const GAME_TIME_LIMIT = 90;
  const TOTAL_ROUNDS = 10;
  const BOT_PROFILES = [
    { name: "Cipher", skillBonus: 0.12, speedBonus: 0.9 },
    { name: "Pixel", skillBonus: 0, speedBonus: 1 },
    { name: "Orbit", skillBonus: -0.08, speedBonus: 1.12 },
  ];
  const BOT_NAMES = BOT_PROFILES.map((bot) => bot.name);

  let selectedWord = "";
  let correctLetters = [];
  let wrongLetters = [];
  let remainingGuesses = 6;
  let difficulty = "Easy";
  let timeRemaining = GAME_TIME_LIMIT;
  let currentRound = 1;
  let roundOver = false;
  let playerDone = false;
  let botInterval;
  let timerInterval;
  let nextRoundTimeout;
  let bots = [];
  let scores = {};
  let roundAwardedPlayers = new Set();

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

  function startMatch() {
    currentRound = 1;
    scores = {
      Player: 0,
      ...Object.fromEntries(BOT_NAMES.map((name) => [name, 0])),
    };
    resultsModal.hidden = true;
    resetBtn.innerHTML = '<i class="fas fa-redo"></i> Restart Match';
    updateScores();
    initRound();
  }

  function showStartScreen() {
    currentRound = 1;
    scores = {
      Player: 0,
      ...Object.fromEntries(BOT_NAMES.map((name) => [name, 0])),
    };
    bots = [];
    selectedWord = "";
    correctLetters = [];
    wrongLetters = [];
    roundOver = true;
    playerDone = false;
    timeRemaining = GAME_TIME_LIMIT;

    clearInterval(botInterval);
    clearInterval(timerInterval);
    clearTimeout(nextRoundTimeout);

    wordDisplay.innerHTML = "";
    keyboard.innerHTML = "";
    Object.values(hangmanParts).forEach((part) => {
      if (part) part.style.display = "none";
    });

    const d = getDifficulty(difficultyDropdown);
    remainingGuesses = d.remainingGuesses;
    difficulty = d.difficulty;
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
    categoryContainer.textContent = "Category: Ready when you are";
    gameMessageEl.textContent = "Choose a difficulty, then start when you're ready.";
    gameMessageEl.style.color = "var(--primary)";
    resetBtn.innerHTML = '<i class="fas fa-play"></i> Start Quick Play';

    updateScores();
    updateRoundDisplay();
    updateDifficultyDisplay();
    updateTimerDisplay();
    updateBotStatus("Waiting for the match to start...");
  }

  async function initRound() {
    correctLetters = [];
    wrongLetters = [];
    roundAwardedPlayers = new Set();
    roundOver = false;
    playerDone = false;
    gameMessageEl.textContent = "";
    gameMessageEl.style.color = "";
    clearInterval(botInterval);
    clearInterval(timerInterval);
    clearTimeout(nextRoundTimeout);

    const d = getDifficulty(difficultyDropdown);
    remainingGuesses = d.remainingGuesses;
    difficulty = d.difficulty;
    updateRoundDisplay();
    updateDifficultyDisplay();

    const data = await chooseWordFromDB();
    if (!data?.word) {
      roundOver = true;
      gameMessageEl.textContent = "Unable to load a word. Try restarting.";
      gameMessageEl.style.color = "red";
      difficultyDropdown.hidden = false;
      return;
    }

    selectedWord = data.word;
    if (categoryContainer) {
      categoryContainer.textContent = "Category: " + data.category;
    }

    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
    Object.values(hangmanParts).forEach((part) => {
      if (part) part.style.display = "none";
    });

    displayWordBlanks(selectedWord);
    createKeyboard();
    createBots(difficulty);
    startBotGuesses(difficulty);
    startTimer();
    difficultyDropdown.hidden = true;
  }

  function displayWordBlanks(word) {
    wordDisplay.innerHTML = "";
    const phrase = word.split(" ");

    phrase.forEach((w, i) => {
      const wordContainer = document.createElement("div");
      wordContainer.classList.add("word-group");

      for (const char of w) {
        const letterEl = document.createElement("div");
        letterEl.classList.add("word-letter");
        letterEl.dataset.letter = char.toUpperCase();
        letterEl.textContent = /[A-Z]/i.test(char) ? "_" : char;
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

  function createKeyboard() {
    keyboard.innerHTML = "";
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const keyEl = document.createElement("button");
      keyEl.classList.add("keyboard-letter");
      keyEl.textContent = letter;
      keyEl.dataset.letter = letter;
      keyEl.addEventListener("click", () => handlePlayerGuess(letter));
      keyboard.appendChild(keyEl);
    }
  }

  function handlePlayerGuess(letter) {
    if (
      roundOver ||
      playerDone ||
      correctLetters.includes(letter) ||
      wrongLetters.includes(letter)
    ) {
      return;
    }

    if (selectedWord.toUpperCase().includes(letter)) {
      correctLetters.push(letter);
      updateWordDisplay();
      markKey(letter, "correct");

      if (isWordSolved(correctLetters)) {
        playerDone = true;
        const points = awardPoints("Player", remainingGuesses);
        gameMessageEl.textContent = `You solved it! +${points} points. Waiting for the bots...`;
        gameMessageEl.style.color = "green";
        disableKeyboard();
        revealWord();
        checkRoundComplete();
      }
      return;
    }

    wrongLetters.push(letter);
    remainingGuesses--;
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
    markKey(letter, "wrong");
    updateHangmanDrawing();

    if (remainingGuesses === 0) {
      playerDone = true;
      gameMessageEl.textContent = `You are out this round. The word was: ${selectedWord}`;
      gameMessageEl.style.color = "red";
      showCompletedHangman();
      revealWord();
      disableKeyboard();
      checkRoundComplete();
    }
  }

  function startTimer() {
    timeRemaining = GAME_TIME_LIMIT;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      timeRemaining--;
      updateTimerDisplay();

      if (timeRemaining <= 0) {
        showCompletedHangman();
        endRound(`Time ran out. The word was: ${selectedWord}`);
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const visibleTime = Math.max(timeRemaining, 0);
    if (!timerEl) return;
    timerEl.textContent = `${visibleTime}s`;
    timerEl.classList.toggle("timer-urgent", visibleTime <= 20);
    timerPanel?.classList.toggle("timer-warning", visibleTime <= 20);
  }

  function createBots(diff) {
    const settings = getBotDifficultySettings(diff);

    bots = BOT_PROFILES.map((profile, index) => ({
      name: profile.name,
      correctLetters: [],
      wrongLetters: [],
      remainingGuesses: settings.guesses,
      smartChance: Math.min(
        0.95,
        Math.max(0, settings.smartChance + profile.skillBonus)
      ),
      nextGuessAt: Date.now() + settings.speed * profile.speedBonus * (index + 1),
      speed: Math.round(settings.speed * profile.speedBonus),
      active: true,
      solved: false,
      roundPoints: 0,
      status: "Playing",
    }));

    updateBotStatus(`${bots.length} bots active: ${botNameList()}.`);
    renderBotScores();
  }

  function startBotGuesses(diff) {
    botInterval = setInterval(() => {
      if (roundOver) return clearInterval(botInterval);

      const now = Date.now();
      bots.forEach((bot) => {
        if (!bot.active || now < bot.nextGuessAt) return;

        const guessLetter = chooseBotLetter(bot, diff);
        if (!guessLetter) {
          bot.active = false;
          checkRoundComplete();
          return;
        }

        handleBotGuess(bot, guessLetter);
        bot.nextGuessAt = now + bot.speed;
      });
    }, 250);
  }

  function chooseBotLetter(bot, diff) {
    const availableLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      .split("")
      .filter(
        (l) => !bot.correctLetters.includes(l) && !bot.wrongLetters.includes(l)
      );

    if (availableLetters.length === 0) return null;

    const unknownWordLetters = getUnknownWordLetters(bot.correctLetters).filter(
      (letter) => availableLetters.includes(letter)
    );

    if (unknownWordLetters.length && Math.random() < bot.smartChance) {
      return mostCommonLetter(unknownWordLetters);
    }

    switch (diff) {
      case "Easy":
        return randomLetter(availableLetters);
      case "Medium":
        return Math.random() < 0.7
          ? mostCommonLetter(availableLetters)
          : randomLetter(availableLetters);
      case "Hard":
      case "Advanced":
        return mostCommonLetter(availableLetters);
      default:
        return randomLetter(availableLetters);
    }
  }

  function handleBotGuess(bot, letter) {
    if (selectedWord.toUpperCase().includes(letter)) {
      bot.correctLetters.push(letter);
      updateBotStatus(`${bot.name} found ${letter}.`);

      if (isWordSolved(bot.correctLetters)) {
        completeBotWord(bot);
      }
      return;
    }

    bot.wrongLetters.push(letter);
    bot.remainingGuesses--;
    bot.status = `${bot.remainingGuesses} guesses left`;
    renderBotScores();
    updateBotStatus(`${bot.name} missed ${letter}.`);

    if (bot.remainingGuesses <= 0) {
      bot.active = false;
      bot.status = "Out";
      renderBotScores();
      updateBotStatus(`${bot.name} is out.`);
      checkRoundComplete();
    }
  }

  function completeBotWord(bot) {
    if (bot.solved || roundAwardedPlayers.has(bot.name)) return;

    bot.active = false;
    bot.solved = true;
    const points = awardPoints(bot.name, bot.remainingGuesses);
    bot.roundPoints = points;
    bot.status = `Solved +${points}`;
    renderBotScores();
    updateBotStatus(`${bot.name} solved the word and earned +${points} points.`);
    checkRoundComplete();
  }

  function checkRoundComplete() {
    if (roundOver) return;

    const botsDone = bots.every((bot) => !bot.active);
    if (playerDone && botsDone) {
      endRound(`Round ${currentRound} complete. The word was: ${selectedWord}`);
    }
  }

  function endRound(message) {
    if (roundOver) return;

    roundOver = true;
    playerDone = true;
    bots.forEach((bot) => {
      bot.active = false;
    });

    clearInterval(botInterval);
    clearInterval(timerInterval);
    revealWord();
    disableKeyboard();
    difficultyDropdown.hidden = currentRound < TOTAL_ROUNDS;
    gameMessageEl.textContent = message;
    gameMessageEl.style.color = "var(--primary)";

    if (currentRound >= TOTAL_ROUNDS) {
      showMatchResults();
      return;
    }

    updateBotStatus(`Next round starts soon. Standings: ${standingsText()}`);
    nextRoundTimeout = setTimeout(() => {
      currentRound++;
      initRound();
    }, 2500);
  }

  function awardPoints(name, guessesLeft) {
    if (roundAwardedPlayers.has(name)) return 0;

    const difficultyBonusMap = {
      Easy: 40,
      Medium: 70,
      Hard: 100,
      Advanced: 140,
    };
    const timeBonus = Math.max(timeRemaining, 0) * 4;
    const remainingBonus = Math.max(guessesLeft, 0) * 25;
    const wordBonus = selectedWord.replace(/ /g, "").length * 10;
    const points =
      difficultyBonusMap[difficulty] + timeBonus + remainingBonus + wordBonus;

    roundAwardedPlayers.add(name);
    scores[name] = (scores[name] || 0) + points;
    updateScores();
    return points;
  }

  function updateScores() {
    const topBotScore = Math.max(...BOT_NAMES.map((name) => scores[name] || 0));
    if (playerScoreEl) playerScoreEl.textContent = String(scores.Player || 0);
    if (topBotScoreEl) topBotScoreEl.textContent = String(topBotScore);
    renderBotScores();
  }

  function renderBotScores() {
    if (!botScoreListEl) return;

    botScoreListEl.innerHTML = "";
    BOT_NAMES.forEach((name) => {
      const bot = bots.find((entry) => entry.name === name);
      const scoreRow = document.createElement("div");
      scoreRow.className = "bot-score-row";
      scoreRow.innerHTML = `
        <span>
          <strong class="bot-score-name">${name}</strong>
          <small>${bot?.status || "Waiting"}</small>
        </span>
        <strong>${scores[name] || 0}</strong>
      `;
      botScoreListEl.appendChild(scoreRow);
    });
  }

  function showMatchResults() {
    const standings = getStandings();
    const winner = standings[0];

    resultsTitle.textContent =
      winner.name === "Player" ? "You won the match!" : `${winner.name} won`;
    resultsSummary.textContent = `Final score: ${winner.name} finished with ${winner.score} points.`;
    resultsList.innerHTML = "";

    standings.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-entry";
      item.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span class="leaderboard-meta">
          <span class="leaderboard-word">${entry.name}</span>
          <span class="leaderboard-date">${entry.name === "Player" ? "You" : "Bot opponent"}</span>
        </span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      resultsList.appendChild(item);
    });

    updateBotStatus(`Match complete. Winner: ${winner.name}.`);
    resultsModal.hidden = false;
  }

  function getStandings() {
    return Object.entries(scores)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  function standingsText() {
    return getStandings()
      .map((entry, index) => `#${index + 1} ${entry.name} ${entry.score}`)
      .join(" | ");
  }

  function updateRoundDisplay() {
    if (roundDisplayEl) {
      roundDisplayEl.textContent = `Round: ${currentRound} / ${TOTAL_ROUNDS}`;
    }
  }

  function updateDifficultyDisplay() {
    if (difficultyDisplay) {
      difficultyDisplay.textContent = `Difficulty: ${difficulty}`;
    }
  }

  function updateWordDisplay() {
    document.querySelectorAll(".word-letter").forEach((el) => {
      if (correctLetters.includes(el.dataset.letter)) {
        el.textContent = el.dataset.letter;
      }
    });
  }

  function markKey(letter, type) {
    const key = document.querySelector(
      `.keyboard-letter[data-letter="${letter}"]`
    );
    if (key) key.classList.add(type, "used");
  }

  function disableKeyboard() {
    document.querySelectorAll(".keyboard-letter").forEach((key) => {
      key.disabled = true;
      key.classList.add("used");
    });
  }

  function revealWord() {
    document.querySelectorAll(".word-letter").forEach((el) => {
      el.textContent = el.dataset.letter;
    });
  }

  function updateHangmanDrawing() {
    const parts = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];

    parts.slice(0, wrongLetters.length).forEach((part) => {
      if (hangmanParts[part]) hangmanParts[part].style.display = "block";
    });
  }

  function showCompletedHangman() {
    Object.values(hangmanParts).forEach((part) => {
      if (part) part.style.display = "block";
    });
  }

  function isWordSolved(letters) {
    return selectedWord
      .toUpperCase()
      .split("")
      .every((letter) => !/[A-Z]/.test(letter) || letters.includes(letter));
  }

  function getUnknownWordLetters(knownLetters) {
    return [
      ...new Set(
        selectedWord
          .toUpperCase()
          .split("")
          .filter((letter) => /[A-Z]/.test(letter) && !knownLetters.includes(letter))
      ),
    ];
  }

  function getBotDifficultySettings(diff) {
    const settings = {
      Easy: {
        guesses: 6,
        speed: 2300,
        smartChance: 0.18,
      },
      Medium: {
        guesses: 7,
        speed: 1400,
        smartChance: 0.45,
      },
      Hard: {
        guesses: 8,
        speed: 850,
        smartChance: 0.74,
      },
      Advanced: {
        guesses: 10,
        speed: 450,
        smartChance: 0.94,
      },
    };

    return settings[diff] || settings.Easy;
  }

  function botNameList() {
    return bots.map((bot) => bot.name).join(", ");
  }

  function updateBotStatus(message) {
    if (botStatusEl) botStatusEl.textContent = message;
  }

  function randomLetter(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function mostCommonLetter(arr) {
    const frequency = "ETAOINSHRDLCUMWFGYPBVKJXQZ".split("");
    for (const letter of frequency) {
      if (arr.includes(letter)) return letter;
    }
    return arr[0];
  }

  function getDifficulty(dropdown) {
    const diff = dropdown.value;
    if (diff === "easy") return { difficulty: "Easy", remainingGuesses: 6 };
    if (diff === "medium") return { difficulty: "Medium", remainingGuesses: 5 };
    if (diff === "hard") return { difficulty: "Hard", remainingGuesses: 4 };
    if (diff === "advanced") {
      return { difficulty: "Advanced", remainingGuesses: 3 };
    }
    return { difficulty: "Easy", remainingGuesses: 6 };
  }

  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") return;
    if (/^[a-z]$/i.test(e.key)) handlePlayerGuess(e.key.toUpperCase());
  });

  resetBtn.addEventListener("click", startMatch);
  playAgainBtn?.addEventListener("click", startMatch);

  difficultyDropdown.addEventListener("change", () => {
    const d = getDifficulty(difficultyDropdown);
    remainingGuesses = d.remainingGuesses;
    difficulty = d.difficulty;
    updateDifficultyDisplay();
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
  });

  updateTimerDisplay();
  showStartScreen();
});
