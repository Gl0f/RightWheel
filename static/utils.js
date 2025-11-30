
/**
 * Завантажує список брендів з API та відображає їх у вказаному контейнері.
 * @param {string} containerId - ID HTML-елемента, куди вставити список.
 */
async function renderBrandQuickNav(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Елемент з ID "${containerId}" не знайдено для навігації брендів.`);
        return;
    }

    container.innerHTML = '<p style="color: var(--muted); font-size: 14px;">Завантаження брендів...</p>'; // Індикатор завантаження

    try {
        const response = await fetch('/api/brands'); // Запит до API
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const brands = await response.json(); // Отримуємо [{id: 1, name: 'Audi', ...}, ...]

        if (!brands || brands.length === 0) {
            container.innerHTML = '<p style="color: var(--muted); font-size: 14px;">Не вдалося завантажити бренди.</p>';
            return;
        }

        // Генеруємо HTML для списку брендів
        let html = '<div class="brand-quick-nav-grid">';
        brands.forEach(brand => {
            // Посилання веде на сторінку бренду (brand.html)
            const brandLink = `brand.html?id=${brand.id}&name=${encodeURIComponent(brand.name)}`;
            html += `<a href="${brandLink}" class="brand-quick-nav-item">${brand.name}</a>`;
        });
        html += '</div>';

        container.innerHTML = html;

    } catch (error) {
        console.error("Помилка завантаження брендів для навігації:", error);
        container.innerHTML = `<p style="color: red; font-size: 14px;">Помилка завантаження брендів.</p>`;
    }
}