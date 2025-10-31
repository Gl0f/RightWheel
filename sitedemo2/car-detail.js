document.addEventListener('DOMContentLoaded', () => {
    const carDetailContainer = document.getElementById('carDetailContainer');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    let ALL_CARS = [];
    
    function getCarIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    function loadCarsFromStorage() {
        try {
            const savedCars = localStorage.getItem('RightWheel_cars');
            if (savedCars) {
                ALL_CARS = JSON.parse(savedCars);
            } else {
                carDetailContainer.innerHTML = `<p style="color: red;">Помилка: база даних автомобілів не знайдена.</p>`;
            }
        } catch (e) {
            console.error("Помилка завантаження даних з localStorage:", e);
            carDetailContainer.innerHTML = `<p style="color: red;">Помилка завантаження даних.</p>`;
        }
    }

    function renderBreadcrumbs(car) {
        const brandLink = `brand.html?name=${encodeURIComponent(car.make)}`;
        const modelLink = `model.html?brand=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}`;
        const generationLink = `generation.html?brand=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}&year=${car.year}`;

        breadcrumbsContainer.innerHTML = `
            <a href="main.html">Головна</a>
            <span>/</span>
            <a href="${brandLink}">${car.make}</a>
            <span>/</span>
            <a href="${modelLink}">${car.model}</a>
            <span>/</span>
            <a href="${generationLink}">${car.year}</a>
            <span>/</span>
            <span class="current">${car.engine}</span>
        `;
    }

    // ЗМІНЕНА ФУНКЦІЯ: тепер шукає за роком і типом кузова
    function findSimilarCars(currentCar) {
        if (!currentCar) return [];
        return ALL_CARS.filter(car =>
            car.id !== currentCar.id &&
            car.body_type === currentCar.body_type &&
            Math.abs(car.year - currentCar.year) <= 2 // Шукаємо авто +/- 2 роки
        )
        .slice(0, 4);
    }

    // ЗМІНЕНА ФУНКЦІЯ: видалено ціну
    function renderSimilarCars(similarCars) {
        const container = document.getElementById('similarCarsContainer');
        if (!container) return;
        if (similarCars.length === 0) { /* ... */ return; }
        const cardsHTML = similarCars.map(car => `
            <a href="car.html?id=${car.id}" class="similar-car-card">
                <div class="similar-car-title">${car.make} ${car.model}</div>
                <div class="similar-car-details">
                    <span>${car.year}</span>
                    <span>${car.engine}</span>
                </div>
            </a>
        `).join('');
        container.innerHTML = `<h4>Схожі автомобілі</h4><div class="similar-cars-grid">${cardsHTML}</div>`;
    }

    // ЗМІНЕНА ФУНКЦІЯ: видалено ціну та телефон з таблиці
    function displayCarDetails() {
        loadCarsFromStorage();
        const carId = getCarIdFromUrl();
        const car = ALL_CARS.find(c => c.id === carId);
        if (!car) { /* ... */ return; }
        document.title = `${car.make} ${car.model} — RightWheel`;
        renderBreadcrumbs(car);
        carDetailContainer.innerHTML = '';
        carDetailContainer.innerHTML += `
            <h2>${car.make} ${car.model}</h2>
            <div class="car-detail-content" style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px;">
                <div class="car-image-gallery">
                    <img src="${car.image_url || 'https://via.placeholder.com/600x400?text=No+Photo'}" alt="${car.make} ${car.model}" style="width: 100%; border-radius: 8px;">
                </div>
                <div class="car-description">
                    <h3>Технічні характеристики</h3>
                    <table class="specs-table">
                        <tr><td>Країна</td><td>${car.country || 'Н/Д'}</td></tr>
                        <tr><td>Рік випуску</td><td>${car.year}</td></tr>
                        <tr><td>Тип кузова</td><td>${car.body_type || 'Н/Д'}</td></tr>
                        <tr><td>Двигун</td><td>${car.engine}</td></tr>
                        <tr><td>Паливо</td><td>${car.fuel}</td></tr>
                        <tr><td>Потужність</td><td>${car.power_hp} к.с.</td></tr>
                        <tr><td>Крутний момент</td><td>${car.torque_nm || 'Н/Д'} Нм</td></tr>
                        <tr><td>Трансмісія</td><td>${car.transmission}</td></tr>
                        <tr><td>Привід</td><td>${car.drive || 'Н/Д'}</td></tr>
                        <tr><td>Розгін 0-100 км/год</td><td>${car.acceleration_0_100 ? car.acceleration_0_100 + ' сек.' : 'Н/Д'}</td></tr>
                        <tr><td>Макс. швидкість</td><td>${car.top_speed_kmh ? car.top_speed_kmh + ' км/год' : 'Н/Д'}</td></tr>
                        <tr><td>Витрата палива (зміш.)</td><td>${car.fuel_consumption_mixed ? car.fuel_consumption_mixed + ' л/100 км' : 'Н/Д'}</td></tr>
                        <tr><td>Об'єм багажника</td><td>${car.trunk_volume_l ? car.trunk_volume_l + ' л' : 'Н/Д'}</td></tr>
                    </table>
                </div>
            </div>
            <div id="similarCarsContainer" class="similar-cars-section"></div>
        `;
        const similarCars = findSimilarCars(car);
        renderSimilarCars(similarCars);
    }
    displayCarDetails();
});