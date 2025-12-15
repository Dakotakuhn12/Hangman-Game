import { generateRoomCode } from "../utils/utils.js";

export function setupRooms(io) {
  const rooms = {}; // roomCode -> { creator, players: [{id, username}], wordChooserId, word, category, correctLetters, wrongLetters, remainingGuesses, gameOver }

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    function updateRoomPlayers(roomCode) {
      const room = rooms[roomCode];
      if (!room) return;

      io.to(roomCode).emit("updatePlayers", room.players, room.creator);
    }

    function broadcastGameState(roomCode) {
      const room = rooms[roomCode];
      if (!room) return;

      io.to(roomCode).emit("updateGameState", {
        correctLetters: room.correctLetters,
        wrongLetters: room.wrongLetters,
        remainingGuesses: room.remainingGuesses,
        gameOver: room.gameOver,
        selectedWord: room.word,
      });
    }

    socket.on("createRoom", (username, callback) => {
      let roomCode;
      do {
        roomCode = generateRoomCode();
      } while (rooms[roomCode]);

      rooms[roomCode] = {
        creator: socket.id,
        players: [{ id: socket.id, username }],
        wordChooserId: null,
        word: null,
        category: "General",
        correctLetters: [],
        wrongLetters: [],
        remainingGuesses: 6,
        gameOver: false,
      };
      socket.join(roomCode);

      console.log(`${username} (${socket.id}) created room ${roomCode}`);
      callback(roomCode);
      updateRoomPlayers(roomCode);
      socket.emit("logMessage", `Welcome to room ${roomCode}!`);
    });

    socket.on("joinRoom", (roomCode, username, callback) => {
      const room = rooms[roomCode];
      if (room) {
        // Check if username already exists in room
        const usernameExists = room.players.some(
          (p) => p.username === username
        );
        if (usernameExists) {
          callback({
            success: false,
            message: "Username already taken in this room",
          });
          return;
        }

        room.players.push({ id: socket.id, username });
        socket.join(roomCode);

        console.log(`${username} (${socket.id}) joined room ${roomCode}`);
        io.to(roomCode).emit("logMessage", `${username} has joined the room!`);
        callback({ success: true });
        updateRoomPlayers(roomCode);

        // Send current game state to new player if game is in progress
        if (room.word) {
          socket.emit("gameStarted", {
            word: room.word,
            category: room.category,
          });

          setTimeout(() => {
            broadcastGameState(roomCode);
          }, 100);
        }
      } else {
        callback({ success: false, message: "Room not found" });
      }
    });

    socket.on("startGame", (roomCode, difficulty = "easy") => {
      const room = rooms[roomCode];
      if (!room) return;

      // Only creator can start the game
      if (socket.id !== room.creator) {
        socket.emit("logMessage", "Only the room creator can start the game!");
        return;
      }

      // Convert difficulty to guesses
      const difficultyMap = {
        easy: 6,
        medium: 5,
        hard: 4,
        advanced: 3,
      };
      room.remainingGuesses = difficultyMap[difficulty] || 6;

      // Pick a word chooser randomly
      let chooser;
      do {
        chooser = room.players[Math.floor(Math.random() * room.players.length)];
      } while (chooser.id === room.wordChooserId && room.players.length > 1);

      room.wordChooserId = chooser.id;

      room.correctLetters = [];
      room.wrongLetters = [];
      room.gameOver = false;
      room.word = null;
      room.category = "General";

      io.to(roomCode).emit(
        "logMessage",
        `Game started! Difficulty: ${difficulty}`
      );

      room.players.forEach((player) => {
        if (player.id === room.wordChooserId) {
          io.to(player.id).emit("chooseWord");
        } else {
          io.to(player.id).emit("waitForWord");
        }
      });
    });

    socket.on("submitWord", (roomCode, word, category = "General") => {
      const room = rooms[roomCode];
      if (!room || socket.id !== room.wordChooserId) return;

      room.word = word.toUpperCase();
      room.category = category;
      room.correctLetters = [];
      room.wrongLetters = [];
      room.gameOver = false;

      io.to(roomCode).emit(
        "logMessage",
        `Word submitted! Category: ${category}`
      );
      io.to(roomCode).emit("gameStarted", {
        word: word,
        category,
      });

      broadcastGameState(roomCode);
    });

    // Handle guesses from players
    socket.on("playerGuess", (roomCode, letter) => {
      const room = rooms[roomCode];
      if (!room || room.gameOver || socket.id === room.wordChooserId) return;

      letter = letter.toUpperCase();
      if (
        room.correctLetters.includes(letter) ||
        room.wrongLetters.includes(letter)
      )
        return;

      io.to(roomCode).emit("logMessage", `${socket.id} guessed: ${letter}`);

      if (room.word.includes(letter)) {
        room.correctLetters.push(letter);
      } else {
        room.wrongLetters.push(letter);
        room.remainingGuesses--;
      }

      // Check for win/loss
      const allLettersGuessed = room.word
        .split("")
        .every((c) => /[^A-Z]/i.test(c) || room.correctLetters.includes(c));
      if (allLettersGuessed) {
        room.gameOver = true;
        io.to(roomCode).emit(
          "logMessage",
          "🎉 All letters guessed! Players win!"
        );
      }
      if (room.remainingGuesses <= 0) {
        room.gameOver = true;
        io.to(roomCode).emit("logMessage", "💀 No guesses left! Players lose!");
      }

      broadcastGameState(roomCode);
    });

    socket.on("leaveRoom", (roomCode, callback) => {
      const room = rooms[roomCode];
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      console.log(room.players);
      room.players = room.players.filter((p) => p.id !== socket.id);
      console.log(room.players);
      socket.leave(roomCode);
      console.log(room.players);

      if (socket.id === room.creator) {
        // Host leaves - assign new creator if there are other players
        if (room.players.length > 0) {
          room.creator = room.players[0].id;
          io.to(roomCode).emit(
            "logMessage",
            `${player?.username || "Host"} left. ${
              room.players[0].username
            } is now the host.`
          );
        } else {
          // Close the room
          io.to(roomCode).emit("logMessage", "Room closed!");
          delete rooms[roomCode];
        }
      } else {
        io.to(roomCode).emit(
          "logMessage",
          `${player?.username || "A player"} left the room`
        );
      }

      updateRoomPlayers(roomCode);
      callback();
    });

    socket.on("getGameState", (roomCode) => {
      const room = rooms[roomCode];
      if (room && room.word) {
        socket.emit("updateGameState", {
          correctLetters: room.correctLetters,
          wrongLetters: room.wrongLetters,
          remainingGuesses: room.remainingGuesses,
          gameOver: room.gameOver,
          selectedWord: room.word,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      for (const [roomCode, room] of Object.entries(rooms)) {
        const player = room.players.find((p) => p.id === socket.id);
        if (!player) continue;

        if (socket.id === room.creator) {
          // Host disconnects - assign new creator
          room.players = room.players.filter((p) => p.id !== socket.id);
          if (room.players.length > 0) {
            room.creator = room.players[0].id;
            io.to(roomCode).emit(
              "logMessage",
              `${player.username} (host) disconnected. ${room.players[0].username} is now the host.`
            );
            updateRoomPlayers(roomCode);
          } else {
            // Room is empty, delete it
            delete rooms[roomCode];
          }
        } else {
          room.players = room.players.filter((p) => p.id !== socket.id);
          io.to(roomCode).emit(
            "logMessage",
            `${player.username} has disconnected.`
          );
          updateRoomPlayers(roomCode);
        }

        // If word chooser leaves, assign new one if game is active
        if (socket.id === room.wordChooserId && room.word) {
          if (room.players.length > 0) {
            room.wordChooserId = room.players[0].id;
            io.to(room.wordChooserId).emit(
              "logMessage",
              "You are now the word chooser for the next round."
            );
          }
        }
      }
    });
  });
}
