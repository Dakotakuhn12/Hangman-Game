import { words } from "./data.js";

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const difficulty_dropdown = document.getElementById("diffictuly_drop");
  const wordDisplay = document.getElementById("word-display");
  const keyboard = document.getElementById("keyboard");
  const remainingGuessesEl = document.getElementById("remaining-guesses");
  const gameMessageEl = document.getElementById("game-message");
  const resetBtn = document.getElementById("reset-btn");
  const categoryContainer = document.getElementById("category");

  // Hangman SVG Parts
  const hangmanParts = {
    head: document.getElementById("head"),
    body: document.getElementById("body"),
    leftArm: document.getElementById("left-arm"),
    rightArm: document.getElementById("right-arm"),
    leftLeg: document.getElementById("left-leg"),
    rightLeg: document.getElementById("right-leg"),
    face: document.getElementById("face"),
  };

  // Game Variables
  let selectedWord = "";
  let correctLetters = [];
  let wrongLetters = [];
  let remainingGuesses;
  let gameOver = false;
  let difficulty;

  // Word lists (your massive lists including new categories)
  // Initialize Game
  function initGame() {
    correctLetters = [];
    wrongLetters = [];
    gameOver = false;
    gameMessageEl.textContent = "";
    const d = get_difficulty(difficulty_dropdown);
    remainingGuesses = d.remainingGuesses;
    difficulty = d.difficulty;

    // Pick random word & category
    const categories = Object.keys(words);
    const randomCategory =
      categories[Math.floor(Math.random() * categories.length)];
    const wordList = words[randomCategory];
    selectedWord = wordList[Math.floor(Math.random() * wordList.length)];

    // Update UI
    if (categoryContainer) {
      categoryContainer.textContent = "Category: " + randomCategory;
    }
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;

    // Hide all hangman parts
    Object.values(hangmanParts).forEach(
      (part) => (part.style.display = "none")
    );

    // Display blanks for the word
    wordDisplay.innerHTML = "";
    for (let i = 0; i < selectedWord.length; i++) {
      const letterEl = document.createElement("div");
      letterEl.classList.add("word-letter");
      letterEl.dataset.letter = selectedWord[i].toUpperCase();
      letterEl.textContent = "_";
      wordDisplay.appendChild(letterEl);
    }

    // Create keyboard
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

  // Handle guess
  function handleGuess(letter) {
    if (
      gameOver ||
      correctLetters.includes(letter) ||
      wrongLetters.includes(letter)
    )
      return;

    if (selectedWord.toUpperCase().includes(letter)) {
      correctLetters.push(letter);
      updateWordDisplay();
      // Mark keyboard letter as correct
      const key = document.querySelector(
        `.keyboard-letter[data-letter="${letter}"]`
      );
      if (key) key.classList.add("correct", "used");

      if (checkWin()) {
        gameOver = true;
        gameMessageEl.textContent = "Congrats! You Won!";
        gameMessageEl.style.color = "green";
      }
    } else {
      wrongLetters.push(letter);
      remainingGuesses--;
      remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;

      // Mark keyboard letter as wrong
      const key = document.querySelector(
        `.keyboard-letter[data-letter="${letter}"]`
      );
      if (key) key.classList.add("wrong", "used");

      updateHangmanDrawing(difficulty);

      if (remainingGuesses === 0) {
        gameOver = true;
        gameMessageEl.textContent = `Game Over! The word was: ${selectedWord}`;
        gameMessageEl.style.color = "red";

        hangmanParts.face.style.display = "block";

        document.querySelectorAll(".word-letter").forEach((el) => {
          el.textContent = el.dataset.letter;
        });
      }
    }
  }

  // Update word display
  function updateWordDisplay() {
    document.querySelectorAll(".word-letter").forEach((el) => {
      const letter = el.dataset.letter;
      if (correctLetters.includes(letter)) {
        el.textContent = letter;
      }
    });
  }

  // Check win
  function checkWin() {
    return selectedWord
      .toUpperCase()
      .split("")
      .every((letter) => correctLetters.includes(letter));
  }

  // Update hangman drawing
  function updateHangmanDrawing(difficulty) {
    if (difficulty === "Easy") {
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
    if (difficulty === "Medium") {
      switch (wrongLetters.length) {
        case 1:
          hangmanParts.head.style.display = "block";
          break;
        case 2:
          hangmanParts.body.style.display = "block";
          break;
        case 3:
          hangmanParts.leftArm.style.display = "block";
          hangmanParts.rightArm.style.display = "block";
          break;
        case 4:
          hangmanParts.leftLeg.style.display = "block";
          break;
        case 5:
          hangmanParts.rightLeg.style.display = "block";
          break;
      }
    }
    if (difficulty === "Hard") {
      switch (wrongLetters.length) {
        case 1:
          hangmanParts.head.style.display = "block";
          break;
        case 2:
          hangmanParts.body.style.display = "block";
          break;
        case 3:
          hangmanParts.leftArm.style.display = "block";
          hangmanParts.rightArm.style.display = "block";
          break;
        case 4:
          hangmanParts.leftLeg.style.display = "block";
          hangmanParts.rightLeg.style.display = "block";
          break;
      }
    }
    if (difficulty === "Advanced") {
      switch (wrongLetters.length) {
        case 1:
          hangmanParts.head.style.display = "block";
          break;
        case 2:
          hangmanParts.body.style.display = "block";
          hangmanParts.leftArm.style.display = "block";
          hangmanParts.rightArm.style.display = "block";
          break;
        case 3:
          hangmanParts.leftLeg.style.display = "block";
          hangmanParts.rightLeg.style.display = "block";
          break;
      }
    }
  }

  // Keyboard typing support
  document.addEventListener("keydown", (e) => {
    if (/^[a-z]$/i.test(e.key)) handleGuess(e.key.toUpperCase());
  });

  // Reset button
  resetBtn.addEventListener("click", initGame);

  // Start the game
  difficulty_dropdown.addEventListener("change", () => {
    const d = get_difficulty(difficulty_dropdown);
    remainingGuesses = d.remainingGuesses;
    difficulty = d.difficulty;

    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;
  });

  initGame();
});

function get_difficulty(difficulty_dropdown) {
  const diff = difficulty_dropdown.value;

  if (diff === "easy") {
    return { difficulty: "Easy", remainingGuesses: 6 };
  }
  if (diff === "Medium") {
    return { difficulty: "Medium", remainingGuesses: 5 };
  }
  if (diff === "Hard") {
    return { difficulty: "Hard", remainingGuesses: 4 };
  }
  if (diff === "Advanced") {
    return { difficulty: "Advanced", remainingGuesses: 3 };
  }
}

// To Do List:

// Have the difficulties appear ex. Easy Medium Hard Advanced
// For each different difficulty have one less guess for each difficulty ex: Easy - 6, Medium - 5, Hard - 4, Advanced - 3
// Have it to where it can be played with different games modes ex: quick play, private game, single player
// Put in a room code instead of copying a link for the private game mode
// for the quick play mode put in bots that play the game against you
// style it a bunch as well
// have it where there is spaces and dashes as well
