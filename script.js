// Lista fiszek
import { flashcards } from './flashcards.js'
import { tags } from './tags.js'

// Tag filtering state
let selectedTags = [];
let filteredFlashcards = flashcards;

// Wczytaj wybrane tagi z cookies
function loadSelectedTagsFromCookies() {
  const tagsCookie = getCookie('selectedTags');
  if (tagsCookie) {
    try {
      selectedTags = JSON.parse(tagsCookie);
    } catch (e) {
      selectedTags = [];
    }
  } else {
    selectedTags = tags.map(t => t.code); // domyślnie wszystkie
  }
}

function saveSelectedTagsToCookies() {
  setCookie('selectedTags', JSON.stringify(selectedTags));
}

// Filtrowanie fiszek po tagach
function filterFlashcardsByTags() {
  filteredFlashcards = flashcards.filter(card =>
    card.tags && card.tags.some(tag => selectedTags.includes(tag))
  );
}

// Generowanie formularza tagów
function renderTagForm() {
  const tagForm = document.getElementById('tag-form');
  tagForm.innerHTML = '<h3>Wybierz zagadnienia:</h3>' +
    '<div id="tag-warning" style="color:var(--color-0);margin-bottom:8px;font-size:0.95em;display:none">Musisz zaznaczyć przynajmniej jedno zagadnienie!</div>';
  const dzialCodes = ["dz1", "dz2", "dz3"];
  tags.forEach(tag => {
    const checked = selectedTags.includes(tag.code) ? 'checked' : '';
    const dzialClass = dzialCodes.includes(tag.code) ? 'dzial' : '';
    tagForm.innerHTML += `<label class="${dzialClass}"><input type="checkbox" value="${tag.code}" ${checked}>${tag.name}</label>`;
  });
}

// Obsługa zmiany wyboru tagów
function setupTagFormEvents() {
  const tagForm = document.getElementById('tag-form');
  tagForm.addEventListener('change', (e) => {
    const checkboxes = tagForm.querySelectorAll('input[type="checkbox"]');
    const dzialCodes = ["dz1", "dz2", "dz3"];
    const tagList = tags.map(t => t.code);
    const changed = e.target;
    // Sprawdź czy zmieniono dział
    if (dzialCodes.includes(changed.value)) {
      // Zaznaczenie działu: zaznacz wszystkie tagi poniżej aż do następnego działu
      let startIdx = tagList.indexOf(changed.value);
      let endIdx = tagList.length;
      for (let i = startIdx + 1; i < tagList.length; i++) {
        if (dzialCodes.includes(tagList[i])) {
          endIdx = i;
          break;
        }
      }
      for (let i = startIdx; i < endIdx; i++) {
        checkboxes[i].checked = changed.checked;
      }
      // Odznaczenie działu: jeśli odznaczenie spowoduje brak zaznaczonych tagów, zostaw pierwszy tag pod działem
      if (!changed.checked) {
        const checkedTags = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (checkedTags.length === 0) {
          // Zostaw pierwszy tag pod działem
          if (startIdx + 1 < endIdx) {
            checkboxes[startIdx + 1].checked = true;
          }
        }
      }
    }
    // Aktualizuj selectedTags
    const checkedTags = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const warning = document.getElementById('tag-warning');
    if (checkedTags.length === 0) {
      warning.style.display = 'block';
      // Przywróć zaznaczenie poprzednich tagów
      checkboxes.forEach(cb => {
        if (selectedTags.includes(cb.value)) cb.checked = true;
      });
      return;
    } else {
      warning.style.display = 'none';
    }
    selectedTags = checkedTags;
    saveSelectedTagsToCookies();
    filterFlashcardsByTags();
    resetFlashcardPool();
    document.getElementById("question_amount").innerHTML = filteredFlashcards.length;
    updateRemainingFlashcards();
  });
}

// Panel tagów - wysuwanie
function setupTagPanelToggle() {
  const panel = document.getElementById('tag-panel');
  const toggle = document.getElementById('tag-panel-toggle');
  toggle.addEventListener('click', () => {
    panel.classList.toggle('open');
  });
}

// Reset puli fiszek po zmianie tagów
function resetFlashcardPool() {
  usedIndices = [];
  recentScores = Array(filteredFlashcards.length).fill(null);
  currentCardIndex = getRandomCard();
  newPoolStarted = false; // <-- naprawa: wyłącz flagę resetu puli po ręcznym resecie
  saveStateToCookies();
  showCard(currentCardIndex);
  scoreElement.innerHTML = `Wynik: 0 z ${filteredFlashcards.length}`;
  answerContainer.style.opacity = 0;
  explanationContainer.style.opacity = 0;
}

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
let recentScores = [];
let newPoolStarted = false; // flaga wykrycia nowej puli
let wrongFlashcardIds = []; // pula błędnych fiszek
let wrongMode = false; // czy jesteśmy w trybie powtórki błędów

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
    recentScores = Array(filteredFlashcards.length).fill(null);
    newPoolStarted = false;
  }
  // Zapisz wynik dla bieżącej fiszki
  recentScores[currentCardIndex] = isCorrect ? 1 : 0;

  // Dodaj do puli błędów jeśli odpowiedź była zła
  const cardId = filteredFlashcards[currentCardIndex].id;
  if (!isCorrect && !wrongFlashcardIds.includes(cardId)) {
    wrongFlashcardIds.push(cardId);
  }
  // Usuń z puli błędów jeśli odpowiedź była dobra
  if (isCorrect && wrongFlashcardIds.includes(cardId)) {
    wrongFlashcardIds = wrongFlashcardIds.filter(id => id !== cardId);
  }

  // Oblicz wynik
  const totalScore = recentScores.filter(s => s === 1).length;
  // Sprawdź czy skończono pulę
  if (usedIndices.length === filteredFlashcards.length) {
    scoreElement.innerHTML = `<span style='color:var(--color-1-very-light);font-weight:bold;'>Ostateczny wynik: ${totalScore} na ${filteredFlashcards.length}</span>`;
  } else {
    scoreElement.innerHTML = `Wynik: ${totalScore} z ${filteredFlashcards.length}`;
  }
  saveStateToCookies();
}

// Funkcja losująca nową fiszkę
function getRandomCard() {
  // Jeśli skończyła się pula, przejdź do powtórki błędów
  if (usedIndices.length === filteredFlashcards.length) {
    if (wrongMode) {
      // Tryb powtórki błędów: jeśli są jeszcze błędne fiszki, powtarzaj je w nieskończoność
      if (wrongFlashcardIds.length > 0) {
        filteredFlashcards = filteredFlashcards.filter(card => wrongFlashcardIds.includes(card.id));
        usedIndices = [];
        recentScores = Array(filteredFlashcards.length).fill(null);
        newPoolStarted = true;
      } else {
        // Wszystko poprawnie, wróć do normalnej puli
        filterFlashcardsByTags();
        usedIndices = [];
        recentScores = Array(filteredFlashcards.length).fill(null);
        wrongMode = false;
        wrongFlashcardIds = [];
        newPoolStarted = true;
      }
    } else if (wrongFlashcardIds.length > 0) {
      // Przejdź do trybu powtórki błędów
      filteredFlashcards = filteredFlashcards.filter(card => wrongFlashcardIds.includes(card.id));
      usedIndices = [];
      recentScores = Array(filteredFlashcards.length).fill(null);
      wrongMode = true;
      newPoolStarted = true;
    } else {
      // Reset do nowej puli (po powtórce błędów lub gdy nie ma błędów)
      usedIndices = [];
      wrongFlashcardIds = [];
      wrongMode = false;
      newPoolStarted = true;
      filterFlashcardsByTags();
      recentScores = Array(filteredFlashcards.length).fill(null);
    }
  }

  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * filteredFlashcards.length);
  } while (usedIndices.includes(randomIndex));

  usedIndices.push(randomIndex);
  saveStateToCookies();
  updateRemainingFlashcards();
  return randomIndex;
}

// Funkcja aktualizująca ilość pozostałych fiszek
function updateRemainingFlashcards() {
  const remaining = filteredFlashcards.length - usedIndices.length;
  remainingFlashcardsElement.textContent = remaining;
}
// Funkcja zapisująca stan do cookies
function saveStateToCookies() {
  setCookie('usedIndices', JSON.stringify(usedIndices));
  setCookie('currentCardIndex', currentCardIndex);
  setCookie('recentScores', JSON.stringify(recentScores));
  setCookie('selectedTags', JSON.stringify(selectedTags));
  setCookie('wrongFlashcardIds', JSON.stringify(wrongFlashcardIds));
  setCookie('wrongMode', wrongMode ? '1' : '0');
}

// Funkcja odczytująca stan z cookies
function loadStateFromCookies() {
  const used = getCookie('usedIndices');
  const idx = getCookie('currentCardIndex');
  const scores = getCookie('recentScores');
  const wrongIds = getCookie('wrongFlashcardIds');
  const wrongModeCookie = getCookie('wrongMode');
  loadSelectedTagsFromCookies();
  filterFlashcardsByTags();
  if (wrongModeCookie === '1' && wrongIds) {
    try {
      wrongFlashcardIds = JSON.parse(wrongIds);
      filteredFlashcards = filteredFlashcards.filter(card => wrongFlashcardIds.includes(card.id));
      wrongMode = true;
    } catch (e) {
      wrongFlashcardIds = [];
      wrongMode = false;
    }
  } else {
    wrongFlashcardIds = [];
    wrongMode = false;
  }
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
      recentScores = Array(filteredFlashcards.length).fill(null);
      for (let i = 0; i < parsedScores.length && i < filteredFlashcards.length; i++) {
        recentScores[i] = parsedScores[i];
      }
    } catch (e) {
      recentScores = Array(filteredFlashcards.length).fill(null);
    }
  } else {
    recentScores = Array(filteredFlashcards.length).fill(null);
  }
}
// Funkcja wyświetlająca fiszkę
function showCard(index) {
  const card = filteredFlashcards[index];
  // Dodaj informację o powtórce
  if (wrongMode) {
    questionElement.innerHTML = `<span style='color:var(--color-0-very-light);font-weight:bold;'>[Powtórka]</span> ${card.id}. ${card.question}`;
  } else {
    questionElement.innerHTML = `${card.id}. ${card.question}`;
  }
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
  const card = filteredFlashcards[currentCardIndex];
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
  recentScores = Array(filteredFlashcards.length).fill(null);
  currentCardIndex = getRandomCard();
  saveStateToCookies();
  showCard(currentCardIndex);
  scoreElement.innerHTML = `Wynik: 0 z ${filteredFlashcards.length}`;
  answerContainer.style.opacity = 0;
  explanationContainer.style.opacity = 0;
});

// Wyświetl pierwszą fiszkę
// Przywróć stan z cookies lub rozpocznij nową sesję
loadStateFromCookies();
document.getElementById("question_amount").innerHTML = filteredFlashcards.length;
renderTagForm();
setupTagFormEvents();
setupTagPanelToggle();
if (currentCardIndex !== null && !isNaN(currentCardIndex) && usedIndices.length > 0) {
  showCard(currentCardIndex);
} else {
  currentCardIndex = getRandomCard();
  showCard(currentCardIndex);
}
updateRemainingFlashcards();
// Wyświetl wynik po wczytaniu strony
const totalScore = recentScores.filter(s => s === 1).length;
scoreElement.innerHTML = `Wynik: ${totalScore} z ${filteredFlashcards.length}`;
