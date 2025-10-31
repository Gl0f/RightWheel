document.addEventListener('DOMContentLoaded', () => {
    // --- Елементи DOM ---
    const carDetailContainer = document.getElementById('carDetailContainer');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    let detailCompareBtn = null; // Ми знайдемо його пізніше

    // --- Стан сторінки ---
    let state = {
        brandId: null, brandName: '', modelId: null, modelName: '',
        generationId: null, generationName: '', trimId: null,
        comparisonList: [] // ДОДАЙТЕ ЦЕЙ РЯДОК
    };

    /**
     * Витягує всі ID та імена з параметрів URL.
     */
    function getParamsFromUrl() {
        const params = new URLSearchParams(window.location.search);
        state.brandId = params.get('brandId');
        state.brandName = decodeURIComponent(params.get('brandName') || '');
        state.modelId = params.get('modelId');
        state.modelName = decodeURIComponent(params.get('modelName') || '');
        state.generationId = params.get('generationId');
        state.generationName = decodeURIComponent(params.get('generationName') || '');
        state.trimId = params.get('id');
    }

    /**
     * Відображає навігацію "хлібні крихти".
     */
    function renderBreadcrumbs(trimName = 'Комплектація') {
        if (!breadcrumbsContainer) return;
        const brandLink = `brand.html?id=${state.brandId}&name=${encodeURIComponent(state.brandName)}`;
        const modelLink = `model.html?brandId=${state.brandId}&brandName=${encodeURIComponent(state.brandName)}&modelId=${state.modelId}&modelName=${encodeURIComponent(state.modelName)}`;
        const generationLink = `generation.html?brandId=${state.brandId}&brandName=${encodeURIComponent(state.brandName)}&modelId=${state.modelId}&modelName=${encodeURIComponent(state.modelName)}&generationId=${state.generationId}&generationName=${encodeURIComponent(state.generationName)}`;

        breadcrumbsContainer.innerHTML = `
            <a href="main.html">Головна</a>
            <span>/</span>
            <a href="${brandLink}">${state.brandName}</a>
            <span>/</span>
            <a href="${modelLink}">${state.modelName}</a>
            <span>/</span>
            <a href="${generationLink}">${state.generationName}</a>
            <span>/</span>
            <span class="current">${trimName}</span>
        `;
    }

    /**
     * Зберігає ID переглянутої комплектації в localStorage.
     */
    function saveToRecentlyViewed(trimId) {
        if (!trimId) return;
        const MAX_RECENTLY_VIEWED = 10;
        const storageKey = 'RightWheel_recently_viewed';
        try {
            let recentlyViewed = JSON.parse(localStorage.getItem(storageKey) || '[]');
            recentlyViewed = recentlyViewed.map(String);
            const trimIdStr = String(trimId);
            recentlyViewed = recentlyViewed.filter(id => id !== trimIdStr);
            recentlyViewed.unshift(trimIdStr);
            if (recentlyViewed.length > MAX_RECENTLY_VIEWED) {
                recentlyViewed = recentlyViewed.slice(0, MAX_RECENTLY_VIEWED);
            }
            localStorage.setItem(storageKey, JSON.stringify(recentlyViewed));
        } catch (e) {
            console.error("Помилка збереження нещодавно переглянутих:", e);
        }
    }

    /**
     * Допоміжна функція для створення рядка в таблиці характеристик.
     * @param {string} label - Назва характеристики.
     * @param {string|number} value - Значення.
     * @param {string} [unit=''] - Одиниця виміру (напр., 'мм', 'кг').
     * @returns {string} - HTML-рядок <tr>...</tr>.
     */
    function createSpecRow(label, value, unit = '') {
        if (value === null || value === undefined || value === '') {
            return ''; // Не рендеримо рядок, якщо даних немає
        }
        return `
            <tr class="spec-row">
                <td class="spec-label">${label}</td>
                <td class="spec-value">${value} ${unit}</td>
            </tr>
        `;
    }

    /**
     * Генерує HTML для галереї зображень.
     * @param {object} car - Об'єкт автомобіля з API.
     * @returns {string} - HTML-код для галереї.
     */
    function renderGallery(car) {
        const images = car.images || [];
        const fallbackImage = 'https://via.placeholder.com/800x500?text=No+Photo';
        const mainImage = images.length > 0 ? images[0] : (car.image_url || fallbackImage);

        let thumbnailsHTML = '';
        if (images.length > 1) {
            thumbnailsHTML = images.map((imgUrl, index) => `
                <div class="thumbnail-item ${index === 0 ? 'active' : ''}" data-image-url="${imgUrl}">
                    <img src="${imgUrl}" alt="${car.make_name} ${car.model_name} thumbnail ${index + 1}">
                </div>
            `).join('');
        }

        return `
            <div class="car-gallery-container">
                <div class="main-image-container">
                    <img id="mainCarImage" src="${mainImage}" alt="Головне фото ${car.make_name} ${car.model_name}">
                </div>
                ${images.length > 1 ? `<div class="thumbnail-grid">${thumbnailsHTML}</div>` : ''}
            </div>
        `;
    }

    /**
     * Генерує HTML для бічної панелі "Швидкі факти".
     * @param {object} car - Об'єкт автомобіля з API.
     * @returns {string} - HTML-код для бічної панелі.
     */
    function renderQuickSpecs(car) {
        // Збираємо факти, як на скріншоті
        const facts = [
            { label: 'Тип кузова', value: car.body_type },
            { label: 'Витрата палива', value: car.fuel_consumption_mixed, unit: 'л/100 км' },
            { label: 'ЕКО стандарт', value: car.emission_standard },
            { label: 'Потужність', value: car.power_hp, unit: 'к.с.' },
            { label: 'Об\'єм двигуна', value: car.engine_displacement_cm3, unit: 'см³' },
            { label: 'Розгін 0-100 км/ч', value: car.acceleration_0_100, unit: 'сек' },
            { label: 'Макс. швидкість', value: car.top_speed_kmh, unit: 'км/год' },
            { label: 'Привід', value: car.drive },
            { label: 'Довжина', value: car.length_mm, unit: 'мм' },
            { label: 'Вага', value: car.weight_kg, unit: 'кг' },
            { label: 'Об\'єм багажника', value: car.trunk_volume_l, unit: 'л' },
            { label: 'Коробка передач', value: car.transmission },
        ];

        let factsHTML = facts
            .map(fact => {
                if (fact.value) {
                    return `<div class="quick-spec-item">
                                <span class="quick-spec-label">${fact.label}</span>
                                <span class="quick-spec-value">${fact.value} ${fact.unit || ''}</span>
                            </div>`;
                }
                return '';
            })
            .join('');

        return `<div class="quick-specs-box">${factsHTML}</div>`;
    }

    /**
     * Генерує HTML для всіх таблиць з характеристиками.
     * @param {object} car - Об'єкт автомобіля з API.
     * @returns {string} - HTML-код таблиць.
     */
    function renderSpecifications(car) {
        return `
            <div class="car-specs-container">
                
                <h3 class="spec-section-title">Базова інформація</h3>
                <table class="specs-table">
                    <tbody>
                        ${createSpecRow('Марка', car.make_name)}
                        ${createSpecRow('Модель', car.model_name)}
                        ${createSpecRow('Покоління', car.generation_name)}
                        ${createSpecRow('Модифікація (двигун)', car.name)}
                        ${createSpecRow('Рік випуску', car.year)}
                        ${createSpecRow('Тип кузова', car.body_type)}
                        ${createSpecRow('Кількість місць', car.num_seats)}
                        ${createSpecRow('Кількість дверей', car.num_doors)}
                    </tbody>
                </table>

                <h3 class="spec-section-title">Експлуатаційні характеристики</h3>
                <table class="specs-table">
                    <tbody>
                        ${createSpecRow('Витрата палива (змішаний)', car.fuel_consumption_mixed, 'л/100 км')}
                        ${createSpecRow('Екологічний стандарт', car.emission_standard)}
                        ${createSpecRow('Викиди CO2', car.co2_emissions_g_km, 'г/км')}
                        ${createSpecRow('Паливо', car.fuel)}
                        ${createSpecRow('Розгін 0-100 км/ч', car.acceleration_0_100, 'сек')}
                        ${createSpecRow('Максимальна швидкість', car.top_speed_kmh, 'км/год')}
                    </tbody>
                </table>

                <h3 class="spec-section-title">Двигун</h3>
                <table class="specs-table">
                    <tbody>
                        ${createSpecRow('Потужність', car.power_hp, 'к.с.')}
                        ${createSpecRow('Крутний момент', car.torque_nm, 'Нм')}
                        ${createSpecRow('Модель/Код двигуна', car.engine_code)}
                        ${createSpecRow('Об\'єм двигуна', car.engine_displacement_cm3, 'см³')}
                        ${createSpecRow('Кількість циліндрів', car.num_cylinders)}
                        ${createSpecRow('Конфігурація двигуна', car.engine_config)}
                        ${createSpecRow('Діаметр циліндра', car.cylinder_bore_mm, 'мм')}
                        ${createSpecRow('Хід поршня', car.piston_stroke_mm, 'мм')}
                        ${createSpecRow('Ступінь стиснення', car.compression_ratio)}
                        ${createSpecRow('Кількість клапанів на циліндр', car.num_valves_per_cylinder)}
                        ${createSpecRow('Система вприску палива', car.fuel_system)}
                        ${createSpecRow('Тип наддуву', car.turbocharger)}
                        ${createSpecRow('Газорозподільний механізм', car.valve_actuation)}
                        ${createSpecRow('Системи двигуна', car.engine_systems)}
                    </tbody>
                </table>
                
                <h3 class="spec-section-title">Трансмісія та Привід</h3>
                <table class="specs-table">
                    <tbody>
                        ${createSpecRow('Привід', car.drive)}
                        ${createSpecRow('Коробка передач', car.transmission)}
                    </tbody>
                </table>

                <h3 class="spec-section-title">Розміри, Вага, Об\'єми</h3>
                <table class="specs-table">
                    <tbody>
                        ${createSpecRow('Довжина', car.length_mm, 'мм')}
                        ${createSpecRow('Ширина', car.width_mm, 'мм')}
                        ${createSpecRow('Висота', car.height_mm, 'мм')}
                        ${createSpecRow('Колісна база', car.wheelbase_mm, 'мм')}
                        ${createSpecRow('Споряджена вага', car.weight_kg, 'кг')}
                        ${createSpecRow('Об\'єм багажника', car.trunk_volume_l, 'л')}
                        ${createSpecRow('Об\'єм паливного баку', car.fuel_tank_l, 'л')}
                        ${createSpecRow('Діаметр розвороту', car.turning_circle_m, 'м')}
                    </tbody>
                </table>

                <h3 class="spec-section-title">Підвіска та Гальма</h3>
                <table class="specs-table">
                    <tbody>
                        ${createSpecRow('Передня підвіска', car.front_suspension)}
                        ${createSpecRow('Задня підвіска', car.rear_suspension)}
                        ${createSpecRow('Передні гальма', car.front_brakes)}
                        ${createSpecRow('Задні гальма', car.rear_brakes)}
                    </tbody>
                </table>

                <h3 class="spec-section-title">Шини та Диски</h3>
                <table class="specs-table">
                    <tbody>
                        ${createSpecRow('Розмір шин', car.tire_size)}
                        ${createSpecRow('Розмір дисків', car.wheel_size)}
                    </tbody>
                </table>

            </div>
        `;
    }

    /**
     * Додає слухачі подій для мініатюр галереї.
     */
    function attachGalleryListeners() {
        const mainImage = document.getElementById('mainCarImage');
        const thumbnails = document.querySelectorAll('.thumbnail-item');
        
        if (!mainImage || thumbnails.length === 0) {
            return;
        }

        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', () => {
                // Оновлюємо головне зображення
                mainImage.src = thumb.dataset.imageUrl;
                
                // Оновлюємо активний клас
                thumbnails.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
    }


    /**
     * Завантажує список порівняння з localStorage.
     */
    function loadComparisonList() {
        try {
            const savedComparison = localStorage.getItem('RightWheel_comparison');
            state.comparisonList = savedComparison ? JSON.parse(savedComparison) : [];
        } catch (e) { 
            console.error("Помилка завантаження списку порівняння:", e); 
            state.comparisonList = []; 
        }
    }


    function handleDetailCompareClick() {
        if (!state.trimId) return;

        const trimIdStr = state.trimId.toString();
        const isCompared = state.comparisonList.includes(trimIdStr);

        // Перевіряємо наявність глобальних функцій
        console.log('Тип updateComparisonList:', typeof updateComparisonList);
        console.log('Тип renderComparisonBar:', typeof renderComparisonBar);

        if (typeof updateComparisonList === 'function' && typeof renderComparisonBar === 'function') {

             if (!isCompared && state.comparisonList.length >= 4) {
                showInfoModal('Обмеження', 'Можна порівнювати не більше 4 автомобілів одночасно.', 'info');
                return;
            }

            if (isCompared) {
                state.comparisonList = state.comparisonList.filter(id => id !== trimIdStr);
            } else {
                state.comparisonList.push(trimIdStr);
            }

            updateDetailCompareButtonState();

            console.log(`Викликаю updateComparisonList('${trimIdStr}', ${!isCompared})`);
            updateComparisonList(trimIdStr, !isCompared);

            console.log('Викликаю renderComparisonBar()');
            renderComparisonBar();

        } else {
            console.error('Функції updateComparisonList або renderComparisonBar не знайдено!');
            console.log('Глобальні функції не знайдено! Перевірте порядок завантаження скриптів та їх вміст.');
            showInfoModal('Помилка', 'Не вдалося оновити список порівняння.', 'error');
        }
    }
    
    /**
     * Оновлює стан кнопки порівняння (текст та клас).
     */
    function updateDetailCompareButtonState() {
        if (!detailCompareBtn) return;
        
        const trimIdStr = state.trimId.toString();
        const isCompared = state.comparisonList.includes(trimIdStr);
        
        const textSpan = detailCompareBtn.querySelector('span');
        
        if (isCompared) {
            if (textSpan) textSpan.textContent = 'Видалити з порівняння';
            detailCompareBtn.classList.add('compared'); // Додаємо клас для стилізації (якщо є)
            detailCompareBtn.classList.remove('secondary');
            detailCompareBtn.classList.add('primary'); // Робимо червоною
        } else {
            if (textSpan) textSpan.textContent = 'Додати до порівняння';
            detailCompareBtn.classList.remove('compared');
            detailCompareBtn.classList.remove('primary');
            detailCompareBtn.classList.add('secondary');
        }
    }
    
    /**
     * Обробник кліку на кнопку "Додати до порівняння"
     */
    function handleDetailCompareClick() {
        if (!state.trimId) return;
        
        const trimIdStr = state.trimId.toString();
        const isCompared = state.comparisonList.includes(trimIdStr);
        
        // Викликаємо ГЛОБАЛЬНІ функції з app.js (вони мають бути доступні)
        
        if (typeof updateComparisonList === 'function' && typeof renderComparisonBar === 'function') {
            
            // Імітуємо логіку updateComparisonList, щоб перевірити ліміт
             if (!isCompared && state.comparisonList.length >= 4) {
                showInfoModal('Обмеження', 'Можна порівнювати не більше 4 автомобілів одночасно.', 'info');
                return;
            }
            
            // Оновлюємо локальний стан
            if (isCompared) {
                state.comparisonList = state.comparisonList.filter(id => id !== trimIdStr);
            } else {
                state.comparisonList.push(trimIdStr);
            }
            
            // Оновлюємо стан кнопки
            updateDetailCompareButtonState();
            
            // Викликаємо глобальні функції, щоб оновити localStorage та бар
            updateComparisonList(trimIdStr, !isCompared);
            renderComparisonBar(); // Перемальовуємо бар внизу
            
        } else {
            console.error('Функції updateComparisonList або renderComparisonBar не знайдено. Переконайтеся, що app.js завантажено.');
            showInfoModal('Помилка', 'Не вдалося оновити список порівняння.', 'error');
        }
    }


    /**
     * Завантажує детальну інформацію про комплектацію з API та відображає її
     */
    async function loadAndDisplayCarDetails() {
        if (!state.trimId) {
            carDetailContainer.innerHTML = '<h2>Помилка: ID комплектації не вказано в URL.</h2>';
            renderBreadcrumbs("Помилка");
            return;
        }

        saveToRecentlyViewed(state.trimId);
        carDetailContainer.innerHTML = '<p>Завантаження даних про автомобіль...</p>'; // TODO: Замінити на скелетон
        renderBreadcrumbs("Завантаження...");

        try {
            const apiUrl = `http://127.0.0.1:5000/api/trims/${state.trimId}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                let errorText = `HTTP error! status: ${response.status}`;
                try {
                    const errorJson = await response.json();
                    errorText += `, Message: ${errorJson.error || response.statusText}`;
                } catch (e) { errorText += `, Message: ${response.statusText}`; }
                throw new Error(errorText);
            }
            
            const car = await response.json(); // Отримуємо об'єкт з усіма даними

            if (!car) {
                throw new Error("Не вдалося отримати дані про автомобіль.");
            }

            // Оновлюємо заголовок сторінки та хлібні крихти
            const pageTitle = `${car.make_name} ${car.model_name} ${car.name}`;
            document.title = `${pageTitle} — RightWheel`;
            renderBreadcrumbs(car.name);

            // Генеруємо HTML для нового дизайну
            const galleryHTML = renderGallery(car);
            const quickSpecsHTML = renderQuickSpecs(car);
            const specificationsHTML = renderSpecifications(car);

            // Збираємо фінальний макет (Grid: main-content | sidebar)
            carDetailContainer.innerHTML = `
                <h2 class="car-detail-main-title">${pageTitle} (${car.year})</h2>
                
                <div class="car-detail-layout-grid">
                    <div class="car-main-content">
                        ${galleryHTML}
                        ${specificationsHTML}
                    </div>
                    
                    <div class="car-sidebar">
                        ${quickSpecsHTML}
                        
                        <div class="compare-button-container">
                            <button id="detailAddToCompareBtn" class="btn secondary full-width" data-id="${car.id}">
                                <span>Завантаження...</span>
                            </button>
                        </div>

                        <div id="similarCarsContainer" class="similar-cars-section">
                            Завантаження схожих авто...
                        </div>
                    </div>
                </div>
            `;

            // ---Ініціалізуємо кнопку порівняння ---
            detailCompareBtn = document.getElementById('detailAddToCompareBtn');
            if (detailCompareBtn) {
                // Встановлюємо початковий стан кнопки
                updateDetailCompareButtonState(); 
                detailCompareBtn.addEventListener('click', handleDetailCompareClick);
            }
          
            
            attachGalleryListeners();
            // Завантажуємо схожі авто (ця функція у вас вже була і має працювати)
            await loadAndRenderSimilarCars(state.trimId);

        } catch (error) {
            console.error("Помилка завантаження деталей автомобіля:", error);
            renderBreadcrumbs("Помилка");
            carDetailContainer.innerHTML = `<h2 style="color: red;">Не вдалося завантажити дані: ${error.message}. Дивіться консоль.</h2>`;
        }
    }

    /**
     * Завантажує та відображає схожі автомобілі.
     * (Ця функція, ймовірно, у вас вже є. Переконайтеся, що вона на місці).
     */
    async function loadAndRenderSimilarCars(currentTrimId) {
        const container = document.getElementById('similarCarsContainer');
        if (!container) return;

        try {
            const similarApiUrl = `http://127.0.0.1:5000/api/trims/${currentTrimId}/similar`;
            const response = await fetch(similarApiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const similarCars = await response.json();

            if (!similarCars || similarCars.length === 0) {
                container.innerHTML = '<h4>Схожих автомобілів не знайдено</h4>';
                return;
            }

            const cardsHTML = similarCars.map(sCar => {
                const params = new URLSearchParams({
                    id: sCar.id, brandId: sCar.brand_id, brandName: sCar.make_name,
                    modelId: sCar.model_id, modelName: sCar.model_name,
                    generationId: sCar.generation_id,
                    generationName: sCar.generation_name || `${sCar.year_start}-${sCar.year_end || 'н.ч.'}`
                });
                const carLink = `car.html?${params.toString()}`;

                return `
                <a href="${carLink}" class="similar-car-card">
                    <div class="similar-car-title">${sCar.make_name} ${sCar.model_name}</div>
                    <div class="similar-car-details">
                        <span>${sCar.year}</span>
                        <span>${sCar.name} (${sCar.engine || ''})</span>
                    </div>
                </a>`;
            }).join('');

            container.innerHTML = `<h4>Схожі автомобілі</h4><div class="similar-cars-grid">${cardsHTML}</div>`;

        } catch (error) {
            console.error("Помилка завантаження схожих авто:", error);
            container.innerHTML = '<h4 style="color: var(--muted);">Не вдалося завантажити схожі авто.</h4>';
        }
    }

    /**
     * Ініціалізує сторінку.
     */
    function initCarDetailPage() {
        getParamsFromUrl();
        loadComparisonList();
        loadAndDisplayCarDetails();
        renderBrandQuickNav('brandQuickNavContainer'); 
    }

    initCarDetailPage();
   
});