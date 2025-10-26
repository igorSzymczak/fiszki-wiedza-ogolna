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
  const tagList = document.getElementById('tag-list');
  tagList.innerHTML = '';
  tags.forEach(tag => {
    const checked = selectedTags.includes(tag.code) ? 'checked' : '';
    const dzialClass = (tag.index && tag.index === 1) ? 'dzial' : '';
    // Indent according to numeric index: higher index -> more right offset
    const indent = ((tag.index && tag.index > 0) ? (tag.index - 1) : 0) * 16;
    tagList.innerHTML += `<label class="${dzialClass}" style="margin-left:${indent}px"><input type="checkbox" value="${tag.code}" ${checked}>${tag.name}</label>`;
  });
}

// Obsługa zmiany wyboru tagów
function setupTagFormEvents() {
  const tagList = document.getElementById('tag-list');
  // Replace the node to remove any previously attached anonymous listeners
  const tagListParent = tagList.parentNode;
  const newTagList = tagList.cloneNode(true);
  tagListParent.replaceChild(newTagList, tagList);
  const tagListNode = newTagList;

  tagListNode.addEventListener('change', (e) => {
    // Ensure the event target is a checkbox input
    const changed = e.target.closest && e.target.closest('input[type="checkbox"]') ? e.target.closest('input[type="checkbox"]') : (e.target.type === 'checkbox' ? e.target : null);
    if (!changed) return;
    const checkboxes = tagListNode.querySelectorAll('input[type="checkbox"]');
    const tagCodes = tags.map(t => t.code);
    // Map tag code -> numeric index (default to 2 when missing)
    const tagIndexMap = Object.fromEntries(tags.map(t => [t.code, (typeof t.index === 'number') ? t.index : 2]));

    // Cascade toggle: when toggling a tag of index K, toggle all following tags with index >= K
    // until we meet a tag with index < K (that denotes an ancestor or sibling higher in the tree)
    const startIdx = tagCodes.indexOf(changed.value);
    if (startIdx >= 0) {
      const changedIndex = tagIndexMap[changed.value] || 2;
      let endIdx = tagCodes.length;
      for (let i = startIdx + 1; i < tagCodes.length; i++) {
        // stop when we meet a tag at the same or higher level (index <= changedIndex)
        if ((tagIndexMap[tagCodes[i]] || 2) <= changedIndex) {
          endIdx = i;
          break;
        }
      }
      // Only affect deeper-level tags (index > changedIndex). Do not toggle siblings
      // at the same level (index === changedIndex).
      for (let i = startIdx + 1; i < endIdx; i++) {
        if (!checkboxes[i]) continue;
        if ((tagIndexMap[tagCodes[i]] || 2) > changedIndex) {
          checkboxes[i].checked = changed.checked;
        }
      }
    }

    // Update in-memory selectedTags but DO NOT persist or reshuffle automatically.
    // The user must press the "apply" button to save and draw a new batch.
    selectedTags = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    // Hide any previous warning while the user is editing
    const warning = document.getElementById('tag-warning');
    if (warning) warning.style.display = 'none';
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

// Handlers for select-all and select-sem2
function setupTagPanelButtons() {
  // Ensure a control container exists at the top of the tag panel
  let controls = document.querySelector('.tag-panel .tag-panel-controls');
  const panel = document.querySelector('.tag-panel');
  if (!controls && panel) {
    controls = document.createElement('div');
    controls.className = 'tag-panel-controls';
    panel.insertBefore(controls, panel.firstChild);
  }
  // Clear existing controls to avoid duplicates (we'll recreate canonical buttons)
  if (controls) controls.innerHTML = '';

  // Helper to create a button if missing
  function ensureButton(id, text) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = id;
      btn.type = 'button';
      btn.textContent = text;
      if (controls) controls.appendChild(btn);
    } else {
      // ensure it's not a submit button (avoid form submit reloads)
      btn.type = 'button';
    }
    return btn;
  }

  const applyBtn = ensureButton('apply-tags', 'Zapisz i losuj');
  const selectAll = ensureButton('select-all', 'Zaznacz wszystkie');
  const deselectAll = ensureButton('deselect-all', 'Odznacz wszystkie');

  // "Apply" button: validate, persist and draw new pool
  applyBtn.addEventListener('click', () => {
    const tagListNode = document.getElementById('tag-list');
    const checkboxes = tagListNode.querySelectorAll('input[type="checkbox"]');
    const checkedTags = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const warning = document.getElementById('tag-warning');
    if (checkedTags.length === 0) {
      if (warning) warning.style.display = 'block';
      // Revert visual selection to last saved tags from cookies
      const saved = getCookie('selectedTags');
      let savedTags = [];
      if (saved) {
        try { savedTags = JSON.parse(saved); } catch (e) { savedTags = []; }
      } else {
        savedTags = tags.map(t => t.code);
      }
      // Restore checkboxes
      checkboxes.forEach(cb => cb.checked = savedTags.includes(cb.value));
      selectedTags = savedTags;
      return;
    }
    // Persist selection and reset pool
    selectedTags = checkedTags;
    saveSelectedTagsToCookies();
    filterFlashcardsByTags();
    resetFlashcardPool();
    document.getElementById("question_amount").innerHTML = filteredFlashcards.length;
    updateRemainingFlashcards();
    if (warning) warning.style.display = 'none';
  });

  // Select all (only visual, does not persist until apply)
  selectAll.addEventListener('click', () => {
    const tagListNode = document.getElementById('tag-list');
    const checkboxes = tagListNode.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    selectedTags = tags.map(t => t.code);
  });

  // Deselect all (visual only)
  deselectAll.addEventListener('click', () => {
    const tagListNode = document.getElementById('tag-list');
    const checkboxes = tagListNode.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    selectedTags = [];
  });

  // (removed Sem2 quick-select per user request)
}

// Reset puli fiszek po zmianie tagów
function resetFlashcardPool() {
  usedIndices = [];
  recentScores = Array(filteredFlashcards.length).fill(null);
  currentCardIndex = getRandomCard();
  newPoolStarted = false;
  wrongFlashcardIds = [];
  wrongMode = false; // zawsze wyłącz tryb powtórki przy resecie
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
    saveStateToCookies(); // <-- zapisuj błędne pytania natychmiast
  }
  // Usuń z puli błędów jeśli odpowiedź była dobra
  if (isCorrect && wrongFlashcardIds.includes(cardId)) {
    wrongFlashcardIds = wrongFlashcardIds.filter(id => id !== cardId);
    saveStateToCookies(); // <-- zapisuj błędne pytania natychmiast
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
  const remaining = filteredFlashcards.length - usedIndices.length + 1;
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
  // Przywróć pulę powtórkową jeśli istnieje
  if (wrongIds) {
    try {
      wrongFlashcardIds = JSON.parse(wrongIds);
    } catch (e) {
      wrongFlashcardIds = [];
    }
  } else {
    wrongFlashcardIds = [];
  }
  // Jeśli są błędne fiszki i nie jesteśmy po resecie/tagach, ustaw tryb powtórki
  if (wrongFlashcardIds.length > 0 && wrongModeCookie === '1') {
    filteredFlashcards = flashcards.filter(card => wrongFlashcardIds.includes(card.id));
    wrongMode = true;
  } else {
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
  newPoolStarted = false;
  wrongFlashcardIds = [];
  wrongMode = false;
  saveStateToCookies();
  showCard(currentCardIndex);
  scoreElement.innerHTML = `Wynik: 0 z ${filteredFlashcards.length}`;
  answerContainer.style.opacity = 0;
  explanationContainer.style.opacity = 0;
  // Przywróć normalny wygląd pytania
  questionElement.innerHTML = `${filteredFlashcards[currentCardIndex].id}. ${filteredFlashcards[currentCardIndex].question}`;
});

// Wyświetl pierwszą fiszkę
// Przywróć stan z cookies lub rozpocznij nową sesję
loadStateFromCookies();
document.getElementById("question_amount").innerHTML = filteredFlashcards.length;
renderTagForm();
setupTagFormEvents();
setupTagPanelToggle();
setupTagPanelButtons();
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
