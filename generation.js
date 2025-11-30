document.addEventListener('DOMContentLoaded', () => {
    // --- Елементи DOM ---
    const elements = {
        title: document.getElementById('generationMainTitle'),
        breadcrumbs: document.getElementById('breadcrumbs'),
        generationSelect: document.getElementById('generationQuickSelect'),
        
        galleryContainer: document.getElementById('generationGalleryContainer'),
        mainImage: document.getElementById('generationMainImage'),
        thumbnailGrid: document.getElementById('generationThumbnailGrid'),
        
        descriptionContainer: document.getElementById('generationDescriptionContainer'),
        
        videosSection: document.getElementById('generationVideosContainer'),
        videosGrid: document.getElementById('generationVideosGrid'),
        
        trimsListTitle: document.getElementById('trimsListTitle'),
        trimListContainer: document.getElementById('trimListContainer'),
        
        paginationInfo: document.getElementById('paginationInfo'),
        paginationRow: document.getElementById('paginationRow'),
        brandQuickNav: document.getElementById('brandQuickNavContainer'),
        comparisonModal: document.getElementById('comparisonModal')
    };

    // --- Стан сторінки ---
    let state = {
        brandId: null, brandName: '', modelId: null, modelName: '',
        generationId: null, generationName: '',
        currentPage: 1,
        favorites: [], // Список ID обраних
        comparisonList: [],
    };

    // --- 1. Ініціалізація та Завантаження ---

    async function initGenerationPage() {
        getParamsFromUrl();
        if (!state.generationId) {
            elements.title.textContent = "Помилка: ID покоління не вказано.";
            return;
        }
        
        // Запускаємо паралельно завантаження обраного та швидкої навігації
        loadFavoritesFromAPI(); 
        loadComparisonList();
        renderBrandQuickNav('brandQuickNavContainer');
        
        // Завантажуємо дані для випадаючого списку поколінь
        renderGenerationDropdown(); 

        elements.trimListContainer.addEventListener('click', handleTrimListClick);


        // Завантажуємо всі дані сторінки
        await loadGenerationDetails(state.currentPage);
        renderComparisonBar();
    }

    /**
     * Отримує параметри з URL та зберігає у 'state'.
     */
    function getParamsFromUrl() {
        const params = new URLSearchParams(window.location.search);
        state.brandId = params.get('brandId');
        state.brandName = decodeURIComponent(params.get('brandName') || '');
        state.modelId = params.get('modelId');
        state.modelName = decodeURIComponent(params.get('modelName') || '');
        state.generationId = params.get('generationId');
        // Отримуємо 'generationName' з URL, щоб уникнути "Завантаження..." у крихтах
        state.generationName = decodeURIComponent(params.get('generationName') || 'Покоління');
        
        // Встановлюємо початкові значення, поки дані вантажаться
        elements.title.textContent = `Завантаження... ${state.brandName} ${state.modelName} ${state.generationName}`;
        document.title = `Комплектації ${state.brandName} ${state.modelName} — RightWheel`;
        renderBreadcrumbs(state.generationName);
    }

    /**
     * Головна функція завантаження даних.
     * Викликає новий API-маршрут та розподіляє дані по рендер-функціях.
     */
    async function loadGenerationDetails(page = 1) {
        if (!state.generationId) return;
        
        // Показуємо скелетони для списку комплектацій
        renderTrimSkeletons(5); 
        
        try {
            const apiUrl = `http://127.0.0.1:5000/api/generations/${state.generationId}/details?page=${page}&limit=15`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                let errorText = `HTTP error! status: ${response.status}`;
                try {
                    const errorJson = await response.json();
                    errorText += `, Message: ${errorJson.error || response.statusText}`;
                } catch (e) { errorText += `, Message: ${response.statusText}`; }
                throw new Error(errorText);
            }
            
            const data = await response.json();
            
            // Оновлюємо 'state' реальними даними
            state.brandId = data.brand_id;
            state.brandName = data.make_name;
            state.modelId = data.model_id;
            state.modelName = data.model_name;
            state.generationName = data.generation_name;
            state.currentPage = data.trims_pagination.current_page;
            
            // --- Викликаємо функції рендерингу ---
            renderPageInfo(data);
            renderGallery(data.images);
            renderDescription(data.description);
            renderVideos(data.videos);
            renderTrimList(data.trims_pagination.items);
            renderPagination(data.trims_pagination.total_items, data.trims_pagination.total_pages);
            
        } catch (error) {
            console.error("Помилка завантаження деталей покоління:", error);
            elements.title.textContent = `Помилка завантаження даних`;
            elements.trimListContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    // --- 2. Функції Рендерингу ---

    /**
     * Оновлює заголовки, хлібні крихти та назву вкладки.
     */
    function renderPageInfo(data) {
        const titleText = `${data.make_name} ${data.model_name} ${data.generation_name}`;
        elements.title.textContent = titleText;
        document.title = `${titleText} — RightWheel`;
        // Оновлюємо хлібні крихти з точними даними
        renderBreadcrumbs(data.generation_name);
    }
    
    /**
     * Відображає "хлібні крихти".
     */
    function renderBreadcrumbs(genName) {
        if (!elements.breadcrumbs) return;
        const brandLink = `brand.html?id=${state.brandId}&name=${encodeURIComponent(state.brandName)}`;
        const modelLink = `model.html?brandId=${state.brandId}&brandName=${encodeURIComponent(state.brandName)}&modelId=${state.modelId}&modelName=${encodeURIComponent(state.modelName)}`;
        elements.breadcrumbs.innerHTML = `
            <a href="main.html">Головна</a> <span>/</span>
            <a href="${brandLink}">${state.brandName}</a> <span>/</span>
            <a href="${modelLink}">${state.modelName}</a> <span>/</span>
            <span class="current">${genName}</span>
        `;
    }

    /**
     * Відображає галерею фотографій покоління.
     */
    function renderGallery(images) {
        if (!images || images.length === 0) {
            elements.galleryContainer.style.display = 'none';
            return;
        }

        elements.galleryContainer.style.display = 'block';
        elements.mainImage.src = images[0]; // Встановлюємо перше фото як головне
        
        elements.thumbnailGrid.innerHTML = images.map((imgUrl, index) => `
            <div class="thumbnail-item ${index === 0 ? 'active' : ''}" data-image-url="${imgUrl}">
                <img src="${imgUrl}" alt="Мініатюра ${index + 1}">
            </div>
        `).join('');

        // Додаємо слухачі на мініатюри
        elements.thumbnailGrid.querySelectorAll('.thumbnail-item').forEach(thumb => {
            thumb.addEventListener('click', () => {
                elements.mainImage.src = thumb.dataset.imageUrl;
                // Оновлюємо активний клас
                elements.thumbnailGrid.querySelector('.thumbnail-item.active')?.classList.remove('active');
                thumb.classList.add('active');
            });
        });
    }

    /**
     * Відображає опис покоління.
     */
    function renderDescription(description) {
        if (!description) {
            elements.descriptionContainer.style.display = 'none';
            return;
        }
        elements.descriptionContainer.style.display = 'block';
        // (Тут можна додати логіку "Читати повністю", але поки що просто виводимо)
        elements.descriptionContainer.innerHTML = `<p>${description.replace(/\n/g, '<br>')}</p>`;
    }

    /**
     * Відображає секцію відеооглядів.
     */
    function renderVideos(videos) {
        if (!videos || videos.length === 0) {
            elements.videosSection.style.display = 'none';
            return;
        }
        
        elements.videosSection.style.display = 'block';
        elements.videosGrid.innerHTML = videos.map(video => `
            <a href="https://www.youtube.com/watch?v=${video.youtube_video_id}" target="_blank" class="video-card">
                <div class="video-thumbnail">
                    <img src="https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg" alt="${video.title}">
                    <div class="video-play-icon">
                        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z"></path></svg>
                    </div>
                </div>
                <span class="video-title">${video.title}</span>
            </a>
        `).join('');
    }

    /**
     * Відображає список комплектацій у новому дизайні.
     */
    function renderTrimList(trims) {
        if (!trims || trims.length === 0) {
            elements.trimListContainer.innerHTML = '<div class="empty-state"><p>Для цього покоління комплектацій не знайдено.</p></div>';
            elements.trimsListTitle.textContent = 'Комплектації (0)';
            return;
        }
        
        elements.trimsListTitle.textContent = `Комплектації`;
        
        elements.trimListContainer.innerHTML = trims.map(trim => {
            const isFavorited = state.favorites.includes(trim.id.toString());
            const isCompared = state.comparisonList.includes(trim.id.toString());
            
            // Формуємо посилання на деталі
            const params = new URLSearchParams({
                id: trim.id, brandId: state.brandId, brandName: state.brandName,
                modelId: state.modelId, modelName: state.modelName,
                generationId: state.generationId, generationName: state.generationName
            });
            const detailLink = `car.html?${params.toString()}`;

            return `
            <div class="trim-card" data-id="${trim.id}">
                <div class="trim-card-main">
                    <a href="${detailLink}" class="trim-card-title">
                        ${trim.name} (${trim.engine}, ${trim.power_hp} к.с., ${trim.fuel}, ${trim.transmission}, ${trim.drive})
                    </a>
                    <div class="trim-card-details">
                        <span>Рік: ${trim.year}</span>
                        <span>Кузов: ${trim.body_type || 'Н/Д'}</span>
                        <span>Двигун: ${trim.engine_code || 'Н/Д'}</span>
                    </div>
                </div>
                <div class="trim-card-actions">
                    <button class="btn small favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${trim.id}" title="${isFavorited ? 'Видалити з обраного' : 'Додати в обране'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="btn small compare-btn ${isCompared ? 'compared' : ''}" data-id="${trim.id}" title="${isCompared ? 'Видалити з порівняння' : 'Додати до порівняння'}"> 
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16 17L21 12L16 7M3 12H21M8 7L3 12L8 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            `;
        }).join('');
        

    }
    
    /**
     * Генерує скелетони для списку комплектацій.
     */
    function renderTrimSkeletons(count) {
        let skeletonHTML = '';
        for (let i = 0; i < count; i++) {
            skeletonHTML += '<div class="trim-card-skeleton"></div>';
        }
        elements.trimListContainer.innerHTML = skeletonHTML;
    }

    /**
     * Відображає пагінацію.
     */
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
            <button class="btn secondary small" id="prevPage" ${prevDisabled}>&lt; Попередня</button>
            <button class="btn secondary small" id="nextPage" ${nextDisabled}>Наступна &gt;</button>
        `;
        
        // Кнопки тепер викликають loadGenerationDetails
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (state.currentPage > 1) {
                loadGenerationDetails(state.currentPage - 1);
            }
        });
        document.getElementById('nextPage')?.addEventListener('click', () => {
            if (state.currentPage < totalPages) {
                loadGenerationDetails(state.currentPage + 1);
            }
        });
    }

    // --- 3. Допоміжні Функції (Обране, Навігація) ---

    /**
     * Обробляє всі кліки всередині списку комплектацій.
     */
    function handleTrimListClick(e) {
        // 1. Перевіряємо клік по кнопці "Обране"
        const favoriteButton = e.target.closest('.favorite-btn');
        if (favoriteButton) {
            e.stopPropagation(); // Зупиняємо, щоб не спрацював клік по картці
            const trimId = favoriteButton.dataset.id;
            if (trimId) {
                toggleFavorite(trimId);
            }
            return; // Зупиняємо виконання
        }

        // 2. Перевіряємо клік по кнопці "Порівняння"
        const compareButton = e.target.closest('.compare-btn');
        if (compareButton) {
            e.stopPropagation();
            const trimId = compareButton.dataset.id;
            if (trimId) {
                toggleCompare(trimId); // Викликаємо НОВУ функцію порівняння
            }
            return;
        }

        // 2. Перевіряємо клік по самій картці (або її вмісту)
        const card = e.target.closest('.trim-card');
        if (card) {
            // Знаходимо посилання на деталі всередині картки
            const detailLink = card.querySelector('.trim-card-title');
            if (detailLink && detailLink.href) {
                window.location.href = detailLink.href;
            } else {
                console.error('Не вдалося знайти посилання на деталі всередині картки');
            }
        }
    }


    /**
     * Завантажує ID обраних з API.
     */
    async function loadFavoritesFromAPI() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) {
            state.favorites = [];
            return;
        }
        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/favorites/ids', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const ids = await response.json();
                state.favorites = ids.map(id => id.toString());
            } else {
                state.favorites = [];
            }
        } catch (e) {
            console.error("Помилка завантаження обраного:", e);
            state.favorites = [];
        }
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
                console.log('Adding listener to compareBtn');
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

            // ---Генеруємо тіло з групуванням ---
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
     * Перемикає стан "Обране" для комплектації.
     */
    async function toggleFavorite(trimId) {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) {
            showInfoModal('Потрібен вхід', 'Будь ласка, увійдіть, щоб додавати авто в обране.', 'info');
            return;
        }
        
        const trimIdStr = trimId.toString();
        const isFavorited = state.favorites.includes(trimIdStr);
        const url = isFavorited 
            ? `http://127.0.0.1:5000/api/me/favorites/${trimId}`
            : 'http://127.0.0.1:5000/api/me/favorites';
        const method = isFavorited ? 'DELETE' : 'POST';
        
        const options = {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` }
        };
        
        if (method === 'POST') {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify({ trim_id: parseInt(trimId) });
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error('Не вдалося оновити обране');
            
            // === ОНОВЛЕНА ЛОГІКА СПОВІЩЕНЬ ===
            if (isFavorited) {
                // Якщо БУВ в обраному, значить ми видалили
                state.favorites = state.favorites.filter(id => id !== trimIdStr);
                showInfoModal('Обране', 'Автомобіль видалено з обраного.', 'info');
            } else {
                // Якщо НЕ БУВ, значить додали
                state.favorites.push(trimIdStr);
                showInfoModal('Обране', 'Автомобіль додано до обраного!', 'success');
            }
            updateFavoriteButtonState(trimIdStr);
            // === КІНЕЦЬ ОНОВЛЕННЯ ===

        } catch (error) {
            console.error("Помилка toggleFavorite:", error);
            showInfoModal('Помилка', error.message, 'error');
        }
    }

    /**
     * Оновлює вигляд кнопки "Обране" (клас 'favorited').
     */
    function updateFavoriteButtonState(trimIdStr) {
        const button = elements.trimListContainer?.querySelector(`.favorite-btn[data-id="${trimIdStr}"]`);
        if (button) {
            const isFavorited = state.favorites.includes(trimIdStr);
            button.classList.toggle('favorited', isFavorited);
            button.title = isFavorited ? "Видалити з обраного" : "Додати в обране";
        }
    }
    
    
    /**
     * Завантажує та відображає випадаючий список поколінь.
     */
    async function renderGenerationDropdown() {
        if (!elements.generationSelect || !state.modelId) return;

        try {
            const apiUrl = `http://127.0.0.1:5000/api/models/${state.modelId}/generations`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const generations = await response.json();

            elements.generationSelect.innerHTML = ''; // Очищуємо

            if (!generations || generations.length === 0) {
                elements.generationSelect.innerHTML = '<option>Поколінь не знайдено</option>';
                elements.generationSelect.disabled = true;
                return;
            }

            generations.forEach(gen => {
                const option = document.createElement('option');
                option.value = gen.id;
                option.textContent = `${gen.name || 'Покоління'} (${gen.year_start || '?'} - ${gen.year_end || 'н.ч.'})`;
                if (gen.id.toString() === state.generationId) {
                    option.selected = true;
                }
                elements.generationSelect.appendChild(option);
            });

            elements.generationSelect.addEventListener('change', (e) => {
                const selectedGen = generations.find(g => g.id.toString() === e.target.value);
                if (selectedGen) {
                    const genName = selectedGen.name || `${selectedGen.year_start}-${selectedGen.year_end || 'н.ч.'}`;
                    const params = new URLSearchParams({
                        brandId: state.brandId, brandName: state.brandName,
                        modelId: state.modelId, modelName: state.modelName,
                        generationId: selectedGen.id, generationName: genName
                    });
                    window.location.href = `generation.html?${params.toString()}`;
                }
            });

        } catch (error) {
            console.error("Помилка завантаження поколінь для dropdown:", error);
            elements.generationSelect.innerHTML = '<option>Помилка завантаження</option>';
            elements.generationSelect.disabled = true;
        }
    }

    // Запускаємо ініціалізацію
    initGenerationPage();
   
});