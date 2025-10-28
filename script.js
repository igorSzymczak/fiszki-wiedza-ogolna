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
  // Prepare helper maps for hierarchy and codes
  const tagCodes = tags.map(t => t.code);
  const tagIndexMap = Object.fromEntries(tags.map(t => [t.code, (typeof t.index === 'number') ? t.index : 2]));

  // Helper: collect descendant codes for tag at position `startIdx`
  function collectDescendants(startIdx) {
    const result = [];
    const baseIndex = tagIndexMap[tagCodes[startIdx]] || 2;
    for (let i = startIdx + 1; i < tagCodes.length; i++) {
      const idx = tagIndexMap[tagCodes[i]] || 2;
      if (idx <= baseIndex) break; // stop when sibling or ancestor
      result.push(tagCodes[i]);
    }
    return result;
  }

  tags.forEach((tag, i) => {
    const checked = selectedTags.includes(tag.code) ? 'checked' : '';
    const dzialClass = (tag.index && tag.index === 1) ? 'dzial' : '';
    // Indent according to numeric index: higher index -> more right offset
    const indent = ((tag.index && tag.index > 0) ? (tag.index - 1) : 0) * 16;
    // Inline color for index 2 tags (keeps previous behavior)
    const colorStyle = (tag.index === 2) ? 'color:var(--color-1);' : '';

    // Compute count = cards having this tag OR any of its descendant tags
    const descendants = collectDescendants(i);
    const codesToCount = [tag.code, ...descendants];
    const count = flashcards.filter(card => card.tags && card.tags.some(tcode => codesToCount.includes(tcode))).length;

    tagList.innerHTML += `<label class="${dzialClass}" style="margin-left:${indent}px; ${colorStyle}"><input type="checkbox" value="${tag.code}" ${checked}>${tag.name} <span class="tag-count">(${count})</span></label>`;
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
    // Also: propagate upward — if all descendants of an ancestor are checked,
    // mark the ancestor checked; if any descendant is unchecked, ancestor is unchecked.
    // This keeps parent state consistent when users manually toggle children.
    // First, compute new checked state from checkboxes
    selectedTags = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

    // Upward propagation: walk backwards from the changed position and update ancestors
    try {
      if (startIdx >= 0) {
        for (let pos = startIdx - 1; pos >= 0; pos--) {
          const parentCode = tagCodes[pos];
          const parentIndex = tagIndexMap[parentCode] || 2;
          // find end of this parent's descendant range
          let parentEnd = tagCodes.length;
          for (let k = pos + 1; k < tagCodes.length; k++) {
            if ((tagIndexMap[tagCodes[k]] || 2) <= parentIndex) {
              parentEnd = k;
              break;
            }
          }
          // check descendants (only those with index > parentIndex)
          let anyDescendant = false;
          let allChecked = true;
          for (let k = pos + 1; k < parentEnd; k++) {
            const childIndex = tagIndexMap[tagCodes[k]] || 2;
            if (childIndex > parentIndex) {
              anyDescendant = true;
              const cb = checkboxes[k];
              if (!cb || !cb.checked) { allChecked = false; break; }
            }
          }
          // Only adjust parent if it actually has descendants
          const parentCb = checkboxes[pos];
          if (!parentCb) continue;
          if (anyDescendant) {
            parentCb.checked = allChecked;
          }
        }
        // Refresh selectedTags after propagation
        selectedTags = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
      }
    } catch (err) {
      // if anything goes wrong in propagation, fall back to basic selection
      selectedTags = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    }

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

  // Create simple limit controls (checkbox + number input)
  let limitWrapper = document.getElementById('limit-controls');
  if (!limitWrapper) {
    limitWrapper = document.createElement('div');
    limitWrapper.id = 'limit-controls';
    limitWrapper.style.display = 'flex';
    limitWrapper.style.gap = '8px';
    limitWrapper.style.alignItems = 'center';
    // place after existing buttons
    if (controls) controls.appendChild(limitWrapper);
  }

  // Build checkbox and number input
  let limitCheckbox = document.getElementById('limit-enabled');
  let limitNumber = document.getElementById('limit-count');
  if (!limitCheckbox) {
    limitCheckbox = document.createElement('input');
    limitCheckbox.type = 'checkbox';
    limitCheckbox.id = 'limit-enabled';
    limitCheckbox.title = 'Włącz limit fiszek';
  }
  if (!limitNumber) {
    limitNumber = document.createElement('input');
    limitNumber.type = 'number';
    limitNumber.id = 'limit-count';
    limitNumber.min = '1';
    limitNumber.value = '10';
    limitNumber.style.width = '64px';
    limitNumber.title = 'Maksymalna liczba fiszek';
  }
  // Label for checkbox
  let limitLabel = document.getElementById('limit-label');
  if (!limitLabel) {
    limitLabel = document.createElement('label');
    limitLabel.id = 'limit-label';
    limitLabel.style.display = 'flex';
    limitLabel.style.alignItems = 'center';
    limitLabel.style.gap = '6px';
    limitLabel.appendChild(limitCheckbox);
    const span = document.createElement('span');
    span.textContent = 'Limit fiszek';
    limitLabel.appendChild(span);
  }
  // Clear wrapper and append canonical controls
  limitWrapper.innerHTML = '';
  limitWrapper.appendChild(limitLabel);
  limitWrapper.appendChild(limitNumber);

  // Initialize limit controls from cookies (if present)
  try {
    const limEnabled = getCookie('limitEnabled');
    const limCount = getCookie('limitCount');
    if (limEnabled === '1') limitCheckbox.checked = true; else limitCheckbox.checked = false;
    if (limCount) {
      const n = parseInt(limCount);
      if (!isNaN(n) && n > 0) limitNumber.value = String(n);
    }
  } catch (e) {
    // ignore
  }

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
    // Persist selection
    selectedTags = checkedTags;
    saveSelectedTagsToCookies();

    // Build the filtered list first
    filterFlashcardsByTags();

    // Apply optional limit if enabled (read values from controls)
    const limitEnabledEl = document.getElementById('limit-enabled');
    const limitCountEl = document.getElementById('limit-count');
    let limitEnabled = false;
    let limitCount = null;
    if (limitEnabledEl && limitEnabledEl.checked) {
      limitEnabled = true;
      const v = parseInt(limitCountEl && limitCountEl.value);
      if (!isNaN(v) && v > 0) limitCount = v;
    }

    if (limitEnabled && limitCount !== null) {
      // shuffle filteredFlashcards and slice to requested size
      const arr = filteredFlashcards.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      filteredFlashcards = arr.slice(0, Math.min(limitCount, arr.length));
      // Persist the exact limited pool (by id) so it can be restored after reload
      try { setCookie('limitedPoolIds', JSON.stringify(filteredFlashcards.map(c => c.id))); } catch (e) { setCookie('limitedPoolIds', ''); }
    }

    // Persist limit preferences to cookie
    setCookie('limitEnabled', limitEnabled ? '1' : '0');
    setCookie('limitCount', limitCount !== null ? String(limitCount) : '');
    if (!(limitEnabled && limitCount !== null)) {
      // clear any previous limited pool when limit not active
      setCookie('limitedPoolIds', '');
    }

    // Reset pool and update UI
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
        // Re-apply limit if enabled so new pool respects user's limit
        applyLimitToFilteredFlashcards();
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
      // If a limit is enabled, ensure limited pool persisted
      applyLimitToFilteredFlashcards();
    } else {
      // Reset do nowej puli (po powtórce błędów lub gdy nie ma błędów)
      usedIndices = [];
      wrongFlashcardIds = [];
      wrongMode = false;
      newPoolStarted = true;
      filterFlashcardsByTags();
      // Re-apply limit if enabled so new pool respects user's limit
      applyLimitToFilteredFlashcards();
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
  // If a limited pool is active and saved, persist progress by IDs instead of indices
  const limitedSaved = getCookie('limitedPoolIds');
  if (limitedSaved) {
    try {
      const limitedIds = JSON.parse(limitedSaved);
      if (Array.isArray(limitedIds) && limitedIds.length > 0) {
        // Save used items as IDs
        const usedIds = usedIndices.map(i => (filteredFlashcards[i] && filteredFlashcards[i].id) ? filteredFlashcards[i].id : null).filter(Boolean);
        setCookie('usedIds', JSON.stringify(usedIds));
        // Save recent scores by id map
        const scoresById = {};
        for (let i = 0; i < recentScores.length; i++) {
          const s = recentScores[i];
          const card = filteredFlashcards[i];
          if (card && s !== null && s !== undefined) scoresById[card.id] = s;
        }
        setCookie('recentScoresById', JSON.stringify(scoresById));
        // Save current card id
        const currentId = (currentCardIndex !== null && filteredFlashcards[currentCardIndex]) ? filteredFlashcards[currentCardIndex].id : '';
        setCookie('currentCardId', currentId);
      }
    } catch (e) {
      // fall back to clearing these keys
      setCookie('usedIds', '');
      setCookie('recentScoresById', '');
      setCookie('currentCardId', '');
    }
  } else {
    // Default behavior: save indices and array scores
    setCookie('usedIndices', JSON.stringify(usedIndices));
    setCookie('currentCardIndex', currentCardIndex);
    setCookie('recentScores', JSON.stringify(recentScores));
  }
  // Common state
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
  // If a limited pool was saved previously, restore that exact pool (by id)
  const limitedSaved = getCookie('limitedPoolIds');
  let limitedRestored = false;
  if (limitedSaved) {
    try {
      const limitedIds = JSON.parse(limitedSaved);
      if (Array.isArray(limitedIds) && limitedIds.length > 0) {
        // rebuild pool in the same order as saved ids
        const rebuilt = limitedIds.map(id => flashcards.find(c => c.id === id)).filter(Boolean);
        if (rebuilt.length > 0) {
          filteredFlashcards = rebuilt;
          // Reset progress for the restored limited pool (we keep wrongFlashcardIds separate)
          usedIndices = [];
          recentScores = Array(filteredFlashcards.length).fill(null);
          currentCardIndex = null;
          wrongMode = false;
          limitedRestored = true;
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }
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
  // Restore progress from cookies
  if (!limitedRestored) {
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
  } else {
    // We restored a limited pool. Try to restore progress saved by IDs.
    const usedIdsCookie = getCookie('usedIds');
    const recentScoresByIdCookie = getCookie('recentScoresById');
    const currentCardIdCookie = getCookie('currentCardId');
    // Map usedIds -> usedIndices (indices relative to filteredFlashcards)
    if (usedIdsCookie) {
      try {
        const usedIds = JSON.parse(usedIdsCookie);
        usedIndices = usedIds.map(id => filteredFlashcards.findIndex(c => c.id === id)).filter(i => i >= 0);
      } catch (e) {
        usedIndices = [];
      }
    } else {
      usedIndices = [];
    }
    // Restore recentScores by id
    recentScores = Array(filteredFlashcards.length).fill(null);
    if (recentScoresByIdCookie) {
      try {
        const map = JSON.parse(recentScoresByIdCookie);
        Object.keys(map).forEach(id => {
          const idxInPool = filteredFlashcards.findIndex(c => c.id === (isNaN(Number(id)) ? id : Number(id)));
          if (idxInPool >= 0) recentScores[idxInPool] = map[id];
        });
      } catch (e) {
        // ignore
      }
    }
    // Restore currentCardIndex by id if possible
    if (currentCardIdCookie) {
      const curId = currentCardIdCookie;
      const found = filteredFlashcards.findIndex(c => c.id === (isNaN(Number(curId)) ? curId : Number(curId)));
      currentCardIndex = found >= 0 ? found : null;
    } else {
      currentCardIndex = null;
    }
  }
}
// Funkcja znajdująca nazwę tagu po jego kodzie
function findTagName(code) {
  const tag = tags.find(t => t.code === code);
  return tag ? tag.name : code;
}

// Helper: if a limit is enabled, apply it to current filteredFlashcards (shuffle+slice)
function applyLimitToFilteredFlashcards() {
  const limEnabled = getCookie('limitEnabled');
  const limCount = getCookie('limitCount');
  if (limEnabled === '1' && limCount) {
    const n = parseInt(limCount);
    if (!isNaN(n) && n > 0) {
      const arr = filteredFlashcards.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      filteredFlashcards = arr.slice(0, Math.min(n, arr.length));
      try { setCookie('limitedPoolIds', JSON.stringify(filteredFlashcards.map(c => c.id))); } catch (e) { setCookie('limitedPoolIds', ''); }
      return;
    }
  }
  // if not enabled, clear limited pool cookie
  setCookie('limitedPoolIds', '');
}

// Funkcja wyświetlająca fiszkę
function showCard(index) {
  const card = filteredFlashcards[index];
  
  // Znajdź nazwę dziedziny (pierwszy tag)
  let domainHtml = '';
  if (card.tags && card.tags.length > 0) {
    const domainName = findTagName(card.tags[0]);
    domainHtml = `<div class="domain_name">${domainName}</div>`;
  }
  
  // Dodaj informację o powtórce i dziedzinie
  if (wrongMode) {
    questionElement.innerHTML = `${domainHtml}<span style='color:var(--color-0-very-light);font-weight:bold;'>[Powtórka]</span> ${card.id}. ${card.question}`;
  } else {
    questionElement.innerHTML = `${domainHtml}${card.id}. ${card.question}`;
  }
  answerElement.innerHTML = ""; // Ukryj odpowiedź
  explanationElement.innerHTML = ""; // Ukryj wyjaśnienie

  // Zarządzaj obrazkiem
  if (card.hasImage) {
    imageElement.src = `./img/${card.id}.png`;
    imageElement.style.display = "block";
  } else {
    imageElement.style.display = "none";
  }

  // Zmień tekst i klasy przycisków
  badButton.textContent = "Odkryj fiszkę";
  goodButton.textContent = "Odkryj fiszkę";
  // don't clobber other classes (like 'flash') — use classList
  badButton.classList.remove('bad', 'good');
  badButton.classList.add('grey');
  goodButton.classList.remove('bad', 'good');
  goodButton.classList.add('grey');

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
  // switch classes without removing transient ones like 'flash'
  badButton.classList.remove('grey', 'good');
  badButton.classList.add('bad');
  goodButton.classList.remove('grey', 'bad');
  goodButton.classList.add('good');
  updateRemainingFlashcards();
}

// Obsługa przycisków
badButton.addEventListener("click", () => {
  if (badButton.classList.contains("grey")) {
    // flash then reveal
    flashButtons([badButton]).then(() => revealCard());
  } else {
    // flash then mark wrong and advance
    flashButtons([badButton]).then(() => {
      updateScore(false); // Użytkownik odpowiedział źle
      currentCardIndex = getRandomCard();
      saveStateToCookies();
      showCard(currentCardIndex);
      answerContainer.style.opacity = 0;
      explanationContainer.style.opacity = 0;
    });
  }
});

goodButton.addEventListener("click", () => {
  if (goodButton.classList.contains("grey")) {
    flashButtons([goodButton]).then(() => revealCard());
  } else {
    flashButtons([goodButton]).then(() => {
      updateScore(true); // Użytkownik odpowiedział dobrze
      currentCardIndex = getRandomCard();
      saveStateToCookies();
      showCard(currentCardIndex);
      answerContainer.style.opacity = 0;
      explanationContainer.style.opacity = 0;
    });
  }
});

// Obsługa klawiatury: strzałki lewo/prawo
// - jeśli fiszka jest zakryta (przyciski mają klasę 'grey') -> odkryj
// - jeśli fiszka jest odkryta -> lewo = źle, prawo = dobrze (tak jak przyciski)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  // Ignore typing in inputs/textareas/contenteditable
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

  // Prevent page scrolling when using arrows for navigation
  e.preventDefault();

  const isCovered = badButton.classList.contains('grey') || goodButton.classList.contains('grey');
  if (isCovered) {
    // Any arrow when covered should reveal. Flash both buttons visually first.
    flashButtons([badButton, goodButton]).then(() => revealCard());
    return;
  }

  // Card already revealed: left = wrong, right = good
  if (e.key === 'ArrowLeft') {
    // Flash bad button, then perform action
    flashButtons([badButton]).then(() => {
      updateScore(false);
      currentCardIndex = getRandomCard();
      saveStateToCookies();
      showCard(currentCardIndex);
      answerContainer.style.opacity = 0;
      explanationContainer.style.opacity = 0;
    });
  } else if (e.key === 'ArrowRight') {
    // Flash good button, then perform action
    flashButtons([goodButton]).then(() => {
      updateScore(true);
      currentCardIndex = getRandomCard();
      saveStateToCookies();
      showCard(currentCardIndex);
      answerContainer.style.opacity = 0;
      explanationContainer.style.opacity = 0;
    });
  }
});

// Helper to flash one or more buttons by toggling the 'flash' class briefly
function flashButtons(buttons, duration = 420) {
  return new Promise(resolve => {
    buttons.forEach(btn => {
      try { btn.classList.add('flash'); } catch (e) {}
    });
    setTimeout(() => {
      buttons.forEach(btn => { try { btn.classList.remove('flash'); } catch (e) {} });
      resolve();
    }, duration + 30);
  });
}

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
