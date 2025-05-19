// --- Game Setup & UI Element References ---
const board = document.getElementById('game-board');
const clickCountEl = document.getElementById('click-count');
const matchedCountEl = document.getElementById('matched-count');
const pairsLeftEl = document.getElementById('pairs-left');
const totalPairsEl = document.getElementById('total-pairs');
const timerEl = document.getElementById('timer');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const powerBtn = document.getElementById('power-up-btn');
const themeToggle = document.getElementById('theme-toggle');

// --- Game State ---
let cards = [], firstCard, secondCard;
let lockBoard = false;
let clickCount = 0, matchedPairs = 0, totalPairs = 0;
let countdown, timeLeft;
let powerUpLimit = 0, powerUpUsed = 0;

// --- Difficulty Settings ---
const difficulties = {
  easy: { pairs: 6, time: 90 },
  medium: { pairs: 10, time: 60 },
  hard: { pairs: 15, time: 45 }
};

// --- Event Listeners ---
startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);
powerBtn.addEventListener('click', powerUp);
themeToggle.addEventListener('click', toggleTheme);
document.querySelectorAll('input[name="difficulty"]').forEach(r => r.addEventListener('change', updateDifficultyInfo));
setInterval(updateCurrentTime, 1000);

// --- Game Logic ---
function getSelectedDifficulty() {
  return document.querySelector('input[name="difficulty"]:checked')?.value || 'easy';
}

function resetGame() {
  clearInterval(countdown);
  board.innerHTML = '';
  document.getElementById('result-box').classList.add('d-none');

  // Reset state
  clickCount = matchedPairs = totalPairs = timeLeft = 0;
  firstCard = secondCard = null;
  lockBoard = false;

  powerBtn.disabled = true;
  startBtn.disabled = false;
  setDifficultyRadios(true);
  timerEl.classList.remove('low-time');

  updateStatus();
}

async function startGame() {
  resetGame();
  powerBtn.disabled = false;
  startBtn.disabled = true;
  setDifficultyRadios(false);

  const level = getSelectedDifficulty();
  totalPairs = difficulties[level].pairs;
  timeLeft = difficulties[level].time;

  powerUpLimit = { easy: 1, medium: 2, hard: 3 }[level];
  powerUpUsed = 0;

  const pokemon = await getRandomPokemon(totalPairs);
  createCards(pokemon);
  shuffle(cards);
  renderCards();
  countdown = setInterval(updateTimer, 1000);
  updateStatus();
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

async function getRandomPokemon(count) {
  const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1000');
  const data = await res.json();
  const selected = [], used = new Set();
  while (selected.length < count) {
    const i = Math.floor(Math.random() * data.results.length);
    const poke = data.results[i];
    if (used.has(poke.name)) continue;
    const img = `https://img.pokemondb.net/artwork/large/${poke.name}.jpg`;
    selected.push({ name: poke.name, img });
    used.add(poke.name);
  }
  return selected;
}

function createCards(pokemon) {
  cards = [];
  pokemon.forEach(p => {
    cards.push(createCardElement(p), createCardElement(p));
  });
}

function createCardElement(pokemon) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card';
  wrapper.innerHTML = `
    <div class="card-inner">
      <div class="card-back"></div>
      <div class="card-front"><img src="${pokemon.img}" alt="${pokemon.name}" width="80"></div>
    </div>`;
  wrapper.dataset.name = pokemon.name;
  wrapper.addEventListener('click', () => flipCard(wrapper));
  return wrapper;
}

function renderCards() {
  board.innerHTML = '';
  cards.forEach(card => board.appendChild(card));
  totalPairsEl.textContent = totalPairs;
  pairsLeftEl.textContent = totalPairs;
}

function flipCard(card) {
  if (lockBoard || card === firstCard || card.classList.contains('matched')) return;
  card.querySelector('.card-inner').classList.add('flipped');
  clickCount++;

  if (!firstCard) {
    firstCard = card;
  } else {
    secondCard = card;
    checkMatch();
  }
  updateStatus();
}

function checkMatch() {
  const isMatch = firstCard.dataset.name === secondCard.dataset.name;
  if (isMatch) {
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    matchedPairs++;
    if (matchedPairs === totalPairs) endGame(true);
    resetTurn();
  } else {
    lockBoard = true;
    setTimeout(() => {
      firstCard.querySelector('.card-inner').classList.remove('flipped');
      secondCard.querySelector('.card-inner').classList.remove('flipped');
      resetTurn();
    }, 1000);
  }
}

function resetTurn() {
  [firstCard, secondCard] = [null, null];
  lockBoard = false;
}

function updateStatus() {
  clickCountEl.textContent = clickCount;
  matchedCountEl.textContent = matchedPairs;
  pairsLeftEl.textContent = totalPairs - matchedPairs;
  totalPairsEl.textContent = totalPairs;
  timerEl.textContent = timeLeft;
}

function updateTimer() {
  timeLeft--;
  timerEl.textContent = timeLeft;
  if (timeLeft <= 10) timerEl.classList.add('low-time');
  else timerEl.classList.remove('low-time');
  if (timeLeft <= 0) endGame(false);
}

function endGame(won) {
  clearInterval(countdown);
  lockBoard = true;
  powerBtn.disabled = true;
  startBtn.disabled = false;
  setDifficultyRadios(true);
  if (won) showResult(true);
  else showGameOverToast();
}

function showResult(won) {
  const box = document.getElementById('result-box');
  const text = document.getElementById('result-text');
  text.textContent = won ? '🎉 You Win!' : '💀 Game Over';
  text.className = won ? 'text-success' : 'text-danger';
  box.classList.remove('d-none');
}

function showGameOverToast() {
  const toast = document.getElementById('gameover-toast');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    resetGame();
  }, 3000);
}

function showPowerUpToastMessage(msg) {
  const toast = document.getElementById('powerup-message');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function powerUp() {
  if (powerUpUsed >= powerUpLimit) {
    const level = getSelectedDifficulty();
    const limits = {
      easy: 'once in Easy mode.',
      medium: 'twice in Medium mode.',
      hard: 'three times in Hard mode.'
    };
    showPowerUpToastMessage(`You can only use Power-Up ${limits[level]}`);
    return;
  }
  powerUpUsed++;
  document.querySelectorAll('.card-inner').forEach(inner => inner.classList.add('flipped'));
  setTimeout(() => {
    document.querySelectorAll('.card:not(.matched) .card-inner').forEach(inner => inner.classList.remove('flipped'));
  }, 1500);
}

const difficultyInfo = document.getElementById('difficulty-info');
function updateDifficultyInfo() {
    const level = getSelectedDifficulty();
    const { pairs, time } = difficulties[level];
    difficultyInfo.innerHTML = `<span class="dot ${level}"></span> ${capitalize(level)} Mode: Match ${pairs} pairs within ${time} seconds.`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateCurrentTime() {
  const now = new Date();
  document.getElementById('current-time').textContent = now.toLocaleTimeString();
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  themeToggle.textContent = document.body.classList.contains('dark') ? 'Light Mode' : 'Dark Mode';
}

function setDifficultyRadios(enabled) {
  document.querySelectorAll('input[name="difficulty"]').forEach(r => r.disabled = !enabled);
}