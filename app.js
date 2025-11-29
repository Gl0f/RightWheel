const elements = {
    loginModal: document.getElementById('loginModal'),
    registerModal: document.getElementById('registerModal'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    showRegisterBtn: document.getElementById('showRegisterBtn'),
    showLoginBtn: document.getElementById('showLoginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    brandGridView: document.getElementById('brandGridView'),
    brandsGrid: document.getElementById('brandsGrid'),
    logoHomeLink: document.getElementById('logoHomeLink'),
    openAddModalBtn: document.getElementById('openAddModalBtn'),
    editAddModal: document.getElementById('editAddModal'),
    exportBtn: document.getElementById('exportBtn'),
    featuredCars: document.getElementById('featuredCars'),
    globalSearchInput: document.getElementById('globalSearchInput'),
    searchDropdown: document.getElementById('searchDropdown'),
    advancedSearchBtn: document.getElementById('advancedSearchBtn'),
    advancedSearchModal: document.getElementById('advancedSearchModal'),
    adv_make: document.getElementById('adv_make'),
    statsSection: document.getElementById('statsSection'),
    mainPageTitle: document.getElementById('mainPageTitle'),
    showFavoritesBtn: document.getElementById('showFavoritesBtn'),
    comparisonBar: document.getElementById('comparisonBar'),
    recentlyViewedCars: document.getElementById('recentlyViewedCars'),
    accountLinkBtn: document.getElementById('accountLinkBtn'),
    comparisonModal: document.getElementById('comparisonModal'),
    infoModal: document.getElementById('infoModal'),
    infoModalTitle: document.getElementById('infoModalTitle'),
    infoModalMessage: document.getElementById('infoModalMessage'),
    infoModalOkBtn: document.getElementById('infoModalOkBtn'),
    userMenuContainer: document.getElementById('userMenuContainer'),
    userMenuTrigger: document.getElementById('userMenuTrigger'),
    headerUsername: document.getElementById('headerUsername'),
    headerAvatarImg: document.getElementById('headerAvatarImg'),
    logoutBtnDropdown: document.getElementById('logoutBtnDropdown'),
    infoModalBack: document.getElementById('infoModalBack')
    
 
};


document.addEventListener('DOMContentLoaded', () => {
    // Слухачі для нового Info Modal (тепер тут)
    const okButton = document.getElementById('infoModalOkBtn');
    const backButton = document.getElementById('infoModalBack'); // Використовуємо elements.infoModalBack? Ні, краще getElementById

    if (okButton) {
        okButton.addEventListener('click', () => {
            console.log("Кнопка 'OK' натиснута!"); 
            closeInfoModal();
        });
    } else {
        // Ця помилка може з'являтися, якщо вікна немає на сторінці - це нормально
        // console.error("Кнопка 'OK' для Info Modal не знайдена!"); 
    }

    if (backButton) {
        backButton.addEventListener('click', () => {
            console.log("Фон модального вікна натиснуто!"); 
            closeInfoModal();
        });
    } else {
        // console.error("Фон для Info Modal не знайдено!");
    }
});



const state = {
    isLoggedIn: false,
    favorites: [],     
    comparisonList: [] 
   
};

// --- Global Fetch Interceptor ---
// Зберігаємо оригінальну функцію fetch
const originalFetch = window.fetch;

/**
 * Глобальний перехоплювач для всіх fetch-запитів.
 * Автоматично обробляє помилки 401 (Unauthorized) для очищення сесії.
 */
window.fetch = async function (url, options) {
    // Викликаємо оригінальний fetch
    const response = await originalFetch(url, options);

    // Перевіряємо, чи це не запит на сам логін/реєстрацію
    const isAuthRequest = url.includes('/api/auth/login') || url.includes('/api/auth/register');

    // Перевіряємо на 401 Unauthorized
    if (response.status === 401 && !isAuthRequest) {
        console.error('Fetch Interceptor: Отримано 401 Unauthorized. Очищення сесії.');

        // 1. Очищуємо localStorage (викликаємо частину логіки handleLogout)
        localStorage.removeItem('RightWheel_access_token');
        localStorage.removeItem('RightWheel_loggedInUser');
        state.isLoggedIn = false;
        
        // 2. Показуємо модальне вікно
        showInfoModal(
            'Сесія застаріла', 
            'Ваш сеанс входу завершився. Натисніть "OK" для перезавантаження сторінки.', 
            'error'
        );

        // 3. Додаємо слухач на кнопку "OK" модалки, щоб перезавантажити сторінку
        const okButton = document.getElementById('infoModalOkBtn');
        if (okButton) {
            // Видаляємо старі слухачі, щоб уникнути дублікатів
            okButton.replaceWith(okButton.cloneNode(true));
            // Прив'язуємо перезавантаження до "OK"
            document.getElementById('infoModalOkBtn').addEventListener('click', () => {
                window.location.reload();
            });
        }
        
        // 4. Зупиняємо подальше виконання .then() .json() у коді, що викликав запит
        return new Promise(() => {}); 
    }

    // Якщо все добре (не 401), повертаємо відповідь як зазвичай
    return response;
};
// --- End of Global Fetch Interceptor ---

let USERS_DATABASE = [];

// --- Збереження/Завантаження з localStorage (ТІЛЬКИ для користувачів та обраного/порівняння) ---
function saveDataToLocalStorage() {
    try {
        localStorage.setItem('RightWheel_users', JSON.stringify(USERS_DATABASE));
        localStorage.setItem('RightWheel_favorites', JSON.stringify(state.favorites));
        // Не зберігаємо MOCK_CARS
    } catch (e) { console.error("Помилка збереження даних в localStorage:", e); }
}

function loadDataFromLocalStorage() {
    try {
        const savedUsers = localStorage.getItem('RightWheel_users');
        const savedFavorites = localStorage.getItem('RightWheel_favorites');
        // Не завантажуємо MOCK_CARS
        USERS_DATABASE = savedUsers ? JSON.parse(savedUsers) : [{ username: 'admin', password: '12345', email: 'admin@rightwheel.ua' }];
        state.favorites = savedFavorites ? JSON.parse(savedFavorites) : [];
    } catch (e) {
        console.error("Помилка завантаження даних з localStorage:", e);
        USERS_DATABASE = [{ username: 'admin', password: '12345', email: 'admin@rightwheel.ua' }];
        state.favorites = [];
    }
}

// --- Допоміжні функції ---
function generateUniqueId() { return 'car-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }
function getFuelBadgeClass(fuel) {
    if (!fuel) return '';
    switch (fuel.toLowerCase()) {
        case 'бензин': return 'fuel-petrol';
        case 'дизель': return 'fuel-diesel';
        case 'гібрид': return 'fuel-hybrid';
        case 'електрика': return 'fuel-electric';
        case 'газ': return 'fuel-gas';
        default: return '';
    }
}
// formatPrice видалено, бо ціни немає

// --- Функції автентифікації (залишаються як були, працюють з USERS_DATABASE) ---


async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const captcha = document.getElementById('registerCaptchaCheck').checked;
    
    if (!captcha) { showInfoModal('Помилка', 'Будь ласка, підтвердіть, що ви не робот!', 'error'); return; }
    if (password !== confirmPassword) { showInfoModal('Помилка', 'Паролі не співпадають!', 'error'); return; }
    
    try {
        const response = await fetch('http://127.0.0.1:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Невідома помилка');
        }
        
        showInfoModal('Успіх', data.message, 'success');
        showLoginModal(); // Автоматично показуємо вікно логіну

    } catch (error) {
        console.error("Помилка реєстрації:", error);
        showInfoModal('Помилка реєстрації', error.message, 'error');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const captcha = document.getElementById('captchaCheck').checked;

    if (!captcha) {
        showInfoModal('Помилка', 'Будь ласка, підтвердіть, що ви не робот!', 'error');
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        // Всередині handleLogin, після отримання data:

        if (!response.ok) {
            throw new Error(data.error || 'Невідома помилка');
        }

        localStorage.setItem('RightWheel_access_token', data.access_token);
        localStorage.setItem('RightWheel_loggedInUser', username);

        // --- ДОДАНО ---
        if (data.avatar_url) {
            localStorage.setItem('RightWheel_userAvatar', data.avatar_url);
        } else {
            localStorage.removeItem('RightWheel_userAvatar');
        }
        // --------------

        if (elements.loginModal) elements.loginModal.style.display = 'none';
        window.location.reload();

    } catch (error) {
        console.error("Помилка логіну:", error);
        showInfoModal('Помилка входу', error.message, 'error');
    }
    const consent = document.getElementById('consentCheck').checked;
    if (!consent) {
        showInfoModal('Увага', 'Потрібна згода на обробку даних.', 'info');
        return;
    }
}

function showRegisterModal() { if(elements.loginModal) elements.loginModal.style.display = 'none'; if(elements.registerModal) elements.registerModal.style.display = 'flex'; }
function showLoginModal() { if(elements.registerModal) elements.registerModal.style.display = 'none'; if(elements.loginModal) elements.loginModal.style.display = 'flex'; }

function closeLoginModal() {
    if(elements.loginModal) elements.loginModal.style.display = 'none';
}
function closeRegisterModal() {
    if(elements.registerModal) elements.registerModal.style.display = 'none';
}

function handleLogout() {
    // Видаляємо токен та ім'я користувача
    localStorage.removeItem('RightWheel_access_token');
    localStorage.removeItem('RightWheel_loggedInUser');

    state.isLoggedIn = false;
    
    if(elements.logoutBtn) elements.logoutBtn.style.display = 'none';
    if(elements.showFavoritesBtn) elements.showFavoritesBtn.style.display = 'none';
    if(elements.openAddModalBtn) elements.openAddModalBtn.disabled = true;
    if(elements.accountLinkBtn) elements.accountLinkBtn.style.display = 'none';

    // === ОНОВЛЕНО ===
    // 2. Негайно перезавантажуємо сторінку.
    // Це найпростіший спосіб очистити стан і показати сторінку
    // у режимі "гостя", особливо на захищених сторінках як "Мій кабінет".
    window.location.reload();
    // Можливо, потрібно перезавантажити сторінку або перемалювати її стан
    checkLoginStatus();
}

/**
 * Показує кастомне модальне вікно.
 * @param {string} title - Заголовок вікна.
 * @param {string} message - Текст повідомлення.
 * @param {'info' | 'success' | 'error'} [type='info'] - Тип для стилізації заголовка.
 */
function showInfoModal(title, message, type = 'info') {
    const modal = document.getElementById('infoModal');
    const modalTitle = document.getElementById('infoModalTitle');
    const modalMessage = document.getElementById('infoModalMessage');
    
    if (!modal || !modalTitle || !modalMessage) {
        // Запасний варіант, якщо модальне вікно не знайдено
        alert(`${title}\n\n${message}`);
        return;
    }
    
    modalTitle.textContent = title;
    modalMessage.innerHTML = message; // .innerHTML, щоб дозволити <br>
    
    // Очищуємо старі класи кольорів
    modalTitle.classList.remove('modal-title-success', 'modal-title-error', 'modal-title-info');
    
    // Додаємо новий клас
    if (type === 'success') {
        modalTitle.classList.add('modal-title-success');
    } else if (type === 'error') {
        modalTitle.classList.add('modal-title-error');
    } else {
        modalTitle.classList.add('modal-title-info');
    }
    
    modal.style.display = 'flex';
}

/**
 * Закриває кастомне модальне вікно.
 */
function closeInfoModal() {
    console.log("Функція closeInfoModal викликана!");
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}


function checkLoginStatus() {
    const token = localStorage.getItem('RightWheel_access_token');
    const username = localStorage.getItem('RightWheel_loggedInUser');
    const showLoginModalBtn = document.getElementById('showLoginModalBtn');

    if (token) {
        state.isLoggedIn = true;
        
        // 1. Ховаємо кнопку входу
        if (showLoginModalBtn) showLoginModalBtn.style.display = 'none';
        
        // 2. Показуємо меню користувача
        if (elements.userMenuContainer) elements.userMenuContainer.style.display = 'inline-block';
        
        // 3. Показуємо кнопку обраного
        if (elements.showFavoritesBtn) elements.showFavoritesBtn.style.display = 'inline-flex';

        // 4. Оновлюємо ім'я в хедері
        if (elements.headerUsername) elements.headerUsername.textContent = username || 'Користувач';

        // 5. Оновлюємо аватарку в хедері
        if (elements.headerAvatarImg) {
            const savedAvatar = localStorage.getItem('RightWheel_userAvatar');
            
            if (savedAvatar && savedAvatar !== 'null') {
                // Якщо є збережена аватарка - показуємо її
                const url = savedAvatar.startsWith('http') ? savedAvatar : `http://127.0.0.1:5000${savedAvatar}`;
                elements.headerAvatarImg.src = url;
            } else {
                // Якщо немає - генеруємо літеру
                const initial = (username || 'U').charAt(0).toUpperCase();
                elements.headerAvatarImg.src = `https://ui-avatars.com/api/?name=${initial}&background=E40C2B&color=fff&size=64&bold=true`;
            }
        }

    } else {
        state.isLoggedIn = false;
        
        // Показуємо кнопку входу
        if (showLoginModalBtn) showLoginModalBtn.style.display = 'inline-flex';
        
        // Ховаємо все інше
        if (elements.userMenuContainer) elements.userMenuContainer.style.display = 'none';
        if (elements.showFavoritesBtn) elements.showFavoritesBtn.style.display = 'none';
    }
}

// --- Відображення сітки брендів (з використанням fetch) ---
async function renderBrandGrid() {
    if (!elements.brandsGrid) return;
    elements.brandsGrid.innerHTML = '<p>Завантаження марок...</p>';

    try {
        const response = await fetch('http://127.0.0.1:5000/api/brands'); // Запит до API
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const brands = await response.json(); // Отримуємо [{id: 1, name: 'Audi', country: '...'}, ...]

        elements.brandsGrid.innerHTML = '';
        if(elements.mainPageTitle) elements.mainPageTitle.textContent = 'Оберіть марку для перегляду моделей';

        if (!brands || brands.length === 0) {
            elements.brandsGrid.innerHTML = '<p>Не вдалося завантажити список марок.</p>';
            return;
        }

        brands.forEach(brand => {
            const item = document.createElement('div');
            item.className = 'brand-item';
            item.dataset.brandId = brand.id; // Зберігаємо ID
            item.dataset.brandName = brand.name; // Зберігаємо ім'я
            const logoUrl = `https://logo.clearbit.com/${brand.name.toLowerCase().replace(/ /g, '')}.com`;
            const fallbackLetter = brand.name.charAt(0).toUpperCase();

            item.innerHTML = `
                <div class="brand-logo-placeholder">
                <span>${fallbackLetter}</span>
                <img src="${brand.logo_url || ''}" alt="${brand.name}" onerror="this.style.opacity='0'"> 
                
                </div>
                <div class="brand-name">${brand.name}</div>
                <div class="brand-country">(${brand.country || 'Країна не вказана'})</div>
                `;
            item.addEventListener('click', handleBrandClick); // Додаємо слухач
            elements.brandsGrid.appendChild(item);
        });

    } catch (error) {
        console.error("Помилка завантаження марок:", error);
        if(elements.mainPageTitle) elements.mainPageTitle.textContent = 'Оберіть марку для перегляду моделей';
        elements.brandsGrid.innerHTML = `<p style="color: red;">Помилка завантаження марок. Дивіться консоль.</p>`;
    }
}

// --- Обробник кліку на бренд (оновлений) ---
function handleBrandClick(e) {
    const brandId = e.currentTarget.dataset.brandId;
    const brandName = e.currentTarget.dataset.brandName;
    // Передаємо ID та ім'я на сторінку brand.html
    window.location.href = `brand.html?id=${brandId}&name=${encodeURIComponent(brandName)}`;
}


/**
 * Завантажує та відображає "Автомобіль дня".
 */
async function renderStatistics() {
    const statsSection = document.getElementById('statsSection');
    if (!statsSection) return; // Якщо елемента немає, нічого не робимо

    statsSection.innerHTML = '<p style="color: var(--muted);">Завантаження автомобіля дня...</p>';

    try {
        const response = await fetch('http://127.0.0.1:5000/api/car-of-the-day');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const car = await response.json();

        // Формуємо посилання на сторінку деталей
        const params = new URLSearchParams({
            id: car.id, brandId: car.brand_id, brandName: car.make_name,
            modelId: car.model_id, modelName: car.model_name,
            generationId: car.generation_id, generationName: car.generation_name || `${car.year_start}-${car.year_end || 'н.ч.'}`
        });
        const carLink = `car.html?${params.toString()}`;
        
        // --- Відображаємо картку автомобіля дня ---
        // Використаємо стилі, схожі на featured-car-card, але можемо їх налаштувати
        statsSection.innerHTML = `
            <div class="featured-car-card car-of-the-day" style="cursor: pointer; border-radius: 8px;" data-link="${carLink}">  <div class="featured-car-image" style="flex: 0 0 150px; height: 100px; border-radius: 4px; overflow: hidden;">  <img src="${car.image_url || 'https://via.placeholder.com/150x100?text=No+Photo'}" alt="${car.make_name} ${car.model_name}" style="border-radius: 4px;"> </div>
                <div class="featured-car-content">
                    <h4 style="color: var(--success); font-size: 14px; margin-bottom: 8px;">✨ Автомобіль дня ✨</h4>
                    <h4 style="font-size: 19px;">${car.make_name} ${car.model_name} (${car.year})</h4>
                    <div class="spec-line">${car.name || ''}</div>
                    <div class="spec-line">${car.power_hp ? car.power_hp + ' к.с.' : ''} ${car.fuel ? `(${car.fuel})` : ''} ${car.engine ? `| ${car.engine}` : ''}</div>
                    <div class="body-drive-line">${car.body_type || ''}${car.drive ? ', ' + car.drive : ''}</div>
                    <div style="font-size: 12px; color: var(--accent); margin-top: 5px;">Дізнатися більше →</div>
                </div>
            </div>
            
            <style> 
              .car-of-the-day { 
                 transition: background 0.3s ease; /* Додано для плавного ефекту наведення */
                 box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* Додано легку тінь для об'єму */
              }
              .car-of-the-day:hover { 
                 background: #2a2a2a; 
                 box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3); /* Тінь темніша при наведенні */
              }
              /* Забираємо grid-layout у statsSection, щоб картка займала всю ширину */
              #statsSection { display: block; padding: 15px; } 
            </style>
        `;
        
        // Додаємо слухач для переходу по кліку
        const cardElement = statsSection.querySelector('.car-of-the-day');
        if (cardElement) {
            cardElement.addEventListener('click', () => {
                window.location.href = cardElement.dataset.link;
            });
        }
        
    } catch (error) {
        console.error("Помилка завантаження автомобіля дня:", error);
        statsSection.innerHTML = `<p style="color: red;">Не вдалося завантажити автомобіль дня: ${error.message}</p>`;
    }
}


async function renderFeaturedCars() {
    if (!elements.featuredCars) return;
    elements.featuredCars.innerHTML = '<p>Завантаження...</p>'; // Повідомлення про завантаження

    try {
        // --- Запит до нового API ---
        const response = await fetch('http://127.0.0.1:5000/api/trims/latest');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const latestTrims = await response.json(); // Отримуємо список останніх комплектацій

        elements.featuredCars.innerHTML = ''; // Очищуємо

        if (!latestTrims || latestTrims.length === 0) {
            elements.featuredCars.innerHTML = '<p>Не вдалося завантажити останні надходження.</p>';
            return;
        }

        latestTrims.forEach(car => {
            const card = document.createElement('div');
            card.className = 'featured-car-card';
            // Зберігаємо ID комплектації для переходу
            card.dataset.id = car.id;
            // Передаємо всі необхідні параметри для хлібних крихт на наступній сторінці
            card.dataset.brandId = car.brand_id; // Потрібно додати brand_id до запиту API, якщо його немає
            card.dataset.brandName = car.make_name;
            card.dataset.modelId = car.model_id; // Потрібно додати model_id до запиту API, якщо його немає
            card.dataset.modelName = car.model_name;
            card.dataset.generationId = car.generation_id;
            card.dataset.generationName = car.generation_name || `${car.year_start}-${car.year_end || 'н.ч.'}`;

            // Формуємо HTML картки (без ціни)
            card.innerHTML = `
                <div class="featured-car-image">
                    <img src="${car.image_url || 'https://via.placeholder.com/100x70?text=No+Photo'}" alt="${car.make_name} ${car.model_name}">
                </div>
                <div class="featured-car-content">
                    <h4>${car.make_name} ${car.model_name} (${car.year})</h4>
                    <div class="spec-line">${car.name || ''}</div>
                    <div class="spec-line">${car.power_hp ? car.power_hp + ' к.с.' : ''} ${car.fuel ? `(${car.fuel})` : ''}</div>
                    <div class="body-drive-line">${car.body_type || ''}${car.drive ? ', ' + car.drive : ''}</div>
                </div>
            `;
            elements.featuredCars.appendChild(card);
        });

        // Додаємо слухач для переходу на сторінку деталей
        elements.featuredCars.querySelectorAll('.featured-car-card').forEach(card => {
            card.addEventListener('click', () => {
                // Формуємо URL для car.html з усіма ID та іменами для хлібних крихт
                const params = new URLSearchParams({
                    id: card.dataset.id, // ID комплектації
                    brandId: card.dataset.brandId,
                    brandName: card.dataset.brandName,
                    modelId: card.dataset.modelId,
                    modelName: card.dataset.modelName,
                    generationId: card.dataset.generationId,
                    generationName: card.dataset.generationName
                });
                window.location.href = `car.html?${params.toString()}`;
            });
        });

    } catch (error) {
        console.error("Помилка завантаження останніх надходжень:", error);
        elements.featuredCars.innerHTML = `<p style="color: red;">Помилка завантаження. Дивіться консоль.</p>`;
    }
}


async function handleGlobalSearchInput() {
    const query = elements.globalSearchInput.value.toLowerCase().trim();
    
    if (query.length < 2) {
        if (elements.searchDropdown) elements.searchDropdown.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Network error');
        
        const results = await response.json();

        if (!elements.searchDropdown) return;
        elements.searchDropdown.innerHTML = '';

        if (results.length === 0) {
            elements.searchDropdown.innerHTML = '<div style="padding:8px 12px; color:#ccc; font-size: 13px;">Нічого не знайдено</div>';
            elements.searchDropdown.style.display = 'block';
            elements.searchDropdown.style.backgroundColor = '#2D3748';
            elements.searchDropdown.style.width = '100%'; // Для повідомлення можна лишити широким
            return;
        }

        results.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-dropdown-item';
            
            // Стилі елемента
            // white-space: nowrap; - забороняє перенос тексту, щоб ширина рахувалась правильно
            div.style.cssText = "display: flex; align-items: center; padding: 4px 10px; border-bottom: 1px solid #4A5568; background: #2D3748; cursor: pointer; min-height: 40px; white-space: nowrap;";
            
            div.onmouseover = () => div.style.background = '#1A202C';
            div.onmouseout = () => div.style.background = '#2D3748';

            // Дані
            div.dataset.type = item.type;
            div.dataset.id = item.id;
            div.dataset.name = item.name;
            
            if (item.type === 'generation') {
                div.dataset.brandId = item.brand_id;
                div.dataset.brandName = item.brand_name;
                div.dataset.modelId = item.model_id;
                div.dataset.modelName = item.model_name;
                div.dataset.generationName = item.generation_name;
            } else if (item.type === 'brand') {
                div.dataset.brandName = item.name;
            }

            const imageUrl = item.image_url || 'https://via.placeholder.com/50x30?text=No+Img';
            
            if (item.type === 'generation') {
                div.innerHTML = `
                    <div style="width: 50px; height: 30px; margin-right: 10px; flex-shrink: 0; overflow: hidden; border-radius: 2px; background: #1A202C; border: 1px solid #4A5568;">
                        <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: center; line-height: 1.1;">
                        <div style="color: #ffffff !important; font-weight: 600; font-size: 13px;">${item.name}</div>
                        <div style="color: #A0AEC0 !important; font-size: 11px; margin-top: 2px;">${item.extra_info || ''}</div>
                    </div>
                    <div style="width: 15px;"></div>
                `;
            } else {
                div.innerHTML = `
                    <div style="padding-left: 4px; line-height: 1.1;">
                        <div style="color: #ffffff !important; font-weight: 600; font-size: 13px;">${item.name}</div>
                        <div style="color: #A0AEC0 !important; font-size: 10px;">${item.type === 'brand' ? 'Марка' : 'Модель'}</div>
                    </div>
                    <div style="width: 15px;"></div>
                `;
            }
            
            div.addEventListener('click', handleSearchDropdownClick);
            elements.searchDropdown.appendChild(div);
        });
        
        // === КРИТИЧНІ ЗМІНИ ДЛЯ ШИРИНИ ===
        elements.searchDropdown.style.display = 'block';
        elements.searchDropdown.style.backgroundColor = '#2D3748';
        elements.searchDropdown.style.border = '1px solid #4A5568';
        elements.searchDropdown.style.borderRadius = '0 0 4px 4px';
        
        // 1. Відв'язуємо від правого краю
        elements.searchDropdown.style.right = 'auto';
        // 2. Змушуємо ширину залежати від контенту (найдовшого тексту)
        elements.searchDropdown.style.width = 'max-content';
        // 3. Скидаємо мінімальну ширину (було 100%)
        elements.searchDropdown.style.minWidth = '0'; 
        // 4. Встановлюємо мінімальний поріг (щоб не було зовсім вузьким, наприклад 250px)
        elements.searchDropdown.style.minWidth = '250px'; 

    } catch (error) {
        console.error("Помилка пошуку:", error);
    }
}

function handleSearchDropdownClick(e) {
    const item = e.target.closest('.search-dropdown-item');
    if (!item) return;

    const type = item.dataset.type;
    const id = item.dataset.id;
    const name = item.dataset.name;

    closeSearchDropdown();

    let targetUrl = '';

    if (type === 'brand') {
        // Перехід на сторінку бренду
        targetUrl = `brand.html?id=${id}&name=${encodeURIComponent(name)}`;
        
    } else if (type === 'model') {
        // Перехід на сторінку моделі
        targetUrl = `model.html?brandId=${item.dataset.brandId}&brandName=${encodeURIComponent(item.dataset.brandName)}&modelId=${id}&modelName=${encodeURIComponent(name)}`;
        
    } else if (type === 'generation') {
        // === НОВЕ: Перехід на сторінку покоління ===
        const params = new URLSearchParams({
            brandId: item.dataset.brandId,
            brandName: item.dataset.brandName,
            modelId: item.dataset.modelId,
            modelName: item.dataset.modelName,
            generationId: id, // ID покоління
            generationName: item.dataset.generationName || name
        });
        targetUrl = `generation.html?${params.toString()}`;
    }

    if (targetUrl) {
        window.location.href = targetUrl;
    } else {
        console.error("Невідомий тип елемента пошуку:", type);
    }
}

function closeSearchDropdown() { 
    if (elements.searchDropdown) {
        console.log("Closing dropdown soon..."); 
        setTimeout(() => { 
            console.log("Dropdown closed NOW."); 
            elements.searchDropdown.style.display = 'none'; 
        }, 500); // Збільшена затримка
    }
}
async function initAdvancedSearch() {
    // Завантаження марок для фільтра тепер теж має йти з API
    if (!elements.adv_make) return;
    elements.adv_make.innerHTML = '<option value="">Марка...</option>';
    try {
        const response = await fetch('http://127.0.0.1:5000/api/brands');
        const brands = await response.json();
        brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand.name; // Або brand.id, якщо API пошуку працює по ID
            option.textContent = brand.name;
            elements.adv_make.appendChild(option);
        });
    } catch (error) {
        console.error("Не вдалося завантажити марки для розширеного пошуку:", error);
    }
}

function openAdvancedSearchModal() { if (elements.advancedSearchModal) elements.advancedSearchModal.style.display = 'flex'; }
function closeAdvancedSearchModal() { if (elements.advancedSearchModal) elements.advancedSearchModal.style.display = 'none'; }

function handleAdvancedSearch(e) {
    e.preventDefault();
    // Збираємо значення фільтрів з форми
    const filters = {
        make: document.getElementById('adv_make').value,
        body_type: document.getElementById('adv_body_type').value,
        fuel: document.getElementById('adv_fuel').value,
        drive: document.getElementById('adv_drive').value,
        year_from: document.getElementById('adv_year_from').value,
        year_to: document.getElementById('adv_year_to').value,
        power_from: document.getElementById('adv_power_from').value,
        power_to: document.getElementById('adv_power_to').value
    };

    // Створюємо рядок параметрів для URL, ігноруючи порожні значення
    const searchParams = new URLSearchParams();
    for (const key in filters) {
        if (filters[key]) { // Додаємо тільки якщо значення не порожнє
            searchParams.append(key, filters[key]);
        }
    }

    // Перенаправляємо на сторінку результатів з параметрами
    window.location.href = `search_results.html?${searchParams.toString()}`;

    // Закриваємо модальне вікно
    closeAdvancedSearchModal();
}
function resetAdvancedSearch() { if (elements.advancedSearchForm) elements.advancedSearchForm.reset(); }

function openEditAddModal(carId = null) {
    // Потрібен API для збереження/редагування даних
    if (!state.isLoggedIn) { alert('Будь ласка, увійдіть в систему.'); return; }
    console.warn("Додавання/редагування ще не підключено до API.");
    showInfoModal('В розробці', 'Функція додавання/редагування тимчасово недоступна.', 'info');
    // Можна додати код для відкриття модального вікна з формою, але без збереження
}

function exportData() {
    // Потрібен API-маршрут /api/cars/export
    console.warn("Експорт ще не підключено до API.");
    showInfoModal('В розробці', 'Функція експорту тимчасово недоступна.', 'info');
}



function updateComparisonList(carId, isSelected) {
    console.log('Функція updateComparisonList (app.js) ВИКЛИКАНА з:', carId, isSelected);

    // --- Завжди завантажуємо актуальний список з localStorage ---
    let currentComparisonList = [];
    try {
        const savedComparison = localStorage.getItem('RightWheel_comparison');
        currentComparisonList = savedComparison ? JSON.parse(savedComparison) : [];
        // Переконуємося, що всі ID - це рядки
        currentComparisonList = currentComparisonList.map(id => id.toString());
    } catch (e) {
        console.error("Помилка завантаження списку порівняння всередині updateComparisonList:", e);
        currentComparisonList = []; // Починаємо з порожнього списку у разі помилки
    }


    const carIdStr = carId.toString();
    const index = currentComparisonList.indexOf(carIdStr); // Працюємо з актуальним списком

    if (isSelected) {
        if (index === -1) { // Якщо ще не додано
            if (currentComparisonList.length >= 4) {
                showInfoModal('Обмеження', 'Можна порівнювати не більше 4 автомобілів одночасно.', 'info');
                // Важливо: Не намагаємось знайти checkbox тут, бо ми можемо бути на іншій сторінці.
                return; // Виходимо, якщо ліміт досягнуто
            }
            currentComparisonList.push(carIdStr); // Додаємо до актуального списку
            console.log('Додано до порівняння (в app.js):', carIdStr, 'Новий список:', currentComparisonList);
        } else {
             console.log('Вже є в порівнянні (в app.js):', carIdStr);
        }
    } else { // Видалення
        if (index > -1) { // Якщо елемент існує
            currentComparisonList.splice(index, 1); // Видаляємо з актуального списку
             console.log('Видалено з порівняння (в app.js):', carIdStr, 'Новий список:', currentComparisonList);
        } else {
             console.log('Не знайдено для видалення (в app.js):', carIdStr);
        }
    }

    // Оновлюємо глобальний state (опціонально, але може бути корисним для інших функцій app.js)
    state.comparisonList = [...currentComparisonList]; // Копіюємо оновлений список

    // Зберігаємо оновлений список в localStorage
    try {
        localStorage.setItem('RightWheel_comparison', JSON.stringify(currentComparisonList));
        console.log('Збережено в localStorage:', currentComparisonList);
    } catch (e) {
        console.error("Помилка збереження оновленого списку порівняння:", e);
    }

    renderComparisonBar(); // Перемальовуємо нижню панель з актуальними даними
}
function renderComparisonBar() {
    console.log('Функція renderComparisonBar (app.js) ВИКЛИКАНА');
    if (!elements.comparisonBar) return;
    const count = state.comparisonList.length;
    if (count > 0) {
        elements.comparisonBar.classList.add('visible');
        elements.comparisonBar.innerHTML = `<div class="comparison-content"><span>Обрано для порівняння: ${count} авто</span><div><button class="btn secondary small" id="clearComparisonBtn">Очистити</button><button class="btn primary" id="compareBtn" ${count < 2 ? 'disabled' : ''}>Порівняти</button></div></div>`;
        document.getElementById('compareBtn')?.addEventListener('click', () => { window.location.href = 'comparison.html'; });
        document.getElementById('clearComparisonBtn')?.addEventListener('click', clearComparison);
    } else {
        elements.comparisonBar.classList.remove('visible');
    }
}
function clearComparison() {
    state.comparisonList = [];
    renderComparisonBar();
    // Потрібно зняти галочки на сторінці (якщо це сторінка списку)
}
// Повністю замініть цю функцію в app.js
async function openComparisonModal() {
    if (state.comparisonList.length < 2) return;

    // Показуємо завантажувач у модалці
    if (elements.comparisonModal) {
        elements.comparisonModal.innerHTML = `
            <div class="modal-back"></div>
            <div class="modal" style="max-width: 1000px;">
              <div class="modal-header">
                <h2 class="modal-title">Порівняння автомобілів</h2>
                <button id="closeCompareModal" class="btn small secondary">Закрити</button>
              </div>
              <div class="modal-content" style="overflow-x: auto;">
                <p>Завантаження даних для порівняння...</p>
              </div>
            </div>`;
        elements.comparisonModal.style.display = 'flex';
        document.getElementById('closeCompareModal')?.addEventListener('click', closeComparisonModal);
        elements.comparisonModal.querySelector('.modal-back')?.addEventListener('click', closeComparisonModal);
    }

    try {
        // Створюємо масив промісів для завантаження даних по кожному ID
        const fetchPromises = state.comparisonList.map(trimId =>
            fetch(`http://127.0.0.1:5000/api/trims/${trimId}`).then(response => {
                if (!response.ok) throw new Error(`Не вдалося завантажити дані для ID ${trimId}`);
                return response.json();
            })
        );

        // Чекаємо на завершення всіх запитів
        const carsToCompare = await Promise.all(fetchPromises);

        // Визначаємо характеристики для порівняння (без ціни/телефону)
        const specs = [
            { key: 'make_name', label: 'Марка' }, // Потрібно отримувати make_name з API
            { key: 'model_name', label: 'Модель' }, // Потрібно отримувати model_name з API
            { key: 'name', label: 'Комплектація' },
            { key: 'year', label: 'Рік', compare: 'max' }, // Виділяти найновіший
            { key: 'power_hp', label: 'Потужність (к.с.)', compare: 'max' }, // Виділяти найпотужніший
            { key: 'torque_nm', label: 'Крутний момент (Нм)', compare: 'max' },
            { key: 'acceleration_0_100', label: 'Розгін 0-100 (сек)', compare: 'min' }, // Виділяти найшвидший
            { key: 'top_speed_kmh', label: 'Макс. швидкість (км/год)', compare: 'max' },
            { key: 'fuel_consumption_mixed', label: 'Витрата (зміш., л/100км)', compare: 'min' },
            { key: 'fuel', label: 'Паливо' },
            { key: 'transmission', label: 'Трансмісія' },
            { key: 'body_type', label: 'Тип кузова' },
            { key: 'drive', label: 'Привід' },
            { key: 'trunk_volume_l', label: 'Багажник (л)', compare: 'max' }
            // Додайте інші ключі з відповіді API /api/trims/{id}, які хочете порівнювати
        ];

        let headerHtml = '<th>Характеристика</th>';
        carsToCompare.forEach(car => {
            // Припускаємо, що API повертає make_name та model_name (треба оновити app.py!)
            headerHtml += `<th>${car.make_name || car.make || ''} ${car.model_name || car.model || ''} ${car.name}</th>`;
        });

        let bodyHtml = specs.map(spec => {
            let rowHtml = `<tr><td class="spec-label">${spec.label}</td>`;
            let values = []; // Масив значень для порівняння

            // Збираємо значення і класи
            carsToCompare.forEach(car => {
                const value = car[spec.key];
                values.push({ raw: value, formatted: value !== null && value !== undefined ? value : 'Н/Д' });
            });

            // Визначаємо найкраще/найгірше значення, якщо потрібно
            let bestRawValue = null;
            let worstRawValue = null; // Для витрати палива та розгону
            const numericValues = values.map(v => parseFloat(v.raw)).filter(v => !isNaN(v));

            if (numericValues.length > 1 && spec.compare) {
                if (spec.compare === 'max') {
                    bestRawValue = Math.max(...numericValues);
                } else if (spec.compare === 'min') {
                    bestRawValue = Math.min(...numericValues);
                    // Для витрати/розгону можемо знайти і "найгірше" (найбільше)
                    worstRawValue = Math.max(...numericValues);
                }
            }

            // Формуємо рядки таблиці з виділенням
            values.forEach(v => {
                let className = '';
                const numericVal = parseFloat(v.raw);
                if (bestRawValue !== null && numericVal === bestRawValue) {
                    className = 'highlight-best';
                } else if (worstRawValue !== null && numericVal === worstRawValue && (spec.key === 'fuel_consumption_mixed' || spec.key === 'acceleration_0_100')) {
                     // Виділяємо червоним найбільшу витрату/розгін
                     className = 'highlight-worst';
                }
                 // Додаємо одиниці виміру, якщо потрібно
                let displayValue = v.formatted;
                if (spec.key === 'power_hp' && v.raw) displayValue += ' к.с.';
                if (spec.key === 'torque_nm' && v.raw) displayValue += ' Нм';
                if (spec.key === 'acceleration_0_100' && v.raw) displayValue += ' сек.';
                if (spec.key === 'top_speed_kmh' && v.raw) displayValue += ' км/год';
                if (spec.key === 'fuel_consumption_mixed' && v.raw) displayValue += ' л/100км';
                if (spec.key === 'trunk_volume_l' && v.raw) displayValue += ' л';

                rowHtml += `<td class="${className}">${displayValue}</td>`;
            });

            return rowHtml + '</tr>';
        }).join('');

        // Оновлюємо вміст модального вікна
        const modalContent = elements.comparisonModal.querySelector('.modal-content');
        if (modalContent) {
             modalContent.innerHTML = `<table class="comparison-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
        }

    } catch (error) {
        console.error("Помилка завантаження даних для порівняння:", error);
        const modalContent = elements.comparisonModal.querySelector('.modal-content');
         if (modalContent) {
            modalContent.innerHTML = `<p style="color: red;">Не вдалося завантажити дані: ${error.message}</p>`;
         }
    }
}
function closeComparisonModal() { if (elements.comparisonModal) elements.comparisonModal.style.display = 'none'; }

// --- Загальна функція відображення (спрощена) ---
async function renderData() {
    // Тепер головна сторінка відображає тільки марки
    await renderBrandGrid();
    renderStatistics(); // Оновлено
    renderFeaturedCars(); // Оновлено
    renderComparisonBar(); // Залишено
}


/**
 * Завантажує та відображає нещодавно переглянуті автомобілі.
 */
function updateRecentScrollButtonsVisibility() {
    const grid = elements.recentlyViewedCars;
    const leftBtn = document.getElementById('scrollRecentLeft');
    const rightBtn = document.getElementById('scrollRecentRight');

    // Перевіряємо наявність елементів
    if (!grid || !leftBtn || !rightBtn) {
        console.warn("Scroll elements not found for recently viewed.");
        return;
    }

    // Перевіряємо, чи є взагалі що прокручувати
    const canScroll = grid.scrollWidth > grid.clientWidth;

    if (!canScroll) {
        // Якщо прокрутка не потрібна, ховаємо обидві кнопки
        leftBtn.classList.add('hidden');
        rightBtn.classList.add('hidden');
        return;
    }

    // Показуємо/ховаємо ліву кнопку
    leftBtn.classList.toggle('hidden', grid.scrollLeft <= 0);

    // Показуємо/ховаємо праву кнопку (з невеликим допуском в 1px)
    rightBtn.classList.toggle('hidden', grid.scrollLeft >= grid.scrollWidth - grid.clientWidth - 1);
}

/**
 * Завантажує та відображає нещодавно переглянуті автомобілі.
 */
async function renderRecentlyViewed() {
    // Перевіряємо наявність основного контейнера
    if (!elements.recentlyViewedCars) {
        console.warn("Елемент recentlyViewedCars не знайдено.");
        return; 
    }
    // Знаходимо батьківську секцію
    const section = elements.recentlyViewedCars.closest('.recently-viewed-section');

    let recentlyViewedIds = [];
    try {
        // Завантажуємо ID з localStorage
        recentlyViewedIds = JSON.parse(localStorage.getItem('RightWheel_recently_viewed') || '[]');
    } catch (e) {
        console.error("Помилка завантаження ID нещодавно переглянутих:", e);
        if (section) section.style.display = 'none'; // Ховаємо секцію при помилці
        return;
    }

    // Якщо ID немає, ховаємо секцію
    if (recentlyViewedIds.length === 0) {
        if (section) section.style.display = 'none'; 
        return;
    }

    // Якщо є ID, показуємо секцію та індикатор завантаження
    if (section) section.style.display = 'block';
    elements.recentlyViewedCars.innerHTML = '<p>Завантаження даних...</p>'; // Індикатор завантаження

    try {
        // Створюємо масив промісів для завантаження даних по кожному ID
        const fetchPromises = recentlyViewedIds.map(trimId =>
            fetch(`http://127.0.0.1:5000/api/trims/${trimId}`)
                .then(response => {
                    // Перевіряємо, чи успішний запит
                    if (!response.ok) {
                        console.error(`Не вдалося завантажити ID ${trimId}. Статус: ${response.status}`);
                        return null; // Повертаємо null при помилці
                    }
                    return response.json(); // Повертаємо JSON-дані
                })
                .catch(error => {
                    // Обробляємо мережеві помилки
                    console.error(`Помилка мережі при завантаженні ID ${trimId}:`, error);
                    return null; // Повертаємо null при помилці
                })
        );

        // Чекаємо на завершення всіх запитів
        const results = await Promise.all(fetchPromises);
        // Фільтруємо null значення (які виникли через помилки)
        const recentCarsData = results.filter(car => car !== null); 

        // Якщо після завантаження дані відсутні (можливо, авто видалені)
        if (recentCarsData.length === 0) {
            elements.recentlyViewedCars.innerHTML = '<p style="color: var(--muted);">Не вдалося завантажити дані.</p>';
            // Ховаємо кнопки прокрутки, якщо дані не завантажились
            document.getElementById('scrollRecentLeft')?.classList.add('hidden');
            document.getElementById('scrollRecentRight')?.classList.add('hidden');
            return;
        }

        // Очищуємо індикатор завантаження
        elements.recentlyViewedCars.innerHTML = ''; 
        
        // Відображаємо кожну картку
        recentCarsData.forEach(car => {
            const card = document.createElement('div');
            card.className = 'recent-car-card'; // Використовуємо стиль картки
            // Зберігаємо всі необхідні дані для переходу на сторінку деталей
            card.dataset.id = car.id;
            card.dataset.brandId = car.brand_id;
            card.dataset.brandName = car.make_name;
            card.dataset.modelId = car.model_id;
            card.dataset.modelName = car.model_name;
            card.dataset.generationId = car.generation_id;
            card.dataset.generationName = car.generation_name || `${car.year_start}-${car.year_end || 'н.ч.'}`;

            // Формуємо HTML картки
            card.innerHTML = `
                <div class="recent-car-image">
                    <img src="${car.image_url || 'https://via.placeholder.com/80x55?text=No+Photo'}" alt="${car.make_name} ${car.model_name}">
                </div>
                <div class="recent-car-content">
                    <h4>${car.make_name} ${car.model_name} (${car.year})</h4>
                    <div class="spec-line">${car.name || ''}</div>
                    <div class="spec-line">${car.power_hp ? car.power_hp + ' к.с.' : ''} ${car.fuel ? `(${car.fuel})` : ''}</div>
                    <div class="body-drive-line">${car.body_type || ''}${car.drive ? ', ' + car.drive : ''}</div>
                </div>
            `;
             // Додаємо слухач події для переходу на сторінку деталей car.html
             card.addEventListener('click', () => {
                 const params = new URLSearchParams({ 
                     id: card.dataset.id, 
                     brandId: card.dataset.brandId, 
                     brandName: card.dataset.brandName,
                     modelId: card.dataset.modelId, 
                     modelName: card.dataset.modelName,
                     generationId: card.dataset.generationId, 
                     generationName: card.dataset.generationName
                 });
                 window.location.href = `car.html?${params.toString()}`;
             });
             // Додаємо картку до контейнера
            elements.recentlyViewedCars.appendChild(card);
        });

        // Оновлюємо видимість кнопок прокрутки ПІСЛЯ додавання всіх карток
        // Даємо невелику затримку, щоб браузер встиг розрахувати ширину
        setTimeout(updateRecentScrollButtonsVisibility, 150); 

        // Додаємо слухач події 'scroll' до контейнера, якщо його ще немає
        if (elements.recentlyViewedCars && !elements.recentlyViewedCars.dataset.scrollListenerAdded) {
            elements.recentlyViewedCars.addEventListener('scroll', updateRecentScrollButtonsVisibility);
            elements.recentlyViewedCars.dataset.scrollListenerAdded = 'true'; // Позначаємо, що слухач додано
        }

    } catch (error) { // Обробляємо загальну помилку (напр., якщо Promise.all не спрацював)
        console.error("Загальна помилка відображення нещодавно переглянутих:", error);
        elements.recentlyViewedCars.innerHTML = '<p style="color: red;">Помилка відображення даних.</p>';
        // Ховаємо кнопки прокрутки при загальній помилці
        document.getElementById('scrollRecentLeft')?.classList.add('hidden');
        document.getElementById('scrollRecentRight')?.classList.add('hidden');
    }
}


// app.js

// Ця функція викликається автоматично після завантаження бібліотеки Google
// (див. HTML крок нижче) або при ініціалізації сторінки
function initGoogleAuth() {
    const GOOGLE_CLIENT_ID = "946160534638-fonljg2rk50c1pcovhuk91anbhmj1s9o.apps.googleusercontent.com"; // Той самий, що і на бекенді
    
    // Перевіряємо, чи завантажилась бібліотека
    if (typeof google === 'undefined') return;

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse
    });

    // Рендеримо кнопку в контейнер (створимо його в HTML)
    const buttonContainer = document.getElementById("googleButtonDiv");
    if (buttonContainer) {
        google.accounts.id.renderButton(
            buttonContainer,
            { 
                theme: "filled_black", // Темна тема під ваш дизайн
                size: "large",         // Розмір
                width: "100%",         // Розтягнути на ширину контейнера (або вкажіть пікселі, напр 350)
                text: "continue_with", // Текст "Продовжити через Google"
                shape: "pill"          // Заокруглені краї, як у ваших кнопок
            }
        );
    }
    
    // Опціонально: відобразити спливаюче вікно (One Tap) праворуч зверху
    // google.accounts.id.prompt(); 
}

// Обробка відповіді від Google
async function handleGoogleCredentialResponse(response) {
    console.log("Google Token received:", response.credential);

    try {
        const res = await fetch('http://127.0.0.1:5000/api/auth/google', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ token: response.credential })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            // Зберігаємо токен і логін
            localStorage.setItem('RightWheel_access_token', data.access_token);
            localStorage.setItem('RightWheel_loggedInUser', data.username);

            // --- ДОДАНО ---
            if (data.avatar_url) {
                localStorage.setItem('RightWheel_userAvatar', data.avatar_url);
            }
            
            showInfoModal('Успіх', 'Вхід через Google виконано успішно!', 'success');
            
            // Закриваємо модалку і перезавантажуємо сторінку
            const loginModal = document.getElementById('loginModal');
            if (loginModal) loginModal.style.display = 'none';
            
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showInfoModal('Помилка', data.error || "Помилка входу через Google", 'error');
        }
    } catch (e) {
        console.error("Network error:", e);
        showInfoModal('Помилка', "Не вдалося з'єднатися з сервером", 'error');
    }
}

// Додаємо ініціалізацію при завантаженні сторінки
window.onload = function() {
    // Викликаємо ініціалізацію Google, якщо бібліотека вже є
    initGoogleAuth();
    // Ваша існуюча init() функція
    if (typeof init === 'function') init();
};


// --- Ініціалізація ---

async function init() {
    // === 1. ГЛОБАЛЬНА ЛОГІКА (Працює на всіх сторінках) ===
    loadDataFromLocalStorage(); 
    checkLoginStatus(); 

    // Додаємо слухачі для хедера та модалок (вони є на всіх сторінках)
    // Нові слухачі для посилань внизу модалок
    document.getElementById('showRegisterBtnFromLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterModal();
    });
    document.getElementById('showLoginBtnFromRegister')?.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginModal();
    });

    // Слухач для "Забули пароль?"
    document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        showInfoModal('Функція у розробці', 'Функція відновлення паролю наразі недоступна.', 'info');
    });
    elements.registerForm?.addEventListener('submit', handleRegister);
    elements.loginForm?.addEventListener('submit', handleLogin);
    elements.logoutBtn?.addEventListener('click', handleLogout);
    
    // Кнопка "Увійти" з хедера (теж глобальна)
    document.getElementById('showLoginModalBtn')?.addEventListener('click', showLoginModal);

    document.getElementById('closeLoginModalBtn')?.addEventListener('click', closeLoginModal);
    document.getElementById('closeRegisterModalBtn')?.addEventListener('click', closeRegisterModal);

    // Закриття по кліку на фон
    elements.loginModal?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-back')) closeLoginModal();
    });
    elements.registerModal?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-back')) closeRegisterModal();
    });
    
    // Кнопка "Обране" (глобальна)
    elements.showFavoritesBtn?.addEventListener('click', () => {
        window.location.href = 'favorites.html';
    });

    // Запускаємо рендер "Нещодавно переглянутих"
    // (Ця функція має внутрішню перевірку, тому безпечна для всіх сторінок)
    await renderRecentlyViewed();
    
    // Додаємо слухачі для скролу "Нещодавно переглянутих"
    // (Вони спрацюють тільки на сторінках, де є ці кнопки)
    const scrollAmount = 335; 
    document.getElementById('scrollRecentLeft')?.addEventListener('click', () => {
        elements.recentlyViewedCars?.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    document.getElementById('scrollRecentRight')?.addEventListener('click', () => {
        elements.recentlyViewedCars?.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

// --- ЛОГІКА МЕНЮ КОРИСТУВАЧА (ВСТАВИТИ ТУТ, ДО RETURN) ---
    if (elements.userMenuTrigger) {
        // Видаляємо старі, щоб не дублювати
        const newTrigger = elements.userMenuTrigger.cloneNode(true);
        elements.userMenuTrigger.parentNode.replaceChild(newTrigger, elements.userMenuTrigger);
        elements.userMenuTrigger = newTrigger; // Оновлюємо посилання

        elements.userMenuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.userMenuContainer.classList.toggle('active');
        });
    }

    // Закриття при кліку поза меню
    document.addEventListener('click', (e) => {
        if (elements.userMenuContainer && elements.userMenuContainer.classList.contains('active')) {
            if (!elements.userMenuContainer.contains(e.target)) {
                elements.userMenuContainer.classList.remove('active');
            }
        }
    });

    if (elements.logoutBtnDropdown) {
        elements.logoutBtnDropdown.addEventListener('click', handleLogout);
    }
    // -----------------------------------------------------------


    // === 2. ЛОГІКА ТІЛЬКИ ДЛЯ main.html ===
    
    // Перевіряємо, чи ми на головній сторінці, дивлячись на унікальний елемент
    if (!elements.brandGridView) {
        // Ми не на головній сторінці.
        // Глобальна логіка вже відпрацювала, просто виходимо.
        return; 
    }

    // --- Якщо ми тут, значить ми на main.html ---
    
    // Запускаємо логіку пошуку
    await initAdvancedSearch(); 

    

    // Додаємо слухачі, специфічні для main.html
    elements.logoHomeLink?.addEventListener('click', () => window.location.href = 'main.html'); 
    elements.globalSearchInput?.addEventListener('input', handleGlobalSearchInput);
    elements.globalSearchInput?.addEventListener('focus', handleGlobalSearchInput);
    elements.globalSearchInput?.addEventListener('blur', closeSearchDropdown);
    elements.searchDropdown?.addEventListener('click', handleSearchDropdownClick);
    elements.advancedSearchBtn?.addEventListener('click', openAdvancedSearchModal);
    document.getElementById('closeAdvancedSearchModal')?.addEventListener('click', closeAdvancedSearchModal);
    elements.advancedSearchModal?.addEventListener('click', (e) => { if (e.target.classList.contains('modal-root')) closeAdvancedSearchModal(); });
    document.getElementById('advancedSearchForm')?.addEventListener('submit', handleAdvancedSearch);
    document.getElementById('resetAdvancedSearch')?.addEventListener('click', resetAdvancedSearch);
    elements.openAddModalBtn?.addEventListener('click', () => openEditAddModal(null));
    elements.exportBtn?.addEventListener('click', exportData);
    

    // Запускаємо завантаження даних для головної сторінки
    await renderData();
}



document.addEventListener('DOMContentLoaded', init);