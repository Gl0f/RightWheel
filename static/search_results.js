
document.addEventListener('DOMContentLoaded', () => {
    // --- Елементи DOM ---
    const elements = {
        titleElement: document.getElementById('searchResultsTitle'),
        listElement: document.getElementById('carList'), // <-- Перевірте ID тут і в HTML
        paginationInfo: document.getElementById('paginationInfo'),
        paginationRow: document.getElementById('paginationRow'),
        comparisonBar: document.getElementById('comparisonBar'),
        comparisonModal: document.getElementById('comparisonModal')
    };

    // --- Стан сторінки ---
    let state = {
        carsPerPage: 15,
        currentPage: 1,
        comparisonList: [],
    };


    /**
     * Генерує та відображає скелетні завантажувачі.
     * @param {number} count - Кількість скелетонів для відображення.
     */
    function renderSkeletons(count) {
        if (!elements.listElement) return;
        
        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            skeletonHTML += '<div class="skeleton"></div>';
        }
        elements.listElement.innerHTML = skeletonHTML;
    }

    // --- Допоміжні функції ---
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

    // --- Функції для Порівняння ---
    function updateComparisonList(carId, isSelected) {
        const carIdStr = carId.toString();
        const index = state.comparisonList.indexOf(carIdStr);
        if (isSelected) {
            if (index === -1) {
                if (state.comparisonList.length >= 4) {
                    showInfoModal('Обмеження', 'Можна порівнювати не більше 4 автомобілів одночасно.', 'info');
                    const checkbox = document.querySelector(`.compare-checkbox[data-id="${carId}"]`);
                    if (checkbox) checkbox.checked = false;
                    return;
                }
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

           
            const compareBtn = document.getElementById('compareBtn');
            const clearBtn = document.getElementById('clearComparisonBtn');

            if (compareBtn) {
                // Видаляємо старий слухач (якщо він був) перед додаванням нового
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
        // 1. Очищуємо список у пам'яті
        state.comparisonList = [];
        
        // 2. Очищуємо localStorage
        try { 
            localStorage.removeItem('RightWheel_comparison'); 
        } catch(e) { 
            console.error("Помилка очищення списку порівняння:", e); 
        }
        
        // 3. Ховаємо нижню панель
        renderComparisonBar();
        
        // 4. === ВИПРАВЛЕННЯ: Скидаємо вигляд усіх кнопок на сторінці ===
        if (elements.listElement) {
            const allButtons = elements.listElement.querySelectorAll('.compare-btn');
            allButtons.forEach(btn => {
                btn.classList.remove('compared'); // Забираємо червоний колір
                btn.title = "Додати до порівняння"; // Повертаємо підказку
            });
        }
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

        // Показуємо завантажувач у модалці
        elements.comparisonModal.innerHTML = `
            <div class="modal-back"></div>
            <div class="modal" style="max-width: 1000px;">
            <div class="modal-header">
                <h2 class="modal-title">Порівняння автомобілів</h2>
                <button id="closeCompareModalBtn" class="btn small secondary">Закрити</button>
            </div>
            <div class="modal-content" style="overflow-x: auto;">
                <p>Завантаження даних для порівняння...</p>
            </div>
            </div>`;
        elements.comparisonModal.style.display = 'flex';
        // Додаємо слухачі для закриття
        const closeBtn = document.getElementById('closeCompareModalBtn');
        const modalBack = elements.comparisonModal.querySelector('.modal-back');
        if (closeBtn) closeBtn.addEventListener('click', closeComparisonModal);
        if (modalBack) modalBack.addEventListener('click', closeComparisonModal);


        try {
            // Створюємо масив промісів для завантаження даних по кожному ID
            const fetchPromises = state.comparisonList.map(trimId =>
                fetch(`/api/trims/${trimId}`)
                    .then(async response => { // Додаємо async тут
                        if (!response.ok) {
                            // Спробуємо прочитати помилку з тіла відповіді
                            let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                            try {
                                const errorJson = await response.json();
                                errorMsg = errorJson.error || errorMsg;
                            } catch (e) { /* Ігноруємо помилку парсингу JSON */}
                            throw new Error(`Не вдалося завантажити дані для ID ${trimId} (${errorMsg})`);
                        }
                        return response.json();
                    })
            );

            // Чекаємо на завершення всіх запитів
            const carsToCompare = await Promise.all(fetchPromises);

            // Визначаємо характеристики для порівняння
            // Переконайтеся, що ключі (key) відповідають назвам полів, які повертає ваш API /api/trims/{id}
            const specs = [
                { key: 'make_name', label: 'Марка' },
                { key: 'model_name', label: 'Модель' },
                { key: 'name', label: 'Комплектація' },
                { key: 'year', label: 'Рік', compare: 'max' },
                { key: 'power_hp', label: 'Потужність', compare: 'max' },
                { key: 'torque_nm', label: 'Крутний момент', compare: 'max' },
                { key: 'acceleration_0_100', label: 'Розгін 0-100', compare: 'min' },
                { key: 'top_speed_kmh', label: 'Макс. швидкість', compare: 'max' },
                { key: 'fuel_consumption_mixed', label: 'Витрата (зміш.)', compare: 'min' },
                { key: 'fuel', label: 'Паливо' },
                { key: 'transmission', label: 'Трансмісія' },
                { key: 'body_type', label: 'Тип кузова' },
                { key: 'drive', label: 'Привід' },
                { key: 'trunk_volume_l', label: 'Багажник (л)', compare: 'max' },
                { key: 'num_doors', label: 'К-сть дверей' },
                { key: 'weight_kg', label: 'Вага (кг)', compare: 'min' },
                { key: 'fuel_tank_l', label: 'Об\'єм баку (л)', compare: 'max'},
                { key: 'length_mm', label: 'Довжина (мм)'},
                { key: 'width_mm', label: 'Ширина (мм)'},
                { key: 'height_mm', label: 'Висота (мм)'},
                { key: 'wheelbase_mm', label: 'Колісна база (мм)'}
            ];

            // Генеруємо заголовок таблиці
            let headerHtml = '<th>Характеристика</th>';
            carsToCompare.forEach(car => {
                headerHtml += `<th>${car.make_name || '?'} ${car.model_name || '?'} ${car.name || '?'} (${car.year || '?'})</th>`;
            });

            // Генеруємо тіло таблиці
            let bodyHtml = specs.map(spec => {
                let rowHtml = `<tr><td class="spec-label">${spec.label}</td>`;
                let values = []; // Масив значень для визначення кращого/гіршого

                // Збираємо значення
                carsToCompare.forEach(car => {
                    const rawValue = car[spec.key];
                    values.push(rawValue); // Зберігаємо сирі значення для порівняння
                });

                // Визначаємо найкраще/найгірше значення
                let bestRawValue = null;
                let worstRawValue = null;
                const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

                if (numericValues.length > 1 && spec.compare) {
                    if (spec.compare === 'max') {
                        bestRawValue = Math.max(...numericValues);
                    } else if (spec.compare === 'min') {
                        bestRawValue = Math.min(...numericValues);
                        worstRawValue = Math.max(...numericValues); // Для витрати/розгону/ваги
                    }
                }

                // Формуємо рядки таблиці з виділенням та одиницями виміру
                carsToCompare.forEach(car => {
                    const rawValue = car[spec.key];
                    const numericVal = parseFloat(rawValue);
                    let className = '';

                    if (bestRawValue !== null && !isNaN(numericVal) && numericVal === bestRawValue) {
                        className = 'highlight-best';
                    } else if (worstRawValue !== null && !isNaN(numericVal) && numericVal === worstRawValue && (spec.key === 'fuel_consumption_mixed' || spec.key === 'acceleration_0_100' || spec.key === 'weight_kg')) {
                        className = 'highlight-worst';
                    }

                    // Форматуємо значення для відображення
                    let displayValue = (rawValue !== null && rawValue !== undefined) ? rawValue : 'Н/Д';
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

                return rowHtml + '</tr>';
            }).join('');

            // Оновлюємо вміст модального вікна
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
                fetch(`/api/trims/${trimId}`)
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

            // --- Додаємо поле 'group' ---
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

    // --- Основна логіка сторінки ---

    async function loadResults(page = 1) {
        if (!elements.titleElement || !elements.listElement || !elements.paginationInfo || !elements.paginationRow) {
            console.error("Помилка: Не знайдено необхідні елементи DOM.");
            return; 
        }

        elements.titleElement.textContent = 'Завантаження результатів пошуку...';
        renderSkeletons(state.carsPerPage);
        elements.paginationInfo.innerHTML = '';
        elements.paginationRow.innerHTML = '';

        const searchParams = new URLSearchParams(window.location.search);
        
        // --- Додаємо page до запиту ---
        searchParams.append('page', page);
        searchParams.append('limit', state.carsPerPage); // Використовуємо 15

        try {
            const apiUrl = `/api/search/advanced?${searchParams.toString()}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                let errorText = `HTTP error! status: ${response.status}`;
                try { const errorJson = await response.json(); errorText += `, Message: ${errorJson.error || response.statusText}`; }
                catch (e) { errorText += `, Message: ${response.statusText}`; }
                throw new Error(errorText);
            }
            
            // --- Отримуємо новий об'єкт ---
            const data = await response.json();
            
            state.currentPage = data.current_page; // Оновлюємо стан
            const results = data.items;
            
            // --- РЕНДЕРИНГ (логіка з renderResultsPage переїхала сюди) ---
            elements.listElement.innerHTML = '';

            if (!results || results.length === 0) {
                elements.listElement.innerHTML = '<div class="empty-state"><h3>За вашим запитом нічого не знайдено.</h3><p>Спробуйте змінити параметри пошуку.</p></div>';
                elements.titleElement.textContent = 'Результати пошуку (0)';
                renderPagination(0, 1); // Відображаємо порожню пагінацію
                return;
            }

            elements.titleElement.textContent = `Результати пошуку (${data.total_items})`;

            

            results.forEach(car => { // Використовуємо 'results' (тобто data.items) напряму
                const card = document.createElement('div');
                card.className = 'card';
                card.dataset.id = car.id;
                // ... (всі ваші dataset.brandId, dataset.brandName і т.д.)
                card.dataset.brandId = car.brand_id;
                card.dataset.brandName = car.make_name;
                card.dataset.modelId = car.model_id;
                card.dataset.modelName = car.model_name;
                card.dataset.generationId = car.generation_id;
                card.dataset.generationName = car.generation_name || `${car.year_start}-${car.year_end || 'н.ч.'}`;
                
                const isCompared = state.comparisonList.includes(car.id.toString());
                
                // (Ваш card.innerHTML - він правильний, не міняйте)
                card.innerHTML = `
                    <div>
                        <button class="btn small compare-btn ${isCompared ? 'compared' : ''}" data-id="${car.id}" title="${isCompared ? 'Видалити з порівняння' : 'Додати до порівняння'}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M16 17L21 12L16 7M3 12H21M8 7L3 12L8 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="car-image-container"><img src="${car.image_url || 'https://via.placeholder.com/100x70?text=No+Photo'}" alt="${car.make_name} ${car.model_name}"></div>
                    <div class="card-title">${car.make_name} ${car.model_name} <span>${car.name}</span></div>
                    <div>${car.year}</div>
                    <div>${car.power_hp ? car.power_hp + ' к.с.' : 'Н/Д'}</div>
                    <div><span class="fuel-badge ${getFuelBadgeClass(car.fuel)}">${car.fuel || 'Н/Д'}</span></div>
                    <div>${car.transmission || 'Н/Д'}</div>
                `;
                // (Ваш card.addEventListener - він правильний, не міняйте)
                card.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('compare-checkbox')) {
                        const params = new URLSearchParams({
                            id: card.dataset.id, brandId: card.dataset.brandId, brandName: card.dataset.brandName,
                            modelId: card.dataset.modelId, modelName: card.dataset.modelName,
                            generationId: card.dataset.generationId, generationName: card.dataset.generationName
                        });
                        window.location.href = `car.html?${params.toString()}`;
                    }
                });
                const compareBtn = card.querySelector('.compare-btn');
                if(compareBtn) {
                    compareBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); 
                        toggleCompare(e.currentTarget.dataset.id);
                    });
                }
                elements.listElement.appendChild(card);
            });

            
            renderPagination(data.total_items, data.total_pages); // Використовуємо дані з API

        } catch (error) {
            console.error("Помилка розширеного пошуку:", error);
            if (elements.titleElement) elements.titleElement.textContent = 'Помилка пошуку';
            if (elements.listElement) {
                elements.listElement.innerHTML = `<p style="color: red;">Не вдалося виконати пошук: ${error.message}.</p>`;
            }
            state.currentPage = 1;
            renderPagination(0, 1);
        }
    }


    function renderPagination(totalItems, totalPages) {
        if (!elements.paginationRow || !elements.paginationInfo) return;
        elements.paginationRow.innerHTML = '';
        
        if (totalPages <= 1) {
            elements.paginationInfo.innerHTML = `Знайдено ${totalItems} комплектацій`;
            return;
        }
        
        const prevDisabled = state.currentPage === 1 ? 'disabled' : '';
        const nextDisabled = state.currentPage === totalPages ? 'disabled' : '';
        elements.paginationInfo.innerHTML = `Сторінка ${state.currentPage} з ${totalPages} (${totalItems} комплектацій)`;
        
        elements.paginationRow.innerHTML = `
            <button class="btn secondary small" id="prevPageBtn" ${prevDisabled}>&lt; Попередня</button>
            <button class="btn secondary small" id="nextPageBtn" ${nextDisabled}>Наступна &gt;</button>
        `;
        
        // --- Кнопки викликають loadResults() ---
        const prevButton = document.getElementById('prevPageBtn');
        const nextButton = document.getElementById('nextPageBtn');
        
        if(prevButton) {
            prevButton.addEventListener('click', () => {
                if (state.currentPage > 1) { 
                    loadResults(state.currentPage - 1); 
                }
            });
        }
        if(nextButton) {
            nextButton.addEventListener('click', () => {
                if (state.currentPage < totalPages) { 
                    loadResults(state.currentPage + 1); 
                }
            });
        }
    }


    // --- ФУНКЦІЯ для перемикання порівняння ---
    function toggleCompare(trimId) {
        const trimIdStr = trimId.toString();
        
        // Перевіряємо актуальний стан у локальному списку
        const wasCompared = state.comparisonList.includes(trimIdStr);

        

        // Оновлюємо ЛОКАЛЬНИЙ стан (state) сторінки
        if (wasCompared) {
            state.comparisonList = state.comparisonList.filter(id => id !== trimIdStr);
        } else {
            state.comparisonList.push(trimIdStr);
        }

        // Викликаємо глобальну функцію для оновлення localStorage та нижньої панелі
        updateComparisonList(trimIdStr, !wasCompared);

        // Оновлюємо вигляд кнопки (червона/сіра)
        updateCompareButtonState(trimIdStr);

        // Показуємо сповіщення
        if (wasCompared) {
            showInfoModal('Порівняння', 'Автомобіль видалено зі списку порівняння.', 'info');
        } else {
            showInfoModal('Порівняння', 'Автомобіль додано до списку порівняння!', 'success');
        }
    }

    // ФУНКЦІЯ для оновлення вигляду кнопки 
    function updateCompareButtonState(trimIdStr) {
        // ВИПРАВЛЕННЯ: Використовуємо listElement (це і є наш #carList), а не trimListContainer
        const button = elements.listElement?.querySelector(`.compare-btn[data-id="${trimIdStr}"]`);
        
        if (button) {
            const isCompared = state.comparisonList.includes(trimIdStr);
            
            // Додаємо або забираємо клас 'compared' (який робить кнопку червоною)
            if (isCompared) {
                button.classList.add('compared');
            } else {
                button.classList.remove('compared');
            }
            
            button.title = isCompared ? "Видалити з порівняння" : "Додати до порівняння";
        }
    }

    function loadComparisonList() {
        try {
            const savedComparison = localStorage.getItem('RightWheel_comparison');
            state.comparisonList = savedComparison ? JSON.parse(savedComparison) : [];
        } catch (e) { console.error("Помилка завантаження списку порівняння:", e); state.comparisonList = []; }
    }

    function initSearchResultsPage() {
        // Перевіряємо наявність основних елементів ще раз перед початком роботи
        if (!elements.titleElement || !elements.listElement || !elements.paginationInfo || !elements.paginationRow) {
            console.error("Критична помилка: Не знайдено основні елементи DOM на сторінці search_results.html. Подальше виконання скрипта неможливе.");
            // Можна показати повідомлення користувачу
            document.body.innerHTML = '<h1 style="color: red; text-align: center; margin-top: 50px;">Помилка завантаження сторінки. Зверніться до адміністратора.</h1>';
            return;
        }
        loadComparisonList();
        loadResults(state.currentPage); // Запускаємо завантаження
        renderComparisonBar();
    }

    initSearchResultsPage();
   
});