document.addEventListener('DOMContentLoaded', () => {
    // --- Елементи DOM ---
    const carDetailContainer = document.getElementById('carDetailContainer');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    let detailCompareBtn = null;

    // --- Стан сторінки ---
    let state = {
        brandId: null, brandName: '', modelId: null, modelName: '',
        generationId: null, generationName: '', trimId: null,
        comparisonList: [],
        is3DInitialized: false // Прапор для 3D
    };

    // --- Змінні для 3D (Three.js) ---
    let scene, camera, renderer, model, controls, animationId;

    /**
     * Витягує параметри з URL.
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
     * Хлібні крихти.
     */
    function renderBreadcrumbs(trimName = 'Комплектація') {
        if (!breadcrumbsContainer) return;
        const brandLink = `brand.html?id=${state.brandId}&name=${encodeURIComponent(state.brandName)}`;
        const modelLink = `model.html?brandId=${state.brandId}&brandName=${encodeURIComponent(state.brandName)}&modelId=${state.modelId}&modelName=${encodeURIComponent(state.modelName)}`;
        const generationLink = `generation.html?brandId=${state.brandId}&brandName=${encodeURIComponent(state.brandName)}&modelId=${state.modelId}&modelName=${encodeURIComponent(state.modelName)}&generationId=${state.generationId}&generationName=${encodeURIComponent(state.generationName)}`;

        breadcrumbsContainer.innerHTML = `
            <a href="main.html">Головна</a> <span>/</span>
            <a href="${brandLink}">${state.brandName}</a> <span>/</span>
            <a href="${modelLink}">${state.modelName}</a> <span>/</span>
            <a href="${generationLink}">${state.generationName}</a> <span>/</span>
            <span class="current">${trimName}</span>
        `;
    }

    /**
     * Зберігає ID в "Нещодавно переглянуті".
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
     * Рядок таблиці характеристик.
     */
    function createSpecRow(label, value, unit = '') {
        if (value === null || value === undefined || value === '') return '';
        return `<tr class="spec-row"><td class="spec-label">${label}</td><td class="spec-value">${value} ${unit}</td></tr>`;
    }

    /**
     * Генерує HTML галереї (З ПІДТРИМКОЮ 3D).
     */
    function renderGallery(car) {
        const images = car.images || [];
        const fallbackImage = 'https://via.placeholder.com/800x500?text=No+Photo';
        const mainImage = images.length > 0 ? images[0] : (car.image_url || fallbackImage);

        let thumbnailsHTML = '';
        if (images.length > 1) {
            thumbnailsHTML = images.map((imgUrl, index) => `
                <div class="thumbnail-item ${index === 0 ? 'active' : ''}" data-image-url="${imgUrl}">
                    <img src="${imgUrl}" alt="thumbnail ${index + 1}">
                </div>
            `).join('');
        }

        return `
            <div class="car-gallery-container">
                <div class="media-viewer-container">
                    <img id="mainCarImage" class="media-viewer-image" src="${mainImage}" alt="${car.make_name} ${car.model_name}">
                    
                    <div id="threejs-container" style="display: none;"></div>

                    <div class="media-controls">
                        <button id="btn-view-photo" class="media-btn active">Фото</button>
                        <button id="btn-view-3d" class="media-btn">3D Огляд</button>
                    </div>
                </div>
                ${images.length > 1 ? `<div class="thumbnail-grid">${thumbnailsHTML}</div>` : ''}
            </div>
        `;
    }

    /**
     * Логіка ініціалізації Three.js.
     */
    function init3DScene() {
        if (state.is3DInitialized) return; 

        const container = document.getElementById('threejs-container');
        if (!container) return;

        // 1. Сцена
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x2a2a2a);

        // 2. Камера
        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(4, 2, 4);

        // 3. Рендерер (Налаштування яскравості!)
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        // ВАЖЛИВО: Робимо кольори соковитими та яскравішими
        renderer.outputEncoding = THREE.sRGBEncoding; 
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.5; // <--- Збільште це число (до 2.0), якщо все ще темно
        
        container.appendChild(renderer.domElement);

        // 4. Світло
        // HemisphereLight дає м'яке заповнююче світло (зверху біле, знизу сіре)
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        hemiLight.position.set(0, 20, 0);
        scene.add(hemiLight);

        // Основне спрямоване світло (імітує сонце)
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); // Трохи збільшив інтенсивність до 1.2
        dirLight.position.set(10, 10, 10);
        scene.add(dirLight);

        // Додаткове підсвічування з іншого боку (щоб не було чорних тіней)
        const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backLight.position.set(-10, 5, -10);
        scene.add(backLight);

        // 5. Контролери
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.0;

        // 6. Завантаження моделі
        const loader = new THREE.GLTFLoader();
        const modelUrl = `static/models/${state.trimId}.glb`;

        console.log(`Завантаження 3D моделі: ${modelUrl}`);

        loader.load(modelUrl, 
            (gltf) => {
                model = gltf.scene;
                // Центрування
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.sub(center);
                // Масштабування
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 3 / maxDim; 
                model.scale.set(scale, scale, scale);

                scene.add(model);
            }, 
            undefined, 
            (error) => {
                console.error('Помилка 3D:', error);
                showInfoModal('3D не доступне', 'Для цього авто поки немає 3D моделі.', 'info');
                document.getElementById('btn-view-photo').click();
            }
        );

        function animate() {
            animationId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            if (!container || container.style.display === 'none') return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });

        state.is3DInitialized = true;
    }

    /**
     * Налаштування перемикачів Фото/3D.
     */
    function setupMediaToggles() {
        const btnPhoto = document.getElementById('btn-view-photo');
        const btn3D = document.getElementById('btn-view-3d');
        const imgContainer = document.getElementById('mainCarImage');
        const threeContainer = document.getElementById('threejs-container');
        const thumbnailGrid = document.querySelector('.thumbnail-grid');

        if (!btnPhoto || !btn3D) return;

        btnPhoto.addEventListener('click', () => {
            btnPhoto.classList.add('active');
            btn3D.classList.remove('active');
            imgContainer.style.display = 'block';
            threeContainer.style.display = 'none';
            if (thumbnailGrid) thumbnailGrid.style.opacity = '1';
        });

        btn3D.addEventListener('click', () => {
            btn3D.classList.add('active');
            btnPhoto.classList.remove('active');
            imgContainer.style.display = 'none';
            threeContainer.style.display = 'block';
            if (thumbnailGrid) thumbnailGrid.style.opacity = '0.3';
            
            if (!state.is3DInitialized) init3DScene();
        });
    }

    function renderQuickSpecs(car) {
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
        let factsHTML = facts.map(fact => fact.value ? `<div class="quick-spec-item"><span class="quick-spec-label">${fact.label}</span><span class="quick-spec-value">${fact.value} ${fact.unit || ''}</span></div>` : '').join('');
        return `<div class="quick-specs-box">${factsHTML}</div>`;
    }

    /**
     * ПОВНА ВЕРСІЯ renderSpecifications (повернуто всі поля).
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

    function attachGalleryListeners() {
        const mainImage = document.getElementById('mainCarImage');
        const thumbnails = document.querySelectorAll('.thumbnail-item');
        if (!mainImage || thumbnails.length === 0) return;

        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', () => {
                const btnPhoto = document.getElementById('btn-view-photo');
                if (btnPhoto && !btnPhoto.classList.contains('active')) btnPhoto.click();
                
                mainImage.src = thumb.dataset.imageUrl;
                thumbnails.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
    }

    function loadComparisonList() {
        try {
            const savedComparison = localStorage.getItem('RightWheel_comparison');
            state.comparisonList = savedComparison ? JSON.parse(savedComparison) : [];
        } catch (e) { state.comparisonList = []; }
    }

    function handleDetailCompareClick() {
        if (!state.trimId) return;
        const trimIdStr = state.trimId.toString();
        const wasCompared = state.comparisonList.includes(trimIdStr);
        
        if (typeof updateComparisonList === 'function' && typeof renderComparisonBar === 'function') {
             if (!wasCompared && state.comparisonList.length >= 4) {
                showInfoModal('Обмеження', 'Можна порівнювати не більше 4 автомобілів.', 'info');
                return;
            }
            if (wasCompared) state.comparisonList = state.comparisonList.filter(id => id !== trimIdStr);
            else state.comparisonList.push(trimIdStr);
            
            updateDetailCompareButtonState();
            updateComparisonList(trimIdStr, !wasCompared);
            renderComparisonBar(); 
            showInfoModal('Порівняння', wasCompared ? 'Видалено зі списку.' : 'Додано до списку!', wasCompared ? 'info' : 'success');
        } else {
            console.error('Функції порівняння не знайдено (перевірте app.js)');
        }
    }
    
    function updateDetailCompareButtonState() {
        if (!detailCompareBtn) return;
        const trimIdStr = state.trimId.toString();
        const isCompared = state.comparisonList.includes(trimIdStr);
        const textSpan = detailCompareBtn.querySelector('span');
        
        if (isCompared) {
            if (textSpan) textSpan.textContent = 'Видалити з порівняння';
            detailCompareBtn.classList.add('primary');
            detailCompareBtn.classList.remove('secondary');
        } else {
            if (textSpan) textSpan.textContent = 'Додати до порівняння';
            detailCompareBtn.classList.add('secondary');
            detailCompareBtn.classList.remove('primary');
        }
    }

    async function loadAndDisplayCarDetails() {
        if (!state.trimId) {
            carDetailContainer.innerHTML = '<h2>Помилка: ID не вказано.</h2>';
            return;
        }
        
        // ЗБЕРІГАЄМО ІСТОРІЮ ПЕРЕГЛЯДУ
        saveToRecentlyViewed(state.trimId);
        
        carDetailContainer.innerHTML = '<p>Завантаження...</p>';
        renderBreadcrumbs("Завантаження...");

        try {
            const apiUrl = `http://127.0.0.1:5000/api/trims/${state.trimId}`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Помилка API');
            
            const car = await response.json();
            const pageTitle = `${car.make_name} ${car.model_name} ${car.name}`;
            document.title = `${pageTitle} — RightWheel`;
            renderBreadcrumbs(car.name);

            carDetailContainer.innerHTML = `
                <h2 class="car-detail-main-title">${pageTitle} (${car.year})</h2>
                <div class="car-detail-layout-grid">
                    <div class="car-main-content">
                        ${renderGallery(car)}
                        ${renderSpecifications(car)}
                    </div>
                    <div class="car-sidebar">
                        ${renderQuickSpecs(car)}
                        <div class="compare-button-container">
                            <button id="detailAddToCompareBtn" class="btn secondary full-width"><span>Завантаження...</span></button>
                        </div>
                        <div id="similarCarsContainer" class="similar-cars-section">Завантаження схожих авто...</div>
                    </div>
                </div>
            `;

            detailCompareBtn = document.getElementById('detailAddToCompareBtn');
            if (detailCompareBtn) {
                updateDetailCompareButtonState(); 
                detailCompareBtn.addEventListener('click', handleDetailCompareClick);
            }
          
            setupMediaToggles(); // Налаштовуємо кнопки 3D
            attachGalleryListeners();
            await loadAndRenderSimilarCars(state.trimId);

        } catch (error) {
            console.error("Error:", error);
            carDetailContainer.innerHTML = `<h2>Помилка завантаження даних.</h2>`;
        }
    }

    async function loadAndRenderSimilarCars(currentTrimId) {
        const container = document.getElementById('similarCarsContainer');
        if (!container) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/trims/${currentTrimId}/similar`);
            const similarCars = await response.json();
            if (!similarCars || similarCars.length === 0) {
                container.innerHTML = '<h4>Схожих авто не знайдено</h4>';
                return;
            }
            const cardsHTML = similarCars.map(sCar => {
                const params = new URLSearchParams({
                    id: sCar.id, brandId: sCar.brand_id, brandName: sCar.make_name,
                    modelId: sCar.model_id, modelName: sCar.model_name,
                    generationId: sCar.generation_id,
                    generationName: sCar.generation_name || `${sCar.year_start}-${sCar.year_end || 'н.ч.'}`
                });
                return `<a href="car.html?${params.toString()}" class="similar-car-card"><div class="similar-car-title">${sCar.make_name} ${sCar.model_name}</div><div class="similar-car-details"><span>${sCar.year}</span><span>${sCar.name}</span></div></a>`;
            }).join('');
            container.innerHTML = `<h4>Схожі автомобілі</h4><div class="similar-cars-grid">${cardsHTML}</div>`;
        } catch (error) { container.innerHTML = ''; }
    }

    /**
     * Ініціалізує сторінку.
     */
    function initCarDetailPage() {
        getParamsFromUrl();
        loadComparisonList();
        loadAndDisplayCarDetails();
        if(typeof renderBrandQuickNav === 'function') renderBrandQuickNav('brandQuickNavContainer'); 
    }

    initCarDetailPage();
});