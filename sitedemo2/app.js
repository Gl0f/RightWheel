// app.js

let MOCK_CARS = []; 
let USERS_DATABASE = [];

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
    carListView: document.getElementById('carListView'),
    currentBrandTitle: document.getElementById('currentBrandTitle'),
    listElement: document.getElementById('carList'),
    searchInput: document.getElementById('searchInput'),
    fuelSelect: document.getElementById('fuelSelect'),
    sortSelect: document.getElementById('sortSelect'),
    listHeader: document.getElementById('listHeader'),
    paginationInfo: document.getElementById('paginationInfo'),
    paginationRow: document.getElementById('paginationRow'),
    editAddModal: document.getElementById('editAddModal'),
    viewCarModal: document.getElementById('viewCarModal'),
    logoHomeLink: document.getElementById('logoHomeLink'),
    openAddModalBtn: document.getElementById('openAddModalBtn'),
    closeEditAddModal: document.getElementById('closeEditAddModal'),
    carForm: document.getElementById('carForm'),
    exportBtn: document.getElementById('exportBtn'),
    backToBrandsBtn: document.getElementById('backToBrandsBtn'),
    featuredCars: document.getElementById('featuredCars'),
    globalSearchInput: document.getElementById('globalSearchInput'),
    searchDropdown: document.getElementById('searchDropdown'),
    advancedSearchBtn: document.getElementById('advancedSearchBtn'),
    advancedSearchModal: document.getElementById('advancedSearchModal'),
    closeAdvancedSearchModal: document.getElementById('closeAdvancedSearchModal'),
    advancedSearchForm: document.getElementById('advancedSearchForm'),
    resetAdvancedSearch: document.getElementById('resetAdvancedSearch'),
    adv_make: document.getElementById('adv_make'),
    adv_body_type: document.getElementById('adv_body_type'),
    adv_fuel: document.getElementById('adv_fuel'),
    adv_drive: document.getElementById('adv_drive'),
    adv_year_from: document.getElementById('adv_year_from'),
    adv_year_to: document.getElementById('adv_year_to'),
    adv_price_from: document.getElementById('adv_price_from'),
    adv_price_to: document.getElementById('adv_price_to'),
    adv_power_from: document.getElementById('adv_power_from'),
    adv_power_to: document.getElementById('adv_power_to'),
    statsSection: document.getElementById('statsSection'),
    mainPageTitle: document.getElementById('mainPageTitle'),
    showFavoritesBtn: document.getElementById('showFavoritesBtn'),
    comparisonBar: document.getElementById('comparisonBar'),
    comparisonModal: document.getElementById('comparisonModal')
};

const state = {
    carsPerPage: 15,
    currentPage: 1,
    selectedBrand: '',
    currentSortColumn: 'year',
    currentSortDirection: 'desc',
    isLoggedIn: false,
    advancedSearchFilters: {},
    viewMode: 'all', // 'all' or 'favorites'
    favorites: [], 
    comparisonList: [] 
};

function saveDataToLocalStorage() {
    try {
        localStorage.setItem('RightWheel_cars', JSON.stringify(MOCK_CARS));
        localStorage.setItem('RightWheel_users', JSON.stringify(USERS_DATABASE));
        localStorage.setItem('RightWheel_favorites', JSON.stringify(state.favorites));
    } catch (e) {
        console.error("Помилка збереження даних в localStorage:", e);
    }
}

function loadDataFromLocalStorage() {
    try {
        const savedCars = localStorage.getItem('RightWheel_cars');
        const savedUsers = localStorage.getItem('RightWheel_users');
        const savedFavorites = localStorage.getItem('RightWheel_favorites');

        MOCK_CARS = savedCars ? JSON.parse(savedCars) : [...CAR_DATABASE];
        USERS_DATABASE = savedUsers ? JSON.parse(savedUsers) : [{ username: 'admin', password: '12345', email: 'admin@rightwheel.ua' }];
        state.favorites = savedFavorites ? JSON.parse(savedFavorites) : [];
    } catch (e) {
        console.error("Помилка завантаження даних з localStorage:", e);
        MOCK_CARS = [...CAR_DATABASE];
        USERS_DATABASE = [{ username: 'admin', password: '12345', email: 'admin@rightwheel.ua' }];
        state.favorites = [];
    }
}

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
function formatPrice(price) { return price.toLocaleString('uk-UA', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }); }
function getLatestCars(count = 4) { return [...MOCK_CARS].sort((a, b) => b.year - a.year || b.id.localeCompare(a.id)).slice(0, count); }

function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const captcha = document.getElementById('registerCaptchaCheck').checked;
    
    if (!captcha) { alert('Будь ласка, підтвердіть, що ви не робот!'); return; }
    if (password !== confirmPassword) { alert('Паролі не співпадають!'); return; }
    if (USERS_DATABASE.find(user => user.username === username)) { alert('Користувач з таким логіном вже існує!'); return; }
    if (USERS_DATABASE.find(user => user.email === email)) { alert('Користувач з таким email вже існує!'); return; }
    
    USERS_DATABASE.push({ username, password, email });
    saveDataToLocalStorage();
    alert('Реєстрація успішна! Тепер ви можете увійти в систему.');
    showLoginModal();
}

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const captcha = document.getElementById('captchaCheck').checked;
    
    if (!captcha) { alert('Будь ласка, підтвердіть, що ви не робот!'); return; }
    
    const user = USERS_DATABASE.find(u => u.username === username && u.password === password);
    
    if (user) {
        // ---> ДОДАЙТЕ ЦЕЙ РЯДОК <---
        localStorage.setItem('RightWheel_loggedInUser', username);

        state.isLoggedIn = true;
        elements.loginModal.style.display = 'none';
        elements.logoutBtn.style.display = 'inline-flex';
        elements.showFavoritesBtn.style.display = 'inline-flex';
        elements.openAddModalBtn.disabled = false;
        renderData();
    } else {
        alert('Невірний логін або пароль!');
    }
}

function showRegisterModal() { elements.loginModal.style.display = 'none'; elements.registerModal.style.display = 'flex'; }
function showLoginModal() { elements.registerModal.style.display = 'none'; elements.loginModal.style.display = 'flex'; }

function handleLogout() {
    // ---> ДОДАЙТЕ ЦЕЙ РЯДОК <---
    localStorage.removeItem('RightWheel_loggedInUser');

    state.isLoggedIn = false;
    state.selectedBrand = '';
    state.currentPage = 1;
    
    elements.loginModal.style.display = 'flex';
    elements.logoutBtn.style.display = 'none';
    elements.showFavoritesBtn.style.display = 'none';
    elements.openAddModalBtn.disabled = true;
    
    if (elements.loginForm) elements.loginForm.reset();
}

// ВСТАВТЕ ЦЮ НОВУ ФУНКЦІЮ ПЕРЕД init()
function checkLoginStatus() {
    const loggedInUser = localStorage.getItem('RightWheel_loggedInUser');
    if (loggedInUser) {
        state.isLoggedIn = true;
        elements.loginModal.style.display = 'none';
        elements.logoutBtn.style.display = 'inline-flex';
        elements.showFavoritesBtn.style.display = 'inline-flex';
        elements.openAddModalBtn.disabled = false;
    }
}

function handleGlobalSearchInput() {
    const query = elements.globalSearchInput.value.toLowerCase().trim();
    if (query.length < 2) { elements.searchDropdown.style.display = 'none'; return; }
    const results = MOCK_CARS.filter(car => car.make.toLowerCase().includes(query) || car.model.toLowerCase().includes(query)).slice(0, 10);
    if (results.length === 0) { elements.searchDropdown.style.display = 'none'; return; }
    elements.searchDropdown.innerHTML = '';
    results.forEach(car => {
        const item = document.createElement('div');
        item.className = 'search-dropdown-item';
        item.dataset.id = car.id;
        item.innerHTML = `<div><div class="search-dropdown-make">${car.make}</div><div class="search-dropdown-model">${car.model}</div></div><div class="search-dropdown-year">${car.year}</div>`;
        elements.searchDropdown.appendChild(item);
    });
    elements.searchDropdown.style.display = 'block';
}

function handleSearchDropdownClick(e) {
    const item = e.target.closest('.search-dropdown-item');
    if (!item) return;
    const carId = item.dataset.id;
    const car = MOCK_CARS.find(c => c.id === carId);
    if (car) {
        state.selectedBrand = car.make;
        state.currentPage = 1;
        state.viewMode = 'all';
        renderData();
        elements.searchDropdown.style.display = 'none';
        elements.globalSearchInput.value = '';
    }
}

function closeSearchDropdown() { setTimeout(() => { elements.searchDropdown.style.display = 'none'; }, 150); }

function initAdvancedSearch() {
    const makes = [...new Set(MOCK_CARS.map(car => car.make))].sort();
    elements.adv_make.innerHTML = '<option value="">Марка...</option>';
    makes.forEach(make => {
        const option = document.createElement('option');
        option.value = make;
        option.textContent = make;
        elements.adv_make.appendChild(option);
    });
}

function openAdvancedSearchModal() { elements.advancedSearchModal.style.display = 'flex'; }
function closeAdvancedSearchModal() { elements.advancedSearchModal.style.display = 'none'; }

function handleAdvancedSearch(e) {
    e.preventDefault();
    state.advancedSearchFilters = {
        make: elements.adv_make.value,
        body_type: elements.adv_body_type.value,
        fuel: elements.adv_fuel.value,
        drive: elements.adv_drive.value,
        year_from: elements.adv_year_from.value ? parseInt(elements.adv_year_from.value) : null,
        year_to: elements.adv_year_to.value ? parseInt(elements.adv_year_to.value) : null,
        price_from: elements.adv_price_from.value ? parseInt(elements.adv_price_from.value) : null,
        price_to: elements.adv_price_to.value ? parseInt(elements.adv_price_to.value) : null,
        power_from: elements.adv_power_from.value ? parseInt(elements.adv_power_from.value) : null,
        power_to: elements.adv_power_to.value ? parseInt(elements.adv_power_to.value) : null
    };
    state.selectedBrand = '';
    state.currentPage = 1;
    state.viewMode = 'all';
    renderData();
    closeAdvancedSearchModal();
}

function resetAdvancedSearch() {
    elements.advancedSearchForm.reset();
    state.advancedSearchFilters = {};
    renderData();
}

function applyAdvancedFilters(cars) {
    const filters = state.advancedSearchFilters;
    return cars.filter(car => {
        if (filters.make && car.make !== filters.make) return false;
        if (filters.body_type && car.body_type !== filters.body_type) return false;
        if (filters.fuel && car.fuel !== filters.fuel) return false;
        if (filters.drive && car.drive !== filters.drive) return false;
        if (filters.year_from && car.year < filters.year_from) return false;
        if (filters.year_to && car.year > filters.year_to) return false;
        if (filters.price_from && car.price_eur < filters.price_from) return false;
        if (filters.price_to && car.price_eur > filters.price_to) return false;
        if (filters.power_from && car.power_hp < filters.power_from) return false;
        if (filters.power_to && car.power_hp > filters.power_to) return false;
        return true;
    });
}

// Повністю замініть цю функцію в app.js
function renderStatistics() {
    if (!elements.statsSection) return;
    const totalCars = MOCK_CARS.length;
    const fuelCounts = MOCK_CARS.reduce((acc, car) => { acc[car.fuel] = (acc[car.fuel] || 0) + 1; return acc; }, {});
    const fuelDistributionHTML = Object.entries(fuelCounts).map(([fuel, count]) => `<div class="fuel-dist-segment ${getFuelBadgeClass(fuel)}" style="width: ${((count / totalCars) * 100)}%;" title="${fuel}: ${count} авто"></div>`).join('');
    
    // ЗМІНА ТУТ: видалено картку "Середня вартість"
    elements.statsSection.innerHTML = `
        <div class="stat-card">
            <div class="stat-title">Загальна кількість авто</div>
            <div class="stat-value">${totalCars}</div>
        </div>
        <div class="stat-card">
            <div class="stat-title">Розподіл за типом палива</div>
            <div class="stat-value" style="font-size: 16px;">${Object.keys(fuelCounts).length} типів</div>
            <div class="fuel-dist-bar">${fuelDistributionHTML}</div>
        </div>
    `;
}

// Повністю замініть цю функцію в app.js
function renderFeaturedCars() {
    if (!elements.featuredCars) return;
    const latestCars = getLatestCars(4);
    elements.featuredCars.innerHTML = '';
    latestCars.forEach(car => {
        const card = document.createElement('div');
        card.className = 'featured-car-card';
        card.dataset.id = car.id;
        // ЗМІНА ТУТ: видалено блок .featured-car-price
        card.innerHTML = `
            <div class="featured-car-header">
                <div class="featured-car-title">
                    <h4>${car.make} ${car.model}</h4>
                    <span>${car.engine}</span>
                </div>
                <div class="featured-car-year">${car.year}</div>
            </div>
            <div class="featured-car-specs">
                <div class="featured-car-spec"><label>Потужність</label><span>${car.power_hp} к.с.</span></div>
                <div class="featured-car-spec"><label>Паливо</label><span class="fuel-badge ${getFuelBadgeClass(car.fuel)}">${car.fuel}</span></div>
                <div class="featured-car-spec"><label>Трансмісія</label><span>${car.transmission}</span></div>
                <div class="featured-car-spec"><label>Крутний момент</label><span>${car.torque_nm} Нм</span></div>
            </div>
        `;
        elements.featuredCars.appendChild(card);
    });
    elements.featuredCars.querySelectorAll('.featured-car-card').forEach(card => {
        card.addEventListener('click', () => {
            // Змінюємо перехід на сторінку car.html замість модального вікна
            window.location.href = `car.html?id=${card.dataset.id}`;
        });
    });
}

function renderBrandGrid() {
    elements.brandGridView.style.display = 'block';
    
    elements.brandsGrid.innerHTML = '';
    
    let carsToShow = MOCK_CARS;
    let title = 'Оберіть марку для перегляду моделей';
    
    if (Object.keys(state.advancedSearchFilters).length > 0 && state.viewMode !== 'favorites') {
        carsToShow = applyAdvancedFilters(carsToShow);
        title = `Результати розширеного пошуку (${carsToShow.length})`;
    }
    
    elements.mainPageTitle.textContent = title;

    const makeCounts = carsToShow.reduce((acc, car) => { acc[car.make] = (acc[car.make] || 0) + 1; return acc; }, {});
    const makes = Object.keys(makeCounts).sort();

    makes.forEach(make => {
        const item = document.createElement('div');
        item.className = 'brand-item';
        item.dataset.make = make;
        item.innerHTML = `<div class="brand-logo-placeholder">${make.charAt(0).toUpperCase()}</div><div class="brand-name">${make}</div><div style="font-size: 12px; color: var(--muted); margin-top: 4px;">(${makeCounts[make]} моделей)</div>`;
        elements.brandsGrid.appendChild(item);
    });
    
    renderStatistics();
    renderFeaturedCars();
    attachBrandGridListeners();
}

/*function renderCarTable() {
    elements.brandGridView.style.display = 'none';
    elements.carListView.style.display = 'block';
    elements.listElement.innerHTML = '';

    let filteredCars;

    if (state.viewMode === 'favorites') {
        elements.currentBrandTitle.textContent = `⭐ Ваші обрані автомобілі`;
        filteredCars = MOCK_CARS.filter(car => state.favorites.includes(car.id));
    } else {
        elements.currentBrandTitle.textContent = `Автомобілі марки ${state.selectedBrand}`;
        filteredCars = MOCK_CARS.filter(car => car.make === state.selectedBrand);
    }
    
    const searchTerm = elements.searchInput?.value.toLowerCase().trim() || '';
    const selectedFuel = elements.fuelSelect?.value || '';
    if (searchTerm) { filteredCars = filteredCars.filter(car => car.model.toLowerCase().includes(searchTerm) || car.year.toString().includes(searchTerm)); }
    if (selectedFuel) { filteredCars = filteredCars.filter(car => car.fuel === selectedFuel); }

    filteredCars.sort((a, b) => {
        const isAsc = state.currentSortDirection === 'asc' ? 1 : -1;
        let valA, valB;
        switch (state.currentSortColumn) {
            case 'price': valA = a.price_eur; valB = b.price_eur; break;
            case 'year': valA = a.year; valB = b.year; break;
            case 'power': valA = a.power_hp; valB = b.power_hp; break;
            case 'fuel': valA = a.fuel.toLowerCase(); valB = b.fuel.toLowerCase(); break;
            case 'model': valA = a.model.toLowerCase(); valB = b.model.toLowerCase(); break;
            default: return 0;
        }
        if (valA < valB) return -1 * isAsc;
        if (valA > valB) return 1 * isAsc;
        return 0;
    });

    const totalCars = filteredCars.length;
    const totalPages = Math.ceil(totalCars / state.carsPerPage);
    const startIndex = (state.currentPage - 1) * state.carsPerPage;
    const currentCars = filteredCars.slice(startIndex, startIndex + state.carsPerPage);

    if (currentCars.length === 0) {
        elements.listElement.innerHTML = `<div class="empty-state"><h3>Нічого не знайдено</h3><p>${state.viewMode === 'favorites' ? 'Ви ще не додали жодного авто в обране.' : 'Спробуйте змінити пошуковий запит.'}</p></div>`;
        elements.paginationInfo.innerHTML = '';
        elements.paginationRow.innerHTML = '';
        return;
    }

    currentCars.forEach(car => {
        const isFavorited = state.favorites.includes(car.id);
        const isCompared = state.comparisonList.includes(car.id);
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = car.id; 
        
        card.innerHTML = `
            <div><input type="checkbox" class="compare-checkbox" data-id="${car.id}" ${isCompared ? 'checked' : ''}></div>
            <div class="car-image-container"><img src="${car.image_url || 'https://via.placeholder.com/100x70?text=No+Photo'}" alt="${car.make} ${car.model}" onerror="this.onerror=null;this.src='https://via.placeholder.com/100x70?text=No+Photo';"></div>
            <div class="card-title">${car.make} <span>${car.model}</span></div>
            <div>${car.year}</div>
            <div>${car.power_hp} к.с.</div>
            <div><span class="fuel-badge ${getFuelBadgeClass(car.fuel)}">${car.fuel}</span></div>
            <div>${car.transmission}</div>
            <div class="price-column">${formatPrice(car.price_eur)}</div>
            <div class="phone-number" data-phone="${car.phone}">${car.phone}</div>
            <div class="card-actions">
                <button class="btn small favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${car.id}" title="Додати в обране"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <button class="btn secondary small view-btn" data-id="${car.id}" title="Перегляд"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <button class="btn secondary small edit-btn" data-id="${car.id}" title="Редагувати"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                <button class="btn danger small delete-btn" data-id="${car.id}" title="Видалити"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </div>`;
        elements.listElement.appendChild(card);
    });

    renderPagination(totalCars, totalPages);
    attachListEventListeners();
    attachPhoneNumberListeners();
}*/

function renderData() {
    renderBrandGrid();
    renderComparisonBar(); // Залишаємо, якщо порівняння глобальне
}

function renderPagination(totalCars, totalPages) {
    elements.paginationRow.innerHTML = '';
    if (totalPages <= 1) { elements.paginationInfo.innerHTML = `Показано ${totalCars} результатів`; return; }
    const prevDisabled = state.currentPage === 1 ? 'disabled' : '';
    const nextDisabled = state.currentPage === totalPages ? 'disabled' : '';
    elements.paginationInfo.innerHTML = `Сторінка ${state.currentPage} з ${totalPages} (${totalCars} автомобілів)`;
    elements.paginationRow.innerHTML = `<button class="btn secondary small" id="prevPage" ${prevDisabled}>&lt; Попередня</button><button class="btn secondary small" id="nextPage" ${nextDisabled}>Наступна &gt;</button>`;
    document.getElementById('prevPage')?.addEventListener('click', () => { if (state.currentPage > 1) { state.currentPage--; renderData(); } });
    document.getElementById('nextPage')?.addEventListener('click', () => { if (state.currentPage < totalPages) { state.currentPage++; renderData(); } });
}

function attachBrandGridListeners() { document.querySelectorAll('.brand-item').forEach(item => item.addEventListener('click', handleBrandClick)); }

function attachListEventListeners() {
    if (elements.listElement) {
        elements.listElement.addEventListener('click', handleListDelegation);
        elements.listElement.querySelectorAll('.card').forEach(card => card.addEventListener('click', handleRowClick));
    }
    elements.listElement?.querySelectorAll('.compare-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            updateComparisonList(e.target.dataset.id, e.target.checked);
        });
    });
    if (elements.listHeader) { elements.listHeader.addEventListener('click', handleSortClick); }
}

function attachPhoneNumberListeners() { document.querySelectorAll('.phone-number').forEach(el => el.addEventListener('click', function(e) { e.stopPropagation(); this.classList.toggle('revealed'); })); }

// ЗНАЙДІТЬ ЦЮ ФУНКЦІЮ
function handleRowClick(e) {
    // ЯКЩО КЛІК НЕ ПО КНОПКАХ, ТЕЛЕФОНУ ЧИ ЧЕКБОКСУ
    if (!e.target.closest('.card-actions') && !e.target.closest('.phone-number') && e.target.type !== 'checkbox') {
        const id = e.currentTarget.dataset.id;
        // НОВИЙ КОД: Перенаправляємо на сторінку car.html з потрібним ID
        window.location.href = `car.html?id=${id}`;
    }
}

// ЗНАЙДІТЬ ЦЮ ФУНКЦІЮ
function handleListDelegation(e) {
    e.stopPropagation();
    const targetElement = e.target.closest('button, input');
    if (!targetElement) return;
    const id = targetElement.dataset.id;
    if (!id) return;
    if (targetElement.classList.contains('favorite-btn')) toggleFavorite(id);
    // ЗМІНІТЬ ЦЕЙ РЯДОК
    else if (targetElement.classList.contains('view-btn')) { window.location.href = `car.html?id=${id}`; }
    else if (targetElement.classList.contains('edit-btn')) openEditAddModal(id);
    else if (targetElement.classList.contains('delete-btn')) deleteCar(id);
}

function handleBrandClick(e) {
    const brandName = e.currentTarget.dataset.make;
    window.location.href = `brand.html?name=${brandName}`;
}

function handleSortClick(e) {
    const target = e.target.closest('[data-sort]');
    if (!target) return;
    const newSortColumn = target.dataset.sort;
    let newSortDirection = 'asc';
    if (state.currentSortColumn === newSortColumn) { newSortDirection = state.currentSortDirection === 'asc' ? 'desc' : 'asc'; }
    state.currentSortColumn = newSortColumn;
    state.currentSortDirection = newSortDirection;
    renderData();
}

function handleFilterChange() { state.currentPage = 1; renderData(); }

function handleSortSelectChange() {
    const value = this.value;
    switch(value) {
        case 'price_asc': state.currentSortColumn = 'price'; state.currentSortDirection = 'asc'; break;
        case 'price_desc': state.currentSortColumn = 'price'; state.currentSortDirection = 'desc'; break;
        case 'year_desc': state.currentSortColumn = 'year'; state.currentSortDirection = 'desc'; break;
        case 'year_asc': state.currentSortColumn = 'year'; state.currentSortDirection = 'asc'; break;
        case 'power_desc': state.currentSortColumn = 'power'; state.currentSortDirection = 'desc'; break;
        case 'power_asc': state.currentSortColumn = 'power'; state.currentSortDirection = 'asc'; break;
        default: return;
    }
    renderData();
}

function handleBackToBrands() {
    state.selectedBrand = '';
    state.currentPage = 1;
    state.viewMode = 'all';
    renderData();
}

function toggleFavorite(carId) {
    if (!state.isLoggedIn) { alert('Будь ласка, увійдіть, щоб додавати авто в обране.'); return; }
    const index = state.favorites.indexOf(carId);
    if (index > -1) { state.favorites.splice(index, 1); }
    else { state.favorites.push(carId); }
    saveDataToLocalStorage();
    renderData();
}

function updateComparisonList(carId, isSelected) {
    const index = state.comparisonList.indexOf(carId);
    if (isSelected) {
        if (index === -1) {
            if (state.comparisonList.length >= 4) {
                alert('Можна порівнювати не більше 4 автомобілів одночасно.');
                const checkbox = document.querySelector(`.compare-checkbox[data-id="${carId}"]`);
                if(checkbox) checkbox.checked = false;
                return;
            }
            state.comparisonList.push(carId);
        }
    } else { if (index > -1) { state.comparisonList.splice(index, 1); } }
    renderComparisonBar();
}

function renderComparisonBar() {
    const count = state.comparisonList.length;
    if (count > 0) {
        elements.comparisonBar.classList.add('visible');
        elements.comparisonBar.innerHTML = `<div class="comparison-content"><span>Обрано для порівняння: ${count} авто</span><div><button class="btn secondary small" id="clearComparisonBtn">Очистити</button><button class="btn primary" id="compareBtn" ${count < 2 ? 'disabled' : ''}>Порівняти</button></div></div>`;
        document.getElementById('compareBtn').addEventListener('click', openComparisonModal);
        document.getElementById('clearComparisonBtn').addEventListener('click', clearComparison);
    } else {
        elements.comparisonBar.classList.remove('visible');
    }
}

function clearComparison() { state.comparisonList = []; renderData(); }

function openComparisonModal() {
    const carsToCompare = MOCK_CARS.filter(car => state.comparisonList.includes(car.id));
    const specs = [ { key: 'make', label: 'Марка' }, { key: 'model', label: 'Модель' }, { key: 'year', label: 'Рік', compare: 'max' }, { key: 'price_eur', label: 'Ціна (€)', compare: 'min' }, { key: 'power_hp', label: 'Потужність (к.с.)', compare: 'max' }, { key: 'torque_nm', label: 'Крутний момент (Нм)', compare: 'max' }, { key: 'fuel', label: 'Паливо' }, { key: 'transmission', label: 'Трансмісія' }, { key: 'body_type', label: 'Тип кузова' }, { key: 'drive', label: 'Привід' } ];
    let headerHtml = '<th>Характеристика</th>';
    carsToCompare.forEach(car => { headerHtml += `<th>${car.make} ${car.model}</th>`; });
    let bodyHtml = specs.map(spec => {
        let rowHtml = `<tr><td class="spec-label">${spec.label}</td>`;
        const values = carsToCompare.map(car => parseFloat(car[spec.key])).filter(v => !isNaN(v));
        let bestValue = null;
        if (values.length > 1) {
            if (spec.compare === 'max') bestValue = Math.max(...values);
            if (spec.compare === 'min') bestValue = Math.min(...values);
        }
        carsToCompare.forEach(car => {
            const value = car[spec.key];
            let className = '';
            if (bestValue !== null && parseFloat(value) === bestValue) { className = 'highlight-best'; }
            rowHtml += `<td class="${className}">${value || 'Н/Д'}</td>`;
        });
        return rowHtml + '</tr>';
    }).join('');
    elements.comparisonModal.innerHTML = `<div class="modal-back"></div><div class="modal" style="max-width: 1000px;"><div class="modal-header"><h2 class="modal-title">Порівняння автомобілів</h2><button id="closeCompareModal" class="btn small secondary">Закрити</button></div><div class="modal-content" style="overflow-x: auto;"><table class="comparison-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div></div>`;
    elements.comparisonModal.style.display = 'flex';
    document.getElementById('closeCompareModal').addEventListener('click', closeComparisonModal);
    elements.comparisonModal.querySelector('.modal-back').addEventListener('click', closeComparisonModal);
}
function closeComparisonModal() { elements.comparisonModal.style.display = 'none'; }

function findSimilarCars(currentCar) {
    const priceTolerance = 0.25;
    const minPrice = currentCar.price_eur * (1 - priceTolerance);
    const maxPrice = currentCar.price_eur * (1 + priceTolerance);
    return MOCK_CARS.filter(car => car.id !== currentCar.id && car.price_eur >= minPrice && car.price_eur <= maxPrice && car.body_type === currentCar.body_type)
    .sort((a, b) => Math.abs(a.price_eur - currentCar.price_eur) - Math.abs(b.price_eur - currentCar.price_eur)).slice(0, 3);
}

function renderSimilarCars(similarCars, container) {
    if (similarCars.length === 0) { container.innerHTML = '<h4>Схожих автомобілів не знайдено</h4>'; return; }
    container.innerHTML = `<h4>Схожі автомобілі</h4><div class="similar-cars-grid">${similarCars.map(car => `<div class="similar-car-card" data-id="${car.id}"><div class="similar-car-title">${car.make} ${car.model}</div><div class="similar-car-details"><span>${car.year}</span><span class="fuel-badge ${getFuelBadgeClass(car.fuel)}">${car.fuel}</span></div><div class="similar-car-price">${formatPrice(car.price_eur)}</div></div>`).join('')}</div>`;
    container.querySelectorAll('.similar-car-card').forEach(card => card.addEventListener('click', () => {
        const car = MOCK_CARS.find(c => c.id === card.dataset.id);
        if (car) { closeViewModal(); setTimeout(() => openCarModal(car), 150); }
    }));
}

function openCarModal(car) {
    if (!elements.viewCarModal || !car) return;
    const isFavorited = state.favorites.includes(car.id);
    elements.viewCarModal.innerHTML = `<div class="modal-back"></div><div class="modal" style="max-width: 800px;"><div class="modal-header"><h2 class="modal-title">${car.make} ${car.model}</h2><button id="closeViewModal" class="btn small secondary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="modal-content"><div style="margin-bottom: 20px; border-radius: 4px; overflow: hidden; background: var(--bg); text-align: center;"><img src="${car.image_url || 'https://via.placeholder.com/800x400?text=No+Photo'}" alt="${car.make} ${car.model}" style="width: 100%; height: auto; max-height: 400px; object-fit: cover;" onerror="this.onerror=null;this.src='https://via.placeholder.com/800x400?text=No+Photo';"></div><div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;"><div class="price" style="font-size:32px; color: var(--success); font-weight: 700;">${formatPrice(car.price_eur)}</div><div style="display:flex; gap: 10px;"><button class="btn favorite-btn ${isFavorited ? 'favorited' : ''}" id="modalFavoriteBtn" data-id="${car.id}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="btn primary" id="editFromViewModalBtn" data-id="${car.id}">Редагувати</button></div></div><div class="modal-specs" style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; border-top: 1px solid var(--border); padding-top: 15px;"><div class="spec-item"><span class="spec-label">Рік випуску:</span><span class="spec-value">${car.year}</span></div><div class="spec-item"><span class="spec-label">Тип палива:</span><span class="spec-value"><span class="fuel-badge ${getFuelBadgeClass(car.fuel)}">${car.fuel}</span></span></div><div class="spec-item"><span class="spec-label">Двигун:</span><span class="spec-value">${car.engine}</span></div><div class="spec-item"><span class="spec-label">Потужність:</span><span class="spec-value">${car.power_hp} к.с.</span></div><div class="spec-item"><span class="spec-label">Крутний момент:</span><span class="spec-value">${car.torque_nm} Нм</span></div><div class="spec-item"><span class="spec-label">Трансмісія:</span><span class="spec-value">${car.transmission}</span></div><div class="spec-item"><span class="spec-label">Тип кузова:</span><span class="spec-value">${car.body_type || 'Н/Д'}</span></div><div class="spec-item"><span class="spec-label">Привід:</span><span class="spec-value">${car.drive || 'Н/Д'}</span></div><div class="spec-item"><span class="spec-label">Телефон:</span><span class="spec-value">${car.phone}</span></div></div><div id="similarCarsContainer" class="similar-cars-section"></div></div></div>`;
    elements.viewCarModal.style.display = 'flex';
    const similarCars = findSimilarCars(car);
    const similarCarsContainer = document.getElementById('similarCarsContainer');
    if (similarCarsContainer) { renderSimilarCars(similarCars, similarCarsContainer); }
    document.getElementById('editFromViewModalBtn')?.addEventListener('click', (e) => openEditAddModal(e.target.dataset.id));
    document.getElementById('modalFavoriteBtn')?.addEventListener('click', (e) => toggleFavorite(e.currentTarget.dataset.id));
    document.getElementById('closeViewModal')?.addEventListener('click', closeViewModal);
    elements.viewCarModal.querySelector('.modal-back')?.addEventListener('click', closeViewModal);
}
function closeViewModal() { if (elements.viewCarModal) elements.viewCarModal.style.display = 'none'; }

function openEditAddModal(carId = null) {
    if (!state.isLoggedIn) { alert('Будь ласка, увійдіть в систему для додавання або редагування автомобілів.'); return; }
    
    // Dynamically create modal content
    elements.editAddModal.innerHTML = `
        <div class="modal-back"></div>
        <div class="modal">
          <div class="modal-header">
            <h2 id="formModalTitle" class="modal-title"></h2>
            <button id="closeEditAddModal" class="btn small secondary">X</button>
          </div>
          <form id="carForm" class="form-content">
            <input type="hidden" id="f_id" />
            <div class="form-group grid-2">
              <input id="f_make" type="text" placeholder="Марка" required />
              <input id="f_model" type="text" placeholder="Модель" required />
            </div>
            <div class="form-group grid-3">
              <input id="f_year" type="number" placeholder="Рік" required />
              <input id="f_engine" type="text" placeholder="Двигун" required />
              <input id="f_power_hp" type="number" placeholder="Потужність (к.с.)" required />
            </div>
            <div class="form-group grid-3">
              <input id="f_torque_nm" type="number" placeholder="Крутний момент (Нм)" />
              <input id="f_transmission" type="text" placeholder="Трансмісія" />
              <select id="f_fuel" required><option value="">Паливо...</option><option value="Бензин">Бензин</option><option value="Дизель">Дизель</option><option value="Гібрид">Гібрид</option><option value="Електрика">Електрика</option><option value="Газ">Газ</option></select>
            </div>
            <div class="form-group"><input id="f_image_url" type="url" placeholder="URL зображення" /></div>
            <div class="form-group grid-2"><input id="f_price_eur" type="number" placeholder="Ціна (€)" required /><input id="f_phone" type="text" placeholder="Телефон" /></div>
            <button id="submitCarBtn" class="btn primary full-width" type="submit">Зберегти</gbutton>
          </form>
        </div>`;

    const formTitle = document.getElementById('formModalTitle');

    if (carId) {
        const car = MOCK_CARS.find(c => c.id === carId);
        if (!car) return;
        formTitle.textContent = `Редагування: ${car.make} ${car.model}`;
        // Populate form
        document.getElementById('f_id').value = car.id;
        document.getElementById('f_make').value = car.make;
        document.getElementById('f_model').value = car.model;
        document.getElementById('f_year').value = car.year;
        document.getElementById('f_engine').value = car.engine;
        document.getElementById('f_power_hp').value = car.power_hp;
        document.getElementById('f_torque_nm').value = car.torque_nm || '';
        document.getElementById('f_transmission').value = car.transmission || '';
        document.getElementById('f_fuel').value = car.fuel;
        document.getElementById('f_image_url').value = car.image_url || '';
        document.getElementById('f_price_eur').value = car.price_eur;
        document.getElementById('f_phone').value = car.phone || '';
        closeViewModal();
    } else {
        formTitle.textContent = 'Додати новий автомобіль';
        const fMake = document.getElementById('f_make');
        if (fMake) { fMake.readOnly = !!state.selectedBrand; fMake.value = state.selectedBrand || ''; }
    }
    
    elements.editAddModal.style.display = 'flex';
    document.getElementById('closeEditAddModal').addEventListener('click', () => elements.editAddModal.style.display = 'none');
    elements.editAddModal.querySelector('.modal-back').addEventListener('click', () => elements.editAddModal.style.display = 'none');
    document.getElementById('carForm').addEventListener('submit', handleCarFormSubmit);
}

function handleCarFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('f_id').value;
    const carData = {
        make: document.getElementById('f_make').value, model: document.getElementById('f_model').value, year: parseInt(document.getElementById('f_year').value), engine: document.getElementById('f_engine').value, power_hp: parseInt(document.getElementById('f_power_hp').value), torque_nm: parseInt(document.getElementById('f_torque_nm').value), transmission: document.getElementById('f_transmission').value, fuel: document.getElementById('f_fuel').value, price_eur: parseInt(document.getElementById('f_price_eur').value), image_url: document.getElementById('f_image_url').value, phone: document.getElementById('f_phone').value,
    };
    if (id) {
        const carIndex = MOCK_CARS.findIndex(c => c.id === id);
        if (carIndex !== -1) { MOCK_CARS[carIndex] = { ...MOCK_CARS[carIndex], ...carData }; }
    } else {
        const newCar = { id: generateUniqueId(), body_type: 'Седан', drive: 'Передній', ...carData }; 
        MOCK_CARS.push(newCar);
        if (!state.selectedBrand || state.selectedBrand !== newCar.make) { state.selectedBrand = newCar.make; }
    }
    saveDataToLocalStorage();
    elements.editAddModal.style.display = 'none';
    renderData();
}

function deleteCar(id) {
    if (!state.isLoggedIn) { alert('Будь ласка, увійдіть в систему для видалення автомобілів.'); return; }
    const car = MOCK_CARS.find(c => c.id === id);
    if (car && confirm(`Ви впевнені, що хочете видалити ${car.make} ${car.model} (${car.year})?`)) {
        MOCK_CARS = MOCK_CARS.filter(c => c.id !== id);
        state.favorites = state.favorites.filter(favId => favId !== id);
        state.comparisonList = state.comparisonList.filter(compId => compId !== id);
        if (MOCK_CARS.filter(c => c.make === state.selectedBrand).length === 0) { state.selectedBrand = ''; }
        saveDataToLocalStorage();
        renderData();
    }
}

function exportData() {
    const json = JSON.stringify(MOCK_CARS, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'RightWheel_export.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ПОВНІСТЮ ЗАМІНІТЬ СТАРУ ФУНКЦІЮ НА ЦЮ
function init() {
    checkLoginStatus(); // Цей рядок ми додали раніше
    loadDataFromLocalStorage();
    saveDataToLocalStorage(); 
    
    // ОСНОВНА ЗМІНА ТУТ: ми перевіряємо тільки brandGridView
    if (!elements.brandGridView) { 
        console.error("Помилка: Не вдалося знайти основний елемент brandGridView на головній сторінці."); 
        return; 
    }

    initAdvancedSearch();
    renderData();

    elements.showRegisterBtn.addEventListener('click', showRegisterModal);
    elements.showLoginBtn.addEventListener('click', showLoginModal);
    elements.registerForm.addEventListener('submit', handleRegister);
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);

    elements.logoHomeLink.addEventListener('click', () => {
        state.selectedBrand = ''; state.currentPage = 1; state.advancedSearchFilters = {}; state.viewMode = 'all';
        renderData();
    });
    // Видаляємо слухач для backToBrandsBtn, бо його більше немає на цій сторінці
    // elements.backToBrandsBtn.addEventListener('click', handleBackToBrands); 
    
    // Видаляємо слухачі для фільтрів, бо їх теж більше немає
    // elements.searchInput.addEventListener('input', handleFilterChange);
    // elements.fuelSelect.addEventListener('change', handleFilterChange);
    // elements.sortSelect.addEventListener('change', handleSortSelectChange);

    elements.globalSearchInput.addEventListener('input', handleGlobalSearchInput);
    elements.globalSearchInput.addEventListener('focus', handleGlobalSearchInput);
    elements.globalSearchInput.addEventListener('blur', closeSearchDropdown);
    elements.searchDropdown.addEventListener('click', handleSearchDropdownClick);

    elements.advancedSearchBtn.addEventListener('click', openAdvancedSearchModal);
    document.getElementById('closeAdvancedSearchModal')?.addEventListener('click', closeAdvancedSearchModal);
    elements.advancedSearchModal?.addEventListener('click', (e) => { if (e.target.classList.contains('modal-root')) closeAdvancedSearchModal(); });
    document.getElementById('advancedSearchForm')?.addEventListener('submit', handleAdvancedSearch);
    document.getElementById('resetAdvancedSearch')?.addEventListener('click', resetAdvancedSearch);

    elements.openAddModalBtn.addEventListener('click', () => openEditAddModal(null));
    
    elements.exportBtn.addEventListener('click', exportData);
    
    elements.showFavoritesBtn.addEventListener('click', () => {
        state.viewMode = state.viewMode === 'favorites' ? 'all' : 'favorites';
        state.selectedBrand = '';
        state.currentPage = 1;
        renderData();
    });
}

document.addEventListener('DOMContentLoaded', init);