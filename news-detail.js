document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);

    const elImage = document.getElementById('ndImage');
    const elDate = document.getElementById('ndDate');
    const elTitle = document.getElementById('ndTitle');
    const elContent = document.getElementById('ndContent');
    const elLink = document.getElementById('ndLink');

    const title = params.get('title');
    const image = params.get('image');
    const date = params.get('date');
    // Початковий короткий текст (поки вантажиться повний)
    const initialContent = params.get('content'); 
    const link = params.get('link');

    if (!title || !link) {
        window.location.href = 'news.html';
        return;
    }

    document.title = `${title} — RightWheel`;
    
    elTitle.textContent = title;
    elImage.src = image || 'https://via.placeholder.com/800x500?text=No+Image';
    elDate.textContent = date || 'Сьогодні';
    
    // Спочатку показуємо те, що є (короткий опис)
    if (initialContent) {
        elContent.innerHTML = initialContent.replace(/\n/g, '<br>') + '<br><br><i>Завантаження повної статті...</i>';
    }

    elLink.href = link;

    // --- МАГІЯ ТУТ: Запит на сервер за повним текстом ---
    fetchFullArticle(link);

    async function fetchFullArticle(articleUrl) {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/news/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: articleUrl })
            });

            const data = await response.json();

            if (data.content) {
                // Форматуємо текст: розбиваємо на абзаци
                const formattedText = data.content
                    .split('\n')
                    .filter(p => p.trim().length > 0) // Видаляємо порожні рядки
                    .map(p => `<p>${p}</p>`)
                    .join('');
                
                // Плавно оновлюємо контент
                elContent.innerHTML = formattedText;
            } else {
                // Якщо не вдалося витягнути текст, залишаємо короткий і прибираємо напис про завантаження
                if (initialContent) {
                    elContent.innerHTML = initialContent.replace(/\n/g, '<br>') + '<br><br><i>Повний текст доступний на джерелі.</i>';
                }
            }

        } catch (error) {
            console.error("Не вдалося завантажити повну статтю:", error);
        }
    }
});