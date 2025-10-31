document.addEventListener('DOMContentLoaded', () => {
    const modelTitleElement = document.getElementById('currentModelTitle');
    const yearListContainer = document.getElementById('yearListContainer');
    const breadcrumbsContainer = document.getElementById('breadcrumbs'); // Новий елемент
    let MOCK_CARS = [];
    let state = {
        selectedBrand: '',
        selectedModel: ''
    };

    function loadDataFromStorage() {
        const savedCars = localStorage.getItem('RightWheel_cars');
        if (savedCars) {
            MOCK_CARS = JSON.parse(savedCars);
        } else {
            modelTitleElement.textContent = "Помилка: база даних не знайдена.";
        }
    }

    function getParamsFromUrl() {
        const params = new URLSearchParams(window.location.search);
        state.selectedBrand = params.get('brand');
        state.selectedModel = params.get('model');
    }

    // НОВА ФУНКЦІЯ для відображення хлібних крихт
    function renderBreadcrumbs() {
        const brandLink = `brand.html?name=${encodeURIComponent(state.selectedBrand)}`;
        breadcrumbsContainer.innerHTML = `
            <a href="main.html">Головна</a>
            <span>/</span>
            <a href="${brandLink}">${state.selectedBrand}</a>
            <span>/</span>
            <span class="current">${state.selectedModel}</span>
        `;
    }

    function renderYearList() {
        const carsOfModel = MOCK_CARS.filter(car => car.make === state.selectedBrand && car.model === state.selectedModel);
        const years = [...new Set(carsOfModel.map(car => car.year))].sort((a, b) => b - a);

        modelTitleElement.textContent = `Оберіть рік для ${state.selectedBrand} ${state.selectedModel}`;
        document.title = `Покоління ${state.selectedBrand} ${state.selectedModel} — RightWheel`;
        yearListContainer.innerHTML = '';

        if (years.length === 0) {
            yearListContainer.innerHTML = '<p>Для цієї моделі не знайдено інформації про роки випуску.</p>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'brands-grid';

        years.forEach(year => {
            const yearLink = `generation.html?brand=${encodeURIComponent(state.selectedBrand)}&model=${encodeURIComponent(state.selectedModel)}&year=${year}`;
            const item = document.createElement('a');
            item.href = yearLink;
            item.className = 'brand-item';
            item.style.textDecoration = 'none';
            item.innerHTML = `
                <div class="brand-logo-placeholder" style="font-size: 24px;">📅</div>
                <div class="brand-name" style="font-size: 22px;">${year}</div>
            `;
            grid.appendChild(item);
        });
        yearListContainer.appendChild(grid);
    }

    function init() {
        getParamsFromUrl();
        if (!state.selectedBrand || !state.selectedModel) {
            modelTitleElement.textContent = "Помилка: марка або модель не вказана.";
            return;
        }
        
        loadDataFromStorage();
        renderBreadcrumbs(); // Викликаємо нову функцію
        renderYearList();
    }

    init();
});