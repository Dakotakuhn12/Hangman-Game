import { words } from "./data.js";

document.addEventListener("DOMContentLoaded", async () => {
  // -----------------------------
  // DOM Elements
  // -----------------------------
  const difficultyDropdown = document.getElementById("diffictuly_drop");
  const wordDisplay = document.getElementById("word-display");
  const keyboard = document.getElementById("keyboard");
  const remainingGuessesEl = document.getElementById("remaining-guesses");
  const gameMessageEl = document.getElementById("game-message");
  const resetBtn = document.getElementById("reset-btn");
  const categoryContainer = document.getElementById("category");
  const hangmanParts = {
    head: document.getElementById("head"),
    body: document.getElementById("body"),
    leftArm: document.getElementById("left-arm"),
    rightArm: document.getElementById("right-arm"),
    leftLeg: document.getElementById("left-leg"),
    rightLeg: document.getElementById("right-leg"),
    face: document.getElementById("face"),
  };

  // -----------------------------
  // Game variables
  // -----------------------------
  let selectedWord = "";
  let correctLetters = [];
  let wrongLetters = [];
  let remainingGuesses;
  let gameOver = false;
  let difficulty;
  let isChooser = false;

  // -----------------------------
  // Socket
  // -----------------------------
  const socket = io();
  const roomCodeEl = document.getElementById("room-code");
  const usernameInput = document.getElementById("username");
  let inRoom = false;

  // -----------------------------
  // Socket Events
  // -----------------------------
  socket.on("connect", () => {
    console.log(`Connected to server (ID: ${socket.id})`);
  });

  socket.on("disconnect", (reason) => {
    console.warn(`Disconnected: ${reason}`);
    if (inRoom) alert("You were disconnected. The room may have closed.");
    inRoom = false;
  });

  // -----------------------------
  // Handle word chooser
  // -----------------------------
  socket.on("chooseWord", async () => {
    isChooser = true;
    const word = prompt(
      "You are the word chooser! Enter a word for others to guess:"
    );
    if (!word) return alert("You must enter a word!");

    const category =
      prompt("Optional: Enter a category for this word:") || "General";
    socket.emit("submitWord", roomCodeEl.textContent, word, category);
  });

  socket.on("waitForWord", () => {
    isChooser = false;
    alert("Waiting for the host to choose a word...");
  });

  // -----------------------------
  // Game started
  // -----------------------------
  socket.on("gameStarted", ({ word, category, chooserId }) => {
    selectedWord = word.toUpperCase();
    correctLetters = isChooser ? selectedWord.split("") : [];
    wrongLetters = [];
    remainingGuesses = getDifficulty(difficultyDropdown).remainingGuesses;
    gameOver = false;

    if (categoryContainer)
      categoryContainer.textContent = "Category: " + (category || "General");
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;

    // Reset hangman
    Object.values(hangmanParts).forEach(
      (part) => (part.style.display = "none")
    );

    // Initialize word display
    wordDisplay.innerHTML = "";
    selectedWord.split("").forEach((char) => {
      const letterEl = document.createElement("div");
      letterEl.classList.add("word-letter");
      letterEl.dataset.letter = char;
      letterEl.textContent = isChooser || /[^A-Z]/i.test(char) ? char : "_";
      if (!isChooser && /[^A-Z]/i.test(char)) correctLetters.push(char);
      wordDisplay.appendChild(letterEl);
    });

    // Initialize keyboard
    initKeyboard();
  });

  // -----------------------------
  // Create/join room
  // -----------------------------
  document.getElementById("create-room-btn").addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (!username) return alert("Enter a username");

    socket.emit("createRoom", username, (roomCode) => {
      if (!roomCode) return console.error("No room code returned");

      roomCodeEl.textContent = roomCode;
      inRoom = true;
      console.log(`Room created: ${roomCode} (you are the creator)`);
    });
  });

  document.getElementById("join-room-btn").addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (!username) return alert("Enter a username");

    const code = prompt("Enter room code:");
    if (!code) return;
    const normalizedCode = code.trim().toUpperCase();

    socket.emit("joinRoom", normalizedCode, username, (response) => {
      if (response.success) {
        roomCodeEl.textContent = normalizedCode;
        inRoom = true;
        console.log(`Joined room: ${normalizedCode}`);
      } else {
        alert(response.message);
      }
    });
  });

  document.getElementById("leave-room-btn").addEventListener("click", () => {
    if (!inRoom) return alert("You are not in a room.");
    socket.emit("leaveRoom", roomCodeEl.textContent, () => {
      roomCodeEl.textContent = "None";
      inRoom = false;
      console.log("Left the room");
    });
  });

  document.getElementById("start-game-btn").addEventListener("click", () => {
    if (!inRoom) return alert("You are not in a room.");
    // if not owner of room then you cant start it
    socket.emit("startGame", roomCodeEl.textContent);
  });

  // -----------------------------
  // Keyboard
  // -----------------------------
  function initKeyboard() {
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

  function handleGuess(letter) {
    if (
      gameOver ||
      correctLetters.includes(letter) ||
      wrongLetters.includes(letter) ||
      isChooser
    )
      return;

    if (selectedWord.includes(letter)) {
      correctLetters.push(letter);
      updateWordDisplay();
      document
        .querySelector(`.keyboard-letter[data-letter="${letter}"]`)
        ?.classList.add("correct", "used");

      if (checkWin()) {
        gameOver = true;
        gameMessageEl.textContent = "Congrats! You Won!";
        gameMessageEl.style.color = "green";
      }
    } else {
      wrongLetters.push(letter);
      remainingGuesses--;
      remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
      document
        .querySelector(`.keyboard-letter[data-letter="${letter}"]`)
        ?.classList.add("wrong", "used");

      updateHangmanDrawing();
      if (remainingGuesses === 0) {
        gameOver = true;
        gameMessageEl.textContent = `Game Over! The word was: ${selectedWord}`;
        gameMessageEl.style.color = "red";
        hangmanParts.face.style.display = "block";
        document
          .querySelectorAll(".word-letter")
          .forEach((el) => (el.textContent = el.dataset.letter));
      }
    }
  }

  function updateWordDisplay() {
    document.querySelectorAll(".word-letter").forEach((el) => {
      if (correctLetters.includes(el.dataset.letter))
        el.textContent = el.dataset.letter;
    });
  }

  function checkWin() {
    return selectedWord
      .split("")
      .every((letter) => letter === " " || correctLetters.includes(letter));
  }

  function updateHangmanDrawing() {
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

  // Keyboard typing support
  document.addEventListener("keydown", (e) => {
    if (!/^[a-z]$/i.test(e.key)) return;
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    handleGuess(e.key.toUpperCase());
  });

  // Reset button
  resetBtn.addEventListener("click", () => {
    if (inRoom) socket.emit("startGame", roomCodeEl.textContent);
  });

  // Difficulty handling
  difficultyDropdown.addEventListener("change", () => {
    remainingGuesses = getDifficulty(difficultyDropdown).remainingGuesses;
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
  });

  function getDifficulty(dropdown) {
    const diff = dropdown.value.toLowerCase();
    if (diff === "easy") return { difficulty: "Easy", remainingGuesses: 6 };
    if (diff === "medium") return { difficulty: "Medium", remainingGuesses: 5 };
    if (diff === "hard") return { difficulty: "Hard", remainingGuesses: 4 };
    if (diff === "advanced")
      return { difficulty: "Advanced", remainingGuesses: 3 };
  }
});
