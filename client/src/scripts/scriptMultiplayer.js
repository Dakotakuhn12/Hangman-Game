document.addEventListener("DOMContentLoaded", () => {
  // -----------------------------
  // DOM Elements
  // -----------------------------
  const DOM = {
    username: document.getElementById("username"),
    roomCode: document.getElementById("room-code"),
    roomCodeDisplay: document.getElementById("room-code-display"),
    playerCountDisplay: document.getElementById("player-count-display"),
    playerList: document.getElementById("player-list"),
    difficulty: document.getElementById("difficulty_drop"),
    difficultyDisplay: document.getElementById("difficulty-display"),
    leaderboardSubtitle: document.getElementById("leaderboard-subtitle"),
    leaderboardList: document.getElementById("leaderboard-list"),
    wordDisplay: document.getElementById("word-display"),
    keyboard: document.getElementById("keyboard"),
    remainingGuesses: document.getElementById("remaining-guesses"),
    gameMessage: document.getElementById("game-message"),
    resetBtn: document.getElementById("reset-btn"),
    category: document.getElementById("category"),
    roomLog: document.getElementById("room-log"),
    wordsContainer: document.getElementById("words-container"),
    wordSearch: document.getElementById("word-search"),
    categoryFilter: document.getElementById("category-filter"),
    selectedWordText: document.getElementById("selected-word-text"),
    selectedCategoryText: document.getElementById("selected-category-text"),
    customCategory: document.getElementById("custom-category"),
    submitWordBtn: document.getElementById("submit-selected-word"),
    wordSelectionModal: document.getElementById("word-selection-modal"),
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

  // -----------------------------
  // Game State
  // -----------------------------
  const gameState = {
    selectedWord: "",
    correctLetters: [],
    wrongLetters: [],
    remainingGuesses: 0,
    gameOver: false,
    isChooser: false,
    category: "General",
  };

  const wordSelectionState = {
    selectedWord: null,
    selectedCategory: "General",
    allWords: [],
    filteredWords: [],
  };

  let inRoom = false;
  const socket = io();
  const keyboardButtons = new Map();
  const themeToggleIcon = DOM.themeToggle?.querySelector("i");
  let leaderboardSavedForRound = false;

  // -----------------------------
  // Helper Functions
  // -----------------------------
  const getDifficulty = () => {
    const mapping = { easy: 6, medium: 5, hard: 4, advanced: 3 };
    return mapping[DOM.difficulty.value.toLowerCase()] || 6;
  };

  const getDifficultyLabel = () => {
    const value = DOM.difficulty.value.toLowerCase();
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const getLeaderboardKey = (selectedDifficulty) =>
    `hangmanMultiplayerLeaderboard_${selectedDifficulty}`;

  const normalizePlayerName = (playerName) =>
    (playerName || "").trim().toLocaleLowerCase();

  const getLeaderboardEntries = (selectedDifficulty) => {
    try {
      const raw = localStorage.getItem(getLeaderboardKey(selectedDifficulty));
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
        .slice(0, 5);
    } catch (error) {
      console.error("Failed to load multiplayer leaderboard:", error);
      return [];
    }
  };

  const formatLeaderboardDate = (timestamp) =>
    new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const renderLeaderboard = (selectedDifficulty) => {
    if (!DOM.leaderboardList || !DOM.leaderboardSubtitle) return;

    DOM.leaderboardSubtitle.textContent = `Top scores for ${selectedDifficulty}`;
    const entries = getLeaderboardEntries(selectedDifficulty).slice(0, 5);

    DOM.leaderboardList.innerHTML = "";

    if (!entries.length) {
      const emptyState = document.createElement("li");
      emptyState.className = "leaderboard-empty";
      emptyState.textContent = "No scores yet.";
      DOM.leaderboardList.appendChild(emptyState);
      return;
    }

    entries.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-entry";
      item.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span class="leaderboard-meta">
          <span class="leaderboard-word">${entry.playerName} - ${entry.word}</span>
          <span class="leaderboard-date">${formatLeaderboardDate(entry.timestamp)}</span>
        </span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      DOM.leaderboardList.appendChild(item);
    });
  };

  const saveLeaderboardEntry = (selectedDifficulty, score, word, playerName) => {
    if (!selectedDifficulty || score <= 0 || !playerName) return;

    const entries = getLeaderboardEntries(selectedDifficulty);
    const normalizedPlayerName = normalizePlayerName(playerName);
    const existingEntry = entries.find(
      (entry) => normalizePlayerName(entry.playerName) === normalizedPlayerName,
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

    const topEntries = entries
      .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
      .slice(0, 5);

    localStorage.setItem(
      getLeaderboardKey(selectedDifficulty),
      JSON.stringify(topEntries),
    );

    renderLeaderboard(selectedDifficulty);
  };

  const calculateRoundScore = () => {
    const difficultyValue = DOM.difficulty.value.toLowerCase();
    const difficultyBonusMap = {
      easy: 40,
      medium: 70,
      hard: 100,
      advanced: 140,
    };
    const remainingBonus = Math.max(gameState.remainingGuesses, 0) * 25;
    const wordBonus = (gameState.selectedWord || "").replace(/ /g, "").length * 10;
    return difficultyBonusMap[difficultyValue] + remainingBonus + wordBonus;
  };

  const applyTheme = (theme) => {
    const root = document.documentElement;
    const resolvedTheme = theme === "dark" ? "dark" : "light";

    root.setAttribute("data-theme", resolvedTheme);

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

  DOM.themeToggle?.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";

    localStorage.setItem("hangmanTheme", nextTheme);
    applyTheme(nextTheme);
  });

  const updateDifficultyDisplay = () => {
    if (!DOM.difficultyDisplay) return;

    DOM.difficultyDisplay.textContent = `Difficulty: ${getDifficultyLabel()}`;
  };

  const syncHeaderStats = () => {
    if (DOM.roomCodeDisplay) {
      DOM.roomCodeDisplay.textContent =
        DOM.roomCode.textContent && DOM.roomCode.textContent !== "None"
          ? DOM.roomCode.textContent
          : "Offline";
    }

    if (DOM.playerCountDisplay) {
      DOM.playerCountDisplay.textContent = String(
        DOM.playerList?.children.length || 0,
      );
    }
  };

  const showMessage = (msg, color = "var(--primary)") => {
    DOM.gameMessage.textContent = msg;
    DOM.gameMessage.style.color = color;
  };

  const addRoomLog = (msg) => {
    if (!DOM.roomLog) return;
    const entry = document.createElement("div");
    const now = new Date();
    entry.textContent = `[${now.toTimeString().split(" ")[0]}] ${msg}`;
    DOM.roomLog.appendChild(entry);
    DOM.roomLog.scrollTop = DOM.roomLog.scrollHeight;
  };

  const updateHangman = () => {
    hangmanOrder.forEach((part, i) => {
      part.style.display = i < gameState.wrongLetters.length ? "block" : "none";
    });
  };

  const updateWordDisplay = () => {
    DOM.wordDisplay.innerHTML = "";

    // Split into words (preserve spaces by re-adding them as gaps)
    const words = gameState.selectedWord.split(" ");

    words.forEach((word, wordIndex) => {
      const wordEl = document.createElement("div");
      wordEl.className = "word-display";

      word.split("").forEach((char) => {
        const letterEl = document.createElement("div");
        letterEl.className = "word-letter";
        letterEl.dataset.letter = char;

        if (gameState.isChooser) {
          letterEl.textContent = char;
          letterEl.classList.add("chooser-letter");
        } else if (/[^A-Z]/i.test(char)) {
          letterEl.textContent = char;
          if (!gameState.correctLetters.includes(char)) {
            gameState.correctLetters.push(char);
          }
        } else {
          letterEl.textContent = gameState.correctLetters.includes(char)
            ? char
            : "_";
        }

        wordEl.appendChild(letterEl);
      });

      DOM.wordDisplay.appendChild(wordEl);

      // Optional: spacing between words
      if (wordIndex < words.length - 1) {
        const spaceEl = document.createElement("div");
        spaceEl.className = "word-space";
        DOM.wordDisplay.appendChild(spaceEl);
      }
    });
  };

  const updateKeyboard = () => {
    keyboardButtons.forEach((btn, letter) => {
      btn.className = "keyboard-letter";
      btn.disabled = false;
      if (gameState.correctLetters.includes(letter))
        btn.classList.add("correct", "used");
      else if (gameState.wrongLetters.includes(letter))
        btn.classList.add("wrong", "used"), (btn.disabled = true);
    });
  };

  const checkWin = () =>
    gameState.selectedWord
      .split("")
      .every((c) => /[^A-Z]/i.test(c) || gameState.correctLetters.includes(c));

  const handleGuess = (letter) => {
    if (gameState.gameOver || gameState.isChooser) return;
    if (
      gameState.correctLetters.includes(letter) ||
      gameState.wrongLetters.includes(letter)
    )
      return;
    socket.emit("playerGuess", DOM.roomCode.textContent, letter);
  };

  const initKeyboard = () => {
    DOM.keyboard.innerHTML = "";
    keyboardButtons.clear();
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const btn = document.createElement("button");
      btn.className = "keyboard-letter";
      btn.textContent = letter;
      btn.dataset.letter = letter;
      btn.addEventListener("click", () => handleGuess(letter));
      DOM.keyboard.appendChild(btn);
      keyboardButtons.set(letter, btn);
    }
  };

  const resetGame = (word = "", category = "General") => {
    gameState.selectedWord = word.toUpperCase();
    gameState.category = category;
    gameState.correctLetters = gameState.isChooser ? word.split("") : [];
    gameState.wrongLetters = [];
    gameState.remainingGuesses = getDifficulty();
    gameState.gameOver = false;
    leaderboardSavedForRound = false;

    DOM.remainingGuesses.textContent = `Remaining guesses: ${gameState.remainingGuesses}`;
    DOM.category.textContent = `Category: ${category}`;
    updateDifficultyDisplay();
    renderLeaderboard(getDifficultyLabel());
    Object.values(hangmanParts).forEach((p) => (p.style.display = "none"));

    if (word) {
      updateWordDisplay();
      initKeyboard();
      showMessage("Game started! Make your guesses.", "var(--primary)");
    }
  };

  // -----------------------------
  // Word Selection Helpers
  // -----------------------------
  const fetchWords = async () => {
    try {
      showMessage("Loading words...");
      const res = await fetch("/api/words");
      if (!res.ok) throw new Error("Failed to fetch words");
      const data = await res.json();
      console.log(data);
      wordSelectionState.allWords = [...data];
      wordSelectionState.filteredWords = [...data];
      showMessage("");
      return data;
    } catch {
      const fallback = [
        { word: "ELEPHANT", category: "Animals" },
        { word: "PYTHON", category: "Programming" },
        { word: "PIZZA", category: "Food" },
        { word: "GUITAR", category: "Music" },
      ];
      wordSelectionState.allWords = [...fallback];
      wordSelectionState.filteredWords = [...fallback];
      showMessage("Using fallback words.", "red");
      return fallback;
    }
  };

  const displayWords = (words) => {
    DOM.wordsContainer.innerHTML = "";
    words.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "word-card";
      console.log(item);
      if (wordSelectionState.selectedWord === item.word) {
        card.classList.add("selected");
      }
      card.innerHTML = `<div>${item.word}</div><span class="word-category">${item.category}</span>`;
      card.addEventListener("click", () => {
        DOM.wordsContainer
          .querySelectorAll(".word-card")
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        wordSelectionState.selectedWord = item.word;
        wordSelectionState.selectedCategory = item.category;
        DOM.selectedWordText.textContent = item.word;
        DOM.selectedCategoryText.textContent = item.category;
        DOM.customCategory.value = item.category;
        DOM.submitWordBtn.disabled = false;
      });
      DOM.wordsContainer.appendChild(card);
    });
  };

  const filterWords = () => {
    const term = DOM.wordSearch.value.toLowerCase() || "";
    const cat = DOM.categoryFilter.value;
    wordSelectionState.filteredWords = wordSelectionState.allWords
      .filter((w) => typeof w?.word === "string")
      .filter(
        (w) =>
          w.word.toLowerCase().includes(term) &&
          (cat === "all" || w.category === cat)
      );
    displayWords(wordSelectionState.filteredWords);
  };

  const showWordSelectionModal = async () => {
    DOM.wordSelectionModal.style.display = "flex";
    wordSelectionState.selectedWord = null;
    wordSelectionState.selectedCategory = "General";
    DOM.selectedWordText.textContent = "None";
    DOM.selectedCategoryText.textContent = "General";
    DOM.customCategory.value = "";
    DOM.submitWordBtn.disabled = true;
    await fetchWords();
    filterWords();
  };

  const hideWordSelectionModal = () => {
    DOM.wordSelectionModal.style.display = "none";
  };

  // -----------------------------
  // Socket Events
  // -----------------------------
  socket.on("connect", () => addRoomLog(`Connected: ${socket.id}`));

  socket.on("updatePlayers", (players, creatorId) => {
    DOM.playerList.innerHTML = "";
    players.forEach((p) => {
      const li = document.createElement("li");
      li.className = "player-list-item";
      let txt =
        p.username +
        (p.id === socket.id ? " (You)" : "") +
        (p.id === creatorId ? " ⭐" : "");
      li.textContent = txt;
      if (p.id === creatorId) li.classList.add("player-creator");
      DOM.playerList.appendChild(li);
    });
    syncHeaderStats();
  });

  socket.on("chooseWord", () => {
    gameState.isChooser = true;
    showWordSelectionModal();
    addRoomLog("You are the word chooser!");
  });

  socket.on("waitForWord", () => {
    gameState.isChooser = false;
    showMessage("Waiting for host to choose a word...");
  });

  socket.on("gameStarted", ({ word, category }) => resetGame(word, category));

  socket.on("updateGameState", (state) => {
    Object.assign(gameState, state);
    DOM.remainingGuesses.textContent = `Remaining guesses: ${gameState.remainingGuesses}`;
    updateHangman();
    updateWordDisplay();
    updateKeyboard();

    if (gameState.gameOver) {
      if (checkWin()) {
        showMessage("🎉 Congrats! You Won!", "green"),
          addRoomLog("Players won!");
        if (!leaderboardSavedForRound) {
          saveLeaderboardEntry(
            getDifficultyLabel(),
            calculateRoundScore(),
            gameState.selectedWord,
            DOM.username.value.trim(),
          );
          leaderboardSavedForRound = true;
        }
      } else {
        showMessage(`💀 Game Over! Word was: ${gameState.selectedWord}`, "red"),
          addRoomLog("Players lost!"),
          (hangmanParts.face.style.display = "block");
        leaderboardSavedForRound = true;
      }
    }
  });

  socket.on("logMessage", addRoomLog);

  // -----------------------------
  // UI Events
  // -----------------------------
  const joinOrCreateRoom = (type) => {
    const username = DOM.username.value.trim();
    if (!username) return alert("Enter a username");
    if (type === "create")
      socket.emit("createRoom", username, (room) => {
        DOM.roomCode.textContent = room;
        inRoom = true;
        addRoomLog(`Room created: ${room}`);
        syncHeaderStats();
      });
    else {
      const code = prompt("Enter room code:")?.trim().toUpperCase();
      if (!code) return;
      socket.emit("joinRoom", code, username, (res) => {
        if (res.success)
          (DOM.roomCode.textContent = code),
            (inRoom = true),
            addRoomLog(`Joined room: ${code}`),
            syncHeaderStats();
        else
          alert(res.message), addRoomLog(`Failed to join room: ${res.message}`);
      });
    }
  };

  document
    .getElementById("create-room-btn")
    .addEventListener("click", () => joinOrCreateRoom("create"));
  document
    .getElementById("join-room-btn")
    .addEventListener("click", () => joinOrCreateRoom("join"));

  document.getElementById("leave-room-btn").addEventListener("click", () => {
    if (!inRoom) return alert("You are not in a room.");

    socket.emit("leaveRoom", DOM.roomCode.textContent, () => {
      // Reset room state
      DOM.roomCode.textContent = "None";
      inRoom = false;

      // Reset game state
      gameState.isChooser = false;
      gameState.selectedWord = "";
      gameState.correctLetters = [];
      gameState.wrongLetters = [];
      gameState.remainingGuesses = getDifficulty();
      gameState.gameOver = false;
      gameState.category = "General";

      // Reset UI
      DOM.wordDisplay.innerHTML = "";
      DOM.category.textContent = "Category: General";
      DOM.remainingGuesses.textContent = `Remaining guesses: ${gameState.remainingGuesses}`;
      DOM.gameMessage.textContent = "";

      Object.values(hangmanParts).forEach((p) => (p.style.display = "none"));

      // Reset keyboard
      keyboardButtons.forEach((btn) => {
        btn.disabled = false;
        btn.className = "keyboard-letter";
      });

      // Clear player list
      DOM.playerList.innerHTML = "";
      syncHeaderStats();

      addRoomLog("Left the room.");
    });
  });

  document.getElementById("start-game-btn").addEventListener("click", () => {
    if (!inRoom) return alert("Not in a room.");
    socket.emit("startGame", DOM.roomCode.textContent, DOM.difficulty.value);
    addRoomLog("Game starting...");
  });

  DOM.wordSearch.addEventListener("input", filterWords);
  DOM.categoryFilter.addEventListener("change", filterWords);

  document
    .getElementById("refresh-words")
    .addEventListener("click", async () => {
      await fetchWords();
      // Reset search and category filter
      DOM.wordSearch.value = "";
      DOM.categoryFilter.value = "all";
      // Show all words
      wordSelectionState.filteredWords = [...wordSelectionState.allWords];
      displayWords(wordSelectionState.filteredWords);
      showMessage("Words refreshed.", "var(--primary)");
    });

  document.getElementById("random-word").addEventListener("click", () => {
    const arr = wordSelectionState.filteredWords;
    if (!arr.length) return alert("No words available. Try refreshing.");
    const idx = Math.floor(Math.random() * arr.length);
    const w = arr[idx];
    wordSelectionState.selectedWord = w.word;
    wordSelectionState.selectedCategory = w.category;
    DOM.selectedWordText.textContent = w.word;
    DOM.selectedCategoryText.textContent = w.category;
    DOM.customCategory.value = w.category;
    DOM.submitWordBtn.disabled = false;
    DOM.wordsContainer
      .querySelectorAll(".word-card")
      .forEach((c, i) => c.classList.toggle("selected", i === idx));
  });

  document
    .getElementById("cancel-word-selection")
    .addEventListener("click", () => {
      hideWordSelectionModal();
      showMessage("Word selection cancelled.");
      addRoomLog("Word selection cancelled.");
    });

  DOM.submitWordBtn.addEventListener("click", () => {
    const word = wordSelectionState.selectedWord;
    if (!word) return alert("Select a word first!");
    const category =
      DOM.customCategory.value.trim() ||
      wordSelectionState.selectedCategory ||
      "General";
    socket.emit("submitWord", DOM.roomCode.textContent, word, category);
    hideWordSelectionModal();
    showMessage(`You selected: ${word} (${category})`, "green");
    addRoomLog(`Word submitted: ${word} (${category})`);
  });

  DOM.customCategory.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    DOM.selectedCategoryText.textContent =
      val || wordSelectionState.selectedCategory;
    wordSelectionState.selectedCategory =
      val || wordSelectionState.selectedCategory;
  });

  DOM.resetBtn.addEventListener("click", () => {
    if (inRoom)
      socket.emit("startGame", DOM.roomCode.textContent, DOM.difficulty.value),
        addRoomLog("New game requested.");
  });

  DOM.difficulty.addEventListener("change", () => {
    if (inRoom && !gameState.isChooser) {
      gameState.remainingGuesses = getDifficulty();
      DOM.remainingGuesses.textContent = `Remaining guesses: ${gameState.remainingGuesses}`;
    }
    updateDifficultyDisplay();
    renderLeaderboard(getDifficultyLabel());
  });

  document.addEventListener("keydown", (e) => {
    if (!/^[a-z]$/i.test(e.key)) return;
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (!wordSelectionState.selectedWord) return;
    handleGuess(e.key.toUpperCase());
  });

  // -----------------------------
  // Initialize
  // -----------------------------
  initKeyboard();
  initializeTheme();
  updateDifficultyDisplay();
  DOM.remainingGuesses.textContent = `Remaining guesses: ${getDifficulty()}`;
  syncHeaderStats();
  renderLeaderboard(getDifficultyLabel());
});
