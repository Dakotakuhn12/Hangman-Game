import { generateRoomCode } from "../utils/utils.js";
import { connectDB, getDb } from "../utils/db.js";

export function setupRooms(io) {
  const rooms = {};
  let cachedWords = null;
  let lastFetchTime = 0;
  const CACHE_DURATION = 5 * 60 * 1000;
  const MULTIPLAYER_TIME_LIMIT = 90;

  function clearRoomTimer(room) {
    if (room?.roundTimer) {
      clearInterval(room.roundTimer);
      room.roundTimer = null;
    }
  }

  async function getRandomWord() {
    const now = Date.now();

    if (!cachedWords || now - lastFetchTime >= CACHE_DURATION) {
      await connectDB();
      const db = getDb("words");
      const collectionsInfo = await db.listCollections().toArray();
      const collectionNames = collectionsInfo.map((collection) => collection.name);

      let allWords = [];

      for (const name of collectionNames) {
        const collection = db.collection(name);
        const docs = await collection.find({}).toArray();
        const wordsWithCategory = docs.map((doc) => ({
          ...doc,
          category: name,
        }));

        allWords.push(...wordsWithCategory);
      }

      cachedWords = allWords;
      lastFetchTime = now;
    }

    if (!cachedWords?.length) {
      throw new Error("No words available for multiplayer");
    }

    return cachedWords[Math.floor(Math.random() * cachedWords.length)];
  }

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
        remainingTime: room.remainingTime,
        gameOver: room.gameOver,
        selectedWord: room.word,
        roundEndReason: room.roundEndReason,
        firstSolverName: room.firstSolverName,
      });
    }

    function endRound(roomCode, reason, firstSolverName = "") {
      const room = rooms[roomCode];
      if (!room || room.gameOver) return;

      room.gameOver = true;
      room.roundEndReason = reason;
      room.firstSolverName = firstSolverName;
      clearRoomTimer(room);

      if (reason === "solved") {
        io.to(roomCode).emit(
          "logMessage",
          `Round complete! ${firstSolverName || "A player"} solved it first.`,
        );
      } else if (reason === "timer") {
        io.to(roomCode).emit("logMessage", "Time ran out! Round over.");
      } else if (reason === "guesses") {
        io.to(roomCode).emit("logMessage", "No guesses left! Round over.");
      }

      broadcastGameState(roomCode);
    }

    socket.on("createRoom", (username, callback) => {
      let roomCode;
      do {
        roomCode = generateRoomCode();
      } while (rooms[roomCode]);

      rooms[roomCode] = {
        creator: socket.id,
        players: [{ id: socket.id, username }],
        word: null,
        category: "General",
        correctLetters: [],
        wrongLetters: [],
        remainingGuesses: 6,
        remainingTime: MULTIPLAYER_TIME_LIMIT,
        gameOver: false,
        roundEndReason: null,
        firstSolverName: "",
        roundTimer: null,
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
        const usernameExists = room.players.some((p) => p.username === username);
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

    socket.on("startGame", async (roomCode, difficulty = "easy") => {
      const room = rooms[roomCode];
      if (!room) return;

      if (socket.id !== room.creator) {
        socket.emit("logMessage", "Only the room creator can start the game!");
        return;
      }

      const difficultyMap = {
        easy: 6,
        medium: 5,
        hard: 4,
        advanced: 3,
      };
      room.remainingGuesses = difficultyMap[difficulty] || 6;
      room.remainingTime = MULTIPLAYER_TIME_LIMIT;

      clearRoomTimer(room);
      room.correctLetters = [];
      room.wrongLetters = [];
      room.gameOver = false;
      room.category = "General";
      room.roundEndReason = null;
      room.firstSolverName = "";

      try {
        const randomWord = await getRandomWord();
        room.word = randomWord.word.toUpperCase();
        room.category = randomWord.category || "General";

        io.to(roomCode).emit(
          "logMessage",
          `Game started! Difficulty: ${difficulty} | Category: ${room.category}`,
        );
        io.to(roomCode).emit("gameStarted", {
          word: room.word,
          category: room.category,
        });

        broadcastGameState(roomCode);

        room.roundTimer = setInterval(() => {
          if (!rooms[roomCode] || room.gameOver) {
            clearRoomTimer(room);
            return;
          }

          room.remainingTime--;

          if (room.remainingTime <= 0) {
            room.remainingTime = 0;
            endRound(roomCode, "timer", room.firstSolverName);
            return;
          }

          broadcastGameState(roomCode);
        }, 1000);
      } catch (error) {
        console.error("Failed to start multiplayer game:", error);
        socket.emit(
          "logMessage",
          "Unable to start multiplayer game because no words were available.",
        );
      }
    });

    socket.on("playerGuess", (roomCode, letter) => {
      const room = rooms[roomCode];
      if (!room || room.gameOver || !room.word) return;
      const player = room.players.find((p) => p.id === socket.id);

      letter = letter.toUpperCase();
      if (
        room.correctLetters.includes(letter) ||
        room.wrongLetters.includes(letter)
      ) {
        return;
      }

      io.to(roomCode).emit(
        "logMessage",
        `${player?.username || socket.id} guessed: ${letter}`,
      );

      if (room.word.includes(letter)) {
        room.correctLetters.push(letter);
      } else {
        room.wrongLetters.push(letter);
        room.remainingGuesses--;
      }

      const allLettersGuessed = room.word
        .split("")
        .every((char) => /[^A-Z]/i.test(char) || room.correctLetters.includes(char));

      if (allLettersGuessed) {
        endRound(roomCode, "solved", player?.username || "Unknown");
        return;
      }

      if (room.remainingGuesses <= 0) {
        endRound(roomCode, "guesses", room.firstSolverName);
        return;
      }

      broadcastGameState(roomCode);
    });

    socket.on("leaveRoom", (roomCode, callback) => {
      const room = rooms[roomCode];
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      room.players = room.players.filter((p) => p.id !== socket.id);
      socket.leave(roomCode);

      if (socket.id === room.creator) {
        if (room.players.length > 0) {
          room.creator = room.players[0].id;
          io.to(roomCode).emit(
            "logMessage",
            `${player?.username || "Host"} left. ${
              room.players[0].username
            } is now the host.`,
          );
        } else {
          clearRoomTimer(room);
          io.to(roomCode).emit("logMessage", "Room closed!");
          delete rooms[roomCode];
        }
      } else {
        io.to(roomCode).emit(
          "logMessage",
          `${player?.username || "A player"} left the room`,
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
          remainingTime: room.remainingTime,
          gameOver: room.gameOver,
          selectedWord: room.word,
          roundEndReason: room.roundEndReason,
          firstSolverName: room.firstSolverName,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      for (const [roomCode, room] of Object.entries(rooms)) {
        const player = room.players.find((p) => p.id === socket.id);
        if (!player) continue;

        if (socket.id === room.creator) {
          room.players = room.players.filter((p) => p.id !== socket.id);
          if (room.players.length > 0) {
            room.creator = room.players[0].id;
            io.to(roomCode).emit(
              "logMessage",
              `${player.username} (host) disconnected. ${room.players[0].username} is now the host.`,
            );
            updateRoomPlayers(roomCode);
          } else {
            clearRoomTimer(room);
            delete rooms[roomCode];
          }
        } else {
          room.players = room.players.filter((p) => p.id !== socket.id);
          io.to(roomCode).emit(
            "logMessage",
            `${player.username} has disconnected.`,
          );
          updateRoomPlayers(roomCode);
        }
      }
    });
  });
}
