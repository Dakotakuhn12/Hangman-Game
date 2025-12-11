document.addEventListener("DOMContentLoaded", () => {
  // -----------------------------
  // DOM Elements
  // -----------------------------
  const usernameInput = document.getElementById("username");
  const roomCodeEl = document.getElementById("room-code");
  const playerListEl = document.getElementById("player-list");
  const difficultyDropdown = document.getElementById("difficulty_drop");
  const wordDisplay = document.getElementById("word-display");
  const keyboardContainer = document.getElementById("keyboard");
  const remainingGuessesEl = document.getElementById("remaining-guesses");
  const gameMessageEl = document.getElementById("game-message");
  const resetBtn = document.getElementById("reset-btn");
  const categoryContainer = document.getElementById("category");
  const roomLogEl = document.getElementById("room-log");

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
  let gameState = {
    selectedWord: "",
    correctLetters: [],
    wrongLetters: [],
    remainingGuesses: 0,
    gameOver: false,
    isChooser: false,
    category: "General",
  };

  // -----------------------------
  // Word Selection State
  // -----------------------------
  let wordSelectionState = {
    selectedWord: null,
    selectedCategory: "General",
    allWords: [],
    filteredWords: [],
  };

  let inRoom = false;
  const socket = io();
  let keyboardButtons = new Map();

  // -----------------------------
  // Helper Functions
  // -----------------------------
  const getDifficulty = () => {
    switch (difficultyDropdown.value.toLowerCase()) {
      case "easy":
        return 6;
      case "medium":
        return 5;
      case "hard":
        return 4;
      case "advanced":
        return 3;
      default:
        return 6;
    }
  };

  function updateHangman() {
    hangmanOrder.forEach((part, i) => {
      part.style.display = i < gameState.wrongLetters.length ? "block" : "none";
    });
  }

  function updateWordDisplay() {
    wordDisplay.innerHTML = "";
    gameState.selectedWord.split("").forEach((char) => {
      const letterEl = document.createElement("div");
      letterEl.classList.add("word-letter");
      letterEl.dataset.letter = char;

      if (gameState.isChooser) {
        // Word chooser sees the full word
        letterEl.textContent = char;
        letterEl.classList.add("chooser-letter");
      } else if (/[^A-Z]/i.test(char)) {
        // Non-letter characters (spaces, punctuation)
        letterEl.textContent = char;
        if (!gameState.correctLetters.includes(char)) {
          gameState.correctLetters.push(char);
        }
      } else {
        // Regular letters
        letterEl.textContent = gameState.correctLetters.includes(char)
          ? char
          : "_";
      }
      wordDisplay.appendChild(letterEl);
    });
  }

  function checkWin() {
    return gameState.selectedWord
      .split("")
      .every((c) => /[^A-Z]/i.test(c) || gameState.correctLetters.includes(c));
  }

  function showMessage(msg, color = "var(--primary)") {
    gameMessageEl.textContent = msg;
    gameMessageEl.style.color = color;
  }

  function addRoomLog(message) {
    if (!roomLogEl) return;

    const entry = document.createElement("div");
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    entry.textContent = `[${timeStr}] ${message}`;
    roomLogEl.appendChild(entry);
    roomLogEl.scrollTop = roomLogEl.scrollHeight;
  }

  function handleGuess(letter) {
    if (gameState.gameOver || gameState.isChooser) return;
    if (
      gameState.correctLetters.includes(letter) ||
      gameState.wrongLetters.includes(letter)
    )
      return;

    // Emit guess to server
    socket.emit("playerGuess", roomCodeEl.textContent, letter);
  }

  function initKeyboard() {
    keyboardContainer.innerHTML = "";
    keyboardButtons.clear();
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const keyEl = document.createElement("button");
      keyEl.classList.add("keyboard-letter");
      keyEl.textContent = letter;
      keyEl.dataset.letter = letter;
      keyEl.addEventListener("click", () => handleGuess(letter));
      keyboardContainer.appendChild(keyEl);
      keyboardButtons.set(letter, keyEl);
    }
  }

  function resetGame(word = "", category = "General") {
    gameState.selectedWord = word.toUpperCase();
    gameState.category = category;
    gameState.correctLetters = gameState.isChooser ? word.split("") : [];
    gameState.wrongLetters = [];
    gameState.remainingGuesses = getDifficulty();
    gameState.gameOver = false;

    remainingGuessesEl.textContent = `Remaining guesses: ${gameState.remainingGuesses}`;
    categoryContainer.textContent = `Category: ${category}`;

    Object.values(hangmanParts).forEach(
      (part) => (part.style.display = "none")
    );

    if (word) {
      updateWordDisplay();
      initKeyboard();
      showMessage("Game started! Make your guesses.", "var(--primary)");
    }
  }

  // -----------------------------
  // Word Selection Functions
  // -----------------------------
  async function fetchWordsFromDB() {
    try {
      showMessage("Loading words...", "var(--primary)");
      const response = await fetch("/api/words");
      if (!response.ok) throw new Error("Failed to fetch words");

      const data = await response.json();
      wordSelectionState.allWords = data;
      wordSelectionState.filteredWords = [...data];
      showMessage("");
      return data;
    } catch (err) {
      console.error("Error fetching words:", err);
      showMessage("Failed to load words. Using default words.", "red");
      return getFallbackWords();
    }
  }

  function getFallbackWords() {
    return [
      { word: "ELEPHANT", category: "Animals" },
      { word: "PYTHON", category: "Programming" },
      { word: "JAVASCRIPT", category: "Programming" },
      { word: "PIZZA", category: "Food" },
      { word: "SUSHI", category: "Food" },
      { word: "MOUNTAIN", category: "Geography" },
      { word: "GUITAR", category: "Music" },
      { word: "PIANO", category: "Music" },
      { word: "BUTTERFLY", category: "Animals" },
      { word: "KANGAROO", category: "Animals" },
      { word: "CHOCOLATE", category: "Food" },
      { word: "BASKETBALL", category: "Sports" },
      { word: "FOOTBALL", category: "Sports" },
      { word: "LIBRARY", category: "Places" },
      { word: "HOSPITAL", category: "Places" },
      { word: "COMPUTER", category: "Technology" },
      { word: "KEYBOARD", category: "Technology" },
      { word: "SUNFLOWER", category: "Plants" },
      { word: "TELESCOPE", category: "Science" },
      { word: "VOLCANO", category: "Geography" },
    ];
  }

  function displayWords(words) {
    const wordsContainer = document.getElementById("words-container");
    wordsContainer.innerHTML = "";

    words.forEach((item, index) => {
      const wordCard = document.createElement("div");
      wordCard.className = "word-card";
      if (wordSelectionState.selectedWord === item.word) {
        wordCard.classList.add("selected");
      }

      wordCard.innerHTML = `
        <div>${item.word}</div>
        <span class="word-category">${item.category}</span>
      `;

      wordCard.addEventListener("click", () => {
        // Remove selection from all cards
        document.querySelectorAll(".word-card").forEach((card) => {
          card.classList.remove("selected");
        });

        // Select this card
        wordCard.classList.add("selected");
        wordSelectionState.selectedWord = item.word;
        wordSelectionState.selectedCategory = item.category;

        // Update display
        document.getElementById("selected-word-text").textContent = item.word;
        document.getElementById("selected-category-text").textContent =
          item.category;
        document.getElementById("custom-category").value = item.category;

        // Enable submit button
        document.getElementById("submit-selected-word").disabled = false;
      });

      wordsContainer.appendChild(wordCard);
    });
  }

  function filterWords() {
    const searchTerm = document
      .getElementById("word-search")
      .value.toLowerCase();
    const selectedCategory = document.getElementById("category-filter").value;

    wordSelectionState.filteredWords = wordSelectionState.allWords.filter(
      (item) => {
        const matchesSearch = item.word.toLowerCase().includes(searchTerm);
        const matchesCategory =
          selectedCategory === "all" || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
      }
    );

    displayWords(wordSelectionState.filteredWords);
  }

  function showWordSelectionModal() {
    const modal = document.getElementById("word-selection-modal");
    modal.style.display = "flex";

    // Reset selection
    wordSelectionState.selectedWord = null;
    wordSelectionState.selectedCategory = "General";

    // Update UI
    document.getElementById("selected-word-text").textContent = "None";
    document.getElementById("selected-category-text").textContent = "General";
    document.getElementById("custom-category").value = "";
    document.getElementById("submit-selected-word").disabled = true;

    // Fetch and display words
    fetchWordsFromDB().then((words) => {
      wordSelectionState.allWords = words;
      filterWords();
    });
  }

  function hideWordSelectionModal() {
    const modal = document.getElementById("word-selection-modal");
    modal.style.display = "none";
  }

  // -----------------------------
  // Socket Events
  // -----------------------------
  socket.on("connect", () => {
    console.log(`Connected: ${socket.id}`);
    addRoomLog("Connected to server.");
  });

  socket.on("updatePlayers", (players, creatorId) => {
    playerListEl.innerHTML = "";
    players.forEach((p) => {
      const li = document.createElement("li");
      li.className = "player-list-item";

      let playerText = p.username;
      if (p.id === socket.id) playerText += " (You)";
      if (p.id === creatorId) {
        playerText += " ⭐";
        li.classList.add("player-creator");
      }

      li.textContent = playerText;
      playerListEl.appendChild(li);
    });
  });

  socket.on("chooseWord", () => {
    gameState.isChooser = true;
    showWordSelectionModal();
    addRoomLog("You are the word chooser!");
  });

  socket.on("waitForWord", () => {
    gameState.isChooser = false;
    showMessage("Waiting for host to choose a word...", "var(--primary)");
  });

  socket.on("gameStarted", ({ word, category }) => {
    addRoomLog(`Game started! Category: ${category}`);
    resetGame(word, category);
  });

  socket.on("updateGameState", (state) => {
    // Update local game state from server
    gameState.correctLetters = state.correctLetters;
    gameState.wrongLetters = state.wrongLetters;
    gameState.remainingGuesses = state.remainingGuesses;
    gameState.gameOver = state.gameOver;

    if (state.selectedWord) {
      gameState.selectedWord = state.selectedWord;
    }

    // Update UI
    remainingGuessesEl.textContent = `Remaining guesses: ${gameState.remainingGuesses}`;
    updateHangman();
    updateWordDisplay();

    // Update keyboard
    keyboardButtons.forEach((btn, letter) => {
      btn.classList.remove("correct", "wrong", "used");
      btn.disabled = false;

      if (gameState.correctLetters.includes(letter)) {
        btn.classList.add("correct", "used");
      } else if (gameState.wrongLetters.includes(letter)) {
        btn.classList.add("wrong", "used");
        btn.disabled = true;
      }
    });

    // Check win/lose
    if (gameState.gameOver) {
      if (checkWin()) {
        showMessage("🎉 Congrats! You Won!", "green");
        addRoomLog("Game over - Players won!");
      } else {
        showMessage(`💀 Game Over! Word was: ${gameState.selectedWord}`, "red");
        addRoomLog("Game over - Players lost!");
        hangmanParts.face.style.display = "block";
      }
    }
  });

  socket.on("logMessage", (message) => {
    addRoomLog(message);
  });

  // -----------------------------
  // UI Events
  // -----------------------------
  document.getElementById("create-room-btn").addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (!username) return alert("Enter a username");
    socket.emit("createRoom", username, (roomCode) => {
      roomCodeEl.textContent = roomCode;
      inRoom = true;
      addRoomLog(`Room created: ${roomCode}`);
    });
  });

  document.getElementById("join-room-btn").addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (!username) return alert("Enter a username");
    const code = prompt("Enter room code:").trim().toUpperCase();
    if (!code) return;
    socket.emit("joinRoom", code, username, (response) => {
      if (response.success) {
        roomCodeEl.textContent = code;
        inRoom = true;
        addRoomLog(`Joined room: ${code}`);
      } else {
        alert(response.message);
        addRoomLog(`Failed to join room: ${response.message}`);
      }
    });
  });

  document.getElementById("leave-room-btn").addEventListener("click", () => {
    if (!inRoom) return alert("You are not in a room.");
    socket.emit("leaveRoom", roomCodeEl.textContent, () => {
      roomCodeEl.textContent = "None";
      inRoom = false;
      addRoomLog("Left the room.");
      gameState.isChooser = false;
      showMessage("");
    });
  });

  document.getElementById("start-game-btn").addEventListener("click", () => {
    if (!inRoom) return alert("You are not in a room.");
    const difficulty = difficultyDropdown.value;
    socket.emit("startGame", roomCodeEl.textContent, difficulty);
    addRoomLog("Game starting...");
  });

  // Modal Event Listeners
  document.getElementById("word-search").addEventListener("input", filterWords);
  document
    .getElementById("category-filter")
    .addEventListener("change", filterWords);

  document.getElementById("refresh-words").addEventListener("click", () => {
    fetchWordsFromDB().then(filterWords);
  });

  document.getElementById("random-word").addEventListener("click", () => {
    if (wordSelectionState.filteredWords.length === 0) {
      alert("No words available. Try refreshing.");
      return;
    }

    const randomIndex = Math.floor(
      Math.random() * wordSelectionState.filteredWords.length
    );
    const randomWord = wordSelectionState.filteredWords[randomIndex];

    // Auto-select this word
    wordSelectionState.selectedWord = randomWord.word;
    wordSelectionState.selectedCategory = randomWord.category;

    // Update UI
    document.getElementById("selected-word-text").textContent = randomWord.word;
    document.getElementById("selected-category-text").textContent =
      randomWord.category;
    document.getElementById("custom-category").value = randomWord.category;
    document.getElementById("submit-selected-word").disabled = false;

    // Highlight the word card
    document.querySelectorAll(".word-card").forEach((card, index) => {
      card.classList.remove("selected");
      if (index === randomIndex) {
        card.classList.add("selected");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  document
    .getElementById("cancel-word-selection")
    .addEventListener("click", () => {
      hideWordSelectionModal();
      showMessage("Word selection cancelled.", "var(--primary)");
      addRoomLog("Word selection cancelled.");
    });

  document
    .getElementById("submit-selected-word")
    .addEventListener("click", () => {
      const word = wordSelectionState.selectedWord;
      let category = document.getElementById("custom-category").value.trim();

      if (!word) {
        alert("Please select a word first!");
        return;
      }

      if (!category) {
        category = wordSelectionState.selectedCategory || "General";
      }

      // Emit the selected word to server
      socket.emit("submitWord", roomCodeEl.textContent, word, category);

      hideWordSelectionModal();
      showMessage(`You selected: ${word} (${category})`, "green");
      addRoomLog(`Word submitted: ${word} (${category})`);
    });

  document.getElementById("custom-category").addEventListener("input", (e) => {
    const customCategory = e.target.value.trim();
    if (customCategory) {
      document.getElementById("selected-category-text").textContent =
        customCategory;
      wordSelectionState.selectedCategory = customCategory;
    }
  });

  resetBtn.addEventListener("click", () => {
    if (inRoom) {
      socket.emit(
        "startGame",
        roomCodeEl.textContent,
        difficultyDropdown.value
      );
      addRoomLog("New game requested.");
    }
  });

  difficultyDropdown.addEventListener("change", () => {
    if (inRoom && !gameState.isChooser) {
      gameState.remainingGuesses = getDifficulty();
      remainingGuessesEl.textContent = `Remaining guesses: ${gameState.remainingGuesses}`;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!/^[a-z]$/i.test(e.key)) return;
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    handleGuess(e.key.toUpperCase());
  });

  // Initialize keyboard
  initKeyboard();
  remainingGuessesEl.textContent = `Remaining guesses: ${getDifficulty()}`;
});
