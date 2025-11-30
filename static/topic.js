document.addEventListener('DOMContentLoaded', () => {

    // --- Елементи DOM ---
    const elements = {
        topicTitle: document.getElementById('topicMainTitle'), // Переконайтеся, що в topic.html ID саме такі
        // Якщо ви використовуєте id="topicTitleDisplay" з мого попереднього прикладу HTML, замініть тут.
        // Але судячи з вашого коду, ви використовуєте 'topicMainTitle'.
        
        breadcrumbTitle: document.getElementById('breadcrumbTopicTitle'),
        postsListContainer: document.getElementById('postsListContainer'), // або 'topicPostsContainer'
        
        newReplyContainer: document.getElementById('newReplyContainer'), // Контейнер форми відповіді
        newReplyForm: document.getElementById('newReplyForm') || document.getElementById('replyForm'),
        replyContent: document.getElementById('replyContent'),
        
        loginToReplyMessage: document.getElementById('loginToReplyMessage'),
        loginLink: document.getElementById('loginLink'),
        
        // Модальне вікно видалення
        deleteConfirmModal: document.getElementById('deleteConfirmModal'),
        deleteModalMessage: document.getElementById('deleteModalMessage'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
        deleteModalBack: document.getElementById('deleteModalBack')
    };

    let topicId = null;

    /**
     * Допоміжна функція для форматування тексту (безпека + переноси рядків)
     */
    function formatContent(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");
    }

    function getAvatarUrl(url, username) {
        if (url) {
            return url.startsWith('http') ? url : `${url}`;
        }
        const initial = username ? username.charAt(0).toUpperCase() : '?';
        return `https://ui-avatars.com/api/?name=${initial}&background=2D3748&color=fff&size=100`;
    }

    /**
     * Перевіряє статус логіну та показує/ховає форму відповіді.
     */
    function checkLoginAndToggleForm() {
        const token = localStorage.getItem('RightWheel_access_token');
        
        // Перевірка на існування елементів, щоб уникнути помилок в консолі
        if (elements.newReplyContainer && elements.loginToReplyMessage) {
            if (token) {
                elements.newReplyContainer.style.display = 'block';
                elements.loginToReplyMessage.style.display = 'none';
            } else {
                elements.newReplyContainer.style.display = 'none';
                elements.loginToReplyMessage.style.display = 'block';
            }
        }
    }

    /**
     * Отримує ID теми з URL
     */
    function getTopicIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        topicId = params.get('id');
        
        if (!topicId) {
            if(elements.topicTitle) elements.topicTitle.textContent = "Помилка: ID теми не вказано.";
            if(elements.postsListContainer) elements.postsListContainer.innerHTML = '';
        }
    }

    /**
     * Відкриває модальне вікно для підтвердження видалення.
     */
    function openDeleteConfirmationModal(postId, isFirstPost) {
        if (!elements.deleteConfirmModal) return;

        if (isFirstPost) {
            elements.deleteModalMessage.innerHTML = "Ви впевнені, що хочете видалити цю <b>тему</b>? Цю дію неможливо скасувати.<br><br><b>Будуть видалені всі відповіді в ній.</b>";
        } else {
            elements.deleteModalMessage.innerHTML = "Ви впевнені, що хочете видалити цю <b>відповідь</b>? Цю дію неможливо скасувати.";
        }
        
        elements.confirmDeleteBtn.dataset.postId = postId;
        elements.deleteConfirmModal.style.display = 'flex';
    }

    function closeDeleteConfirmationModal() {
        if (!elements.deleteConfirmModal) return;
        elements.deleteConfirmModal.style.display = 'none';
        elements.confirmDeleteBtn.dataset.postId = '';
    }

    /**
     * Завантажує деталі теми та всі її повідомлення.
     */
    async function loadTopicDetails() {
        if (!topicId) return;

        if(elements.topicTitle) elements.topicTitle.textContent = 'Завантаження теми...';
        if(elements.postsListContainer) elements.postsListContainer.innerHTML = '<p>Завантаження повідомлень...</p>';

        try {
            const response = await fetch(`/api/forum/topics/${topicId}`);
            
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json(); 

            // Оновлюємо заголовок сторінки
            if(elements.topicTitle) elements.topicTitle.textContent = data.title;
            if(elements.breadcrumbTitle) elements.breadcrumbTitle.textContent = data.title;
            document.title = `${data.title} — RightWheel`;

            renderPosts(data.posts);

        } catch (error) {
            console.error("Помилка завантаження теми:", error);
            if(elements.topicTitle) elements.topicTitle.textContent = "Помилка";
            if(elements.postsListContainer) elements.postsListContainer.innerHTML = `<p style="color: red;">Не вдалося завантажити тему: ${error.message}</p>`;
        }
    }

    /**
     * Відображає список повідомлень (ОНОВЛЕНИЙ ДИЗАЙН)
     */
    function renderPosts(posts) {
        if (!posts || posts.length === 0) {
            elements.postsListContainer.innerHTML = '<p>Немає повідомлень.</p>';
            return;
        }

        const currentUsername = localStorage.getItem('RightWheel_loggedInUser');

        elements.postsListContainer.innerHTML = posts.map((post, index) => {
            const dateObj = new Date(post.created_at);
            const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
            
            // Отримуємо URL аватарки
            const avatarSrc = getAvatarUrl(post.author_avatar, post.author_username);
            const profileLink = `user-profile.html?id=${post.author_id}`;

            const isFirstPost = (index === 0);
            const containerClass = isFirstPost ? 'forum-post initial-post' : 'forum-post';

            let deleteButtonHTML = '';
            if (post.author_username === currentUsername) {
                deleteButtonHTML = `<button class="btn danger small delete-post-btn" data-post-id="${post.id}" style="margin-left: 10px; padding: 2px 8px;">✕</button>`;
            }

            return `
                <div class="${containerClass}" id="post-${post.id}">
                    <div class="post-header-bar">
                        <span class="post-date">${dateStr} о ${timeStr}</span>
                        <div style="display: flex; align-items: center;">
                            <span class="post-number">#${index + 1}</span>
                            ${deleteButtonHTML}
                        </div>
                    </div>

                    <div class="post-body">
                        <aside class="post-user-aside" style="text-align: center;">
                            <a href="${profileLink}" style="text-decoration: none;">
                                <div class="user-avatar-placeholder">
                                    <img src="${avatarSrc}" alt="${post.author_username}">
                                </div>
                                <div class="post-username" style="margin-top: 8px; color: #E2E8F0;">${post.author_username || 'Анонім'}</div>
                            </a>
                            <div class="user-title">Користувач</div>
                        </aside>

                        <article class="post-content-area">
                            ${formatContent(post.content)}
                        </article>
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
            showInfoModal('Сесія застаріла', 'Будь ласка, увійдіть знову.', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/forum/posts/${postId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.msg || 'Не вдалося видалити пост');
            }

            showInfoModal('Успіх', data.message, 'success');

            if (data.message.includes('Тему')) {
                window.location.href = 'forum.html';
            } else {
                loadTopicDetails();
            }

        } catch (error) {
            console.error("Помилка видалення:", error);
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
            showInfoModal('Помилка', 'Введіть текст відповіді.', 'error');
            return;
        }
        if (!token) {
            showInfoModal('Потрібен вхід', 'Ви маєте бути залогінені.', 'info');
            return;
        }

        try {
            const response = await fetch(`/api/forum/topics/${topicId}/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || errorData.msg || 'Помилка відправки');
            }

            elements.newReplyForm.reset();
            loadTopicDetails();

        } catch (error) {
            console.error("Помилка відповіді:", error);
            showInfoModal('Помилка', error.message, 'error');
        }
    }

    // --- Ініціалізація та слухачі ---
    function initTopicPage() {
        getTopicIdFromUrl();
        checkLoginAndToggleForm();
        loadTopicDetails();

        if (elements.newReplyForm) {
            elements.newReplyForm.addEventListener('submit', handleReplySubmit);
        }
        
        // Делегування подій для кнопок видалення
        if (elements.postsListContainer) {
            elements.postsListContainer.addEventListener('click', (e) => {
                const deleteButton = e.target.closest('.delete-post-btn');
                if (deleteButton) {
                    const postId = deleteButton.dataset.postId;
                    if (postId) {
                        // Визначаємо, чи це перший пост, перевіряючи клас батьківського контейнера
                        const postContainer = deleteButton.closest('.forum-post');
                        const isFirstPost = postContainer && postContainer.classList.contains('initial-post');
                        
                        openDeleteConfirmationModal(postId, isFirstPost);
                    }
                }
            });
        }
        
        // Модальне вікно видалення
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', () => {
                const postId = elements.confirmDeleteBtn.dataset.postId;
                if (postId) {
                    closeDeleteConfirmationModal();
                    handleDeletePost(postId);
                }
            });
        }
        
        if(elements.cancelDeleteBtn) elements.cancelDeleteBtn.addEventListener('click', closeDeleteConfirmationModal);
        if(elements.closeDeleteModalBtn) elements.closeDeleteModalBtn.addEventListener('click', closeDeleteConfirmationModal);
        if(elements.deleteModalBack) elements.deleteModalBack.addEventListener('click', closeDeleteConfirmationModal);
        
        // Лінк логіну
        if (elements.loginLink) {
            elements.loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof showLoginModal === 'function') showLoginModal();
            });
        }
    }

    initTopicPage();
});