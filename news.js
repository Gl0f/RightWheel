document.addEventListener('DOMContentLoaded', () => {

    async function loadAndRenderNews() {
        // Шукаємо контейнер сітки (Grid), а не слайдер
        const newsGrid = document.getElementById('newsGrid');

        if (!newsGrid) return;

        // Стан завантаження
        newsGrid.innerHTML = '<p style="padding: 20px; color: var(--muted); grid-column: 1/-1;">Завантаження свіжих новин...</p>';

        try {
            const response = await fetch('http://127.0.0.1:5000/api/news');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const newsData = await response.json();

            // Якщо новин немає
            if (!newsData || newsData.length === 0) {
                newsGrid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                        <h3 style="color: var(--muted);">Новин наразі немає.</h3>
                    </div>`;
                return;
            }

            // --- ГЕНЕРАЦІЯ СІТКИ НОВИН ---
            newsGrid.innerHTML = newsData.map(article => {
                // Форматування дати
                const articleDate = new Date(article.published_at).toLocaleDateString('uk-UA', {
                    day: 'numeric', month: 'long', year: 'numeric'
                });
                
                // Обробка тексту
                let description = article.content || '';
                description = description.replace(/\[\+\d+ chars\]$/, ''); // Прибираємо артефакти API

                const imageUrl = article.image_url || 'https://via.placeholder.com/600x400?text=RightWheel+News';

                // Ваша логіка для внутрішнього посилання
                const internalLink = `news-detail.html?title=${encodeURIComponent(article.title)}&date=${encodeURIComponent(articleDate)}&image=${encodeURIComponent(imageUrl)}&content=${encodeURIComponent(description)}&link=${encodeURIComponent(article.link_url)}`;

                // Нова HTML структура для Grid (сітки)
                return `
                    <div class="news-item">
                        <div class="news-thumb-wrapper">
                            <img src="${imageUrl}" alt="${article.title}" class="news-thumb" loading="lazy">
                            <div class="news-date-badge">${articleDate}</div>
                        </div>
                        <div class="news-body">
                            <div class="news-source">${article.source || 'Авто новини'}</div>
                            <h3 class="news-title">${article.title}</h3>
                            <p class="news-excerpt">${description.substring(0, 120)}...</p>
                            
                            <div class="news-footer">
                                <a href="${internalLink}" class="read-more-link">
                                    Читати далі 
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error("Помилка завантаження новин:", error);
            newsGrid.innerHTML = `<div style="padding: 20px; color: var(--danger); text-align:center; grid-column: 1/-1;">Не вдалося завантажити новини: ${error.message}</div>`;
        }
    }

    // Запускаємо функцію
    loadAndRenderNews();
});