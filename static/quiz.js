document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        // Основне вікно гри
        openBtn: document.getElementById('openQuizModalBtn'),
        closeBtn: document.getElementById('closeQuizModalBtn'),
        modal: document.getElementById('quizModal'),
        modalBack: document.querySelector('#quizModal .modal-back'),
        
        image: document.getElementById('quizImage'),
        optionsGrid: document.getElementById('quizOptions'),
        scoreSpan: document.getElementById('quizScore'),
        nextBtn: document.getElementById('quizNextBtn'),

        // НОВЕ: Елементи вікна програшу
        gameOverModal: document.getElementById('gameOverModal'),
        correctText: document.getElementById('correctAnswerText'),
        retryBtn: document.getElementById('gameOverRetryBtn'),
        gameOverCloseBtn: document.getElementById('gameOverCloseBtn')
    };

    let score = 0;
    let currentCorrectAnswer = "";
    let isAnswered = false;

    // --- ВІДКРИТТЯ / ЗАКРИТТЯ ГРИ ---
    if(elements.openBtn) {
        elements.openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            score = 0; // Скидаємо рахунок при відкритті
            elements.scoreSpan.textContent = score;
            elements.modal.style.display = 'flex';
            loadNewQuestion();
        });
    }

    const closeModal = () => {
        elements.modal.style.display = 'none';
        if(elements.gameOverModal) elements.gameOverModal.style.display = 'none';
    };

    if(elements.closeBtn) elements.closeBtn.addEventListener('click', closeModal);
    // Закриття по кліку на фон (тільки для основного вікна, не для Game Over)
    if(elements.modalBack) elements.modalBack.addEventListener('click', closeModal);


    // --- ЛОГІКА ЗАВАНТАЖЕННЯ ---
    async function loadNewQuestion() {
        isAnswered = false;
        elements.nextBtn.style.display = 'none';
        elements.optionsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: grey;">Завантаження...</p>';
        elements.image.style.opacity = "0.5"; // Трохи тьмяніша поки вантажиться

        try {
            const res = await fetch('/api/quiz/question');
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Встановлюємо дані
            elements.image.src = data.image_url;
            elements.image.onload = () => elements.image.style.opacity = "1";
            currentCorrectAnswer = data.correct_answer;

            // Перемішуємо варіанти
            const shuffledOptions = data.options.sort(() => Math.random() - 0.5);

            // Малюємо кнопки
            elements.optionsGrid.innerHTML = '';
            shuffledOptions.forEach(option => {
                const btn = document.createElement('button');
                btn.className = 'quiz-option-btn';
                btn.textContent = option;
                btn.onclick = () => checkAnswer(btn, option);
                elements.optionsGrid.appendChild(btn);
            });

        } catch (e) {
            console.error(e);
            elements.optionsGrid.innerHTML = '<p style="color: red;">Помилка сервера. Спробуйте пізніше.</p>';
        }
    }

    // --- ПЕРЕВІРКА ВІДПОВІДІ ---
    function checkAnswer(btn, selectedOption) {
        if (isAnswered) return; 
        isAnswered = true;

        const allButtons = document.querySelectorAll('.quiz-option-btn');
        allButtons.forEach(b => b.disabled = true); // Блокуємо всі кнопки

        if (selectedOption === currentCorrectAnswer) {
            // === ПРАВИЛЬНО ===
            btn.classList.add('correct');
            score++;
            elements.scoreSpan.textContent = score;
            elements.nextBtn.style.display = 'inline-block'; // Кнопка "Далі"
            
        } else {
            // === НЕПРАВИЛЬНО (ПРОГРАШ) ===
            btn.classList.add('wrong');
            
            // Підсвічуємо правильну відповідь зеленим
            allButtons.forEach(b => {
                if (b.textContent === currentCorrectAnswer) b.classList.add('correct');
            });

            // Відкриваємо вікно програшу з затримкою 0.8 сек (щоб встиг побачити, що помилився)
            setTimeout(() => {
                if(elements.gameOverModal) {
                    elements.correctText.textContent = currentCorrectAnswer;
                    elements.gameOverModal.style.display = 'flex';
                }
            }, 800);
        }
    }

    // --- КНОПКИ У ВІКНІ ПРОГРАШУ ---
    
    // 1. Грати знову
    if(elements.retryBtn) {
        elements.retryBtn.addEventListener('click', () => {
            elements.gameOverModal.style.display = 'none'; // Ховаємо вікно програшу
            score = 0; // Скидаємо рахунок
            elements.scoreSpan.textContent = score;
            loadNewQuestion(); // Вантажимо нове питання
        });
    }

    // 2. Закрити все
    if(elements.gameOverCloseBtn) {
        elements.gameOverCloseBtn.addEventListener('click', () => {
            elements.gameOverModal.style.display = 'none';
            elements.modal.style.display = 'none'; // Закриваємо і саму гру
        });
    }

    // Кнопка "Наступне питання" (тільки якщо виграв)
    if(elements.nextBtn) {
        elements.nextBtn.addEventListener('click', loadNewQuestion);
    }
});