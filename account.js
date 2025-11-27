document.addEventListener('DOMContentLoaded', () => {

    const elements = {
        usernameTitle: document.getElementById('accountUsernameTitle'),
        emailDisplay: document.getElementById('accountEmailDisplay'),
        statsContainer: document.getElementById('accountStatsContainer'),
        topicsList: document.getElementById('myTopicsList'),
        
        // Форми
        emailForm: document.getElementById('changeEmailForm'),
        emailInput: document.getElementById('accEmail'),
        emailPasswordInput: document.getElementById('accEmailPassword'),
        
        passwordForm: document.getElementById('changePasswordForm'),
        oldPasswordInput: document.getElementById('accOldPassword'),
        newPasswordInput: document.getElementById('accNewPassword'),
        confirmPasswordInput: document.getElementById('accConfirmPassword'),
        
        // Кнопки
        goToComparisonBtn: document.getElementById('goToComparisonBtn'),
        
        // Аватар
        avatarImg: document.getElementById('userAvatarImg'),
        changeAvatarBtn: document.getElementById('changeAvatarBtn'),
        avatarInput: document.getElementById('avatarUploadInput')
    };

    let authToken = null;

    // --- Завантаження даних профілю ---
    async function loadAccountDetails() {
        if (!authToken) return;
        
        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/account', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.status === 401) {
                window.location.href = 'main.html';
                return;
            }
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.msg);
            
            // Заповнення інфо
            elements.usernameTitle.textContent = data.user.username;
            if (elements.emailDisplay) elements.emailDisplay.textContent = data.user.email;
            if (elements.emailInput) elements.emailInput.value = data.user.email;
            
            // Аватар (ВИПРАВЛЕНА ЛОГІКА)
            if (data.user.avatar_url) {
                // Перевіряємо, чи це зовнішнє посилання (Google) чи локальне
                if (data.user.avatar_url.startsWith('http')) {
                    // Це Google - використовуємо як є
                    elements.avatarImg.src = data.user.avatar_url;
                } else {
                    // Це локальне фото - додаємо адресу сервера
                    elements.avatarImg.src = `http://127.0.0.1:5000${data.user.avatar_url}?t=${new Date().getTime()}`;
                }
            } else {
                // Якщо фото немає - генеруємо аватар з ініціалів
                const initial = data.user.username.charAt(0).toUpperCase();
                elements.avatarImg.src = `https://ui-avatars.com/api/?name=${initial}&background=E40C2B&color=fff&size=150&bold=true`;
            }

            // Статистика (оновлений дизайн)
            elements.statsContainer.innerHTML = `
                <div class="stat-box">
                    <strong>${data.stats.topic_count}</strong>
                    <span>Створено тем</span>
                </div>
                <div class="stat-box">
                    <strong>${data.stats.post_count}</strong>
                    <span>Повідомлень</span>
                </div>
            `;
            
        } catch (error) {
            console.error('Помилка завантаження акаунту:', error);
        }
    }

    // --- Завантаження тем (СТИЛЬ ФОРУМУ) ---
    async function loadMyTopics() {
        if (!authToken) return;

        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/topics', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!response.ok) throw new Error('Помилка завантаження тем');
            
            const topics = await response.json();
            
            if (topics.length === 0) {
                elements.topicsList.innerHTML = `
                    <div class="empty-state" style="border:none; padding: 30px; text-align: center;">
                        <p style="color: #A0AEC0;">Ви ще не створювали тем.</p>
                        <a href="forum.html" class="btn primary small" style="margin-top: 10px;">Перейти на форум</a>
                    </div>`;
                return;
            }

            // Рендер рядків (копія стилю з forum.js)
            elements.topicsList.innerHTML = topics.map(topic => {
                const topicLink = `topic.html?id=${topic.id}`;
                const dateObj = new Date(topic.created_at);
                const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

                return `
                    <a href="${topicLink}" class="forum-topic-row">
                        <div class="topic-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </div>

                        <div class="topic-main-info">
                            <span class="topic-title">${topic.title}</span>
                            <div class="topic-meta">
                                Створено вами
                            </div>
                        </div>

                        <div class="topic-stats">
                            <span class="stat-value">${topic.post_count || 0}</span>
                            <span class="stat-label">відповідей</span>
                        </div>

                        <div class="topic-last-post">
                            <div>${dateStr}</div>
                            <div style="font-size: 11px; opacity: 0.7;">${timeStr}</div>
                        </div>
                    </a>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Помилка тем:', error);
            elements.topicsList.innerHTML = `<p style="color: red; padding: 15px;">${error.message}</p>`;
        }
    }

    // --- Логіка аватарки ---
    function setupAvatarUpload() {
        if (!elements.changeAvatarBtn || !elements.avatarInput) return;

        elements.changeAvatarBtn.addEventListener('click', () => elements.avatarInput.click());

        elements.avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            try {
                elements.avatarImg.style.opacity = '0.5';
                const response = await fetch('http://127.0.0.1:5000/api/me/account/avatar', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    body: formData
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error);

                showInfoModal('Успіх', 'Аватарку оновлено!', 'success');
                elements.avatarImg.src = `http://127.0.0.1:5000${data.avatar_url}?t=${new Date().getTime()}`;

            } catch (error) {
                showInfoModal('Помилка', error.message, 'error');
            } finally {
                elements.avatarImg.style.opacity = '1';
                elements.avatarInput.value = '';
            }
        });
    }

    // --- Логіка форм (Email/Password) - без змін логіки, тільки прив'язка ---
    async function handleChangeEmail(e) {
        e.preventDefault();
        const newEmail = elements.emailInput.value;
        const password = elements.emailPasswordInput.value;
        
        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/account/email', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_email: newEmail, password: password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            showInfoModal('Успіх', data.message, 'success');
            elements.emailPasswordInput.value = '';
        } catch (error) {
            showInfoModal('Помилка', error.message, 'error');
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        const oldP = elements.oldPasswordInput.value;
        const newP = elements.newPasswordInput.value;
        const confP = elements.confirmPasswordInput.value;

        if (newP !== confP) { showInfoModal('Помилка', 'Паролі не співпадають', 'error'); return; }
        
        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/account/password', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password: oldP, new_password: newP })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            showInfoModal('Успіх', data.message, 'success');
            elements.passwordForm.reset();
        } catch (error) {
            showInfoModal('Помилка', error.message, 'error');
        }
    }

    // --- Список порівняння ---
    function loadComparisonList() {
        if (!elements.goToComparisonBtn) return;
        let list = [];
        try { list = JSON.parse(localStorage.getItem('RightWheel_comparison') || '[]'); } catch (e) {}
        
        elements.goToComparisonBtn.querySelector('span').textContent = `Переглянути список (${list.length})`;
        elements.goToComparisonBtn.disabled = list.length === 0;
        
        elements.goToComparisonBtn.onclick = () => window.location.href = 'comparison.html';
    }

    function initAccountPage() {
        authToken = localStorage.getItem('RightWheel_access_token');
        if (!authToken) { window.location.href = 'main.html'; return; }

        loadAccountDetails();
        loadMyTopics();
        loadComparisonList();
        setupAvatarUpload();
        
        if(elements.emailForm) elements.emailForm.addEventListener('submit', handleChangeEmail);
        if(elements.passwordForm) elements.passwordForm.addEventListener('submit', handleChangePassword);
    }

    initAccountPage();
});