document.addEventListener('DOMContentLoaded', () => {

    const NEWS_DATABASE = [
        {
            id: 2,
            title: "Представлено новий Volkswagen ID.7",
            date: "2025-10-26",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Volkswagen_ID.7_1X7A2431.jpg/1920px-Volkswagen_ID.7_1X7A2431.jpg",
            content: "Volkswagen офіційно представив свій новий електричний седан ID.7. \nМодель обіцяє запас ходу до 700 км (WLTP) завдяки новій батареї та покращеній аеродинаміці.",
            linkUrl: "https://uk.wikipedia.org/wiki/Volkswagen_ID.7" // <-- ЗМІНА ТУТ
        },
        {
            id: 1,
            title: "Toyota оновлює лінійку Corolla",
            date: "2025-10-25",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Toyota_Corolla_Cross_Hybrid_1X7A6349.jpg/1920px-Toyota_Corolla_Cross_Hybrid_1X7A6349.jpg",
            content: "У 2026 модельному році Toyota Corolla отримає нову гібридну установку п'ятого покоління та оновлену мультимедійну систему з більшим екраном.",
            linkUrl: "https://uk.wikipedia.org/wiki/Toyota_Corolla_Cross" // <-- ЗМІНА ТУТ
        },
        {
            id: 3,
            title: "BMW M5 нового покоління стане гібридом",
            date: "2025-10-24",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/BMW_M5_%28G90%29_MYLE_Festival_2025_DSC_9764.jpg/1280px-BMW_M5_%28G90%29_MYLE_Festival_2025_DSC_9764.jpg",
            content: "Інсайдери повідомляють, що наступний BMW M5 отримає потужну гібридну установку V8, сукупна потужність якої перевищить 700 к.с.",
            linkUrl: "https://uk.wikipedia.org/wiki/BMW_M5" // <-- ЗМІНА ТУТ
        }
        // Додавайте нові новини сюди, не забуваючи додати 'linkUrl'
    ];

    
    /**
     * Відображає новини у вигляді слайдів каруселі.
     */
    function renderNews() {
        const swiperWrapper = document.querySelector('#newsSwiper .swiper-wrapper');
        if (!swiperWrapper) {
            console.error("Не знайдено контейнер .swiper-wrapper");
            return;
        }

        if (NEWS_DATABASE.length === 0) {
            document.getElementById('newsSwiper').style.display = 'none';
            return;
        }

        // 1. Генеруємо HTML для кожного слайду
        swiperWrapper.innerHTML = NEWS_DATABASE.map(article => {
            const articleDate = new Date(article.date).toLocaleDateString('uk-UA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const contentHtml = article.content.replace(/\n/g, '<br><br>');

            
            // Тепер 'href' бере посилання з 'article.linkUrl'
            return `
                <a href="${article.linkUrl}" class="swiper-slide" target="_blank">
                    <div class="news-card">
                        <div class="news-card-image">
                            <img src="${article.imageUrl}" alt="${article.title}">
                        </div>
                        <div class="news-card-content">
                            <span class="news-card-date">${articleDate}</span>
                            <h3 class="news-card-title">${article.title}</h3>
                            <p class="news-card-text">${contentHtml}</p>
                        </div>
                    </div>
                </a>
            `;
        }).join('');

        // 2. Ініціалізуємо (ЗАПУСКАЄМО) карусель Swiper
        const swiper = new Swiper('#newsSwiper', {
            loop: true,
            spaceBetween: 30,
            
            slidesPerView: 1, 
            breakpoints: {
                768: {
                    slidesPerView: 2
                },
                1024: {
                    slidesPerView: 3
                }
            },

            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },

            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
        });
    }

    // Запускаємо відображення новин
    renderNews();
});