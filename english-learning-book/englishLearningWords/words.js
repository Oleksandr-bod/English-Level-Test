(function() {
    const loadingDiv = document.getElementById('loading');
    const progressDiv = document.getElementById('progress');
    const questionContainer = document.getElementById('question-container');
    const congratsDiv = document.getElementById('congrats');
    const noWordsDiv = document.getElementById('no-words');
    const englishWordDiv = document.getElementById('english-word');
    const optionButtons = document.querySelectorAll('.option-btn');
    const messageDiv = document.getElementById('message');
    const learnedSpan = document.getElementById('learned-count');
    const totalSpan = document.getElementById('total-count');
    const backToBookBtn = document.getElementById('back-to-book');

    // ---------- ЗВУК ----------
    let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const soundToggleBtn = document.getElementById('sound-toggle');
    if (soundToggleBtn) {
        soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
        soundToggleBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('soundEnabled', soundEnabled);
            soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
        });
    }

    function speakWord(word) {
        if (!soundEnabled) return;
        if (!window.speechSynthesis) {
            console.warn('Web Speech API не підтримується');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    // Озвучування при кліку на англійське слово
    if (englishWordDiv) {
        englishWordDiv.addEventListener('click', () => {
            if (currentWordItem) {
                speakWord(currentWordItem.original);
            }
        });
    }

    // ---------- ІНШІ ЗМІННІ ----------
    let wordsList = [];
    let currentWordItem = null;
    let learnedCount = 0;
    let totalWords = 0;
    let canAnswer = true;
    let autoNextTimeout = null;

    // Отримуємо слова з sessionStorage
    const storedWords = sessionStorage.getItem('learningWords');
    if (!storedWords) {
        loadingDiv.style.display = 'none';
        noWordsDiv.style.display = 'block';
        return;
    }

    let words;
    try {
        words = JSON.parse(storedWords);
    } catch (e) {
        loadingDiv.style.display = 'none';
        noWordsDiv.style.display = 'block';
        return;
    }

    if (!Array.isArray(words) || words.length < 4) {
        loadingDiv.style.display = 'none';
        noWordsDiv.style.display = 'block';
        return;
    }

    totalWords = words.length;
    totalSpan.textContent = totalWords;

    // Кнопка "До книги"
    if (backToBookBtn) {
        backToBookBtn.addEventListener('click', () => {
            const bookPage = sessionStorage.getItem('bookPage');
            const bookCurrentPage = sessionStorage.getItem('bookCurrentPage');
            if (bookPage) {
                const url = new URL(bookPage, window.location.origin);
                if (bookCurrentPage !== null) {
                    url.searchParams.set('page', bookCurrentPage);
                }
                window.location.href = url.toString();
            } else {
                window.location.href = '../../english-learning-book/index.html';
            }
        });
    }

    // Завантаження перекладів
    async function fetchAllTranslations(wordArray) {
        const translations = {};
        const chunkSize = 5;
        for (let i = 0; i < wordArray.length; i += chunkSize) {
            const chunk = wordArray.slice(i, i + chunkSize);
            const promises = chunk.map(async (word) => {
                const cached = localStorage.getItem(`translation_${word.toLowerCase()}`);
                if (cached) {
                    translations[word.toLowerCase()] = cached;
                    return;
                }
                const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|uk`;
                try {
                    const response = await fetch(url);
                    const data = await response.json();
                    let translation = data.responseData?.translatedText;
                    if (!translation || translation.trim() === '' || translation.toLowerCase() === word.toLowerCase()) {
                        translation = word;
                    }
                    translations[word.toLowerCase()] = translation;
                    localStorage.setItem(`translation_${word.toLowerCase()}`, translation);
                } catch (error) {
                    console.warn('Помилка перекладу для', word, error);
                    translations[word.toLowerCase()] = word;
                }
            });
            await Promise.all(promises);
            loadingDiv.innerHTML = `Завантаження перекладів... ${Math.min(i + chunkSize, wordArray.length)}/${wordArray.length} <span class="loading-indicator"></span>`;
        }
        return translations;
    }

    // Запуск
    fetchAllTranslations(words).then(translations => {
        wordsList = words.map(original => {
            const lower = original.toLowerCase();
            return {
                original: original,
                lower: lower,
                translation: translations[lower] || original,
                consecutive: 0,
                learned: false
            };
        });

        loadingDiv.style.display = 'none';
        progressDiv.style.display = 'block';
        questionContainer.style.display = 'block';

        learnedCount = wordsList.filter(w => w.learned).length;
        updateProgress();

        pickNewWord();
    }).catch(error => {
        console.error('Помилка при завантаженні перекладів:', error);
        loadingDiv.innerHTML = 'Помилка завантаження перекладів. Спробуйте пізніше.';
    });

    function updateProgress() {
        learnedSpan.textContent = learnedCount;
        totalSpan.textContent = totalWords;
    }

    function pickNewWord() {
        const unlearned = wordsList.filter(w => !w.learned);
        if (unlearned.length === 0) {
            questionContainer.style.display = 'none';
            progressDiv.style.display = 'none';
            congratsDiv.style.display = 'block';
            return;
        }

        const randomIndex = Math.floor(Math.random() * unlearned.length);
        currentWordItem = unlearned[randomIndex];

        englishWordDiv.textContent = currentWordItem.original;

        generateOptions(currentWordItem);

        messageDiv.textContent = '';
        canAnswer = true;
        optionButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('correct', 'wrong');
        });

        // Озвучуємо нове слово
        speakWord(currentWordItem.original);
    }

    function generateOptions(correctItem) {
        const correctTranslation = correctItem.translation;

        const otherTranslations = wordsList
            .filter(w => w !== correctItem)
            .map(w => w.translation);

        shuffleArray(otherTranslations);

        const uniqueDistractors = [];
        const seen = new Set();
        for (let trans of otherTranslations) {
            if (uniqueDistractors.length >= 3) break;
            if (!seen.has(trans) && trans !== correctTranslation) {
                seen.add(trans);
                uniqueDistractors.push(trans);
            }
        }
        while (uniqueDistractors.length < 3) {
            uniqueDistractors.push('???');
        }

        const options = [
            { text: correctTranslation, isCorrect: true },
            { text: uniqueDistractors[0], isCorrect: false },
            { text: uniqueDistractors[1], isCorrect: false },
            { text: uniqueDistractors[2], isCorrect: false }
        ];
        shuffleArray(options);

        optionButtons.forEach((btn, index) => {
            btn.textContent = options[index].text;
            btn.dataset.correct = options[index].isCorrect ? 'true' : 'false';
        });
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    // Обробка кліку на варіант відповіді
    optionButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (!canAnswer) return;
            canAnswer = false;

            if (autoNextTimeout) clearTimeout(autoNextTimeout);

            const isCorrect = this.dataset.correct === 'true';

            optionButtons.forEach(b => b.disabled = true);

            if (isCorrect) {
                this.classList.add('correct');
                messageDiv.textContent = '✅ Правильно!';
                currentWordItem.consecutive += 1;
                if (currentWordItem.consecutive >= 5) {
                    currentWordItem.learned = true;
                    learnedCount++;
                    updateProgress();
                    messageDiv.textContent += ' Слово вивчено!';
                }
            } else {
                this.classList.add('wrong');
                optionButtons.forEach(b => {
                    if (b.dataset.correct === 'true') {
                        b.classList.add('correct');
                    }
                });
                messageDiv.textContent = `❌ Неправильно. Правильна відповідь: ${currentWordItem.translation}`;
                currentWordItem.consecutive = 0;
            }

            // Автоматичний перехід до наступного слова через 1.5 секунди
            autoNextTimeout = setTimeout(() => {
                pickNewWord();
            }, 1500);
        });
    });
})();

