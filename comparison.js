document.addEventListener('DOMContentLoaded', () => {

    const elements = {
        container: document.getElementById('comparisonTableContainer'),
        title: document.getElementById('comparisonPageTitle'),
        clearBtn: document.getElementById('clearAllComparisonBtn')
    };

    let state = {
        comparisonList: []
    };

    /**
     * Завантажує список ID з localStorage
     */
    function loadComparisonList() {
        try {
            const savedComparison = localStorage.getItem('RightWheel_comparison');
            state.comparisonList = savedComparison ? JSON.parse(savedComparison) : [];
        } catch (e) { 
            console.error("Помилка завантаження списку порівняння:", e); 
            state.comparisonList = []; 
        }
        updateUIState();
    }

    function updateUIState() {
        if (state.comparisonList.length > 0) {
            if(elements.clearBtn) elements.clearBtn.style.display = 'inline-flex';
            elements.title.textContent = `Порівняння автомобілів (${state.comparisonList.length})`;
        } else {
            if(elements.clearBtn) elements.clearBtn.style.display = 'none';
            renderEmptyState();
        }
    }

    /**
     * Видаляє одне авто
     */
    function removeFromCompare(trimIdToRemove) {
        if (!trimIdToRemove) return;

        // Оновлюємо глобальний стан через app.js (якщо доступно)
        if (typeof updateComparisonList === 'function') {
            updateComparisonList(trimIdToRemove, false); 
        } else {
            // Фолбек, якщо app.js не провантажився
            state.comparisonList = state.comparisonList.filter(id => id.toString() !== trimIdToRemove.toString());
            localStorage.setItem('RightWheel_comparison', JSON.stringify(state.comparisonList));
        }
        
        // Оновлюємо локальний стан
        loadComparisonList();
        
        // Перебудовуємо таблицю або показуємо пустий стан
        if (state.comparisonList.length < 2) {
            renderEmptyState();
        } else {
            buildComparisonTable();
        }
    }

    /**
     * Очищає весь список
     */
    function clearAllComparison() {
        if (!confirm('Ви впевнені, що хочете очистити список порівняння?')) return;
        
        state.comparisonList = [];
        localStorage.removeItem('RightWheel_comparison');
        
        // Оновлюємо бар внизу (з app.js)
        if (typeof renderComparisonBar === 'function') renderComparisonBar();
        
        updateUIState();
    }

    if(elements.clearBtn) elements.clearBtn.addEventListener('click', clearAllComparison);

    function renderEmptyState() {
        elements.title.textContent = 'Порівняння автомобілів';
        elements.container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚖️</div>
                <h3>Недостатньо автомобілів для порівняння.</h3>
                <p style="margin-bottom: 20px;">Додайте принаймні два автомобілі до списку, щоб побачити детальне порівняння.</p>
                <a href="main.html" class="btn primary">Перейти до каталогу</a>
            </div>
        `;
    }

    /**
     * Головна функція: будує таблицю
     */
    async function buildComparisonTable() {
        if (state.comparisonList.length < 1) { // Показуємо навіть 1 авто, але краще 2
            renderEmptyState();
            return;
        }

        elements.container.innerHTML = '<div class="loader-spinner">Завантаження...</div>';

        try {
            const fetchPromises = state.comparisonList.map(trimId =>
                fetch(`http://127.0.0.1:5000/api/trims/${trimId}`)
                    .then(async response => { 
                        if (!response.ok) throw new Error(`Помилка ID ${trimId}`);
                        return response.json();
                    })
            );

            const carsToCompare = await Promise.all(fetchPromises);

            // Конфігурація полів для порівняння
            const specs = [
                { group: 'Основні', key: 'year', label: 'Рік випуску', compare: 'max' },
                { group: 'Основні', key: 'body_type', label: 'Тип кузова' },
                { group: 'Основні', key: 'price', label: 'Орієнтовна ціна', unit: '$', compare: 'min' }, // Якщо є в базі

                { group: 'Двигун', key: 'engine', label: 'Двигун' },
                { group: 'Двигун', key: 'fuel', label: 'Паливо' },
                { group: 'Двигун', key: 'power_hp', label: 'Потужність', unit: 'к.с.', compare: 'max' },
                { group: 'Двигун', key: 'torque_nm', label: 'Крутний момент', unit: 'Нм', compare: 'max' },
                { group: 'Двигун', key: 'engine_displacement_cm3', label: 'Об\'єм', unit: 'см³' },
                { group: 'Двигун', key: 'num_cylinders', label: 'Циліндри' },

                { group: 'Динаміка та Економічність', key: 'acceleration_0_100', label: 'Розгін 0-100', unit: 'сек', compare: 'min' },
                { group: 'Динаміка та Економічність', key: 'top_speed_kmh', label: 'Макс. швидкість', unit: 'км/год', compare: 'max' },
                { group: 'Динаміка та Економічність', key: 'fuel_consumption_mixed', label: 'Витрата (зміш.)', unit: 'л/100км', compare: 'min' },
                { group: 'Динаміка та Економічність', key: 'fuel_tank_l', label: 'Бак', unit: 'л', compare: 'max' },

                { group: 'Трансмісія', key: 'transmission', label: 'КПП' },
                { group: 'Трансмісія', key: 'drive', label: 'Привід' },

                { group: 'Габарити', key: 'length_mm', label: 'Довжина', unit: 'мм', compare: 'max' },
                { group: 'Габарити', key: 'width_mm', label: 'Ширина', unit: 'мм' },
                { group: 'Габарити', key: 'height_mm', label: 'Висота', unit: 'мм' },
                { group: 'Габарити', key: 'weight_kg', label: 'Вага', unit: 'кг', compare: 'min' },
                { group: 'Габарити', key: 'trunk_volume_l', label: 'Багажник', unit: 'л', compare: 'max' },
                { group: 'Габарити', key: 'wheelbase_mm', label: 'Колісна база', unit: 'мм' }
            ];

            // 1. Header Row (Sticky)
            let headerHtml = `
                <th>
                    <div class="empty-corner">
                        <button id="inlineClearBtn" class="table-clear-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            Очистити
                        </button>
                        <span>Характеристика</span>
                    </div>
                </th>`;
            carsToCompare.forEach(car => {
                const carName = `${car.make_name} ${car.model_name}`;
                const carTrim = car.name;
                const carImage = car.image_url || 'https://via.placeholder.com/200x130?text=No+Photo';
                
                // Генеруємо посилання на сторінку авто
                const carLinkParams = new URLSearchParams({
                    id: car.id, brandId: car.brand_id, brandName: car.make_name,
                    modelId: car.model_id, modelName: car.model_name,
                    generationId: car.generation_id, generationName: car.generation_name || ''
                });

                headerHtml += `
                    <th class="compare-col-header">
                        <div class="compare-car-card">
                            <button class="remove-btn" data-id="${car.id}" title="Прибрати">&times;</button>
                            
                            <a href="car.html?${carLinkParams.toString()}" class="car-link-wrapper">
                                <div class="img-wrapper">
                                    <img src="${carImage}" alt="${carName}">
                                </div>
                                <div class="car-title">${carName}</div>
                                <div class="car-trim">${carTrim}</div>
                                <div class="car-year">${car.year}</div>
                            </a>
                        </div>
                    </th>`;
            });

            // 2. Data Rows
            let bodyHtml = '';
            let currentGroup = '';

            specs.forEach(spec => {
                // Group Header
                if (spec.group && spec.group !== currentGroup) {
                    currentGroup = spec.group;
                    bodyHtml += `<tr class="group-header"><td colspan="${carsToCompare.length + 1}">${currentGroup}</td></tr>`;
                }

                let rowHtml = `<tr><td class="spec-label">${spec.label}</td>`;
                
                // Збираємо значення для порівняння
                let values = carsToCompare.map(car => {
                    let val = car[spec.key];
                    return (val !== null && val !== undefined && val !== '') ? parseFloat(val) : NaN;
                });

                // Визначаємо Min/Max для підсвітки
                let bestVal = null;
                let worstVal = null;
                
                // Фільтруємо NaN для пошуку мін/макс
                const validNumbers = values.filter(v => !isNaN(v));

                if (validNumbers.length > 1 && spec.compare) {
                    if (spec.compare === 'max') {
                        bestVal = Math.max(...validNumbers);
                    } else if (spec.compare === 'min') {
                        bestVal = Math.min(...validNumbers);
                        worstVal = Math.max(...validNumbers); // Для витрати/розгону "гірше" це більше
                    }
                }

                // Генеруємо клітинки
                carsToCompare.forEach((car, idx) => {
                    let rawVal = car[spec.key];
                    let displayVal = (rawVal !== null && rawVal !== undefined && rawVal !== '') ? rawVal : '—';
                    let numVal = values[idx];
                    let classes = '';

                    // Логіка класів
                    if (!isNaN(numVal) && bestVal !== null) {
                        if (numVal === bestVal) classes = 'highlight-best';
                        else if (worstVal !== null && numVal === worstVal && (spec.compare === 'min')) classes = 'highlight-worst';
                    }

                    // Додаємо одиниці виміру
                    if (spec.unit && displayVal !== '—') {
                        displayVal += ` <span class="unit">${spec.unit}</span>`;
                    }

                    rowHtml += `<td class="${classes}">${displayVal}</td>`;
                });

                bodyHtml += rowHtml + '</tr>';
            });
        
            // Вставка HTML в контейнер
            // 3. RENDER (Повертаємо контейнер для скролу)
                elements.container.innerHTML = `
                <div id="mainScrollContainer" class="table-scroll-container">
                    <table class="comparison-table">
                        <thead><tr>${headerHtml}</tr></thead>
                        <tbody>${bodyHtml}</tbody>
                    </table>
                </div>`;

            // Видаляємо весь блок коду "4. SYNC SCROLL", він більше не потрібен.
            // Залишаємо тільки слухачі подій:
            
            document.getElementById('inlineClearBtn')?.addEventListener('click', clearAllComparison);
            elements.container.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', (e) => removeFromCompare(e.target.dataset.id));
            });

        } catch (error) {
            console.error("Comparison Error:", error);
            elements.container.innerHTML = `<div class="error-state"><p>Не вдалося завантажити дані. Перевірте з'єднання.</p></div>`;
        }
    }
    
    init();
    function init() {
        loadComparisonList();
        buildComparisonTable();
    }
});