document.addEventListener('DOMContentLoaded', () => {
    // Оголошуємо елементи та стан
    const elements = {
        currentGenerationTitle: document.getElementById('currentGenerationTitle'),
        listElement: document.getElementById('carList'),
        breadcrumbsContainer: document.getElementById('breadcrumbs'), // Додано
        paginationInfo: document.getElementById('paginationInfo'),
        paginationRow: document.getElementById('paginationRow')
    };

    const state = {
        carsPerPage: 15,
        currentPage: 1,
        selectedBrand: '',
        selectedModel: '',
        selectedYear: null,
        currentSortColumn: 'price',
        currentSortDirection: 'asc'
    };

    let MOCK_CARS = [];

    function loadCarsFromStorage() {
        const savedCars = localStorage.getItem('RightWheel_cars');
        if (savedCars) MOCK_CARS = JSON.parse(savedCars);
        else elements.currentGenerationTitle.textContent = "Помилка: база даних не знайдена.";
    }

    function getParamsFromUrl() {
        const params = new URLSearchParams(window.location.search);
        state.selectedBrand = params.get('brand');
        state.selectedModel = params.get('model');
        state.selectedYear = parseInt(params.get('year'));
    }
    
    // НОВА ФУНКЦІЯ для відображення хлібних крихт
    function renderBreadcrumbs() {
        const brandLink = `brand.html?name=${encodeURIComponent(state.selectedBrand)}`;
        const modelLink = `model.html?brand=${encodeURIComponent(state.selectedBrand)}&model=${encodeURIComponent(state.selectedModel)}`;
        elements.breadcrumbsContainer.innerHTML = `
            <a href="main.html">Головна</a>
            <span>/</span>
            <a href="${brandLink}">${state.selectedBrand}</a>
            <span>/</span>
            <a href="${modelLink}">${state.selectedModel}</a>
            <span>/</span>
            <span class="current">${state.selectedYear}</span>
        `;
    }

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


    function renderCarTable() {
        elements.listElement.innerHTML = '';
        const titleText = `${state.selectedBrand} ${state.selectedModel} (${state.selectedYear})`;
        document.title = `${titleText} — RightWheel`;
        elements.currentGenerationTitle.textContent = `Комплектації для ${titleText}`;
        
        let filteredCars = MOCK_CARS.filter(car => 
            car.make === state.selectedBrand && 
            car.model === state.selectedModel && 
            car.year === state.selectedYear
        );

        // Сортування
    

        const totalCars = filteredCars.length;
        const totalPages = Math.ceil(totalCars / state.carsPerPage);
        const startIndex = (state.currentPage - 1) * state.carsPerPage;
        const currentCars = filteredCars.slice(startIndex, startIndex + state.carsPerPage);

        if (currentCars.length === 0) {
            elements.listElement.innerHTML = `<div class="empty-state"><h3>Нічого не знайдено</h3></div>`;
            return;
        }

        currentCars.forEach(car => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = car.id;
            card.innerHTML = `
                <div></div>
                <div class="car-image-container"><img src="${car.image_url || 'https://via.placeholder.com/100x70?text=No+Photo'}" alt="${car.make} ${car.model}"></div>
                <div class="card-title">${car.model} <span>${car.engine}</span></div>
                <div>${car.year}</div>
                <div>${car.power_hp} к.с.</div>
                <div><span class="fuel-badge ${getFuelBadgeClass(car.fuel)}">${car.fuel}</span></div>
                <div>${car.transmission}</div>
                
            `;
            card.addEventListener('click', (e) => {
                 if (!e.target.closest('.phone-number')) {
                    window.location.href = `car.html?id=${car.id}`;
                }
            });
            elements.listElement.appendChild(card);
        });

        document.querySelectorAll('.phone-number').forEach(el => el.addEventListener('click', function(e) { e.stopPropagation(); this.classList.toggle('revealed'); }));
        renderPagination(totalCars, totalPages);
    }

    function renderPagination(totalCars, totalPages) {
       // код для пагінації (залишається без змін)
    }

    function init() {
        getParamsFromUrl();
        if (!state.selectedBrand || !state.selectedModel || !state.selectedYear) {
            elements.currentGenerationTitle.textContent = "Помилка: неповні дані в адресі.";
            return;
        }
        loadCarsFromStorage();
        renderBreadcrumbs(); // Викликаємо нову функцію
        renderCarTable();
    }

    init();
});