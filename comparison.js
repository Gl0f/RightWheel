document.addEventListener('DOMContentLoaded', () => {

    const elements = {
        container: document.getElementById('comparisonTableContainer'),
        title: document.getElementById('comparisonPageTitle')
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
    }

    /**
     * Видаляє авто з порівняння (з localStorage) та оновлює сторінку
     */
    function removeFromCompare(trimIdToRemove) {
        if (!trimIdToRemove) return;

        // Викликаємо глобальну функцію з app.js (вона має бути доступна)
        if (typeof updateComparisonList === 'function') {
            // updateComparisonList (false) видалить елемент та оновить localStorage
            updateComparisonList(trimIdToRemove, false); 
            
            // Оновлюємо локальний стан
            state.comparisonList = state.comparisonList.filter(id => id.toString() !== trimIdToRemove.toString());
            
            // Оновлюємо заголовок
            elements.title.textContent = `Порівняння автомобілів (${state.comparisonList.length})`;

            // Перевіряємо, чи достатньо авто для порівняння
            if (state.comparisonList.length < 2) {
                // Якщо ні, показуємо порожній стан
                renderEmptyState();
            } else {
                // Якщо так, просто перебудовуємо таблицю
                buildComparisonTable();
            }
            
            // Оновлюємо нижній бар (з app.js)
            if (typeof renderComparisonBar === 'function') {
                renderComparisonBar();
            }
            
        } else {
            console.error('Глобальна функція updateComparisonList не знайдена!');
            showInfoModal('Помилка', 'Не вдалося оновити список порівняння.', 'error');
        }
    }

    /**
     * Показує повідомлення, якщо авто для порівняння недостатньо
     */
    function renderEmptyState() {
        elements.title.textContent = 'Порівняння автомобілів (0)';
        elements.container.innerHTML = `
            <div class="empty-state">
                <h3>Недостатньо автомобілів для порівняння.</h3>
                <p>Будь ласка, додайте принаймні два автомобілі до списку, щоб побачити їх тут.</p>
            </div>
        `;
    }

    /**
     * Головна функція: завантажує дані та будує таблицю
     */
    async function buildComparisonTable() {
        if (state.comparisonList.length < 2) {
            renderEmptyState();
            return;
        }

        elements.title.textContent = `Порівняння автомобілів (${state.comparisonList.length})`;
        elements.container.innerHTML = '<p>Завантаження даних для порівняння...</p>';

        try {
            // (Цей код скопійовано з вашої функції openComparisonModal)
            const fetchPromises = state.comparisonList.map(trimId =>
                fetch(`http://127.0.0.1:5000/api/trims/${trimId}`)
                    .then(async response => { 
                        if (!response.ok) {
                            let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                            try { const errorJson = await response.json(); errorMsg = errorJson.error || errorMsg; } catch (e) {}
                            throw new Error(`Не вдалося завантажити ID ${trimId} (${errorMsg})`);
                        }
                        return response.json();
                    })
            );

            const carsToCompare = await Promise.all(fetchPromises);

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

            let bodyHtml = '';
            let currentGroup = '';
            specs.forEach(spec => {
                if (spec.group && spec.group !== currentGroup) {
                    currentGroup = spec.group;
                    bodyHtml += `<tr class="compare-group-header"><td colspan="${carsToCompare.length + 1}">${currentGroup}</td></tr>`;
                }
                let rowHtml = `<tr><td class="spec-label">${spec.label}</td>`;
                let values = carsToCompare.map(car => car[spec.key]);
                let bestRawValue = null;
                let worstRawValue = null;
                const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

                if (numericValues.length > 1 && spec.compare) {
                    if (spec.compare === 'max') bestRawValue = Math.max(...numericValues);
                    else if (spec.compare === 'min') {
                        bestRawValue = Math.min(...numericValues);
                        worstRawValue = Math.max(...numericValues); 
                    }
                }

                carsToCompare.forEach(car => {
                    const rawValue = car[spec.key];
                    const numericVal = parseFloat(rawValue);
                    let className = '';
                    if (bestRawValue !== null && !isNaN(numericVal) && numericVal === bestRawValue) className = 'highlight-best';
                    else if (worstRawValue !== null && !isNaN(numericVal) && numericVal === worstRawValue && (spec.key === 'fuel_consumption_mixed' || spec.key === 'acceleration_0_100' || spec.key === 'weight_kg')) className = 'highlight-worst';
                    
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
                bodyHtml += rowHtml + '</tr>';
            });
        
            elements.container.innerHTML = `
                <div style="overflow-x: auto;">
                    <table class="comparison-table">
                        <thead><tr>${headerHtml}</tr></thead>
                        <tbody>${bodyHtml}</tbody>
                    </table>
                </div>`;
            
            // Додаємо слухачі на кнопки "Видалити"
            elements.container.querySelectorAll('.remove-from-compare-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const trimId = e.currentTarget.dataset.id;
                    removeFromCompare(trimId);
                });
            });

        } catch (error) {
            console.error("Помилка завантаження даних для порівняння:", error);
            elements.container.innerHTML = `<p style="color: red;">Не вдалося завантажити дані: ${error.message}</p>`;
        }
    }
    
    /**
     * Ініціалізація сторінки
     */
    function init() {
        loadComparisonList();
        buildComparisonTable();
    }

    init();
});