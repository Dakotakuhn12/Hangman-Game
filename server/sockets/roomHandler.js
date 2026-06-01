import { generateRoomCode } from "../utils/utils.js";
import { connectDB, getDb } from "../utils/db.js";

export function setupRooms(io) {
  const rooms = {};
  let cachedWords = null;
  let lastFetchTime = 0;
  const CACHE_DURATION = 5 * 60 * 1000;
  const MULTIPLAYER_TIME_LIMIT = 90;
  const WORD_MASTER_TOTAL_ROUNDS = 10;
  const difficultyMap = {
    easy: 6,
    medium: 5,
    hard: 4,
    advanced: 3,
  };

  function getDifficultyGuesses(difficulty = "easy") {
    return difficultyMap[difficulty] || 6;
  }

  function getDifficultyBonus(difficulty = "easy") {
    return {
      easy: 40,
      medium: 70,
      hard: 100,
      advanced: 140,
    }[difficulty] || 40;
  }

  function sanitizeChosenWord(word = "") {
    return word
      .trim()
      .toUpperCase()
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/\s+/g, " ");
  }

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

    function ensureWordMasterScores(room) {
      room.wordMasterPendingScores ||= {};
      room.players.forEach((player) => {
        room.wordMasterPendingScores[player.id] ??= 0;
      });
    }

    function getPublicWordMasterScores(room, includeScores = false) {
      ensureWordMasterScores(room);
      const source = includeScores
        ? room.wordMasterScores || room.wordMasterPendingScores
        : {};

      return room.players.map((player) => ({
        id: player.id,
        username: player.username,
        score: source[player.id] || 0,
      }));
    }

    function resetWordMasterMatch(room) {
      room.wordMasterRound = 0;
      room.wordMasterTotalRounds = WORD_MASTER_TOTAL_ROUNDS;
      room.wordMasterMatchActive = true;
      room.wordMasterMatchOver = false;
      room.wordMasterScores = {};
      room.wordMasterPendingScores = {};
      room.chooserIndex = -1;
      ensureWordMasterScores(room);
    }

    function broadcastWordMasterState(roomCode) {
      const room = rooms[roomCode];
      if (!room) return;

      io.to(roomCode).emit("wordMasterState", {
        players: room.players,
        creatorId: room.creator,
        chooserId: room.chooserId || "",
        chooserName: room.chooserName || "",
        scores: getPublicWordMasterScores(room, room.wordMasterMatchOver),
        currentRound: room.wordMasterRound || 0,
        totalRounds: room.wordMasterTotalRounds || WORD_MASTER_TOTAL_ROUNDS,
        matchActive: Boolean(room.wordMasterMatchActive),
        matchOver: Boolean(room.wordMasterMatchOver),
        selectedWord: room.word || "",
        category: room.category || "General",
        correctLetters: room.correctLetters,
        wrongLetters: room.wrongLetters,
        remainingGuesses: room.remainingGuesses,
        remainingTime: room.remainingTime,
        gameOver: room.gameOver,
        roundEndReason: room.roundEndReason,
        firstSolverName: room.firstSolverName,
        waitingForWord: Boolean(room.waitingForWord),
      });
    }

    function clearWordMasterRound(room) {
      clearRoomTimer(room);
      room.word = null;
      room.category = "General";
      room.correctLetters = [];
      room.wrongLetters = [];
      room.remainingTime = MULTIPLAYER_TIME_LIMIT;
      room.gameOver = false;
      room.roundEndReason = null;
      room.firstSolverName = "";
      room.waitingForWord = false;
    }

    function endWordMasterRound(roomCode, reason, firstSolverName = "") {
      const room = rooms[roomCode];
      if (!room || room.gameOver) return;

      room.gameOver = true;
      room.roundEndReason = reason;
      room.firstSolverName = firstSolverName;
      room.waitingForWord = false;
      clearRoomTimer(room);
      ensureWordMasterScores(room);

      const chooserScore = room.wordMasterPendingScores[room.chooserId] || 0;
      if (room.chooserId) {
        room.wordMasterPendingScores[room.chooserId] =
          chooserScore + (reason === "solved" ? 100 : 50);
      }

      if ((room.wordMasterRound || 0) >= WORD_MASTER_TOTAL_ROUNDS) {
        room.wordMasterScores = { ...room.wordMasterPendingScores };
        room.wordMasterMatchActive = false;
        room.wordMasterMatchOver = true;
        io.to(roomCode).emit("logMessage", "Word Master match complete!");
      }

      if (reason === "solved") {
        io.to(roomCode).emit(
          "logMessage",
          `${firstSolverName || "A player"} solved ${room.chooserName}'s word.`,
        );
      } else if (reason === "timer") {
        io.to(roomCode).emit(
          "logMessage",
          `Time ran out. ${room.chooserName} stumped the room.`,
        );
      } else if (reason === "guesses") {
        io.to(roomCode).emit(
          "logMessage",
          `No guesses left. ${room.chooserName} stumped the room.`,
        );
      }

      broadcastWordMasterState(roomCode);
    }

    function startWordMasterTimer(roomCode) {
      const room = rooms[roomCode];
      if (!room) return;

      clearRoomTimer(room);
      room.roundTimer = setInterval(() => {
        if (!rooms[roomCode] || room.gameOver || room.waitingForWord) {
          clearRoomTimer(room);
          return;
        }

        room.remainingTime--;

        if (room.remainingTime <= 0) {
          room.remainingTime = 0;
          endWordMasterRound(roomCode, "timer", room.firstSolverName);
          return;
        }

        broadcastWordMasterState(roomCode);
      }, 1000);
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
        mode: "multiplayer",
        chooserIndex: -1,
        chooserId: "",
        chooserName: "",
        waitingForWord: false,
        wordMasterScores: {},
        wordMasterPendingScores: {},
        wordMasterRound: 0,
        wordMasterTotalRounds: WORD_MASTER_TOTAL_ROUNDS,
        wordMasterMatchActive: false,
        wordMasterMatchOver: false,
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

        if (room.mode === "wordMaster") {
          socket.emit("wordMasterState", {
            players: room.players,
            creatorId: room.creator,
            chooserId: room.chooserId || "",
            chooserName: room.chooserName || "",
            scores: getPublicWordMasterScores(room, room.wordMasterMatchOver),
            currentRound: room.wordMasterRound || 0,
            totalRounds: room.wordMasterTotalRounds || WORD_MASTER_TOTAL_ROUNDS,
            matchActive: Boolean(room.wordMasterMatchActive),
            matchOver: Boolean(room.wordMasterMatchOver),
            selectedWord: room.word || "",
            category: room.category || "General",
            correctLetters: room.correctLetters,
            wrongLetters: room.wrongLetters,
            remainingGuesses: room.remainingGuesses,
            remainingTime: room.remainingTime,
            gameOver: room.gameOver,
            roundEndReason: room.roundEndReason,
            firstSolverName: room.firstSolverName,
            waitingForWord: Boolean(room.waitingForWord),
          });
        }

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

      room.remainingGuesses = getDifficultyGuesses(difficulty);
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

    socket.on("startWordMasterRound", (roomCode, difficulty = "easy") => {
      const room = rooms[roomCode];
      if (!room) return;

      if (socket.id !== room.creator) {
        socket.emit("logMessage", "Only the room creator can start the round!");
        return;
      }

      if (room.players.length < 2) {
        socket.emit(
          "logMessage",
          "Word Master needs at least two players: one chooser and one guesser.",
        );
        return;
      }

      room.mode = "wordMaster";
      if (!room.wordMasterMatchActive || room.wordMasterMatchOver) {
        resetWordMasterMatch(room);
      }

      if (room.waitingForWord || (room.word && !room.gameOver)) {
        socket.emit("logMessage", "Finish the current round before starting another.");
        return;
      }

      if ((room.wordMasterRound || 0) >= WORD_MASTER_TOTAL_ROUNDS) {
        room.wordMasterMatchActive = false;
        room.wordMasterMatchOver = true;
        broadcastWordMasterState(roomCode);
        return;
      }

      clearWordMasterRound(room);
      ensureWordMasterScores(room);
      room.remainingGuesses = getDifficultyGuesses(difficulty);
      room.difficulty = difficulty;
      room.wordMasterRound = (room.wordMasterRound || 0) + 1;
      room.wordMasterTotalRounds = WORD_MASTER_TOTAL_ROUNDS;
      room.chooserIndex = (room.chooserIndex + 1) % room.players.length;

      const chooser = room.players[room.chooserIndex];
      room.chooserId = chooser.id;
      room.chooserName = chooser.username;
      room.waitingForWord = true;

      io.to(roomCode).emit(
        "logMessage",
        `Round ${room.wordMasterRound}/${WORD_MASTER_TOTAL_ROUNDS}: ${chooser.username} is choosing the word.`,
      );
      io.to(chooser.id).emit("wordMasterChooseWord", {
        roomCode,
        difficulty,
      });
      broadcastWordMasterState(roomCode);
    });

    socket.on("submitWordMasterWord", (roomCode, word, category = "Custom") => {
      const room = rooms[roomCode];
      if (!room || room.chooserId !== socket.id || !room.waitingForWord) return;

      const cleanWord = sanitizeChosenWord(word);
      if (cleanWord.replace(/\s/g, "").length < 2) {
        socket.emit("logMessage", "Choose a word with at least two characters.");
        return;
      }

      room.word = cleanWord;
      room.category = (category || "Custom").trim().slice(0, 32) || "Custom";
      room.correctLetters = [];
      room.wrongLetters = [];
      room.remainingTime = MULTIPLAYER_TIME_LIMIT;
      room.gameOver = false;
      room.roundEndReason = null;
      room.firstSolverName = "";
      room.waitingForWord = false;

      io.to(roomCode).emit(
        "logMessage",
        `${room.chooserName} submitted a word. Guessers, you're up!`,
      );
      broadcastWordMasterState(roomCode);
      startWordMasterTimer(roomCode);
    });

    socket.on("wordMasterGuess", (roomCode, letter) => {
      const room = rooms[roomCode];
      if (!room || room.gameOver || room.waitingForWord || !room.word) return;

      if (socket.id === room.chooserId) {
        socket.emit("logMessage", "The word chooser cannot guess this round.");
        return;
      }

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;

      letter = String(letter || "").toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return;

      if (
        room.correctLetters.includes(letter) ||
        room.wrongLetters.includes(letter)
      ) {
        return;
      }

      ensureWordMasterScores(room);
      io.to(roomCode).emit("logMessage", `${player.username} guessed: ${letter}`);

      if (room.word.includes(letter)) {
        room.correctLetters.push(letter);
        room.wordMasterPendingScores[player.id] += 10;
        if (room.chooserId) room.wordMasterPendingScores[room.chooserId] += 5;
      } else {
        room.wrongLetters.push(letter);
        room.remainingGuesses--;
        room.wordMasterPendingScores[player.id] = Math.max(
          0,
          room.wordMasterPendingScores[player.id] - 3,
        );
        if (room.chooserId) room.wordMasterPendingScores[room.chooserId] += 10;
      }

      const allLettersGuessed = room.word
        .split("")
        .every((char) => /[^A-Z]/i.test(char) || room.correctLetters.includes(char));

      if (allLettersGuessed) {
        room.wordMasterPendingScores[player.id] +=
          getDifficultyBonus(room.difficulty) +
          Math.max(0, room.remainingTime) * 3 +
          Math.max(0, room.remainingGuesses) * 20 +
          room.word.replace(/[^A-Z]/g, "").length * 8;
        endWordMasterRound(roomCode, "solved", player.username);
        return;
      }

      if (room.remainingGuesses <= 0) {
        room.remainingGuesses = 0;
        endWordMasterRound(roomCode, "guesses", room.firstSolverName);
        return;
      }

      broadcastWordMasterState(roomCode);
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

      if (room.mode === "wordMaster") {
        delete room.wordMasterScores?.[socket.id];
        delete room.wordMasterPendingScores?.[socket.id];
        if (socket.id === room.chooserId) {
          clearWordMasterRound(room);
          room.chooserId = "";
          room.chooserName = "";
          io.to(roomCode).emit(
            "logMessage",
            "The word chooser left, so the Word Master round was cancelled.",
          );
        }
        broadcastWordMasterState(roomCode);
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

        if (room.mode === "wordMaster") {
          delete room.wordMasterScores?.[socket.id];
          delete room.wordMasterPendingScores?.[socket.id];
          if (socket.id === room.chooserId) {
            clearWordMasterRound(room);
            room.chooserId = "";
            room.chooserName = "";
            io.to(roomCode).emit(
              "logMessage",
              "The word chooser disconnected, so the Word Master round was cancelled.",
            );
          }
          broadcastWordMasterState(roomCode);
        }
      }
    });
  });
}
