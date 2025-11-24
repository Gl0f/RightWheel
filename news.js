document.addEventListener('DOMContentLoaded', () => {

    async function loadAndRenderNews() {
        const swiperWrapper = document.querySelector('#newsSwiper .swiper-wrapper');
        const swiperContainer = document.getElementById('newsSwiper');

        if (!swiperWrapper || !swiperContainer) return;

        swiperWrapper.innerHTML = '<div style="padding: 20px; color: var(--muted);">Завантаження свіжих новин...</div>';

        try {
            const response = await fetch('http://127.0.0.1:5000/api/news');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const newsData = await response.json();

            if (!newsData || newsData.length === 0) {
                swiperContainer.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 40px; width: 100%;">
                        <h3 style="color: var(--muted);">Новин наразі немає.</h3>
                    </div>`;
                swiperContainer.classList.remove('swiper'); 
                return;
            }

            // --- ГЕНЕРАЦІЯ СЛАЙДІВ ---
            swiperWrapper.innerHTML = newsData.map(article => {
                const articleDate = new Date(article.published_at).toLocaleDateString('uk-UA', {
                    day: 'numeric', month: 'long', year: 'numeric'
                });
                
                let description = article.content || '';
                // Очищуємо зайві символи від API
                description = description.replace(/\[\+\d+ chars\]$/, '');

                const imageUrl = article.image_url || 'https://via.placeholder.com/600x400?text=RightWheel+News';

                // 1. СТВОРЮЄМО ВНУТРІШНЄ ПОСИЛАННЯ
                // Ми передаємо дані про новину через URL параметри
                const internalLink = `news-detail.html?title=${encodeURIComponent(article.title)}&date=${encodeURIComponent(articleDate)}&image=${encodeURIComponent(imageUrl)}&content=${encodeURIComponent(description)}&link=${encodeURIComponent(article.link_url)}`;

                // 2. ВИКОРИСТОВУЄМО ЙОГО В HREF ЗАМІСТЬ article.link_url
                // Зверніть увагу: target="_self" відкриває в тому ж вікні (або приберіть target взагалі)
                return `
                    <a href="${internalLink}" class="swiper-slide">
                        <div class="news-card">
                            <div class="news-card-image">
                                <img src="${imageUrl}" alt="${article.title}" loading="lazy">
                            </div>
                            <div class="news-card-content">
                                <span class="news-card-date">${articleDate}</span>
                                <h3 class="news-card-title">${article.title}</h3>
                                <p class="news-card-text">${description.substring(0, 100)}...</p>
                            </div>
                        </div>
                    </a>
                `;
            }).join('');

            initSwiper();

        } catch (error) {
            console.error("Помилка завантаження новин:", error);
            swiperContainer.innerHTML = `<div style="padding: 20px; color: var(--danger); text-align:center;">Не вдалося завантажити новини: ${error.message}</div>`;
            swiperContainer.classList.remove('swiper');
        }
    }

    function initSwiper() {
        const existingSwiper = document.querySelector('#newsSwiper').swiper;
        if (existingSwiper) existingSwiper.destroy();

        new Swiper('#newsSwiper', {
            loop: true,
            spaceBetween: 30,
            grabCursor: true,
            slidesPerView: 1, 
            breakpoints: {
                640: { slidesPerView: 1 },
                768: { slidesPerView: 2 },
                1024: { slidesPerView: 3 }
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            autoplay: {
              delay: 5000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true
            },
        });
    }

    loadAndRenderNews();
});