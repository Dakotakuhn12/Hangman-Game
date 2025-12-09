const socket = io();

const roomCodeEl = document.getElementById("room-code");
const usernameInput = document.getElementById("username");

let inRoom = false;

// -------------------------------
// CREATE ROOM
// -------------------------------
document.getElementById("create-room-btn").addEventListener("click", () => {
  const username = usernameInput.value.trim();
  if (!username) return alert("Enter a username");

  socket.emit("createRoom", username, (roomCode) => {
    if (!roomCode) {
      console.error("Server did not return a room code.");
      return;
    }

    roomCodeEl.textContent = roomCode;
    inRoom = true;
    console.log(`Room created: ${roomCode} (you are the creator)`);

    // Optional: update UI here
    // enterGameScreen();
  });
});

// -------------------------------
// JOIN ROOM
// -------------------------------
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

      // Optional: update UI
      // enterGameScreen();
    } else {
      console.warn(`Failed to join: ${response.message}`);
      alert(response.message);
    }
  });
});

// -------------------------------
// CONNECTION HANDLING
// -------------------------------
socket.on("connect", () => {
  console.log(`Connected to server (ID: ${socket.id})`);
});

socket.on("chooseWord", () => {
  const word = prompt(
    "You are the word chooser! Enter a word for others to guess:"
  );
  if (word) {
    socket.emit("submitWord", roomCodeEl.textContent, word);
  }
});

socket.on("waitForWord", () => {
  alert("Waiting for the host to choose a word...");
});

// When game starts
socket.on("gameStarted", ({ wordLength, word, chooser }) => {
  // Initialize word display with underscores for non-choosers
  selectedWord = word;
  correctLetters = chooser === socket.id ? word.split("") : [];
  wrongLetters = [];
  remainingGuesses = 6; // or based on difficulty

  wordDisplay.innerHTML = "";
  word.split("").forEach((char) => {
    const letterEl = document.createElement("div");
    letterEl.classList.add("word-letter");
    letterEl.dataset.letter = char.toUpperCase();
    letterEl.textContent = chooser === socket.id ? char : "_";
    wordDisplay.appendChild(letterEl);
  });
});

socket.on("disconnect", (reason) => {
  console.warn(`Disconnected from server: ${reason}`);
  if (inRoom) {
    alert(
      "You were disconnected. The room may have closed if the creator left."
    );
    inRoom = false;
  }
});
