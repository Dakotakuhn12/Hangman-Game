document.addEventListener("DOMContentLoaded", () => {
  const DOM = {
    username: document.getElementById("username"),
    roomCode: document.getElementById("room-code"),
    roomCodeDisplay: document.getElementById("room-code-display"),
    playerCountDisplay: document.getElementById("player-count-display"),
    chooserDisplay: document.getElementById("chooser-display"),
    roundDisplay: document.getElementById("round-display"),
    timerDisplay: document.getElementById("word-master-timer-display"),
    playerList: document.getElementById("player-list"),
    scoreList: document.getElementById("score-list"),
    difficulty: document.getElementById("difficulty_drop"),
    difficultyDisplay: document.getElementById("difficulty-display"),
    wordDisplay: document.getElementById("word-display"),
    keyboard: document.getElementById("keyboard"),
    remainingGuesses: document.getElementById("remaining-guesses"),
    gameMessage: document.getElementById("game-message"),
    resetBtn: document.getElementById("reset-btn"),
    category: document.getElementById("category"),
    roomLog: document.getElementById("room-log"),
    chosenWord: document.getElementById("chosen-word"),
    customCategory: document.getElementById("custom-category"),
    submitWordBtn: document.getElementById("submit-selected-word"),
    wordSelectionModal: document.getElementById("word-selection-modal"),
    resultsModal: document.getElementById("match-results"),
    resultsTitle: document.getElementById("results-title"),
    resultsSummary: document.getElementById("results-summary"),
    resultsList: document.getElementById("results-list"),
    playAgainBtn: document.getElementById("play-again-btn"),
    themeToggle: document.getElementById("theme-toggle"),
    themeToggleText: document.getElementById("theme-toggle-text"),
  };

  const hangmanParts = {
    head: document.getElementById("head"),
    body: document.getElementById("body"),
    leftArm: document.getElementById("left-arm"),
    rightArm: document.getElementById("right-arm"),
    leftLeg: document.getElementById("left-leg"),
    rightLeg: document.getElementById("right-leg"),
    face: document.getElementById("face"),
  };

  const hangmanOrder = Object.values(hangmanParts);
  const keyboardButtons = new Map();
  const socket = io();
  const themeToggleIcon = DOM.themeToggle?.querySelector("i");
  const timerPanel = DOM.timerDisplay?.closest(".score-item");
  const WORD_MASTER_TIME_LIMIT = 90;
  const WORD_MASTER_TOTAL_ROUNDS = 10;

  let inRoom = false;
  const gameState = {
    selectedWord: "",
    correctLetters: [],
    wrongLetters: [],
    remainingGuesses: 6,
    remainingTime: WORD_MASTER_TIME_LIMIT,
    gameOver: false,
    waitingForWord: false,
    category: "Custom",
    chooserId: "",
    chooserName: "",
    firstSolverName: "",
    roundEndReason: null,
    currentRound: 0,
    totalRounds: WORD_MASTER_TOTAL_ROUNDS,
    matchActive: false,
    matchOver: false,
  };

  const getDifficulty = () => {
    const mapping = { easy: 6, medium: 5, hard: 4, advanced: 3 };
    return mapping[DOM.difficulty.value.toLowerCase()] || 6;
  };

  const getDifficultyLabel = () => {
    const value = DOM.difficulty.value.toLowerCase();
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const applyTheme = (theme) => {
    const resolvedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", resolvedTheme);

    if (DOM.themeToggleText) {
      DOM.themeToggleText.textContent =
        resolvedTheme === "dark" ? "Light Mode" : "Dark Mode";
    }

    if (themeToggleIcon) {
      themeToggleIcon.className =
        resolvedTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }
  };

  const initializeTheme = () => {
    const savedTheme = localStorage.getItem("hangmanTheme");
    const preferredTheme =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    applyTheme(savedTheme || preferredTheme);
  };

  const updateDifficultyDisplay = () => {
    DOM.difficultyDisplay.textContent = `Difficulty: ${getDifficultyLabel()}`;
  };

  const updateHeaderStats = () => {
    DOM.roomCodeDisplay.textContent =
      DOM.roomCode.textContent && DOM.roomCode.textContent !== "None"
        ? DOM.roomCode.textContent
        : "Offline";
    DOM.playerCountDisplay.textContent = String(DOM.playerList.children.length);
  };

  const showMessage = (message, color = "var(--primary)") => {
    DOM.gameMessage.textContent = message;
    DOM.gameMessage.style.color = color;
  };

  const addRoomLog = (message) => {
    const entry = document.createElement("div");
    const now = new Date();
    entry.textContent = `[${now.toTimeString().split(" ")[0]}] ${message}`;
    DOM.roomLog.appendChild(entry);
    DOM.roomLog.scrollTop = DOM.roomLog.scrollHeight;
  };

  const updateTimerDisplay = () => {
    const visibleTime = Math.max(gameState.remainingTime || 0, 0);
    DOM.timerDisplay.textContent = `${visibleTime}s`;
    DOM.timerDisplay.classList.toggle("timer-urgent", visibleTime <= 20);
    timerPanel?.classList.toggle("timer-warning", visibleTime <= 20);
  };

  const updateRoundDisplay = () => {
    DOM.roundDisplay.textContent = `${gameState.currentRound || 0}/${
      gameState.totalRounds || WORD_MASTER_TOTAL_ROUNDS
    }`;
  };

  const updateHangman = () => {
    hangmanOrder.forEach((part, index) => {
      part.style.display =
        index < gameState.wrongLetters.length ? "block" : "none";
    });
  };

  const updateWordDisplay = () => {
    DOM.wordDisplay.innerHTML = "";
    DOM.wordDisplay.classList.toggle(
      "waiting-word-display",
      !gameState.selectedWord && gameState.waitingForWord,
    );

    if (!gameState.selectedWord) {
      if (gameState.waitingForWord) {
        const waitingMessage = document.createElement("p");
        waitingMessage.className = "word-waiting-message";
        waitingMessage.textContent = "Waiting for the chooser...";
        DOM.wordDisplay.appendChild(waitingMessage);
      }
      return;
    }

    gameState.selectedWord.split(" ").forEach((word, wordIndex, words) => {
      const wordEl = document.createElement("div");
      wordEl.className = "word-display";

      word.split("").forEach((char) => {
        const letterEl = document.createElement("div");
        letterEl.className = "word-letter";

        if (/[^A-Z]/i.test(char)) {
          letterEl.textContent = char;
        } else if (gameState.correctLetters.includes(char)) {
          letterEl.textContent = char;
        } else {
          letterEl.textContent = "_";
        }

        wordEl.appendChild(letterEl);
      });

      DOM.wordDisplay.appendChild(wordEl);

      if (wordIndex < words.length - 1) {
        const spaceEl = document.createElement("div");
        spaceEl.className = "word-space";
        DOM.wordDisplay.appendChild(spaceEl);
      }
    });
  };

  const updateKeyboard = () => {
    const isChooser = socket.id === gameState.chooserId;
    const disabled =
      !inRoom ||
      !gameState.selectedWord ||
      gameState.gameOver ||
      gameState.waitingForWord ||
      isChooser;

    keyboardButtons.forEach((button, letter) => {
      button.className = "keyboard-letter";
      button.disabled = disabled;

      if (gameState.correctLetters.includes(letter)) {
        button.classList.add("correct", "used");
        button.disabled = true;
      } else if (gameState.wrongLetters.includes(letter)) {
        button.classList.add("wrong", "used");
        button.disabled = true;
      }
    });
  };

  const renderPlayers = (players = [], creatorId = "", chooserId = "") => {
    DOM.playerList.innerHTML = "";

    players.forEach((player) => {
      const item = document.createElement("li");
      item.className = "player-list-item";
      item.textContent = [
        player.username,
        player.id === socket.id ? "(You)" : "",
        player.id === creatorId ? "Host" : "",
        player.id === chooserId ? "Chooser" : "",
      ]
        .filter(Boolean)
        .join(" ");

      if (player.id === creatorId) item.classList.add("player-creator");
      if (player.id === chooserId) item.classList.add("player-chooser");
      DOM.playerList.appendChild(item);
    });

    updateHeaderStats();
  };

  const renderScores = (scores = [], showScores = false) => {
    DOM.scoreList.innerHTML = "";

    if (!showScores) {
      const hiddenState = document.createElement("li");
      hiddenState.className = "leaderboard-empty";
      hiddenState.textContent = "Scores are hidden until the match ends.";
      DOM.scoreList.appendChild(hiddenState);
      return;
    }

    const sortedScores = [...scores].sort(
      (a, b) => b.score - a.score || a.username.localeCompare(b.username),
    );

    if (!sortedScores.length) {
      const emptyState = document.createElement("li");
      emptyState.className = "leaderboard-empty";
      emptyState.textContent = "No scores yet.";
      DOM.scoreList.appendChild(emptyState);
      return;
    }

    sortedScores.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-entry";
      item.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span class="leaderboard-meta">
          <span class="leaderboard-word">${entry.username}</span>
          <span class="leaderboard-date">${entry.id === gameState.chooserId ? "Choosing this round" : "Guessing this round"}</span>
        </span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      DOM.scoreList.appendChild(item);
    });
  };

  const renderMatchResults = (scores = []) => {
    const sortedScores = [...scores].sort(
      (a, b) => b.score - a.score || a.username.localeCompare(b.username),
    );
    const winner = sortedScores[0];

    DOM.resultsTitle.textContent = winner
      ? `${winner.username} wins Word Master`
      : "Word Master Complete";
    DOM.resultsSummary.textContent = winner
      ? `Final score: ${winner.username} finished with ${winner.score} points after ${gameState.totalRounds || WORD_MASTER_TOTAL_ROUNDS} rounds.`
      : "The match is complete.";

    DOM.resultsList.innerHTML = "";
    sortedScores.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-entry";
      item.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span class="leaderboard-meta">
          <span class="leaderboard-word">${entry.username}</span>
          <span class="leaderboard-date">Final standing</span>
        </span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      DOM.resultsList.appendChild(item);
    });

    DOM.resultsModal.hidden = false;
  };

  const setModalVisible = (visible) => {
    DOM.wordSelectionModal.style.display = visible ? "flex" : "none";
    if (visible) {
      DOM.chosenWord.value = "";
      DOM.customCategory.value = "Custom";
      DOM.chosenWord.focus();
    }
  };

  const resetLocalRound = () => {
    gameState.selectedWord = "";
    gameState.correctLetters = [];
    gameState.wrongLetters = [];
    gameState.remainingGuesses = getDifficulty();
    gameState.remainingTime = WORD_MASTER_TIME_LIMIT;
    gameState.gameOver = false;
    gameState.waitingForWord = false;
    gameState.category = "Custom";
    gameState.firstSolverName = "";
    gameState.roundEndReason = null;
    gameState.currentRound = 0;
    gameState.totalRounds = WORD_MASTER_TOTAL_ROUNDS;
    gameState.matchActive = false;
    gameState.matchOver = false;
    DOM.category.textContent = "Category: Custom";
    DOM.remainingGuesses.textContent = `Remaining guesses: ${gameState.remainingGuesses}`;
    Object.values(hangmanParts).forEach(
      (part) => (part.style.display = "none"),
    );
    updateTimerDisplay();
    updateRoundDisplay();
    updateWordDisplay();
    updateKeyboard();
    showMessage("");
  };

  const handleGuess = (letter) => {
    if (!inRoom || gameState.gameOver || gameState.waitingForWord) return;
    if (socket.id === gameState.chooserId) return;
    if (
      gameState.correctLetters.includes(letter) ||
      gameState.wrongLetters.includes(letter)
    ) {
      return;
    }

    socket.emit("wordMasterGuess", DOM.roomCode.textContent, letter);
  };

  const initKeyboard = () => {
    DOM.keyboard.innerHTML = "";
    keyboardButtons.clear();

    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const button = document.createElement("button");
      button.className = "keyboard-letter";
      button.textContent = letter;
      button.dataset.letter = letter;
      button.addEventListener("click", () => handleGuess(letter));
      DOM.keyboard.appendChild(button);
      keyboardButtons.set(letter, button);
    }
  };

  const joinOrCreateRoom = (type) => {
    const username = DOM.username.value.trim();
    if (!username) return alert("Enter a username");

    if (type === "create") {
      socket.emit("createRoom", username, (roomCode) => {
        DOM.roomCode.textContent = roomCode;
        inRoom = true;
        addRoomLog(`Room created: ${roomCode}`);
        updateHeaderStats();
      });
      return;
    }

    const code = prompt("Enter room code:")?.trim().toUpperCase();
    if (!code) return;

    socket.emit("joinRoom", code, username, (response) => {
      if (response.success) {
        DOM.roomCode.textContent = code;
        inRoom = true;
        addRoomLog(`Joined room: ${code}`);
        updateHeaderStats();
      } else {
        alert(response.message);
        addRoomLog(`Failed to join room: ${response.message}`);
      }
    });
  };

  socket.on("connect", () => addRoomLog(`Connected: ${socket.id}`));

  socket.on("updatePlayers", (players, creatorId) => {
    renderPlayers(players, creatorId, gameState.chooserId);
  });

  socket.on("wordMasterChooseWord", () => {
    setModalVisible(true);
    showMessage("You are choosing the word for this round.", "var(--primary)");
  });

  socket.on("wordMasterState", (state) => {
    Object.assign(gameState, state);
    renderPlayers(state.players, state.creatorId, state.chooserId);
    renderScores(state.scores, state.matchOver);
    DOM.chooserDisplay.textContent = state.chooserName || "None";
    updateRoundDisplay();
    DOM.category.textContent = `Category: ${state.category || "Custom"}`;
    DOM.remainingGuesses.textContent = `Remaining guesses: ${state.remainingGuesses}`;
    updateTimerDisplay();
    updateHangman();
    updateWordDisplay();
    updateKeyboard();

    if (state.matchOver) {
      renderMatchResults(state.scores || []);
      showMessage("Match complete! Final scoreboard is ready.", "green");
      return;
    }

    DOM.resultsModal.hidden = true;

    if (state.waitingForWord) {
      const chooserText =
        state.chooserId === socket.id
          ? "Choose a word for everyone else to guess."
          : `Waiting for ${state.chooserName} to choose a word.`;
      showMessage(chooserText, "var(--primary)");
      return;
    }

    if (!state.selectedWord) return;

    if (state.gameOver) {
      if (state.roundEndReason === "solved") {
        showMessage(
          `${state.firstSolverName} solved ${state.chooserName}'s word. The word was ${state.selectedWord}. Start the next round when ready.`,
          "green",
        );
      } else {
        showMessage(
          `${state.chooserName} stumped the room. The word was ${state.selectedWord}. Start the next round when ready.`,
          "red",
        );
        hangmanParts.face.style.display = "block";
      }
      return;
    }

    if (state.chooserId === socket.id) {
      showMessage(
        "Your word is live. Watch the guesses roll in.",
        "var(--primary)",
      );
    } else {
      showMessage(`Guess ${state.chooserName}'s word.`, "var(--primary)");
    }
  });

  socket.on("logMessage", addRoomLog);

  DOM.themeToggle?.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    localStorage.setItem("hangmanTheme", nextTheme);
    applyTheme(nextTheme);
  });

  document
    .getElementById("create-room-btn")
    .addEventListener("click", () => joinOrCreateRoom("create"));

  document
    .getElementById("join-room-btn")
    .addEventListener("click", () => joinOrCreateRoom("join"));

  document.getElementById("leave-room-btn").addEventListener("click", () => {
    if (!inRoom) return alert("You are not in a room.");

    socket.emit("leaveRoom", DOM.roomCode.textContent, () => {
      DOM.roomCode.textContent = "None";
      inRoom = false;
      DOM.playerList.innerHTML = "";
      DOM.scoreList.innerHTML =
        '<li class="leaderboard-empty">Scores are hidden until the match ends.</li>';
      DOM.chooserDisplay.textContent = "None";
      DOM.resultsModal.hidden = true;
      setModalVisible(false);
      resetLocalRound();
      updateHeaderStats();
      addRoomLog("Left the room.");
    });
  });

  document.getElementById("start-game-btn").addEventListener("click", () => {
    if (!inRoom) return alert("Not in a room.");
    socket.emit(
      "startWordMasterRound",
      DOM.roomCode.textContent,
      DOM.difficulty.value,
    );
    addRoomLog("Word Master round requested.");
  });

  DOM.resetBtn.addEventListener("click", () => {
    if (!inRoom) return;
    socket.emit(
      "startWordMasterRound",
      DOM.roomCode.textContent,
      DOM.difficulty.value,
    );
    addRoomLog("Next round requested.");
  });

  DOM.playAgainBtn.addEventListener("click", () => {
    DOM.resultsModal.hidden = true;
    if (!inRoom) return;
    socket.emit(
      "startWordMasterRound",
      DOM.roomCode.textContent,
      DOM.difficulty.value,
    );
    addRoomLog("New Word Master match requested.");
  });

  DOM.submitWordBtn.addEventListener("click", () => {
    const word = DOM.chosenWord.value.trim();
    if (!word) return alert("Enter a word first.");

    socket.emit(
      "submitWordMasterWord",
      DOM.roomCode.textContent,
      word,
      DOM.customCategory.value.trim() || "Custom",
    );
    setModalVisible(false);
  });

  document
    .getElementById("cancel-word-selection")
    .addEventListener("click", () => {
      setModalVisible(false);
      showMessage(
        "Word selection cancelled. Start the round again when ready.",
      );
    });

  DOM.difficulty.addEventListener("change", () => {
    if (!gameState.selectedWord) {
      gameState.remainingGuesses = getDifficulty();
      DOM.remainingGuesses.textContent = `Remaining guesses: ${gameState.remainingGuesses}`;
    }
    updateDifficultyDisplay();
  });

  DOM.chosenWord.addEventListener("keydown", (event) => {
    if (event.key === "Enter") DOM.submitWordBtn.click();
  });

  document.addEventListener("keydown", (event) => {
    if (!/^[a-z]$/i.test(event.key)) return;
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    handleGuess(event.key.toUpperCase());
  });

  initKeyboard();
  initializeTheme();
  updateDifficultyDisplay();
  resetLocalRound();
  updateHeaderStats();
});
