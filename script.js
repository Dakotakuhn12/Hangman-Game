document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const wordDisplay = document.getElementById("word-display");
  const keyboard = document.getElementById("keyboard");
  const remainingGuessesEl = document.getElementById("remaining-guesses");
  const gameMessageEl = document.getElementById("game-message");
  const resetBtn = document.getElementById("reset-btn");
  const categoryContainer = document.getElementById("category"); // Make sure HTML has id="category"

  // Hangman SVG Parts
  const hangmanParts = {
    head: document.getElementById("head"),
    body: document.getElementById("body"),
    leftArm: document.getElementById("left-arm"),
    rightArm: document.getElementById("right-arm"),
    leftLeg: document.getElementById("left-leg"),
    rightLeg: document.getElementById("right-leg"),
    face: document.getElementById("face")
  };

  // Game Variables
  let selectedWord = "";
  let correctLetters = [];
  let wrongLetters = [];
  let remainingGuesses = 6;
  let gameOver = false;

  // Word lists (your massive lists including new categories)

const words = {

  animal: [
    "dog","cat","tiger","lion","bear","shark","snake","eagle","frog","whale","horse",
    "zebra","monkey","wolf","dolphin","giraffe","kangaroo","penguin","panda","rabbit",
    "fox","cheetah","hamster","cow","sheep","goat","octopus","jellyfish","butterfly",
    "mouse","rat","chicken","duck","turkey","camel","hippo","rhino","deer","squid",
    "owl","hawk","alligator","ant","bison","beetle","crow","crocodile","crab","dove",
    "donkey","eel","flamingo","gecko","gorilla","hedgehog","heron","hippopotamus",
    "iguana","jaguar","koala","lemur","leopard","lobster","macaw","moose","narwhal",
    "newt","otter","ox","parrot","peacock","pelican","platypus","porcupine","quail",
    "rabbit","raccoon","ram","reindeer","robin","salmon","seahorse","seal","skunk",
    "sloth","snail","swan","tapir","toucan","turkey","turtle","vulture","walrus","weasel",
    "woodpecker","yak","zebu","armadillo","badger","bat","beaver","boar","butterfly",
    "caribou","catfish","cheetah","clam","cobra","cougar","cow","coyote","crane","crow",
    "deer","dingo","dolphin","donkey","duck","eel","falcon","ferret","finch","fox",
    "gecko","gibbon","goat","goldfish","gorilla","grasshopper","grouse","guinea","hamster",
    "hare","hawk","hedgehog","heron","herring","hippopotamus","hornet","horse","hummingbird",
    "hyena","ibis","iguana","jackal","jaguar","jay","kangaroo","kingfisher","koala",
    "koi","lemur","leopard","lion","lizard","lobster","macaw","magpie","mallard","manatee",
    "mink","mole","mongoose","monkey","moose","moray","mouse","narwhal","newt","ocelot",
    "octopus","opossum","orangutan","otter","owl","ox","panda","panther","parrot","peacock",
    "pelican","penguin","pheasant","pig","pigeon","platypus","porcupine","possum","quail",
    "rabbit","raccoon","rat","reindeer","rhinoceros","robin","salmon","scorpion","seahorse",
    "seal","shark","sheep","shrimp","skunk","sloth","snail","snake","sparrow","squid",
    "swan","tapir","tiger","toad","toucan","turkey","turtle","vulture","walrus","weasel",
    "whale","wolf","wombat","woodpecker","yak","zebra"
  ],

  food: [
    "apple","banana","orange","grapes","pear","peach","plum","cherry","strawberry",
    "blueberry","raspberry","blackberry","pineapple","mango","papaya","kiwi","watermelon",
    "cantaloupe","lemon","lime","tomato","carrot","broccoli","spinach","cabbage","lettuce",
    "kale","onion","garlic","potato","sweetpotato","pumpkin","corn","peas","beans","rice",
    "pasta","noodles","bread","bagel","bun","croissant","tortilla","pizza","burger","sandwich",
    "hotdog","taco","burrito","sushi","ramen","dumpling","soup","stew","curry","salad","sausage",
    "bacon","egg","omelette","cheese","milk","yogurt","butter","cream","icecream","cake","cookie",
    "brownie","pie","pancake","waffle","muffin","donut","chocolate","candy","lollipop","chips",
    "popcorn","pretzel","cracker","nuts","almond","peanut","cashew","hazelnut","walnut","pistachio",
    "honey","jam","syrup","oil","vinegar","spaghetti","lasagna","macaroni","fettuccine","gnocchi",
    "meatball","steak","chicken","beef","pork","lamb","turkey","duck","salmon","tuna","shrimp",
    "lobster","crab","clam","oyster","squid","octopus","tofu","tempeh","seitan","beansprout",
    "edamame","seaweed","mushroom","broth","noodle","pizza","burger","soup","sushi","pasta","pie",
    "cake","cookie","chocolate","caramel","waffle","croissant","pudding","jelly","muffin","cupcake",
    "brownie","cheesecake","icecream","sorbet","gelato","smoothie","milkshake","bagel","toast",
    "sandwich","taco","burrito","hotdog","pancake","crepe","quiche","omelette","salad","fruit",
    "vegetable","grain","cereal","rice","bread","cheese","butter","yogurt","cream"
  ],

  game: [
    "chess","checkers","monopoly","scrabble","uno","poker","bridge","hearts","go","backgammon",
    "tic","tac","toe","mahjong","mahjongg","dominoes","clue","battleship","risk","candyland",
    "connectfour","trivialpursuit","pictionary","charades","hangman","bingo","settlers","catan",
    "fortnite","minecraft","roblox","overwatch","valorant","apex","leagueoflegends","csgo",
    "callofduty","pubg","halo","skyrim","zelda","mario","pokemon","sims","rocketleague","pong",
    "tetris","pacman","mariokart","supermario","donkeykong","streetfighter","tekken","smashbros",
    "animalcrossing","genshin","clashofclans","clashroyale","fifa","nba2k","madden","gta",
    "assassinscreed","battlefield","fallguys","amongus","teamfortress","overcooked","stardewvalley",
    "minecraftdungeons","terraria","robloxadoptme","valorantagents","warzone","codmobile","brawlstars",
    "leaguewildrift","pokemonunite","slitherio","agario","fortnitenightmare","subwaysurfers","templerun"
  ],

  place: [
    "school","beach","park","mall","library","museum","city","forest","island","mountain",
    "airport","stadium","desert","village","bridge","castle","garden","cave","harbor",
    "jungle","house","farm","zoo","factory","restaurant","hospital","bank","hotel","theater",
    "station","market","church","mosque","temple","synagogue","stadium","arena","square",
    "playground","stadium","highway","road","street","alley","court","plaza","pier","bay",
    "valley","river","lake","ocean","pond","beachfront","cliff","canyon","hill","plateau",
    "volcano","glacier","swamp","marsh","cave","mine","quarry","hut","lighthouse","tower"
  ],

  object: [
    "phone","laptop","chair","table","pencil","backpack","bottle","car","ball","mirror",
    "keyboard","clock","helmet","candle","camera","remote","glasses","wallet","shovel",
    "blanket","toaster","charger","radio","broom","brush","flashlight","marker","stapler",
    "headphones","controller","notebook","book","paper","eraser","pen","ruler","scissors",
    "printer","monitor","lamp","microwave","oven","fan","chair","sofa","couch","bed","mat",
    "tent","umbrella","boots","shoe","hat","coat","jacket","bag","backpack","stool","bin",
    "bucket","mug","plate","fork","spoon","knife","cup","jar","tray","globe","map","calendar",
    "calendar","clock","thermometer","compass","telescope","binoculars","magnifyingglass","key",
    "lock","chain","rope","string","belt","brush","paintbrush","brush","hammer","screwdriver",
    "wrench","pliers","drill","saw","knife","spade","hoe","rake"
  ],

  sport: [
    "soccer","basketball","baseball","football","tennis","golf","swimming","boxing",
    "hockey","volleyball","track","wrestling","rugby","cycling","skiing","snowboarding",
    "karate","bowling","archery","fencing","rowing","gymnastics","skateboarding","surfing",
    "badminton","cricket","handball","judo","lacrosse","martialarts","polo","softball",
    "tabletennis","taekwondo","triathlon","weightlifting","yoga","kickboxing","sailing",
    "diving","climbing","snowboarding","sledding","icehockey","figure skating","speedskating",
    "kayaking","canoeing","surfing","windsurfing","paragliding","bmx","rollerblading","motocross",
    "paintball","laser tag","archerytag","parkour","skating","crossfit","pilates","fencing",
    "squash","racquetball","trackandfield","rugbyunion","rugbyeight","americanfootball","soccerfutsal","handballbeach","volleyballbeach","softballfastpitch","floorball","iceclimbing",
    "mountainbiking","orienteering","triathlonsprint","swimrun","ultramarathon","trailrunning"
  ],
movies: [
  "inception","titanic","avatar","avengers","frozen","jurassicpark","harrypotter",
  "spiderman","batman","superman","ironman","guardiansofthegalaxy",
  "starwars","interstellar","matrix","gladiator","incredibles","frozen","toy","story",
  "up","coco","findingnemo","lionking","aladdin","moana","encanto","cars","frozen",
  "wonderwoman","blackpanther","antman","doctorstrange","thor","shrek",
  "tangled","brave","wreckitralph","insideout","zootopia","frozen","encanto","lightyear"
],

body: [
  "head","arm","leg","hand","foot","eye","ear","nose","mouth","neck","shoulder","chest",
  "back","stomach","knee","elbow","wrist","ankle","finger","toe","hair","brain","heart",
  "lung","liver","kidney","teeth","tongue","skin","spine","rib","pelvis","thigh","calf",
  "heel","forearm","eyebrow","eyelash","cheek","chin","jaw","shoulderblade","collarbone",
  "palm","fingernail","toenail","thumb","indexfinger","middlefinger","ringfinger","pinky"
],

health: [
  "exercise","diet","sleep","hydration","vitamin","protein","minerals","cardio","strength",
  "stretching","yoga","meditation","mentalhealth","stress","wellbeing","nutrition","balance",
  "immunity","relaxation","hygiene","doctor","checkup","vaccine","workout","endurance",
  "flexibility","calories","metabolism","cholesterol","bloodpressure","hearthealth",
  "mindfulness","recovery","supplement","prevention","therapy","rehabilitation","walking",
  "running","swimming","cycling","rest","hydrated","healthy","organic","wholefoods"
]

};
  // Initialize Game
  function initGame() {
    correctLetters = [];
    wrongLetters = [];
    remainingGuesses = 6;
    gameOver = false;
    gameMessageEl.textContent = "";

    // Pick random word & category
    const categories = Object.keys(words);
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const wordList = words[randomCategory];
    selectedWord = wordList[Math.floor(Math.random() * wordList.length)];

    // Update UI
    if (categoryContainer) {
      categoryContainer.textContent = "Category: " + randomCategory;
    }
    remainingGuessesEl.textContent = `Remaining guesses: ${remainingGuesses}`;

    // Hide all hangman parts
    Object.values(hangmanParts).forEach(part => part.style.display = "none");

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
    if (gameOver || correctLetters.includes(letter) || wrongLetters.includes(letter)) return;

    if (selectedWord.toUpperCase().includes(letter)) {
      correctLetters.push(letter);
      updateWordDisplay();
      // Mark keyboard letter as correct
      const key = document.querySelector(`.keyboard-letter[data-letter="${letter}"]`);
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
      const key = document.querySelector(`.keyboard-letter[data-letter="${letter}"]`);
      if (key) key.classList.add("wrong", "used");

      updateHangmanDrawing();

      if (remainingGuesses === 0) {
        gameOver = true;
        gameMessageEl.textContent = `Game Over! The word was: ${selectedWord}`;
        gameMessageEl.style.color = "red";

        hangmanParts.face.style.display = "block";

        document.querySelectorAll(".word-letter").forEach(el => {
          el.textContent = el.dataset.letter;
        });
      }
    }
  }

  // Update word display
  function updateWordDisplay() {
    document.querySelectorAll(".word-letter").forEach(el => {
      const letter = el.dataset.letter;
      if (correctLetters.includes(letter)) {
        el.textContent = letter;
      }
    });
  }

  // Check win
  function checkWin() {
    return selectedWord.toUpperCase().split("").every(letter => correctLetters.includes(letter));
  }

  // Update hangman drawing
  function updateHangmanDrawing() {
    switch (wrongLetters.length) {
      case 1: hangmanParts.head.style.display = "block"; break;
      case 2: hangmanParts.body.style.display = "block"; break;
      case 3: hangmanParts.leftArm.style.display = "block"; break;
      case 4: hangmanParts.rightArm.style.display = "block"; break;
      case 5: hangmanParts.leftLeg.style.display = "block"; break;
      case 6: hangmanParts.rightLeg.style.display = "block"; break;
    }
  }

  // Keyboard typing support
  document.addEventListener("keydown", e => {
    if (/^[a-z]$/i.test(e.key)) handleGuess(e.key.toUpperCase());
  });

  // Reset button
  resetBtn.addEventListener("click", initGame);

  // Start the game
  initGame();
});

// To Do List:

// Have to code for it to be able to type in the letters instead of clicking them with the mouse
// Have the difficulties appear ex. Easy Medium Hard Advanced
// For each different difficulty have one less balloon/live for each difficulty ex: Easy - 7, Medium - 6, Hard - 5, Advanced - 4
// Have it to where it can be played with different games modes ex: quick play, private game, single player
// Put in a room code instead of copying a link for the private game mode
// for the quick play mode put in bots that play the game against you
// style it a bunch as well