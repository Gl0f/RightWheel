document.addEventListener('DOMContentLoaded', () => {
    const brandTitleElement = document.getElementById('currentBrandTitle');
    const modelListContainer = document.getElementById('modelListContainer');
    const breadcrumbsContainer = document.getElementById('breadcrumbs'); // Новий елемент
    let MOCK_CARS = [];
    let selectedBrand = '';

    function loadDataFromStorage() {
        const savedCars = localStorage.getItem('RightWheel_cars');
        if (savedCars) {
            MOCK_CARS = JSON.parse(savedCars);
        } else {
            brandTitleElement.textContent = "Помилка: база даних не знайдена.";
        }
    }

    function getBrandNameFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('name');
    }

    // НОВА ФУНКЦІЯ для відображення хлібних крихт
    function renderBreadcrumbs() {
        breadcrumbsContainer.innerHTML = `
            <a href="main.html">Головна</a>
            <span>/</span>
            <span class="current">${selectedBrand}</span>
        `;
    }

    function renderModelList() {
        const carsOfBrand = MOCK_CARS.filter(car => car.make === selectedBrand);
        const models = [...new Set(carsOfBrand.map(car => car.model))].sort();

        brandTitleElement.textContent = `Моделі марки ${selectedBrand}`;
        document.title = `Моделі ${selectedBrand} — RightWheel`;
        modelListContainer.innerHTML = '';

        if (models.length === 0) {
            modelListContainer.innerHTML = '<p>Для цієї марки ще не додано жодної моделі.</p>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'brands-grid';

        models.forEach(model => {
            const modelLink = `model.html?brand=${encodeURIComponent(selectedBrand)}&model=${encodeURIComponent(model)}`;
            const item = document.createElement('a');
            item.href = modelLink;
            item.className = 'brand-item';
            item.style.textDecoration = 'none';
            item.innerHTML = `
                <div class="brand-logo-placeholder">${model.charAt(0)}</div>
                <div class="brand-name">${model}</div>
            `;
            grid.appendChild(item);
        });
        modelListContainer.appendChild(grid);
    }

    function init() {
        selectedBrand = getBrandNameFromUrl();
        if (!selectedBrand) {
            brandTitleElement.textContent = "Помилка: марка авто не вказана.";
            return;
        }
        loadDataFromStorage();
        renderBreadcrumbs(); // Викликаємо нову функцію
        renderModelList();
    }

    init();
});