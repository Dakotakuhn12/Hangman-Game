const socket = io();

const roomCodeEl = document.getElementById("room-code");
const usernameInput = document.getElementById("username");

let inRoom = false

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
      inRoom = true
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

socket.on("disconnect", (reason) => {
  console.warn(`Disconnected from server: ${reason}`);
  if (inRoom) {
    alert(
      "You were disconnected. The room may have closed if the creator left."
    );
    inRoom = false
  }
});
