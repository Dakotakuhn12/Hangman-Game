const socket = io();

const roomCodeEl = document.getElementById("room-code");
const usernameInput = document.getElementById("username");

document.getElementById("create-room-btn").addEventListener("click", () => {
  const username = usernameInput.value.trim();
  if (!username) return alert("Enter a username");

  socket.emit("createRoom", username, (roomCode) => {
    roomCodeEl.textContent = roomCode;
    console.console.log(`Room created: ${roomCode} (you are the creator)`);
  });
});

document.getElementById("join-room-btn").addEventListener("click", () => {
  const username = usernameInput.value.trim();
  if (!username) return alert("Enter a username");

  const code = prompt("Enter room code:");
  if (!code) return;

  socket.emit("joinRoom", code.toUpperCase(), username, (response) => {
    if (response.success) {
      roomCodeEl.textContent = code.toUpperCase();
      console.log(`Joined room: ${code.toUpperCase()}`);
    } else {
      console.log(`Failed to join: ${response.message}`);
    }
  });
});

socket.on("connect", () => {
  console.log(`Connected to server (ID: ${socket.id})`);
});

socket.on("disconnect", (reason) => {
  console.log(`Disconnected from server: ${reason}`);
  alert("You were disconnected. The room may have closed if the creator left.");
});
