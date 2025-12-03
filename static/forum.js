document.addEventListener('DOMContentLoaded', () => {

    // Стан сторінки
    let state = {
        currentTab: 'latest', // latest, popular, my
        currentBrandId: '',
        brandsLoaded: false
    };

    const elements = {
        topicsListContainer: document.getElementById('topicsListContainer'),
        
        // Модальне вікно створення
        openCreateModalBtn: document.getElementById('openCreateTopicModalBtn'),
        createModal: document.getElementById('createTopicModal'),
        closeCreateModalBtn: document.getElementById('closeCreateTopicModalBtn'),
        modalBack: document.querySelector('#createTopicModal .modal-back'),
        
        createForm: document.getElementById('newPostForm'),
        postBrandSelect: document.getElementById('postBrandSelect'),
        
        // Сайдбар і вкладки
        brandsFilterList: document.getElementById('brandsFilterList'),
        tabs: document.querySelectorAll('.tab-btn')
    };

    // Знаходимо кнопку скасування
    const cancelBtn = document.getElementById('cancelCreateTopicBtn');

    // Якщо вона є, додаємо функцію закриття
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeCreateModal);
    }

    // --- 1. Керування модальним вікном ---
    
    function openCreateModal() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) {
            if(typeof showLoginModal === 'function') showLoginModal();
            return;
        }
        elements.createModal.style.display = 'flex';
    }

    function closeCreateModal() {
        elements.createModal.style.display = 'none';
    }

    if(elements.openCreateModalBtn) elements.openCreateModalBtn.addEventListener('click', openCreateModal);
    if(elements.closeCreateModalBtn) elements.closeCreateModalBtn.addEventListener('click', closeCreateModal);
    if(elements.modalBack) elements.modalBack.addEventListener('click', closeCreateModal);

    // --- 2. Завантаження брендів (для сайдбару і форми) ---

    async function loadBrands() {
        try {
            const response = await fetch('/api/brands');
            const brands = await response.json();

            // 1. Заповнюємо сайдбар
            if (elements.brandsFilterList) {
                // Зберігаємо першу кнопку "Всі марки"
                elements.brandsFilterList.innerHTML = '<div class="sidebar-item active" data-brand-id="">Всі марки</div>';
                
                brands.forEach(brand => {
                    const div = document.createElement('div');
                    div.className = 'sidebar-item';
                    div.textContent = brand.name;
                    div.dataset.brandId = brand.id;
                    div.addEventListener('click', () => handleBrandFilter(brand.id, div));
                    elements.brandsFilterList.appendChild(div);
                });
                
                // Додаємо слухач на "Всі марки"
                elements.brandsFilterList.querySelector('.active').addEventListener('click', (e) => handleBrandFilter('', e.target));
            }

            // 2. Заповнюємо селект у формі створення
            if (elements.postBrandSelect) {
                brands.forEach(brand => {
                    const option = document.createElement('option');
                    option.value = brand.id;
                    option.textContent = brand.name;
                    elements.postBrandSelect.appendChild(option);
                });
            }

        } catch (error) {
            console.error("Помилка завантаження брендів:", error);
        }
    }

    // --- 3. Обробка фільтрів і вкладок ---

    function handleBrandFilter(brandId, element) {
        // Візуал
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');

        state.currentBrandId = brandId;
        loadTopics(); // Перезавантажуємо список
    }

    function handleTabClick(e) {
        const tab = e.target.dataset.tab;
        
        // Візуал
        elements.tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        state.currentTab = tab;
        loadTopics();
    }

    elements.tabs.forEach(btn => btn.addEventListener('click', handleTabClick));

    // --- 4. Завантаження тем ---

    async function loadTopics() {
        elements.topicsListContainer.innerHTML = '<p style="padding:20px; color:#A0AEC0;">Завантаження...</p>';

        let url = '';
        const token = localStorage.getItem('RightWheel_access_token');

        if (state.currentTab === 'my') {
            // Якщо вкладка "Мої пости" - перевіряємо логін
            if (!token) {
                elements.topicsListContainer.innerHTML = `
                    <div class="empty-state">
                        <p>Увійдіть, щоб переглянути ваші пости.</p>
                        <button class="btn primary small" onclick="showLoginModal()">Увійти</button>
                    </div>`;
                return;
            }
            url = '/api/me/topics'; // Цей API вже є
        } else {
            // Загальний список (Останні або Популярні)
            url = `/api/forum/topics?sort=${state.currentTab}`;
            if (state.currentBrandId) {
                url += `&brand_id=${state.currentBrandId}`;
            }
        }

        try {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await fetch(url, { headers });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const topics = await response.json();
            renderTopics(topics);

        } catch (error) {
            console.error("Помилка:", error);
            elements.topicsListContainer.innerHTML = `<p style="color: red; padding:20px;">Не вдалося завантажити теми.</p>`;
        }
    }

    function getAvatarUrl(url, username) {
        if (url) return url.startsWith('http') ? url : `${url}`;
        const initial = username ? username.charAt(0).toUpperCase() : '?';
        return `https://ui-avatars.com/api/?name=${initial}&background=2D3748&color=fff&size=100`;
    }

    function renderTopics(topics) {
        if (!topics || topics.length === 0) {
            elements.topicsListContainer.innerHTML = `
                <div class="empty-state" style="border: none; padding: 40px; text-align: center;">
                    <h3 style="color: #E2E8F0;">Тем не знайдено 🤷‍♂️</h3>
                    <p style="color: #A0AEC0;">Спробуйте змінити фільтри або створіть нову тему!</p>
                </div>`;
            return;
        }

        elements.topicsListContainer.innerHTML = topics.map(topic => {
            const topicLink = `topic.html?id=${topic.id}`;
            const profileLink = `user-profile.html?id=${topic.author_id}`;
            const dateStr = new Date(topic.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
            const avatarSrc = getAvatarUrl(topic.author_avatar, topic.author_username);
            
            const brandBadge = topic.brand_name 
                ? `<span style="font-size: 11px; background: #232d3b; padding: 2px 6px; border-radius: 4px; color: #A0AEC0; border: 1px solid #4A5568; margin-left: 8px;">${topic.brand_name}</span>` 
                : '';

            return `
                <a href="${topicLink}" class="forum-topic-row" style="text-decoration: none; color: inherit; display: grid;">
                    
                    <div class="topic-icon" style="overflow: hidden; border-radius: 50%; width: 40px; height: 40px;">
                        <img src="${avatarSrc}" alt="${topic.author_username}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>

                    <div class="topic-main-info">
                        <span class="topic-title" style="font-weight: 600;">
                            ${topic.title} ${brandBadge}
                        </span>
                        <div class="topic-meta">
                            Автор: <span class="topic-author" style="color: #A0AEC0;">${topic.author_username || 'Анонім'}</span>
                        </div>
                    </div>

                    <div class="topic-stats">
                        <span class="stat-value">${topic.post_count || 0}</span>
                        <span class="stat-label">відповідей</span>
                    </div>

                    <div class="topic-last-post">
                        <div>${dateStr}</div>
                    </div>
                </a>
            `;
        }).join('');
    }

    // --- 5. Створення нової теми ---

    async function handlePostSubmit(e) {
        e.preventDefault();
        
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        const brandId = document.getElementById('postBrandSelect').value;
        const token = localStorage.getItem('RightWheel_access_token');

        if (!token) return;

        // Блокуємо кнопку
        const btn = e.target.querySelector('button');
        btn.textContent = 'Публікація...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/forum/topics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, content, brand_id: brandId })
            });

            if (!response.ok) {
                 const data = await response.json();
                 throw new Error(data.error || 'Помилка');
            }

            closeCreateModal();
            elements.createForm.reset();
            showInfoModal('Успіх', 'Тему створено!', 'success');
            
            // Скидаємо фільтри і вантажимо нові
            state.currentBrandId = '';
            state.currentTab = 'latest';
            // Оновлюємо UI фільтрів
            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
            document.querySelector('.sidebar-item[data-brand-id=""]').classList.add('active');
            elements.tabs.forEach(t => t.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="latest"]').classList.add('active');
            
            loadTopics();

        } catch (error) {
            showInfoModal('Помилка', error.message, 'error');
        } finally {
            btn.textContent = 'Опублікувати';
            btn.disabled = false;
        }
    }

    if(elements.createForm) elements.createForm.addEventListener('submit', handlePostSubmit);

    // --- Запуск ---
    loadBrands();
    loadTopics();
});