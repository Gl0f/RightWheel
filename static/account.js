document.addEventListener('DOMContentLoaded', () => {

    const elements = {
        // Основні елементи профілю
        usernameTitle: document.getElementById('accountUsernameTitle'),
        emailDisplay: document.getElementById('accountEmailDisplay'),
        statsContainer: document.getElementById('accountStatsContainer'),
        topicsList: document.getElementById('myTopicsList'),
        
        // Аватар
        avatarImg: document.getElementById('userAvatarImg'),
        changeAvatarBtn: document.getElementById('changeAvatarBtn'),
        avatarInput: document.getElementById('avatarUploadInput'),

        // Форма налаштувань профілю (Авто, Біо, Локація)
        detailsForm: document.getElementById('profileDetailsForm'),
        carInput: document.getElementById('accCar'),
        bioInput: document.getElementById('accBio'),
        
        // Форма зміни Email
        emailForm: document.getElementById('changeEmailForm'),
        emailInput: document.getElementById('accEmail'),
        emailPasswordInput: document.getElementById('accEmailPassword'),
        
        // Форма зміни пароля
        passwordForm: document.getElementById('changePasswordForm'),
        oldPasswordInput: document.getElementById('accOldPassword'),
        newPasswordInput: document.getElementById('accNewPassword'),
        confirmPasswordInput: document.getElementById('accConfirmPassword'),
        
        // Кнопка переходу до порівняння
        goToComparisonBtn: document.getElementById('goToComparisonBtn')
    };

    let authToken = null;

    // --- 1. Завантаження даних профілю ---
    async function loadAccountDetails() {
        if (!authToken) return;
        
        try {
            const response = await fetch('/api/me/account', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.status === 401) {
                // Якщо токен протух - викидаємо на головну (або спрацює глобальний перехоплювач)
                window.location.href = 'main.html';
                return;
            }
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.msg);
            
            // Заповнення текстових полів
            if (elements.usernameTitle) elements.usernameTitle.textContent = data.user.username;
            if (elements.emailDisplay) elements.emailDisplay.textContent = data.user.email;
            
            // Заповнення форми налаштувань (Авто, Локація, Біо)
            if (elements.carInput) elements.carInput.value = data.user.current_car || '';
            if (elements.bioInput) elements.bioInput.value = data.user.bio || '';

            // Заповнення поля зміни email
            if (elements.emailInput) elements.emailInput.value = data.user.email;
            
            // Логіка відображення Аватара
            if (elements.avatarImg) {
                if (data.user.avatar_url) {
                    if (data.user.avatar_url.startsWith('http')) {
                        elements.avatarImg.src = data.user.avatar_url;
                    } else {
                        elements.avatarImg.src = `${data.user.avatar_url}?t=${new Date().getTime()}`;
                    }
                } else {
                    const initial = data.user.username.charAt(0).toUpperCase();
                    elements.avatarImg.src = `https://ui-avatars.com/api/?name=${initial}&background=E40C2B&color=fff&size=150&bold=true`;
                }
            }

            // Статистика
            if (elements.statsContainer) {
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
            }
            
        } catch (error) {
            console.error('Помилка завантаження акаунту:', error);
            if (elements.usernameTitle) elements.usernameTitle.textContent = 'Помилка';
        }
    }

    // --- 2. Завантаження тем користувача ---
    async function loadMyTopics() {
        if (!authToken || !elements.topicsList) return;

        try {
            const response = await fetch('/api/me/topics', {
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
                            <div class="topic-meta">Створено вами</div>
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

    // --- 3. Збереження деталей профілю (Авто, Біо) ---
    async function handleUpdateProfileDetails(e) {
        e.preventDefault();
        
        const car = elements.carInput.value;
        const bio = elements.bioInput.value;

        const btn = e.target.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Збереження...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/me/account/details', {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    current_car: car,
                    bio: bio
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            showInfoModal('Успіх', 'Профіль успішно оновлено!', 'success');

        } catch (error) {
            showInfoModal('Помилка', error.message, 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // --- 4. Завантаження аватарки ---
    function setupAvatarUpload() {
        if (!elements.changeAvatarBtn || !elements.avatarInput) return;

        elements.changeAvatarBtn.addEventListener('click', () => elements.avatarInput.click());

        elements.avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            try {
                if (elements.avatarImg) elements.avatarImg.style.opacity = '0.5';
                
                const response = await fetch('/api/me/account/avatar', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    body: formData
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error);

                showInfoModal('Успіх', 'Аватарку оновлено!', 'success');
                if (elements.avatarImg) {
                    elements.avatarImg.src = `${data.avatar_url}?t=${new Date().getTime()}`;
                }

                // --- ДОДАНО: Оновлюємо пам'ять і хедер ---
                localStorage.setItem('RightWheel_userAvatar', data.avatar_url);
                const headerImg = document.getElementById('headerAvatarImg');
                if(headerImg) headerImg.src = `${data.avatar_url}`;
                // -----------------------------------------

            } catch (error) {
                showInfoModal('Помилка', error.message, 'error');
            } finally {
                if (elements.avatarImg) elements.avatarImg.style.opacity = '1';
                elements.avatarInput.value = '';
            }
        });
    }

    // --- 5. Зміна Email ---
    async function handleChangeEmail(e) {
        e.preventDefault();
        const newEmail = elements.emailInput.value;
        const password = elements.emailPasswordInput.value;
        
        try {
            const response = await fetch('/api/me/account/email', {
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

    // --- 6. Зміна Пароля ---
    async function handleChangePassword(e) {
        e.preventDefault();
        const oldP = elements.oldPasswordInput.value;
        const newP = elements.newPasswordInput.value;
        const confP = elements.confirmPasswordInput.value;

        if (newP !== confP) { showInfoModal('Помилка', 'Паролі не співпадають', 'error'); return; }
        
        try {
            const response = await fetch('/api/me/account/password', {
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

    // --- 7. Список порівняння ---
    function loadComparisonList() {
        if (!elements.goToComparisonBtn) return;
        let list = [];
        try { list = JSON.parse(localStorage.getItem('RightWheel_comparison') || '[]'); } catch (e) {}
        
        const btnSpan = elements.goToComparisonBtn.querySelector('span');
        if (btnSpan) btnSpan.textContent = `Переглянути список (${list.length})`;
        elements.goToComparisonBtn.disabled = list.length === 0;
        
        elements.goToComparisonBtn.onclick = () => window.location.href = 'comparison.html';
    }

    async function loadMyAds() {
        const adsContainer = document.getElementById('myAdsList');
        if (!adsContainer || !authToken) return;

        try {
            const response = await fetch('/api/me/ads', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const ads = await response.json();

            if (ads.length === 0) {
                adsContainer.innerHTML = '<p style="color: #718096; grid-column: 1/-1; text-align: center;">У вас немає активних оголошень.</p>';
                return;
            }

            renderAdsGrid(adsContainer, ads);

        } catch (error) {
            console.error(error);
            adsContainer.innerHTML = '<p style="color: red;">Помилка завантаження.</p>';
        }
    }

    // Функція рендеру (спільна для обох сторінок, можна скопіювати сюди)
    function renderAdsGrid(container, ads) {
        container.innerHTML = ads.map(ad => {
            const price = new Intl.NumberFormat('en-US').format(ad.price);
            const imgUrl = ad.main_image || 'https://via.placeholder.com/300x200?text=No+Photo';
            
            return `
                <a href="market-detail.html?id=${ad.id}" style="text-decoration: none; display: block; background: #1A202C; border: 1px solid #4A5568; border-radius: 6px; overflow: hidden; transition: transform 0.2s;">
                    <div style="height: 120px; overflow: hidden;">
                        <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="padding: 10px;">
                        <div style="color: #38A169; font-weight: 700; font-size: 15px; margin-bottom: 2px;">$ ${price}</div>
                        <div style="font-size: 13px; font-weight: 500; color: #E2E8F0;">
                            ${ad.brand_name} ${ad.model_name} ${ad.year}
                        </div>
                    </div>
                </a>
            `;
        }).join('');
    }

    // --- ІНІЦІАЛІЗАЦІЯ ---
    function initAccountPage() {
        authToken = localStorage.getItem('RightWheel_access_token');
        if (!authToken) { 
            window.location.href = 'main.html'; 
            return; 
        }

        loadAccountDetails();
        loadMyTopics();
        loadComparisonList();
        setupAvatarUpload();
        loadMyAds();
        
        if (elements.detailsForm) elements.detailsForm.addEventListener('submit', handleUpdateProfileDetails);
        if (elements.emailForm) elements.emailForm.addEventListener('submit', handleChangeEmail);
        if (elements.passwordForm) elements.passwordForm.addEventListener('submit', handleChangePassword);
    }

    initAccountPage();
});