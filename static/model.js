document.addEventListener('DOMContentLoaded', () => {
    const modelTitleElement = document.getElementById('currentModelTitle');
    const yearListContainer = document.getElementById('yearListContainer');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    // Зберігаємо ID та імена з URL
    let state = {
        brandId: null,
        brandName: '',
        modelId: null,
        modelName: ''
        // generationId та generationName тут не потрібні, бо це сторінка моделі
    };
    
    function getModelPlaceholderImageUrl(text) {
        return `https://via.placeholder.com/300x180?text=${encodeURIComponent(text)}`;
    }

    /**
     * Витягує ID та імена марки/моделі з параметрів URL.
     */
    function getParamsFromUrl() {
        const params = new URLSearchParams(window.location.search);
        // Записуємо значення в об'єкт state
        state.brandId = params.get('brandId');
        state.brandName = decodeURIComponent(params.get('brandName') || '');
        state.modelId = params.get('modelId');
        state.modelName = decodeURIComponent(params.get('modelName') || '');
    }

    /**
     * Відображає навігацію "хлібні крихти".
     */
    function renderBreadcrumbs() {
        if (!breadcrumbsContainer) return;
        // Використовуємо значення зі state
        const brandLink = `brand.html?id=${state.brandId}&name=${encodeURIComponent(state.brandName)}`;
        breadcrumbsContainer.innerHTML = `
            <a href="main.html">Головна</a>
            <span>/</span>
            <a href="${brandLink}">${state.brandName || 'Марка'}</a>
            <span>/</span>
            <span class="current">${state.modelName || 'Модель'}</span>
        `;
    }

/**
 * Завантажує моделі поточної марки та відображає їх у випадаючому списку.
 */
    async function renderModelDropdown() {
        const selectElement = document.getElementById('modelQuickSelect');
        const labelElement = document.querySelector('.model-quick-nav-container label');

        if (!selectElement || !labelElement || !state.brandId) {
            console.error("Необхідні елементи для model dropdown або brandId не знайдено.");
            // Сховаємо контейнер, якщо щось не так
            const container = document.querySelector('.model-quick-nav-container');
            if (container) container.style.display = 'none';
            return;
        }

        // Оновлюємо текст label з назвою марки
        labelElement.textContent = `Інші моделі ${state.brandName}:`;

        try {
            const apiUrl = `/api/brands/${state.brandId}/models`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const models = await response.json(); // Отримуємо [{id: 101, name: 'Golf'}, ...]

            selectElement.innerHTML = ''; // Очищуємо "Завантаження..."

            if (!models || models.length === 0) {
                selectElement.innerHTML = '<option>Моделей не знайдено</option>';
                selectElement.disabled = true;
                return;
            }

            // Додаємо опції для кожної моделі
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id; // Значення - ID моделі
                option.textContent = model.name;
                // Позначаємо поточну модель як вибрану
                if (model.id.toString() === state.modelId) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });

            // Додаємо слухач події 'change' для переходу на іншу модель
            selectElement.addEventListener('change', (e) => {
                const selectedModelId = e.target.value;
                const selectedModel = models.find(m => m.id.toString() === selectedModelId);
                if (selectedModel) {
                    // Переходимо на сторінку обраної моделі (model.html)
                    window.location.href = `model.html?brandId=${state.brandId}&brandName=${encodeURIComponent(state.brandName)}&modelId=${selectedModelId}&modelName=${encodeURIComponent(selectedModel.name)}`;
                }
            });

        } catch (error) {
            console.error("Помилка завантаження моделей для dropdown:", error);
            selectElement.innerHTML = '<option>Помилка завантаження</option>';
            selectElement.disabled = true;
        }
    }

    /**
     * Завантажує покоління для поточної моделі з API та відображає їх.
     */


    async function loadAndRenderGenerations() {
        if (!state.modelId) {
            modelTitleElement.textContent = "Помилка: ID моделі не вказано в URL.";
            return;
        }
        
        modelTitleElement.textContent = `Завантаження поколінь для ${state.brandName} ${state.modelName}...`;
        document.title = `Покоління ${state.brandName} ${state.modelName} — RightWheel`;
        // Використовуємо yearListContainer, як і раніше
        yearListContainer.innerHTML = '<p>Завантаження...</p>';

        try {
            // Використовуємо існуючий API
            const apiUrl = `/api/models/${state.modelId}/generations`;
            const response = await fetch(apiUrl);

            if (!response.ok) { 
                let errorText = `HTTP error! status: ${response.status}`;
                try { const errorJson = await response.json(); errorText += `, Message: ${errorJson.error || response.statusText}`; }
                catch (e) { errorText += `, Message: ${response.statusText}`; }
                throw new Error(errorText);
            }
            const generations = await response.json(); // Отримуємо [{id: 1011, name: 'Mk8', year_start: 2019, year_end: null}, ...]

            yearListContainer.innerHTML = '';

            if (!generations || generations.length === 0) {
                yearListContainer.innerHTML = '<p>Для цієї моделі ще не додано жодного покоління.</p>';
                modelTitleElement.textContent = `Покоління для ${state.brandName} ${state.modelName}`;
                return;
            }

            modelTitleElement.textContent = `Покоління для ${state.brandName} ${state.modelName}`;

            // --- Генеруємо HTML за новим дизайном ---
            let html = '<div class="generations-grid">'; // Контейнер-сітка

            generations.forEach(gen => {
                // Посилання на сторінку КОМПЛЕКТАЦІЙ (generation.html)
                const generationLink = `generation.html?brandId=${state.brandId}&brandName=${encodeURIComponent(state.brandName)}&modelId=${state.modelId}&modelName=${encodeURIComponent(state.modelName)}&generationId=${gen.id}&generationName=${encodeURIComponent(gen.name || `${gen.year_start}-${gen.year_end || 'н.ч.'}`)}`;

                // Формуємо текст
                // Назва моделі + (Код покоління, якщо є)
                const title = `${state.modelName} ${gen.name ? `(${gen.name})` : ''}`;
                // Форматуємо роки: 05.2020 - 03.2023 (приклад, потребує даних з БД, яких зараз немає)
                // Поки що залишимо як є: 2019 - н.ч.
                const years = `${gen.year_start || '?'} - ${gen.year_end || 'н.ч.'}`;
                // Назва покоління (з API)
                const genDetails = gen.body_style || (gen.name || 'Покоління');
                // Тип кузова - поки що не маємо даних з цього API
                // const bodyType = gen.body_type || '';

                // Картинка-заглушка з назвою моделі та покоління
                // Використовуємо gen.image_url з API, а якщо його немає - стару заглушку
                const imageUrl = gen.image_url || getModelPlaceholderImageUrl(`${state.modelName} ${gen.name || ''}`);

                html += `
                    <a href="${generationLink}" class="generation-item">
                        <div class="generation-item-image">
                            <img src="${imageUrl}" alt="${title}">
                        </div>
                        <div class="generation-item-info">
                            <div class="gen-title">${title}</div>
                            <div class="gen-years">${years}</div>
                            <div class="gen-details">${genDetails}</div>

                        </div>
                    </a>`;
            });

            html += '</div>'; // Кінець generations-grid
            yearListContainer.innerHTML = html;

        } catch (error) {
            console.error("Помилка завантаження поколінь:", error);
            modelTitleElement.textContent = `Покоління для ${state.brandName} ${state.modelName}`;
            yearListContainer.innerHTML = `<p style="color: red;">Не вдалося завантажити покоління: ${error.message}.</p>`;
        }
    }

    /**
     * Ініціалізує сторінку.
     */
    function initModelPage() {
        getParamsFromUrl(); // Отримуємо всі ID та імена
        if (!state.brandName || !state.modelName) {
           modelTitleElement.textContent = "Помилка: Назва марки або моделі не вказана в URL.";
        }
        if (!state.brandId || !state.modelId) {
            modelTitleElement.textContent = "Помилка: ID марки або моделі не вказано в URL.";
        }
        renderBreadcrumbs(); // Відображаємо крихти
        renderModelDropdown();
        loadAndRenderGenerations(); // Завантажуємо та відображаємо покоління
        renderBrandQuickNav('brandQuickNavContainer');
        
    }

    initModelPage();
   
});