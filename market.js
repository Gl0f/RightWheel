document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        adsGrid: document.getElementById('adsGrid'),
        filterBrand: document.getElementById('filterBrand'),
        filterModel: document.getElementById('filterModel'), // Нове
        filterYearMin: document.getElementById('filterYearMin'), // Нове
        filterYearMax: document.getElementById('filterYearMax'), // Нове
        filterPriceMin: document.getElementById('filterPriceMin'),
        filterPriceMax: document.getElementById('filterPriceMax'),
        filterMileageMax: document.getElementById('filterMileageMax'), // Нове
        filterTransmission: document.getElementById('filterTransmission'), // Нове
        filterFuel: document.getElementById('filterFuel'), // Нове
        
        applyFiltersBtn: document.getElementById('applyFiltersBtn'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'), // Нове
        sortSelect: document.getElementById('sortSelect'),
        
        // Кнопка відкриття збережених
        showFavoritesBtn: document.getElementById('showMarketFavoritesBtn'),
        
        // Модалка збережених
        favoritesModal: document.getElementById('favoritesModal'),
        favAdsGridModal: document.getElementById('favAdsGridModal'),
        closeFavoritesModalBtn: document.getElementById('closeFavoritesModalBtn'),
        favoritesModalBack: document.querySelector('#favoritesModal .modal-back'),

        // Modal Sell
        openSellModalBtn: document.getElementById('openSellModalBtn'),
        sellModal: document.getElementById('sellModal'),
        closeSellModalBtn: document.getElementById('closeSellModalBtn'),
        sellForm: document.getElementById('sellCarForm'),
        sellBrand: document.getElementById('sellBrand'),
        sellPhotos: document.getElementById('sellPhotos'),
        photoPreview: document.getElementById('photoPreview'),
        modalBack: document.querySelector('#sellModal .modal-back')
    };

    let favoriteIds = [];

    // --- 1. Завантаження даних ---

    async function loadBrands() {
        // У market.js додайте слухач для форми продажу
        // market.js
        elements.sellBrand.addEventListener('change', async function() {
            const brandId = this.value;
            const modelSelect = document.getElementById('sellModel'); 
            
            // Очищуємо і блокуємо
            modelSelect.innerHTML = '<option value="">Завантаження...</option>';
            modelSelect.disabled = true;
            
            if(brandId) {
                try {
                    const res = await fetch(`http://127.0.0.1:5000/api/brands/${brandId}/models`);
                    const models = await res.json();
                    
                    modelSelect.innerHTML = '<option value="">Оберіть модель</option>';
                    models.forEach(m => {
                        modelSelect.add(new Option(m.name, m.id));
                    });
                    modelSelect.disabled = false; // Розблокуємо
                } catch(e) { console.error(e); }
            }
        });
        try {
            const res = await fetch('http://127.0.0.1:5000/api/brands');
            const brands = await res.json();
            brands.forEach(b => {
                elements.filterBrand.add(new Option(b.name, b.id));
                elements.sellBrand.add(new Option(b.name, b.id));
            });
        } catch (e) { console.error(e); }
    }

    async function loadFavoritesIds() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) return;
        try {
            const res = await fetch('http://127.0.0.1:5000/api/market/favorites/ids', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) favoriteIds = await res.json();
        } catch (e) { console.error(e); }
    }

    // Коли обрали марку -> вантажимо моделі
    // Коли обрали марку -> вантажимо моделі
// Коли обрали марку -> вантажимо моделі
    elements.filterBrand.addEventListener('change', async function() {
        const brandId = this.value;
        elements.filterModel.innerHTML = '<option value="">Всі моделі</option>';
        
        if (brandId) {
            elements.filterModel.disabled = true;
            elements.filterModel.innerHTML = '<option>Завантаження...</option>';
            
            try {
                const res = await fetch(`http://127.0.0.1:5000/api/brands/${brandId}/models`);
                if (!res.ok) throw new Error("Помилка");
                
                const models = await res.json();
                
                elements.filterModel.innerHTML = '<option value="">Всі моделі</option>';
                elements.filterModel.disabled = false;

                models.forEach(m => {
                    // ВИПРАВЛЕНО: Value тепер m.id (число), а не m.name
                    elements.filterModel.add(new Option(m.name, m.id)); 
                });
            } catch (e) { 
                elements.filterModel.innerHTML = '<option value="">Помилка</option>';
            }
        } else {
            elements.filterModel.disabled = true;
        }
    });

    // --- 2. Завантаження оголошень з новими фільтрами ---

    async function loadAds() {
        elements.adsGrid.innerHTML = '<p>Завантаження...</p>';
        
        const params = new URLSearchParams({
            brand_id: elements.filterBrand.value,
            model_id: elements.filterModel.value, // <-- ВИПРАВЛЕНО: Тепер передаємо ID
            year_min: elements.filterYearMin.value,
            year_max: elements.filterYearMax.value,
            price_min: elements.filterPriceMin.value,
            price_max: elements.filterPriceMax.value,
            mileage_max: elements.filterMileageMax.value,
            transmission: elements.filterTransmission.value,
            engine: elements.filterFuel.value,
            sort: elements.sortSelect.value
        });

        try {
            const res = await fetch(`http://127.0.0.1:5000/api/market/ads?${params}`);
            const ads = await res.json();
            renderAds(ads);
        } catch (e) {
            elements.adsGrid.innerHTML = '<p style="color:red">Помилка завантаження.</p>';
        }
    }

    function renderAds(ads) {
        if (!ads.length) {
            elements.adsGrid.innerHTML = '<div class="empty-state"><p>Оголошень не знайдено.</p></div>';
            return;
        }
        elements.adsGrid.innerHTML = '';

        ads.forEach(ad => {
            const card = document.createElement('div');
            card.className = 'ad-card';
            
            const imgUrl = ad.main_image || 'https://via.placeholder.com/300x200?text=No+Photo';
            const price = new Intl.NumberFormat('en-US').format(ad.price);
            const isFav = favoriteIds.includes(ad.id);
            const vinBadge = ad.vin_code ? 
                `<span style="font-size: 10px; background: #276749; color: #9AE6B4; padding: 2px 6px; border-radius: 4px; margin-right: 5px;">✓ VIN</span>` 
                : '';

            card.innerHTML = `
                <button class="ad-favorite-btn ${isFav ? 'active' : ''}" data-id="${ad.id}">
                    <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </button>
                <img src="${imgUrl}" class="ad-image" loading="lazy">
                <div class="ad-content">
                    <div class="ad-price">$ ${price}</div>
                    <div class="ad-title">${ad.brand_name} ${ad.model_name} ${ad.year}</div>
                    <div class="ad-meta">
                        ${vinBadge} <span>${ad.mileage} тис. км</span> • 
                        <span>${ad.transmission}</span>
                    </div>
                    <div class="ad-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${ad.location}
                    </div>
                </div>
            `;
            
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.ad-favorite-btn')) {
                    window.location.href = `market-detail.html?id=${ad.id}`;
                }
            });

            const favBtn = card.querySelector('.ad-favorite-btn');
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(ad.id, favBtn);
            });
            
            elements.adsGrid.appendChild(card);
        });
    }

    async function toggleFavorite(id, btn) {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) {
            if(typeof showLoginModal === 'function') showLoginModal();
            return;
        }
        
        btn.classList.toggle('active');
        try {
            const res = await fetch('http://127.0.0.1:5000/api/market/favorites', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ listing_id: id })
            });
            if (res.ok) {
                if (favoriteIds.includes(id)) favoriteIds = favoriteIds.filter(fid => fid !== id);
                else favoriteIds.push(id);
            }
        } catch (e) { btn.classList.toggle('active'); }
    }

    // --- 2. ЛОГІКА МОДАЛЬНОГО ВІКНА ЗБЕРЕЖЕНИХ ---

    async function openFavoritesModal() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) {
            if(typeof showLoginModal === 'function') showLoginModal();
            return;
        }

        elements.favoritesModal.style.display = 'flex';
        elements.favAdsGridModal.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Завантаження...</p>';

        try {
            const res = await fetch('http://127.0.0.1:5000/api/market/favorites/list', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const ads = await res.json();
            renderFavoritesInModal(ads);
        } catch (e) {
            elements.favAdsGridModal.innerHTML = '<p style="color:red">Помилка завантаження</p>';
        }
    }

    function renderFavoritesInModal(ads) {
        if (!ads.length) {
            elements.favAdsGridModal.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--muted);">Список порожній</p>';
            return;
        }

        elements.favAdsGridModal.innerHTML = '';

        ads.forEach(ad => {
            const card = document.createElement('div');
            card.className = 'ad-card';
            card.id = `modal-fav-${ad.id}`; // Для видалення
            
            const imgUrl = ad.main_image || 'https://via.placeholder.com/300x200?text=No+Photo';
            const price = new Intl.NumberFormat('en-US').format(ad.price);

            card.innerHTML = `
                <button class="delete-fav-btn" title="Видалити">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
                <img src="${imgUrl}" class="ad-image" loading="lazy">
                <div class="ad-content">
                    <div class="ad-price">$ ${price}</div>
                    <div class="ad-title">${ad.brand_name} ${ad.model_name} ${ad.year}</div>
                    <div class="ad-meta">
                        <span>${ad.mileage} тис. км</span> • <span>${ad.transmission}</span>
                    </div>
                </div>
            `;
            
            // Клік по картці
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-fav-btn')) {
                    window.location.href = `market-detail.html?id=${ad.id}`;
                }
            });

            // Клік по смітнику
            card.querySelector('.delete-fav-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromFavorites(ad.id);
            });

            elements.favAdsGridModal.appendChild(card);
        });
    }

    async function removeFromFavorites(id) {
        const token = localStorage.getItem('RightWheel_access_token');
        
        // Видаляємо з інтерфейсу модалки
        const cardModal = document.getElementById(`modal-fav-${id}`);
        if(cardModal) cardModal.remove();

        // Оновлюємо основний список (знімаємо червоне сердечко)
        favoriteIds = favoriteIds.filter(fid => fid !== id);
        loadAds(); // Перемальовуємо головний список

        try {
            await fetch('http://127.0.0.1:5000/api/market/favorites', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ listing_id: id })
            });
        } catch(e) { console.error(e); }
    }

    function closeFavoritesModal() { elements.favoritesModal.style.display = 'none'; }

    // Слухачі для модалки збережених
    if (elements.showFavoritesBtn) elements.showFavoritesBtn.addEventListener('click', openFavoritesModal);
    if (elements.closeFavoritesModalBtn) elements.closeFavoritesModalBtn.addEventListener('click', closeFavoritesModal);
    if (elements.favoritesModalBack) elements.favoritesModalBack.addEventListener('click', closeFavoritesModal);


    // --- 3. Логіка форми продажу (без змін) ---
    function openSellModal() {
        if (!localStorage.getItem('RightWheel_access_token')) {
            if(typeof showLoginModal === 'function') showLoginModal();
            return;
        }
        elements.sellModal.style.display = 'flex';
    }
    function closeSellModal() { elements.sellModal.style.display = 'none'; }
    
    elements.sellPhotos.addEventListener('change', function() {
        elements.photoPreview.innerHTML = '';
        Array.from(this.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img'); img.src = e.target.result; img.style.height = '60px'; img.style.borderRadius = '4px'; elements.photoPreview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });

    // Відправка форми (ОНОВЛЕНО)
    elements.sellForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(elements.sellForm);
        const token = localStorage.getItem('RightWheel_access_token');
        
        // --- ЗБИРАЄМО КОМПЛЕКТАЦІЮ В JSON ---
        const equipment = {
            security: [],
            comfort: [],
            media: []
        };

        // Проходимось по всіх чекнутих чекбоксах
        elements.sellForm.querySelectorAll('input[name="opt_security"]:checked').forEach(el => equipment.security.push(el.value));
        elements.sellForm.querySelectorAll('input[name="opt_comfort"]:checked').forEach(el => equipment.comfort.push(el.value));
        elements.sellForm.querySelectorAll('input[name="opt_media"]:checked').forEach(el => equipment.media.push(el.value));

        // Додаємо JSON стрічку в FormData
        formData.append('equipment', JSON.stringify(equipment));
        // -------------------------------------

        const btn = elements.sellForm.querySelector('button[type="submit"]');
        btn.textContent = 'Публікація...';
        btn.disabled = true;

        try {
            const res = await fetch('http://127.0.0.1:5000/api/market/ads', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            showInfoModal('Успіх', 'Оголошення додано!', 'success');
            closeSellModal();
            elements.sellForm.reset();
            elements.photoPreview.innerHTML = '';
            loadAds();

        } catch (error) {
            showInfoModal('Помилка', error.message, 'error');
        } finally {
            btn.textContent = 'Розмістити оголошення';
            btn.disabled = false;
        }
    });

    elements.openSellModalBtn.addEventListener('click', openSellModal);
    elements.closeSellModalBtn.addEventListener('click', closeSellModal);
    elements.modalBack.addEventListener('click', closeSellModal);
    elements.applyFiltersBtn.addEventListener('click', () => loadAds());
    elements.sortSelect.addEventListener('change', () => loadAds());

    // --- Кнопка "Скинути фільтри" ---
    if (elements.resetFiltersBtn) {
        elements.resetFiltersBtn.addEventListener('click', () => {
            // 1. Скидаємо селекти
            elements.filterBrand.value = "";
            
            // Спеціальна обробка для Моделі (блокуємо її)
            elements.filterModel.innerHTML = '<option value="">Всі моделі</option>';
            elements.filterModel.disabled = true; 

            elements.filterTransmission.value = "";
            elements.filterFuel.value = "";

            // 2. Скидаємо інпути (числа)
            elements.filterYearMin.value = "";
            elements.filterYearMax.value = "";
            elements.filterPriceMin.value = "";
            elements.filterPriceMax.value = "";
            elements.filterMileageMax.value = "";

            // 3. Перезавантажуємо оголошення без фільтрів
            loadAds();
        });
    }

    // Старт
    loadBrands();
    loadFavoritesIds().then(loadAds);
});