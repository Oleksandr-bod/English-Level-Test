// ========== main.js – спільна логіка для всіх рівнів ==========

// ---------- 1. Визначаємо рівень і ключ для localStorage ----------
const level = (() => {
    const path = window.location.pathname;
    if (path.includes('a1.html')) return 'A1';
    if (path.includes('a2.html')) return 'A2';
    if (path.includes('b1.html')) return 'B1';
    if (path.includes('b2.html')) return 'B2';
    if (path.includes('c1.html')) return 'C1';
    if (path.includes('c2.html')) return 'C2';
    // Якщо не вдалося визначити – використовуємо загальний ключ (не повинно статися)
    return 'unknown';
})();

const STORAGE_KEY = `englishGameState_${level}`;

// ---------- 2. Глобальні змінні (wordList та TOTAL_WORDS мають бути визначені в підключеному файлі словника) ----------
const TOTAL_WORDS = wordList.length;   // кількість слів для цього рівня
let words = wordList;                  // масив слів

let wordProgress = [];
let learnedCount = 0;
let activeIndices = [];
let currentWordIndex = null;
let textVisible = true;
let autoSpeak = true;

// ---------- 3. DOM елементи ----------
const englishWordSpan = document.getElementById('english-word');
const speakBtn = document.getElementById('speak-btn');
const optionsDiv = document.getElementById('options');
const messageDiv = document.getElementById('message');
const learnedSpan = document.getElementById('learned-count');
const totalSpan = document.getElementById('total-words');
const resetBtn = document.getElementById('reset-btn');
const showTextCheckbox = document.getElementById('show-text');
const autoSpeakCheckbox = document.getElementById('auto-speak');

// ---------- 4. Завантаження / збереження стану ----------
function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const state = JSON.parse(saved);
            wordProgress = state.wordProgress || Array(TOTAL_WORDS).fill(0);
            learnedCount = state.learnedCount || 0;
            activeIndices = state.activeIndices || [];
            textVisible = state.textVisible !== undefined ? state.textVisible : true;
            autoSpeak = state.autoSpeak !== undefined ? state.autoSpeak : true;

            // Фільтруємо активні індекси – тільки ті, де прогрес < 5
            activeIndices = activeIndices.filter(idx => wordProgress[idx] < 5);

            // Якщо активних немає, але ще не всі вивчені – перезапускаємо
            if (activeIndices.length === 0 && learnedCount < TOTAL_WORDS) {
                initNewGame();
            } else {
                // Встановлюємо поточне слово
                if (!activeIndices.includes(state.currentWordIndex) && activeIndices.length > 0) {
                    currentWordIndex = activeIndices[0];
                } else {
                    currentWordIndex = state.currentWordIndex;
                }
            }
        } catch (e) {
            initNewGame();
        }
    } else {
        initNewGame();
    }

    // Оновлюємо чекбокси відповідно до збережених налаштувань
    showTextCheckbox.checked = textVisible;
    autoSpeakCheckbox.checked = autoSpeak;
    updateTextVisibility();
    updateUI();
}

function saveState() {
    const state = {
        wordProgress,
        learnedCount,
        activeIndices,
        currentWordIndex,
        textVisible,
        autoSpeak
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function initNewGame() {
    wordProgress = Array(TOTAL_WORDS).fill(0);
    learnedCount = 0;
    const allIndices = [...Array(TOTAL_WORDS).keys()];
    shuffleArray(allIndices);
    activeIndices = allIndices.slice(0, Math.min(10, TOTAL_WORDS));
    currentWordIndex = activeIndices.length > 0 ? activeIndices[0] : null;
    textVisible = true;
    autoSpeak = true;
    showTextCheckbox.checked = true;
    autoSpeakCheckbox.checked = true;
    updateTextVisibility();
    saveState();
}

// ---------- 5. Допоміжні функції ----------
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function updateTextVisibility() {
    englishWordSpan.style.visibility = textVisible ? 'visible' : 'hidden';
}

function speakWord(word) {
    if (!word) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}

function getOptionsForCurrent() {
    if (currentWordIndex === null) return [];
    const correctUa = words[currentWordIndex].ua;
    const otherIndices = [];

    // Збираємо індекси слів, які ще не вивчені (прогрес < 5) і не є поточним
    for (let i = 0; i < TOTAL_WORDS; i++) {
        if (i !== currentWordIndex && wordProgress[i] < 5) {
            otherIndices.push(i);
        }
    }

    // Якщо таких слів менше 3, додаємо будь-які інші (навіть вивчені)
    if (otherIndices.length < 3) {
        for (let i = 0; i < TOTAL_WORDS; i++) {
            if (i !== currentWordIndex && !otherIndices.includes(i)) {
                otherIndices.push(i);
                if (otherIndices.length >= 3) break;
            }
        }
    }

    shuffleArray(otherIndices);
    const randomOthers = otherIndices.slice(0, 3).map(idx => words[idx].ua);
    let opts = [correctUa, ...randomOthers];
    shuffleArray(opts);
    return opts;
}

function renderOptions() {
    if (currentWordIndex === null) {
        optionsDiv.innerHTML = ''; // буде показано вітання
        return;
    }
    const opts = getOptionsForCurrent();
    optionsDiv.innerHTML = '';
    opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => handleAnswer(opt));
        optionsDiv.appendChild(btn);
    });
}

function handleAnswer(selectedUa) {
    if (currentWordIndex === null) return;
    const correctUa = words[currentWordIndex].ua;
    const isCorrect = (selectedUa === correctUa);
    const buttons = document.querySelectorAll('.option-btn');

    // Видаляємо попередні класи
    buttons.forEach(btn => {
        btn.classList.remove('correct', 'wrong');
    });

    // Підсвічуємо правильну відповідь
    buttons.forEach(btn => {
        if (btn.textContent === correctUa) {
            btn.classList.add('correct');
        }
    });

    // Якщо відповідь неправильна – підсвічуємо вибрану кнопку як wrong
    if (!isCorrect) {
        buttons.forEach(btn => {
            if (btn.textContent === selectedUa) {
                btn.classList.add('wrong');
            }
        });
    }

    // Блокуємо всі кнопки
    buttons.forEach(btn => btn.disabled = true);

    // Оновлюємо прогрес
    if (isCorrect) {
        wordProgress[currentWordIndex] += 1;
        messageDiv.textContent = '✅ Правильно!';
        if (wordProgress[currentWordIndex] === 5) {
            learnedCount++;
            activeIndices = activeIndices.filter(idx => idx !== currentWordIndex);
            // Додаємо нове невивчене слово, якщо є
            const unlearned = [];
            for (let i = 0; i < TOTAL_WORDS; i++) {
                if (wordProgress[i] < 5 && !activeIndices.includes(i)) {
                    unlearned.push(i);
                }
            }
            if (unlearned.length > 0) {
                shuffleArray(unlearned);
                activeIndices.push(unlearned[0]);
            }
        }
    } else {
        wordProgress[currentWordIndex] = 0;
        messageDiv.textContent = '❌ Неправильно. Спробуйте ще раз.';
    }

    learnedCount = wordProgress.filter(v => v >= 5).length;

    // Вибираємо наступне слово
    if (activeIndices.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeIndices.length);
        currentWordIndex = activeIndices[randomIndex];
    } else {
        currentWordIndex = null;
    }

    saveState();

    // Через 1.5 секунди оновлюємо інтерфейс
    setTimeout(() => {
        updateUI();
    }, 1500);
}

// ---------- 6. Вітання після завершення рівня ----------
function showCongratulations() {
    englishWordSpan.textContent = '';
    speakBtn.style.display = 'none';
    optionsDiv.innerHTML = `
        <div class="congrats-message">
            <h2>🎉 Вітаємо! 🎉</h2>
            <p>Ви вивчили всі ${TOTAL_WORDS} слів рівня ${level}!</p>
            <p>Ви молодці! Бажаємо успіхів у подальшому вивченні.</p>
            <button id="play-again-btn" class="btn" style="margin-top: 20px;">Грати знову</button>
        </div>
    `;
    document.getElementById('play-again-btn').addEventListener('click', () => {
        initNewGame();
        speakBtn.style.display = 'inline-flex';
        updateUI();
    });
    messageDiv.textContent = '';
}

function updateUI() {
    if (learnedCount === TOTAL_WORDS) {
        showCongratulations();
        return;
    }

    speakBtn.style.display = 'inline-flex';

    if (currentWordIndex !== null) {
        englishWordSpan.textContent = words[currentWordIndex].en;
        if (autoSpeak) {
            speakWord(words[currentWordIndex].en);
        }
    } else {
        englishWordSpan.textContent = 'Вітаємо!';
    }

    learnedSpan.textContent = learnedCount;
    totalSpan.textContent = TOTAL_WORDS;
    renderOptions();
    updateTextVisibility();
}

// ---------- 7. Обробники подій ----------
speakBtn.addEventListener('click', () => {
    if (currentWordIndex !== null) {
        speakWord(words[currentWordIndex].en);
    }
});

resetBtn.addEventListener('click', () => {
    initNewGame();
    speakBtn.style.display = 'inline-flex';
    updateUI();
});

showTextCheckbox.addEventListener('change', (e) => {
    textVisible = e.target.checked;
    updateTextVisibility();
    saveState();
});

autoSpeakCheckbox.addEventListener('change', (e) => {
    autoSpeak = e.target.checked;
    saveState();
});

// ---------- 8. Запуск ----------
loadState();