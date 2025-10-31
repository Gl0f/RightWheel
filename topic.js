document.addEventListener('DOMContentLoaded', () => {

    // --- Елементи DOM ---
    const elements = {
        topicTitle: document.getElementById('topicMainTitle'),
        breadcrumbTitle: document.getElementById('breadcrumbTopicTitle'),
        postsListContainer: document.getElementById('postsListContainer'),
        
        newReplyContainer: document.getElementById('newReplyContainer'),
        newReplyForm: document.getElementById('newReplyForm'),
        replyContent: document.getElementById('replyContent'),
        
        loginToReplyMessage: document.getElementById('loginToReplyMessage'),
        loginLink: document.getElementById('loginLink'),
        deleteConfirmModal: document.getElementById('deleteConfirmModal'),
        deleteModalMessage: document.getElementById('deleteModalMessage'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
        deleteModalBack: document.getElementById('deleteModalBack')
    };

    let topicId = null;

    /**
     * Перевіряє статус логіну та показує/ховає форму відповіді.
     */
    function checkLoginAndToggleForm() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (token) {
            elements.newReplyContainer.style.display = 'block';
            elements.loginToReplyMessage.style.display = 'none';
        } else {
            elements.newReplyContainer.style.display = 'none';
            elements.loginToReplyMessage.style.display = 'block';
        }
    }

    /**
     * Отримує ID теми з URL
     */
    function getTopicIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        topicId = params.get('id');
        if (!topicId) {
            elements.topicTitle.textContent = "Помилка: ID теми не вказано.";
            elements.postsListContainer.innerHTML = '';
        }
    }


    /**
     * Відкриває модальне вікно для підтвердження видалення.
     * @param {string} postId - ID поста, що видаляється.
     * @param {boolean} isFirstPost - Чи є цей пост першим (тобто, самою темою).
     */
    function openDeleteConfirmationModal(postId, isFirstPost) {
        if (!elements.deleteConfirmModal) return;

        // Оновлюємо текст повідомлення
        if (isFirstPost) {
            elements.deleteModalMessage.innerHTML = "Ви впевнені, що хочете видалити цю <b>тему</b>? Цю дію неможливо скасувати.<br><br><b>Будуть видалені всі відповіді в ній.</b>";
        } else {
            elements.deleteModalMessage.innerHTML = "Ви впевнені, що хочете видалити цю <b>відповідь</b>? Цю дію неможливо скасувати.";
        }
        
        // Зберігаємо ID поста на кнопці для подальшого використання
        elements.confirmDeleteBtn.dataset.postId = postId;
        
        // Показуємо вікно
        elements.deleteConfirmModal.style.display = 'flex';
    }

    /**
     * Закриває модальне вікно підтвердження.
     */
    function closeDeleteConfirmationModal() {
        if (!elements.deleteConfirmModal) return;
        
        // Ховаємо вікно
        elements.deleteConfirmModal.style.display = 'none';
        
        // Очищуємо ID з кнопки
        elements.confirmDeleteBtn.dataset.postId = '';
    }

    /**
     * Завантажує деталі теми та всі її повідомлення.
     */
    async function loadTopicDetails() {
        if (!topicId) return;

        elements.topicTitle.textContent = 'Завантаження теми...';
        elements.postsListContainer.innerHTML = '<p>Завантаження повідомлень...</p>';

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/forum/topics/${topicId}`);
            
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json(); // { id, title, created_at, author_username, posts: [...] }

            // Оновлюємо заголовок сторінки та хлібні крихти
            elements.topicTitle.textContent = data.title;
            elements.breadcrumbTitle.textContent = data.title;
            document.title = `${data.title} — RightWheel`;

            renderPosts(data.posts);

        } catch (error) {
            console.error("Помилка завантаження теми:", error);
            elements.topicTitle.textContent = "Помилка";
            elements.postsListContainer.innerHTML = `<p style="color: red;">Не вдалося завантажити тему: ${error.message}</p>`;
        }
    }

    /**
     * Відображає список повідомлень.
     */

/**
 * Відображає список повідомлень.
 */
    function renderPosts(posts) {
        if (!posts || posts.length === 0) {
            elements.postsListContainer.innerHTML = '<p>У цій темі ще немає повідомлень.</p>';
            return;
        }

        // Отримуємо ім'я поточного залогіненого користувача
        const currentUsername = localStorage.getItem('RightWheel_loggedInUser') || null;

        elements.postsListContainer.innerHTML = posts.map((post, index) => {
            const createdDate = new Date(post.created_at).toLocaleString('uk-UA');
            const postClass = (index === 0) ? 'post-card initial-post' : 'post-card';

            // --- Логіка для кнопки видалення ---
            let deleteButtonHTML = '';
            if (post.author_username === currentUsername) {
                // Цей пост належить поточному користувачу, показуємо кнопку
                deleteButtonHTML = `
                    <button class="btn danger small delete-post-btn" data-post-id="${post.id}" title="Видалити">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                `;
            }
            // --- Кінець логіки ---

            return `
                <div class="${postClass}">
                    <div class="post-header">
                        <span>Автор: <strong>${post.author_username || 'Анонім'}</strong></span>
                        <div class="post-header-actions">
                            <span>${createdDate}</span>
                            ${deleteButtonHTML} </div>
                    </div>
                    <div class="post-content">
                        ${post.content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }).join('');
    }


/**
 * Обробляє видалення поста.
 */
    async function handleDeletePost(postId) {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) {
            showInfoModal('Сесія застаріла', 'Будь ласка, увійдіть знову, щоб керувати обраним.', 'error');
            return;
        }

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/forum/posts/${postId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json(); // Отримуємо відповідь у будь-якому випадку

            if (!response.ok) {
                const errorMessage = data.error || data.msg || 'Не вдалося видалити пост';
                throw new Error(errorMessage);
            }

            
            showInfoModal('Успіх', data.message, 'success'); // "Тему успішно видалено" або "Відповідь успішно видалено"

            // Перевіряємо, чи була видалена вся тема
            if (data.message.includes('Тему')) {
                // Якщо так, повертаємо користувача на сторінку форуму
                window.location.href = 'forum.html';
            } else {
                // Інакше просто оновлюємо список постів
                loadTopicDetails();
            }

        } catch (error) {
            console.error("Помилка видалення поста:", error);
            showInfoModal('Помилка', error.message, 'error');
        }
    }

    /**
     * Обробляє відправку нової відповіді.
     */
    async function handleReplySubmit(e) {
        e.preventDefault();
        
        const content = elements.replyContent.value.trim();
        const token = localStorage.getItem('RightWheel_access_token');

        if (!content) {
            showInfoModal('Помилка', 'Будь ласка, введіть текст відповіді.', 'error');
            return;
        }
        if (!token) {
            showInfoModal('Потрібен вхід', 'Ви маєте бути залогінені, щоб відповідати.', 'info');
            return;
        }
        if (!topicId) {
            showInfoModal('Помилка', 'Помилка: невідомий ID теми.', 'error');
            return;
        }

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/forum/topics/${topicId}/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 // Перевіряємо поле "error" АБО "msg" (для JWT помилок)
                 const errorMessage = errorData.error || errorData.msg || 'Не вдалося надіслати відповідь';
                 throw new Error(errorMessage);
            }

           
            elements.newReplyForm.reset(); // Очищуємо форму
            loadTopicDetails(); // Оновлюємо список повідомлень

        } catch (error) {
            console.error("Помилка відправки відповіді:", error);
            showInfoModal('Помилка', error.message, 'error');
        }
    }

    /**
     * Ініціалізація сторінки
     */

    function initTopicPage() {
        getTopicIdFromUrl();
        checkLoginAndToggleForm();
        loadTopicDetails();

        // Слухач на форму відповіді
        elements.newReplyForm.addEventListener('submit', handleReplySubmit);
        
        // Слухач на кліки в списку постів (для кнопки "Видалити")
        elements.postsListContainer.addEventListener('click', (e) => {
            const deleteButton = e.target.closest('.delete-post-btn');
            if (deleteButton) {
                const postId = deleteButton.dataset.postId;
                if (postId) {
                   
                    // Перевіряємо, чи це перший пост
                    const isFirstPost = deleteButton.closest('.post-card').classList.contains('initial-post');
                    // Відкриваємо наше нове модальне вікно
                    openDeleteConfirmationModal(postId, isFirstPost);
                   
                }
            }
        });
        
        elements.confirmDeleteBtn.addEventListener('click', () => {
            const postId = elements.confirmDeleteBtn.dataset.postId;
            if (postId) {
                closeDeleteConfirmationModal(); // Спочатку закриваємо
                handleDeletePost(postId);       // Потім видаляємо
            }
        });
        
        elements.cancelDeleteBtn.addEventListener('click', closeDeleteConfirmationModal);
        elements.closeDeleteModalBtn.addEventListener('click', closeDeleteConfirmationModal);
        elements.deleteModalBack.addEventListener('click', closeDeleteConfirmationModal);
        
        // Слухач на посилання "Увійдіть"
        elements.loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof showLoginModal === 'function') {
                showLoginModal();
            } else {
                console.error('Помилка: не вдалося знайти функцію логіну.');
            }
        });
    }

    initTopicPage();
});