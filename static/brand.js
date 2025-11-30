document.addEventListener('DOMContentLoaded', () => {
    const brandTitleElement = document.getElementById('currentBrandTitle');
    const modelListContainer = document.getElementById('modelListContainer');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    let brandId = null; // Зберігаємо ID марки з URL
    let brandName = ''; // Зберігаємо ім'я марки з URL

    /**
     * Генерує URL зображення-заглушки для моделі.
     * @param {string} modelName - Назва моделі.
     * @returns {string} URL зображення.
     */
    function getModelPlaceholderImageUrl(modelName) {
        // Створюємо URL, наприклад: https://via.placeholder.com/200x120?text=Golf
        return `https://via.placeholder.com/200x120?text=${encodeURIComponent(modelName)}`;
    }

    

    /**
     * Витягує ID та ім'я марки з параметрів URL.
     */
    function getParamsFromUrl() {
        const params = new URLSearchParams(window.location.search);
        brandId = params.get('id'); // Отримуємо числовий ID
        brandName = decodeURIComponent(params.get('name') || ''); // Отримуємо ім'я
    }

    /**
     * Відображає навігацію "хлібні крихти".
     */
    function renderBreadcrumbs() {
        if (!breadcrumbsContainer) return;
        breadcrumbsContainer.innerHTML = `
            <a href="main.html">Головна</a>
            <span>/</span>
            <span class="current">${brandName || 'Марка'}</span>
        `;
    }

    /**
     * Завантажує моделі для поточної марки з API та відображає їх.
     */

    async function loadAndRenderModels() {
        if (!brandId) {
            brandTitleElement.textContent = "Помилка: ID марки не вказано в URL.";
            return;
        }

        brandTitleElement.textContent = `Завантаження моделей для ${brandName}...`;
        document.title = `Моделі ${brandName} — RightWheel`;
        modelListContainer.innerHTML = '<p>Завантаження...</p>';

        try {
            const apiUrl = `/api/brands/${brandId}/models`;
            const response = await fetch(apiUrl);

            if (!response.ok) { 
                let errorText = `HTTP error! status: ${response.status}`;
                try {
                    const errorJson = await response.json();
                    errorText += `, Message: ${errorJson.error || response.statusText}`;
                } catch (e) { errorText += `, Message: ${response.statusText}`; }
                throw new Error(errorText);
            }
            const models = await response.json(); // Очікуваний формат: [{id: 101, name: 'Golf'}, ...]

            modelListContainer.innerHTML = ''; // Очищаємо

            if (!models || models.length === 0) {
                modelListContainer.innerHTML = '<p>Для цієї марки ще не додано жодної моделі в базу даних.</p>';
                brandTitleElement.textContent = `Моделі марки ${brandName}`;
                return;
            }

            brandTitleElement.textContent = `Моделі марки ${brandName}`;

            // --- Групуємо моделі за першою літерою ---
            const groupedModels = models.reduce((acc, model) => {
                const firstLetter = model.name.charAt(0).toUpperCase();
                if (!acc[firstLetter]) {
                    acc[firstLetter] = [];
                }
                acc[firstLetter].push(model);
                return acc;
            }, {});

            // --- Генеруємо HTML ---
            const sortedLetters = Object.keys(groupedModels).sort(); // Сортуємо літери A, B, C...

            let html = '<div class="model-list-grouped">'; // Загальний контейнер

            // Створюємо навігацію по літерах (як C M R у вашому прикладі)
            html += '<div class="alphabet-nav">';
            sortedLetters.forEach(letter => {
                html += `<a href="#letter-${letter}">${letter}</a>`;
            });
            html += '</div>';


            sortedLetters.forEach(letter => {
                html += `<div class="letter-group" id="letter-${letter}">`; // Контейнер для групи літери
                html += `<h2 class="letter-heading">${letter}</h2>`; // Заголовок літери

                html += '<div class="models-grid">'; // Горизонтальна сітка для моделей цієї літери

                groupedModels[letter].forEach(model => {
                    // Створюємо посилання на model.html (як і раніше)
                    const modelLink = `model.html?brandId=${brandId}&brandName=${encodeURIComponent(brandName)}&modelId=${model.id}&modelName=${encodeURIComponent(model.name)}`;
                    // Використовуємо model.image_url з API, а якщо його немає - стару заглушку
                    const imageUrl = model.image_url || getModelPlaceholderImageUrl(model.name);

                    // Картка моделі
                    html += `
                        <a href="${modelLink}" class="model-item">
                            <div class="model-item-image">
                                <img src="${imageUrl}" alt="${model.name}">
                            </div>
                            <div class="model-item-name">${model.name}</div>
                            <div class="model-item-year">${model.year_start || '?'} ${model.year_start ? ' - ' : ''} ${model.year_end || (model.year_start ? 'н.ч.' : '')}</div>
                        </a>`;
                });

                html += '</div>'; // Кінець models-grid
                html += '</div>'; // Кінець letter-group
            });

            html += '</div>'; // Кінець model-list-grouped
            modelListContainer.innerHTML = html;

            // --- Обробник для плавної прокрутки ---
            const alphabetNav = modelListContainer.querySelector('.alphabet-nav');
            if (alphabetNav) {
                alphabetNav.addEventListener('click', (e) => {
                    // Спрацьовуємо, лише якщо клікнули на посилання (тег <a>)
                    if (e.target.tagName === 'A') {
                        e.preventDefault(); // Скасовуємо стандартний "стрибок"
                        
                        const targetId = e.target.getAttribute('href'); // Отримуємо ID (напр., "#letter-I")
                        const targetElement = document.querySelector(targetId); // Знаходимо елемент на сторінці
                        
                        if (targetElement) {
                            // Виконуємо плавну прокрутку до елемента
                            targetElement.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start' // Прокручуємо до верху елемента
                            });
                        }
                    }
                });
            }

        } catch (error) {
            console.error("Помилка завантаження моделей:", error);
            brandTitleElement.textContent = `Моделі марки ${brandName}`;
            modelListContainer.innerHTML = `<p style="color: red;">Не вдалося завантажити моделі: ${error.message}. Дивіться консоль.</p>`;
        }
    }

    

    /**
     * Ініціалізує сторінку.
     */
    function initBrandPage() {
        getParamsFromUrl(); // Спочатку отримуємо ID та ім'я марки
        if (!brandName && brandId) {
           brandTitleElement.textContent = "Помилка: Назва марки не вказана в URL.";
           // Можна спробувати завантажити назву по ID, якщо потрібно
        } else if (!brandId) {
             brandTitleElement.textContent = "Помилка: ID марки не вказано в URL.";
        }
        renderBrandQuickNav('brandQuickNavContainer');
        renderBreadcrumbs(); // Відображаємо крихти з ім'ям
        loadAndRenderModels(); // Завантажуємо та відображаємо моделі за ID
    }

    initBrandPage();
   
});