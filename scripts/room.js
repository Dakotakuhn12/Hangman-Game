import { generateRoomCode } from "./utils.js";

export function setupRooms(io) {
  const rooms = {}; // roomCode -> { creator, players: [{id, username}] }

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Store username when creating or joining a room
    socket.on("createRoom", (username, callback) => {
      let roomCode;
      do {
        roomCode = generateRoomCode();
      } while (rooms[roomCode]);

      rooms[roomCode] = {
        creator: socket.id,
        players: [{ id: socket.id, username }],
      };
      socket.join(roomCode);

      console.log(`${username} (${socket.id}) created room ${roomCode}`);
      callback(roomCode);
    });

    socket.on("joinRoom", (roomCode, username, callback) => {
      if (rooms[roomCode]) {
        rooms[roomCode].players.push({ id: socket.id, username });
        socket.join(roomCode);

        console.log(`${username} (${socket.id}) joined room ${roomCode}`);

        // Notify everyone else in the room
        socket
          .to(roomCode)
          .emit("logMessage", `${username} has joined the room!`);

        callback({ success: true });
      } else {
        callback({ success: false, message: "Room not found" });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      for (const [roomCode, room] of Object.entries(rooms)) {
        const player = room.players.find((p) => p.id === socket.id);

        if (!player) continue; // skip rooms where they weren't present

        const username = player.username;

        if (room.creator === socket.id) {
          console.log(
            `Creator ${username} (${socket.id}) disconnected. Closing room ${roomCode}`
          );

          // Notify everyone else
          socket.to(roomCode).emit("logMessage", "Host left, room closed!");

          // Disconnect all other players
          room.players.forEach((p) => {
            if (p.id !== socket.id) {
              io.sockets.sockets.get(p.id)?.disconnect(true);
            }
          });

          delete rooms[roomCode];
          break;
        } else {
          // Normal player leaves
          room.players = room.players.filter((p) => p.id !== socket.id);
          socket
            .to(roomCode)
            .emit("logMessage", `${username} has left the room.`);
        }
      }
    });
  });
}
