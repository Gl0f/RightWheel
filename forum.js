document.addEventListener('DOMContentLoaded', () => {

    // --- Елементи DOM ---
    const elements = {
        newPostContainer: document.getElementById('newPostContainer'),
        newPostForm: document.getElementById('newPostForm'),
        postTitle: document.getElementById('postTitle'),
        postContent: document.getElementById('postContent'),
        topicsListContainer: document.getElementById('topicsListContainer'),
        loginToPostMessage: document.getElementById('loginToPostMessage'),
        loginLink: document.getElementById('loginLink')
    };

    /**
     * Перевіряє статус логіну та показує/ховає форму.
     * Ця функція дублює логіку з app.js, але потрібна тут
     * для керування формою на цій сторінці.
     */
    function checkLoginAndToggleForm() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (token) {
            elements.newPostContainer.style.display = 'block';
            elements.loginToPostMessage.style.display = 'none';
        } else {
            elements.newPostContainer.style.display = 'none';
            elements.loginToPostMessage.style.display = 'block';
        }
    }

    /**
     * Завантажує список тем з сервера.
     */
    async function loadTopics() {
        elements.topicsListContainer.innerHTML = '<p>Завантаження тем...</p>';

        try {
           
            const response = await fetch('http://127.0.0.1:5000/api/forum/topics');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const topics = await response.json(); // Очікуємо масив [ {id, title, author_username, created_at, post_count}, ... ]

            renderTopics(topics);

        } catch (error) {
            console.error("Помилка завантаження тем:", error);
            elements.topicsListContainer.innerHTML = `<p style="color: red;">Не вдалося завантажити теми.</p>`;
        }
    }

    // --- ДОПОМІЖНА ФУНКЦІЯ ДЛЯ АВАТАРКИ ---
    function getAvatarUrl(url, username) {
        if (url) {
            return url.startsWith('http') ? url : `http://127.0.0.1:5000${url}`;
        }
        const initial = username ? username.charAt(0).toUpperCase() : '?';
        return `https://ui-avatars.com/api/?name=${initial}&background=2D3748&color=fff&size=100`;
    }

    /**
     * Відображає список тем у контейнері (Оновлений дизайн TMC)
     * @param {Array} topics - Масив об'єктів тем
     */
    function renderTopics(topics) {
        if (!topics || topics.length === 0) {
            elements.topicsListContainer.innerHTML = `
                <div class="empty-state" style="border: none; padding: 40px; text-align: center;">
                    <h3 style="color: #E2E8F0;">Тем поки немає 🤷‍♂️</h3>
                    <p style="color: #A0AEC0;">Станьте першим, хто почне обговорення!</p>
                </div>`;
            return;
        }

        elements.topicsListContainer.innerHTML = topics.map(topic => {
            const topicLink = `topic.html?id=${topic.id}`; 
            // Посилання на профіль
            const profileLink = `user-profile.html?id=${topic.author_id}`;
            
            const dateObj = new Date(topic.created_at);
            const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
            
            const avatarSrc = getAvatarUrl(topic.author_avatar, topic.author_username);

            return `
                <div class="forum-topic-row">
                    <a href="${profileLink}" class="topic-icon" style="overflow: hidden; border-radius: 50%; width: 40px; height: 40px; display: block;">
                        <img src="${avatarSrc}" alt="${topic.author_username}" style="width: 100%; height: 100%; object-fit: cover;">
                    </a>

                    <div class="topic-main-info">
                        <a href="${topicLink}" class="topic-title" style="text-decoration: none; color: inherit;">${topic.title}</a>
                        <div class="topic-meta">
                            Автор: <a href="${profileLink}" class="topic-author" style="color: #A0AEC0; text-decoration: none;">${topic.author_username || 'Анонім'}</a>
                        </div>
                    </div>

                    <div class="topic-stats">
                        <span class="stat-value">${topic.post_count || 0}</span>
                        <span class="stat-label">відповідей</span>
                    </div>

                    <div class="topic-last-post">
                        <div>${dateStr}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Обробляє відправку нової теми.
     */
    async function handlePostSubmit(e) {
        e.preventDefault();
        
        const title = elements.postTitle.value.trim();
        const content = elements.postContent.value.trim();
        const token = localStorage.getItem('RightWheel_access_token');

        if (!title || !content) {
            showInfoModal('Помилка', 'Будь ласка, заповніть заголовок та текст повідомлення.', 'error');
            return;
        }

        if (!token) {
            showInfoModal('Потрібен вхід', 'Ви маєте бути залогінені, щоб створювати теми.', 'info');
            return;
        }

        try {
            
            const response = await fetch('http://127.0.0.1:5000/api/forum/topics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, content })
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 // Перевіряємо поле "error" АБО "msg" (для JWT помилок)
                 const errorMessage = errorData.error || errorData.msg || 'Не вдалося надіслати повідомлення';
                 throw new Error(errorMessage);
            }

            
            showInfoModal('Успіх', 'Тему успішно створено!', 'success');
            elements.newPostForm.reset(); // Очищуємо форму
            loadTopics(); // Оновлюємо список тем

        } catch (error) {
            console.error("Помилка створення теми:", error);
            showInfoModal('Помилка', error.message, 'error');
        }
    }

    /**
     * Ініціалізація сторінки
     */
    function init() {
        // Перевіряємо логін, щоб показати/сховати форму
        checkLoginAndToggleForm();
        
        // Завантажуємо список тем
        loadTopics();

        // Додаємо слухач на форму
        elements.newPostForm.addEventListener('submit', handlePostSubmit);
        
        // Додаємо слухач на посилання "увійдіть" (яке викликає модалку з app.js)
        elements.loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (typeof showLoginModal === 'function') {
                showLoginModal();
            } else {
                console.error('Помилка: не вдалося знайти функцію логіну.');
            }
        });
    }

    init();
});
