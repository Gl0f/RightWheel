document.addEventListener('DOMContentLoaded', () => {
    // --- Елементи DOM ---
    const elements = {
        titleElement: document.getElementById('favoritesTitle'),
        listElement: document.getElementById('carList'),
    };

    // --- Стан сторінки ---
    let state = {
        favorites: [], // Список ID обраних
        favoriteCarsData: [], // Масив з повними даними завантажених авто
        сomparisonList: [] // Список ID для порівняння
    };

    // --- Допоміжні функції ---
    function getFuelBadgeClass(fuel) { /* ... (скопіюйте з generation.js) ... */ }

    // --- Функції Обраного (з localStorage) ---

/**
 * Завантажує список обраних ID з API.
 */
    async function loadFavoritesFromAPI() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) {
            state.favorites = []; // Якщо не залогінений, обране порожнє
            // Якщо не залогінені, одразу показуємо порожній стан
            if (elements.listElement) {
                elements.listElement.innerHTML = '<div class="empty-state"><h3>Будь ласка, увійдіть, щоб побачити обране.</h3><p><a href="main.html" class="btn secondary">Повернутися на головну</a></p></div>';
            }
            return; // Зупиняємо виконання
        }

        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/favorites/ids', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                console.error("Не вдалося завантажити обране, можливо, сесія застаріла.");
                state.favorites = [];
            } else {
                const ids = await response.json(); // Отримуємо [101, 305, 40]
                state.favorites = ids.map(id => id.toString()); // Перетворюємо на рядки
            }
        } catch (e) {
            console.error("Помилка завантаження обраного:", e);
            state.favorites = [];
        }
    }

/**
 * Додає або видаляє ID комплектації через API.
 */
    async function toggleFavorite(trimId) {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) {
            showInfoModal('Сесія застаріла', 'Будь ласка, увійдіть знову, щоб керувати обраним.', 'error');
            return;
        }
        
        const trimIdStr = trimId.toString();
        const isFavorited = state.favorites.includes(trimIdStr);
        
        // На цій сторінці isFavorited має бути завжди true, але ми перевіримо
        if (!isFavorited) {
            console.warn("Спроба видалити те, чого немає в обраному");
            return;
        }

        const url = `http://127.0.0.1:5000/api/me/favorites/${trimId}`; // Тільки URL для DELETE
        const method = 'DELETE';
        
        const options = {
            method: method,
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        };
        
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Не вдалося оновити обране');
            }
            
            // Оновлюємо локальний стан
            const index = state.favorites.indexOf(trimIdStr);
            if (index > -1) state.favorites.splice(index, 1);
            
   
            // Також видаляємо з кешу завантажених даних
            state.favoriteCarsData = state.favoriteCarsData.filter(car => car.id.toString() !== trimIdStr);
            
            // Повторно рендеримо список, щоб видалений елемент зник
            renderFavoritesList();
        

        } catch (error) {
            console.error("Помилка toggleFavorite:", error);
            showInfoModal('Помилка', error.message, 'error');
        }
    }
    
    // Функція для видалення з обраного (прямо зі сторінки favorites.html)
    function removeFromFavorites(trimIdStr) {
        // Просто викликаємо нову асинхронну функцію
        // Вона сама оновить стан і перемалює список
        toggleFavorite(trimIdStr);
    }

    /**
     * Завантажує дані для всіх обраних авто з API.
     */
    async function loadFavoriteCarDetails() {
        if (!elements.listElement) return;
        elements.listElement.innerHTML = '<p>Завантаження даних обраних автомобілів...</p>';

        if (state.favorites.length === 0) {
            elements.listElement.innerHTML = '<div class="empty-state"><h3>Список обраного порожній.</h3><p>Додайте автомобілі до обраного на сторінках комплектацій.</p></div>';
            return;
        }

        try {
            // Створюємо масив промісів для запитів по кожному ID
            const fetchPromises = state.favorites.map(trimId =>
                fetch(`http://127.0.0.1:5000/api/trims/${trimId}`)
                    .then(response => {
                        if (!response.ok) {
                            console.error(`Не вдалося завантажити дані для ID ${trimId}. Статус: ${response.status}`);
                            return null; // Повертаємо null при помилці, щоб Promise.all не зупинився
                        }
                        return response.json();
                    })
                    .catch(error => {
                        console.error(`Помилка мережі при завантаженні ID ${trimId}:`, error);
                        return null; // Повертаємо null при мережевій помилці
                    })
            );

            // Чекаємо на завершення всіх запитів
            const results = await Promise.all(fetchPromises);

            // Фільтруємо null значення (які виникли через помилки)
            state.favoriteCarsData = results.filter(car => car !== null);

            renderFavoritesList(); // Відображаємо завантажені дані

        } catch (error) { // Цей catch спрацює, якщо сам Promise.all викине помилку
            console.error("Загальна помилка завантаження обраних авто:", error);
            elements.listElement.innerHTML = `<p style="color: red;">Не вдалося завантажити дані обраних автомобілів.</p>`;
        }
    }

    /**
     * Відображає список обраних автомобілів.
     */
    function renderFavoritesList() {
        if (!elements.listElement) return;
        elements.listElement.innerHTML = ''; // Очищуємо

        const carsToDisplay = state.favoriteCarsData; // Беремо завантажені дані

        if (carsToDisplay.length === 0) {
             // Якщо після завантаження даних все одно пусто (можливо, авто були видалені з бази)
             if(state.favorites.length > 0) {
                 elements.listElement.innerHTML = '<div class="empty-state"><h3>Не вдалося завантажити дані для обраних авто. Можливо, вони були видалені.</h3></div>';
             } else {
                 elements.listElement.innerHTML = '<div class="empty-state"><h3>Список обраного порожній.</h3><p>Додайте автомобілі до обраного на сторінках комплектацій.</p></div>';
             }
            return;
        }

         // Сортування (наприклад, за роком) - опціонально
         carsToDisplay.sort((a,b) => (b.year || 0) - (a.year || 0));

        carsToDisplay.forEach(car => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = car.id; // ID комплектації

            card.innerHTML = `
                <div></div>
                <div class="car-image-container"><img src="${car.image_url || 'https://via.placeholder.com/100x70?text=No+Photo'}" alt="${car.make_name || ''} ${car.model_name || ''}"></div>
                <div class="card-title">${car.make_name || '?'} ${car.model_name || '?'} <span>${car.name || '?'}</span></div>
                <div>${car.year || 'Н/Д'}</div>
                <div>${car.power_hp ? car.power_hp + ' к.с.' : 'Н/Д'}</div>
                <div><span class="fuel-badge ${getFuelBadgeClass(car.fuel)}">${car.fuel || 'Н/Д'}</span></div>
                <div>${car.transmission || 'Н/Д'}</div>
                <div class="card-actions" style="justify-content: flex-end;">
                    <button class="btn small compare-btn" data-id="${car.id}" title="Додати/видалити з порівняння" >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16 17L21 12L16 7M3 12H21M8 7L3 12L8 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="btn danger small remove-favorite-btn" data-id="${car.id}" title="Видалити з обраного">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            `;
            // Слухач для переходу на сторінку деталей
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.remove-favorite-btn')) {
                     // Формуємо параметри для car.html (треба отримати всі ID та імена з car об'єкта)
                    const params = new URLSearchParams({
                        id: car.id, brandId: car.brand_id, brandName: car.make_name,
                        modelId: car.model_id, modelName: car.model_name,
                        generationId: car.generation_id, generationName: car.generation_name || `${car.year_start}-${car.year_end || 'н.ч.'}`
                    });
                    window.location.href = `car.html?${params.toString()}`;
                }
            });
             // Слухач для кнопки видалення
            const removeBtn = card.querySelector('.remove-favorite-btn');
            if(removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Не переходити на сторінку деталей
                    removeFromFavorites(e.currentTarget.dataset.id);
                });
            }

            const compareBtn = card.querySelector('.compare-btn');
            if(compareBtn) {
                compareBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Не переходити на сторінку деталей
                    toggleCompare(e.currentTarget.dataset.id); // Викликаємо нову функцію
                });
            }

            elements.listElement.appendChild(card);
        });
    }

    function loadComparisonList() {
        try {
            const savedComparison = localStorage.getItem('RightWheel_comparison');
            state.comparisonList = savedComparison ? JSON.parse(savedComparison) : [];
        } catch (e) { console.error("Помилка завантаження списку порівняння:", e); state.comparisonList = []; }
    }

    function updateComparisonList(carId, isSelected) {
        const carIdStr = carId.toString();
        const index = state.comparisonList.indexOf(carIdStr);
        if (isSelected) {
            if (index === -1) {
                
                state.comparisonList.push(carIdStr);
            }
        } else { if (index > -1) state.comparisonList.splice(index, 1); }
        try { localStorage.setItem('RightWheel_comparison', JSON.stringify(state.comparisonList)); }
        catch(e) { console.error("Помилка збереження списку порівняння:", e); }
        renderComparisonBar();
    }

    function renderComparisonBar() {
        const comparisonBarElement = document.getElementById('comparisonBar'); // Використовуємо elements.comparisonBar? Ні, краще getElementById тут
        if (!comparisonBarElement) {
            console.error("Елемент comparisonBar не знайдено!");
            return; // Виходимо, якщо елемента немає
        }

        const count = state.comparisonList.length;
        if (count > 0) {
            comparisonBarElement.classList.add('visible');
            // Створюємо HTML для вмісту бару
            comparisonBarElement.innerHTML = `
                <div class="comparison-content">
                    <span>Обрано для порівняння: ${count} авто</span>
                    <div>
                        <button class="btn secondary small" id="clearComparisonBtn">Очистити</button>
                        <button class="btn primary" id="compareBtn" ${count < 2 ? 'disabled' : ''}>Порівняти</button>
                    </div>
                </div>`;

            // --- НАДІЙНЕ ДОДАВАННЯ СЛУХАЧІВ ---
            const compareBtn = document.getElementById('compareBtn');
            const clearBtn = document.getElementById('clearComparisonBtn');

            if (compareBtn) {
                
                compareBtn.replaceWith(compareBtn.cloneNode(true)); // Клонуємо, щоб видалити старі
                document.getElementById('compareBtn').addEventListener('click', () => { window.location.href = 'comparison.html'; });
            }
            if (clearBtn) {
           
                clearBtn.replaceWith(clearBtn.cloneNode(true));
                document.getElementById('clearComparisonBtn').addEventListener('click', clearComparison);
            }
       

        } else {
            comparisonBarElement.classList.remove('visible');
            comparisonBarElement.innerHTML = ''; // Очищаємо вміст
        }
    }

    function clearComparison() {
        state.comparisonList = [];
        try { localStorage.removeItem('RightWheel_comparison'); }
        catch(e) { console.error("Помилка очищення списку порівняння:", e); }
        renderComparisonBar();
        elements.listElement?.querySelectorAll('.compare-checkbox').forEach(checkbox => { checkbox.checked = false; });
    }


    async function openComparisonModal() {
        if (!elements.comparisonModal) {
            console.error("Елемент comparisonModal не знайдено!");
            return;
        }
        if (state.comparisonList.length < 2) {
            showInfoModal('Порівняння', 'Будь ласка, оберіть щонайменше два автомобілі для порівняння.', 'info');
            return;
        }

        elements.comparisonModal.innerHTML = `
            <div class="modal-back"></div>
            <div class="modal" style="max-width: 1200px;"> 
            <div class="modal-header">
                <h2 class="modal-title">Порівняння автомобілів</h2>
                <button id="closeCompareModalBtn" class="btn small secondary">Закрити</button>
            </div>
            <div class="modal-content" style="overflow-x: auto;">
                <p>Завантаження даних для порівняння...</p>
            </div>
            </div>`;
        elements.comparisonModal.style.display = 'flex';
        
        const closeBtn = document.getElementById('closeCompareModalBtn');
        const modalBack = elements.comparisonModal.querySelector('.modal-back');
        if (closeBtn) closeBtn.addEventListener('click', closeComparisonModal);
        if (modalBack) modalBack.addEventListener('click', closeComparisonModal);

    
        const modalContentElement = elements.comparisonModal.querySelector('.modal-content');
        if (modalContentElement) {
            modalContentElement.addEventListener('click', (e) => {
                const removeButton = e.target.closest('.remove-from-compare-btn');
                if (removeButton) {
                    const trimIdToRemove = removeButton.dataset.id;
                    if (trimIdToRemove) {
                        console.log('Видалення з модального вікна ID:', trimIdToRemove);
                        // 1. Викликаємо глобальну функцію для видалення
                        if (typeof updateComparisonList === 'function') {
                            updateComparisonList(trimIdToRemove, false); // false означає видалити
                        } else {
                            console.error('Функція updateComparisonList не знайдена!');
                            return; // Не продовжуємо, якщо функція недоступна
                        }

                        // 2. Закриваємо поточне модальне вікно
                        closeComparisonModal();

                        // 3. Якщо залишилося достатньо авто, відкриваємо його знову
                        // Перевіряємо оновлений state.comparisonList (який змінився в updateComparisonList)
                        if (state.comparisonList.length >= 2) {
                            console.log('Повторне відкриття модального вікна...');
                            // Невелика затримка, щоб DOM встиг оновитись після закриття
                            setTimeout(openComparisonModal, 100);
                        } else {
                            console.log('Недостатньо авто для порівняння після видалення.');
                            // Панель внизу вже оновилась через updateComparisonList -> renderComparisonBar
                        }
                    }
                }
            });
        }
    

        try {
            const fetchPromises = state.comparisonList.map(trimId =>
                fetch(`http://127.0.0.1:5000/api/trims/${trimId}`)
                    .then(async response => { 
                        if (!response.ok) {
                            let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                            try {
                                const errorJson = await response.json();
                                errorMsg = errorJson.error || errorMsg;
                            } catch (e) { /* Ігноруємо */ }
                            throw new Error(`Не вдалося завантажити ID ${trimId} (${errorMsg})`);
                        }
                        return response.json();
                    })
            );

            const carsToCompare = await Promise.all(fetchPromises);

            // ---Додаємо поле 'group' ---
            const specs = [
                { group: 'Загальне', key: 'make_name', label: 'Марка' },
                { group: 'Загальне', key: 'model_name', label: 'Модель' },
                { group: 'Загальне', key: 'name', label: 'Комплектація' },
                { group: 'Загальне', key: 'year', label: 'Рік', compare: 'max' },
                { group: 'Загальне', key: 'body_type', label: 'Тип кузова' },
                { group: 'Загальне', key: 'num_doors', label: 'К-сть дверей' },
                
                { group: 'Двигун та Паливо', key: 'power_hp', label: 'Потужність', compare: 'max' },
                { group: 'Двигун та Паливо', key: 'torque_nm', label: 'Крутний момент', compare: 'max' },
                { group: 'Двигун та Паливо', key: 'fuel', label: 'Паливо' },
                { group: 'Двигун та Паливо', key: 'fuel_consumption_mixed', label: 'Витрата (зміш.)', compare: 'min' },
                { group: 'Двигун та Паливо', key: 'fuel_tank_l', label: 'Об\'єм баку (л)', compare: 'max'},

                { group: 'Продуктивність', key: 'acceleration_0_100', label: 'Розгін 0-100', compare: 'min' },
                { group: 'Продуктивність', key: 'top_speed_kmh', label: 'Макс. швидкість', compare: 'max' },
                
                { group: 'Трансмісія', key: 'transmission', label: 'Трансмісія' },
                { group: 'Трансмісія', key: 'drive', label: 'Привід' },

                { group: 'Габарити та Вага', key: 'length_mm', label: 'Довжина (мм)'},
                { group: 'Габарити та Вага', key: 'width_mm', label: 'Ширина (мм)'},
                { group: 'Габарити та Вага', key: 'height_mm', label: 'Висота (мм)'},
                { group: 'Габарити та Вага', key: 'wheelbase_mm', label: 'Колісна база (мм)'},
                { group: 'Габарити та Вага', key: 'weight_kg', label: 'Вага (кг)', compare: 'min' },
                { group: 'Габарити та Вага', key: 'trunk_volume_l', label: 'Багажник (л)', compare: 'max' }
            ];

            // --- Генеруємо заголовок з фото ---
            let headerHtml = '<th>Характеристика</th>';
            carsToCompare.forEach(car => {
                const carName = `${car.make_name || '?'} ${car.model_name || '?'} (${car.year || '?'})`;
                const carImage = car.image_url || 'https://via.placeholder.com/150x100?text=No+Photo';
                headerHtml += `
                    <th class="compare-header-col">
                        <div class="compare-header-remove">
                            <button class="btn danger small remove-from-compare-btn" data-id="${car.id}" title="Видалити з порівняння">
                                &times;
                            </button>
                        </div>
                        <img src="${carImage}" alt="${carName}">
                        <div class="compare-header-title">${carName}</div>
                        <div class="compare-header-trim">${car.name || '?'}</div>
                    </th>`;
            });

            // --- Генеруємо тіло з групуванням ---
            let bodyHtml = '';
            let currentGroup = '';

            specs.forEach(spec => {
                // Додаємо заголовок групи, якщо він змінився
                if (spec.group && spec.group !== currentGroup) {
                    currentGroup = spec.group;
                    bodyHtml += `
                        <tr class="compare-group-header">
                            <td colspan="${carsToCompare.length + 1}">${currentGroup}</td>
                        </tr>
                    `;
                }

                let rowHtml = `<tr><td class="spec-label">${spec.label}</td>`;
                let values = []; 

                carsToCompare.forEach(car => {
                    const rawValue = car[spec.key];
                    values.push(rawValue); 
                });

                let bestRawValue = null;
                let worstRawValue = null;
                const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

                if (numericValues.length > 1 && spec.compare) {
                    if (spec.compare === 'max') {
                        bestRawValue = Math.max(...numericValues);
                    } else if (spec.compare === 'min') {
                        bestRawValue = Math.min(...numericValues);
                        worstRawValue = Math.max(...numericValues); 
                    }
                }

                carsToCompare.forEach(car => {
                    const rawValue = car[spec.key];
                    const numericVal = parseFloat(rawValue);
                    let className = '';

                    if (bestRawValue !== null && !isNaN(numericVal) && numericVal === bestRawValue) {
                        className = 'highlight-best';
                    } else if (worstRawValue !== null && !isNaN(numericVal) && numericVal === worstRawValue && (spec.key === 'fuel_consumption_mixed' || spec.key === 'acceleration_0_100' || spec.key === 'weight_kg')) {
                        className = 'highlight-worst';
                    }

                    let displayValue = (rawValue !== null && rawValue !== undefined) ? rawValue : 'Н/Д';
                    // ... (ваша логіка додавання 'к.с.', 'Нм' і т.д. залишається тут)
                    if (spec.key === 'power_hp' && rawValue) displayValue += ' к.с.';
                    if (spec.key === 'torque_nm' && rawValue) displayValue += ' Нм';
                    if (spec.key === 'acceleration_0_100' && rawValue) displayValue += ' сек.';
                    if (spec.key === 'top_speed_kmh' && rawValue) displayValue += ' км/год';
                    if (spec.key === 'fuel_consumption_mixed' && rawValue) displayValue += ' л/100км';
                    if (spec.key === 'trunk_volume_l' && rawValue) displayValue += ' л';
                    if (spec.key === 'weight_kg' && rawValue) displayValue += ' кг';
                    if (spec.key === 'fuel_tank_l' && rawValue) displayValue += ' л';
                    if ((spec.key === 'length_mm' || spec.key === 'width_mm' || spec.key === 'height_mm' || spec.key === 'wheelbase_mm') && rawValue) displayValue += ' мм';

                    rowHtml += `<td class="${className}">${displayValue}</td>`;
                });

                bodyHtml += rowHtml + '</tr>';
            });
     

            const modalContent = elements.comparisonModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.innerHTML = `
                    <div style="overflow-x: auto;">
                        <table class="comparison-table">
                            <thead><tr>${headerHtml}</tr></thead>
                            <tbody>${bodyHtml}</tbody>
                        </table>
                    </div>`;
            }

        } catch (error) {
            console.error("Помилка завантаження даних для порівняння:", error);
            const modalContent = elements.comparisonModal?.querySelector('.modal-content');
            if (modalContent) {
                modalContent.innerHTML = `<p style="color: red;">Не вдалося завантажити дані: ${error.message}</p>`;
            }
        }
    }

    function closeComparisonModal() {
        if (elements.comparisonModal) elements.comparisonModal.style.display = 'none';
    }

    // --- ФУНКЦІЯ для перемикання порівняння ---
    // --- ФУНКЦІЯ для перемикання порівняння ---
    function toggleCompare(trimId) {
        const trimIdStr = trimId.toString();
        // Перевіряємо, чи БУВ автомобіль у списку ДО кліку
        const wasCompared = state.comparisonList.includes(trimIdStr);

        // Перевірка ліміту (якщо ми намагаємося додати новий)
        if (!wasCompared && state.comparisonList.length >= 4) {
            showInfoModal('Обмеження', 'Можна порівнювати не більше 4 автомобілів одночасно.', 'info');
            return; // Не даємо додати
        }

        // Викликаємо глобальну функцію, яка оновить localStorage та нижній бар
        updateComparisonList(trimIdStr, !wasCompared);

        // Оновлюємо ЛОКАЛЬНИЙ стан (state) сторінки, щоб UI був синхронізований
        if (wasCompared) {
            state.comparisonList = state.comparisonList.filter(id => id !== trimIdStr);
        } else {
            state.comparisonList.push(trimIdStr);
        }

        // Оновлюємо вигляд кнопки
        updateCompareButtonState(trimIdStr);

        // === НОВИЙ КОД: ПОКАЗУЄМО СПОВІЩЕННЯ ===
        if (wasCompared) {
            // Якщо він БУВ у списку, значить ми його видалили
            showInfoModal('Порівняння', 'Автомобіль видалено зі списку порівняння.', 'info');
        } else {
            // Якщо його НЕ БУЛО, значить ми його додали
            showInfoModal('Порівняння', 'Автомобіль додано до списку порівняння!', 'success');
        }
    }

    // --- ФУНКЦІЯ для оновлення вигляду кнопки ---
    function updateCompareButtonState(trimIdStr) {
        const button = elements.trimListContainer?.querySelector(`.compare-btn[data-id="${trimIdStr}"]`);
        if (button) {
            const isCompared = state.comparisonList.includes(trimIdStr);
            button.classList.toggle('compared', isCompared); // Додаємо/видаляємо клас
            button.title = isCompared ? "Видалити з порівняння" : "Додати до порівняння";
        }
    }


    /**
     * Ініціалізує сторінку.
     */
    async function initFavoritesPage() {
         // Копіюємо реалізацію getFuelBadgeClass
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
        await loadFavoritesFromAPI(); // Завантажуємо ID
        loadFavoriteCarDetails(); // Завантажуємо дані з API
        loadComparisonList();
        renderComparisonBar();
    }

    initFavoritesPage();
  
});