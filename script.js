// Lista fiszek
import { flashcards } from './flashcards.js'
document.getElementById("question_amount").innerHTML = flashcards.length;

// Elementy strony
const questionElement = document.getElementById("question");
const imageElement = document.getElementById("image");
const answerElement = document.getElementById("answer");
const explanationElement = document.getElementById("explanation");
const badButton = document.getElementById("bad");
const goodButton = document.getElementById("good");
const scoreElement = document.getElementById("score");
const answerContainer = document.querySelector(".answer_container");
const explanationContainer = document.querySelector(".explanation");
const resetButton = document.getElementById("reset");
const remainingFlashcardsElement = document.getElementById("remaining_flashcards");

// Zmienna do śledzenia stanu
let currentCardIndex = null;
let usedIndices = [];
let recentScores = Array(flashcards.length).fill(null); // null = nieodpowiedziane, 1 = dobrze, 0 = źle
let newPoolStarted = false; // flaga wykrycia nowej puli

// Funkcje do obsługi cookies
function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

// Funkcja aktualizująca wynik
function updateScore(isCorrect) {
  // Jeśli zaczęła się nowa pula, wyzeruj wynik
  if (newPoolStarted) {
    recentScores = Array(flashcards.length).fill(null);
    newPoolStarted = false;
  }
  // Zapisz wynik dla bieżącej fiszki
  recentScores[currentCardIndex] = isCorrect ? 1 : 0;

  // Oblicz wynik
  const totalScore = recentScores.filter(s => s === 1).length;
  scoreElement.innerHTML = `Wynik: ${totalScore} z ${flashcards.length}`;
  saveStateToCookies();
}

// Funkcja losująca nową fiszkę
function getRandomCard() {
  if (usedIndices.length === flashcards.length) {
    usedIndices = [];
    newPoolStarted = true; // nowa pula się zaczyna
  }

  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * flashcards.length);
  } while (usedIndices.includes(randomIndex));

  usedIndices.push(randomIndex);
  saveStateToCookies();
  updateRemainingFlashcards();
  return randomIndex;
}

// Funkcja aktualizująca ilość pozostałych fiszek
function updateRemainingFlashcards() {
  const remaining = flashcards.length - usedIndices.length;
  remainingFlashcardsElement.textContent = remaining;
}
// Funkcja zapisująca stan do cookies
function saveStateToCookies() {
  setCookie('usedIndices', JSON.stringify(usedIndices));
  setCookie('currentCardIndex', currentCardIndex);
  setCookie('recentScores', JSON.stringify(recentScores));
}

// Funkcja odczytująca stan z cookies
function loadStateFromCookies() {
  const used = getCookie('usedIndices');
  const idx = getCookie('currentCardIndex');
  const scores = getCookie('recentScores');
  if (used) {
    try {
      usedIndices = JSON.parse(used);
    } catch (e) {
      usedIndices = [];
    }
  }
  if (idx) {
    currentCardIndex = parseInt(idx);
  }
  if (scores) {
    try {
      const parsedScores = JSON.parse(scores);
      // Dopasuj długość do liczby fiszek
      recentScores = Array(flashcards.length).fill(null);
      for (let i = 0; i < parsedScores.length && i < flashcards.length; i++) {
        recentScores[i] = parsedScores[i];
      }
    } catch (e) {
      recentScores = Array(flashcards.length).fill(null);
    }
  } else {
    recentScores = Array(flashcards.length).fill(null);
  }
}
// Funkcja wyświetlająca fiszkę
function showCard(index) {
  const card = flashcards[index];

  // Ustaw pytanie z numerem i odpowiedzi
  questionElement.innerHTML = `${card.id}. ${card.question}`;
  answerElement.innerHTML = ""; // Ukryj odpowiedź
  explanationElement.innerHTML = ""; // Ukryj wyjaśnienie

  // Zarządzaj obrazkiem
  if (card.hasImage) {
    imageElement.src = `./img/zadanie${card.id}.png`;
    imageElement.style.display = "block";
  } else {
    imageElement.style.display = "none";
  }

  // Zmień tekst i klasy przycisków
  badButton.textContent = "Odkryj fiszkę";
  goodButton.textContent = "Odkryj fiszkę";
  badButton.className = "grey";
  goodButton.className = "grey";

  updateRemainingFlashcards();
}

// Funkcja odkrywająca odpowiedź
function revealCard() {
  const card = flashcards[currentCardIndex];
  answerElement.innerHTML = card.answer;
  answerContainer.style.opacity = 1;
  explanationElement.innerHTML = card.explanation;
  explanationContainer.style.opacity = card.explanation == "" ? 0 : 1;

  // Przywróć klasy przycisków
  badButton.textContent = "Źle :(";
  goodButton.textContent = "Dobrze :)";
  badButton.className = "bad";
  goodButton.className = "good";
  updateRemainingFlashcards();
}

// Obsługa przycisków
badButton.addEventListener("click", () => {
  if (badButton.classList.contains("grey")) {
    revealCard();
  } else {
    updateScore(false); // Użytkownik odpowiedział źle
    currentCardIndex = getRandomCard();
    saveStateToCookies();
    showCard(currentCardIndex);
    answerContainer.style.opacity = 0;
    explanationContainer.style.opacity = 0;
  }
});

goodButton.addEventListener("click", () => {
  if (goodButton.classList.contains("grey")) {
    revealCard();
  } else {
    updateScore(true); // Użytkownik odpowiedział dobrze
    currentCardIndex = getRandomCard();
    saveStateToCookies();
    showCard(currentCardIndex);
    answerContainer.style.opacity = 0;
    explanationContainer.style.opacity = 0;
  }
});

// Obsługa resetowania stanu
resetButton.addEventListener("click", () => {
  // Resetuj stan
  usedIndices = [];
  recentScores = Array(flashcards.length).fill(null);
  currentCardIndex = getRandomCard();
  saveStateToCookies();
  showCard(currentCardIndex);
  scoreElement.innerHTML = `Wynik: 0 z ${flashcards.length}`;
  answerContainer.style.opacity = 0;
  explanationContainer.style.opacity = 0;
});

// Wyświetl pierwszą fiszkę
// Przywróć stan z cookies lub rozpocznij nową sesję
loadStateFromCookies();
if (currentCardIndex !== null && !isNaN(currentCardIndex) && usedIndices.length > 0) {
  showCard(currentCardIndex);
} else {
  currentCardIndex = getRandomCard();
  showCard(currentCardIndex);
}
updateRemainingFlashcards();
// Wyświetl wynik po wczytaniu strony
const totalScore = recentScores.filter(s => s === 1).length;
scoreElement.innerHTML = `Wynik: ${totalScore} z ${flashcards.length}`;
