document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        adsGrid: document.getElementById('adsGrid'),
        filterBrand: document.getElementById('filterBrand'),
        filterModel: document.getElementById('filterModel'),
        filterYearMin: document.getElementById('filterYearMin'),
        filterYearMax: document.getElementById('filterYearMax'),
        filterPriceMin: document.getElementById('filterPriceMin'),
        filterPriceMax: document.getElementById('filterPriceMax'),
        filterMileageMax: document.getElementById('filterMileageMax'),
        filterTransmission: document.getElementById('filterTransmission'),
        filterFuel: document.getElementById('filterFuel'),
        filterBodyType: document.getElementById('filterBodyType'),
        
        applyFiltersBtn: document.getElementById('applyFiltersBtn'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),
        sortSelect: document.getElementById('sortSelect'),
        
        showFavoritesBtn: document.getElementById('showMarketFavoritesBtn'),
        favoritesModal: document.getElementById('favoritesModal'),
        favAdsGridModal: document.getElementById('favAdsGridModal'),
        closeFavoritesModalBtn: document.getElementById('closeFavoritesModalBtn'),
        favoritesModalBack: document.querySelector('#favoritesModal .modal-back'),

        openSellModalBtn: document.getElementById('openSellModalBtn'),
        sellModal: document.getElementById('sellModal'),
        closeSellModalBtn: document.getElementById('closeSellModalBtn'),
        sellForm: document.getElementById('sellCarForm'),
        sellBrand: document.getElementById('sellBrand'),
        sellPhotos: document.getElementById('sellPhotos'),
        photoPreview: document.getElementById('photoPreview'),
        modalBack: document.querySelector('#sellModal .modal-back'),

        // Чат елементи
        chatsModal: document.getElementById('chatsModal'),
        chatsList: document.getElementById('chatsList'),
        chatRoom: document.getElementById('chatRoom'),
        chatPlaceholder: document.getElementById('chatPlaceholder'),
        messagesArea: document.getElementById('messagesArea'),
        messageInput: document.getElementById('messageInput'),
        sendMessageForm: document.getElementById('sendMessageForm'),
        chatInterlocutorName: document.getElementById('chatInterlocutorName'),
        chatCarName: document.getElementById('chatCarName'),
        openChatsModalBtn: document.getElementById('openChatsModalBtn'),
        closeChatsModalBtn: document.getElementById('closeChatsModalBtn')
    };

    let favoriteIds = [];
    let activeChatId = null;
    let chatInterval = null;

    // --- 1. ЗАВАНТАЖЕННЯ ДАНИХ ---

    async function loadBrands() {
        // Логіка для селекту в формі продажу
        elements.sellBrand.addEventListener('change', async function() {
            const brandId = this.value;
            const modelSelect = document.getElementById('sellModel'); 
            modelSelect.innerHTML = '<option value="">Завантаження...</option>';
            modelSelect.disabled = true;
            if(brandId) {
                try {
                    const res = await fetch(`/api/brands/${brandId}/models`);
                    const models = await res.json();
                    modelSelect.innerHTML = '<option value="">Оберіть модель</option>';
                    models.forEach(m => modelSelect.add(new Option(m.name, m.id)));
                    modelSelect.disabled = false;
                } catch(e) { console.error(e); }
            }
        });

        // Логіка для фільтрів
        try {
            const res = await fetch('/api/brands');
            const brands = await res.json();
            brands.forEach(b => {
                elements.filterBrand.add(new Option(b.name, b.id));
                elements.sellBrand.add(new Option(b.name, b.id));
            });
        } catch (e) { console.error(e); }
    }

    async function loadFavoritesIds() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) return;
        try {
            const res = await fetch('/api/market/favorites/ids', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) favoriteIds = await res.json();
        } catch (e) { console.error(e); }
    }

    // Зміна марки у фільтрі
    elements.filterBrand.addEventListener('change', async function() {
        const brandId = this.value;
        elements.filterModel.innerHTML = '<option value="">Всі моделі</option>';
        if (brandId) {
            elements.filterModel.disabled = true;
            elements.filterModel.innerHTML = '<option>Завантаження...</option>';
            try {
                const res = await fetch(`/api/brands/${brandId}/models`);
                const models = await res.json();
                elements.filterModel.innerHTML = '<option value="">Всі моделі</option>';
                elements.filterModel.disabled = false;
                models.forEach(m => elements.filterModel.add(new Option(m.name, m.id)));
            } catch (e) { elements.filterModel.innerHTML = '<option value="">Помилка</option>'; }
        } else {
            elements.filterModel.disabled = true;
        }
    });

    // --- 2. ЗАВАНТАЖЕННЯ ОГОЛОШЕНЬ ---

    async function loadAds() {
        elements.adsGrid.innerHTML = '<p>Завантаження...</p>';
        const params = new URLSearchParams({
            brand_id: elements.filterBrand.value,
            model_id: elements.filterModel.value,
            year_min: elements.filterYearMin.value,
            year_max: elements.filterYearMax.value,
            price_min: elements.filterPriceMin.value,
            price_max: elements.filterPriceMax.value,
            mileage_max: elements.filterMileageMax.value,
            transmission: elements.filterTransmission.value,
            engine: elements.filterFuel.value,
            body_type: elements.filterBodyType.value,
            sort: elements.sortSelect.value
        });

        try {
            const res = await fetch(`/api/market/ads?${params}`);
            const ads = await res.json();
            renderAds(ads);
        } catch (e) { elements.adsGrid.innerHTML = '<p style="color:red">Помилка завантаження.</p>'; }
    }

    function renderAds(ads) {
        if (!ads.length) {
            elements.adsGrid.innerHTML = '<div class="empty-state"><p>Оголошень не знайдено.</p></div>';
            return;
        }
        elements.adsGrid.innerHTML = '';
        ads.forEach(ad => {
            const card = document.createElement('div');
            card.className = 'ad-card';
            const uniqueParam = new Date().getTime();
            const imgUrl = ad.main_image 
                ? `${ad.main_image}?t=${uniqueParam}` 
                : 'https://via.placeholder.com/300x200?text=No+Photo';
            const price = new Intl.NumberFormat('en-US').format(ad.price);
            const isFav = favoriteIds.includes(ad.id);
            const vinBadge = ad.vin_code ? `<span style="font-size: 10px; background: #276749; color: #9AE6B4; padding: 2px 6px; border-radius: 4px; margin-right: 5px;">✓ VIN</span>` : '';


            // Використовуємо ad.engine_type замість ad.fuel, щоб уникнути undefined
            const fuelType = ad.engine_type || 'Паливо не вказано';
            const transmissionType = ad.transmission || 'КПП не вказана';
            const locationText = ad.location || 'Місто не вказано';
            
            const mobileHtml = `
                <div class="mobile-card-info" style="display:none;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <span style="font-size:16px; font-weight:700; color:#38A169;">$ ${price}</span>
                        <span style="font-size:11px; color:#aaa; background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 4px;">${ad.year}</span>
                    </div>
                    
                    <div style="font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 5px; line-height: 1.2; height: 32px; overflow: hidden;">
                        ${ad.brand_name} ${ad.model_name}
                    </div>
                    
                    <div style="font-size:11px; color:#999; margin-bottom:5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${transmissionType} • ${fuelType}
                    </div>
                    
                    <div style="font-size:11px; color:#777; display: flex; align-items: center; gap: 3px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${locationText}
                    </div>
                </div>
            `;

            card.innerHTML = `
                <button class="ad-favorite-btn ${isFav ? 'active' : ''}" data-id="${ad.id}">
                    <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </button>
                <img src="${imgUrl}" class="ad-image" loading="lazy">
                
                ${mobileHtml} <div class="ad-content desktop-only"> <div class="ad-price">$ ${price}</div>
                    <div class="ad-title">${ad.brand_name} ${ad.model_name} ${ad.year}</div>
                    <div class="ad-meta">
                        ${vinBadge} <span>${ad.mileage} тис. км</span> • 
                        <span>${ad.transmission}</span>
                    </div>
                    <div class="ad-location">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${ad.location}
                    </div>
                </div>
            `;
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.ad-favorite-btn')) window.location.href = `market-detail.html?id=${ad.id}`;
            });
            const favBtn = card.querySelector('.ad-favorite-btn');
            favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(ad.id, favBtn); });
            elements.adsGrid.appendChild(card);
        });
    }

    async function toggleFavorite(id, btn) {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) { if(typeof showLoginModal === 'function') showLoginModal(); return; }
        btn.classList.toggle('active');
        try {
            const res = await fetch('/api/market/favorites', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ listing_id: id })
            });
            if (res.ok) {
                if (favoriteIds.includes(id)) favoriteIds = favoriteIds.filter(fid => fid !== id);
                else favoriteIds.push(id);
            }
        } catch (e) { btn.classList.toggle('active'); }
    }

    // --- 3. ЧАТИ (Виправлено логіку видалення) ---

    // Функція підтвердження
    function showCustomConfirm(message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('customConfirmModal');
            
            // Якщо модального вікна немає в HTML (забули додати), використовуємо звичайний confirm
            if (!modal) {
                const result = confirm(message);
                resolve(result);
                return;
            }

            const msgElement = document.getElementById('customConfirmMessage');
            const btnOk = document.getElementById('confirmOkBtn');
            const btnCancel = document.getElementById('confirmCancelBtn');
            const back = modal.querySelector('.modal-back');

            msgElement.textContent = message;
            modal.style.display = 'flex';

            // Очищуємо старі лісенери, клонуючи кнопки (щоб не натискалось 10 разів)
            const newBtnOk = btnOk.cloneNode(true);
            const newBtnCancel = btnCancel.cloneNode(true);
            const newBack = back.cloneNode(true);
            
            btnOk.parentNode.replaceChild(newBtnOk, btnOk);
            btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
            back.parentNode.replaceChild(newBack, back);

            const close = (result) => {
                modal.style.display = 'none';
                resolve(result);
            };

            newBtnOk.addEventListener('click', () => close(true));
            newBtnCancel.addEventListener('click', () => close(false));
            newBack.addEventListener('click', () => close(false));
        });
    }

    // Глобальна функція видалення (щоб можна було викликати з onclick в HTML)
    window.deleteChat = async function(event, chatId) {
        event.stopPropagation();
        
        const isConfirmed = await showCustomConfirm('Видалити цей чат? Історія буде втрачена.');
        if (!isConfirmed) return;

        const token = localStorage.getItem('RightWheel_access_token');
        try {
            const res = await fetch(`/api/chats/${chatId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                // Видаляємо з DOM
                const item = document.getElementById(`chat-item-${chatId}`);
                if (item) item.remove();
                
                // Якщо цей чат був відкритий - закриваємо
                if (activeChatId == chatId) {
                    elements.chatRoom.style.display = 'none';
                    elements.chatPlaceholder.style.display = 'flex';
                    activeChatId = null;
                    if(chatInterval) clearInterval(chatInterval);
                }
            } else {
                console.error(await res.json());
                alert('Помилка видалення. Перевірте консоль.');
            }
        } catch (e) { console.error(e); }
    };

    // Відкриття списку чатів
    elements.openChatsModalBtn?.addEventListener('click', () => openChatsModal());
    elements.closeChatsModalBtn?.addEventListener('click', () => {
        elements.chatsModal.style.display = 'none';
        if(chatInterval) clearInterval(chatInterval);
    });

    // Перевірка URL для відкриття конкретного чату
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('open_chat')) {
        const chatId = urlParams.get('open_chat');
        openChatsModal(chatId);
        window.history.replaceState({}, document.title, "market.html");
    }

    async function openChatsModal(startChatId = null) {
        if (!localStorage.getItem('RightWheel_access_token')) {
            if(typeof showLoginModal === 'function') showLoginModal();
            return;
        }
        elements.chatsModal.style.display = 'flex';
        await loadChatsList(startChatId);
    }

    async function loadChatsList(autoSelectId = null) {
        const token = localStorage.getItem('RightWheel_access_token');
        try {
            const res = await fetch('/api/chats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const chats = await res.json();
            
            elements.chatsList.innerHTML = '';
            if (chats.length === 0) {
                elements.chatsList.innerHTML = '<p style="padding:15px; color:#aaa; text-align:center;">У вас немає активних чатів</p>';
                return;
            }

            chats.forEach(chat => {
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.id = `chat-item-${chat.chat_id}`;
                if (activeChatId == chat.chat_id) item.classList.add('active');
                
                // === ВИПРАВЛЕННЯ: Додаємо timestamp, щоб оновити кеш ===
                const uniqueParam = new Date().getTime();
                const img = chat.car_image 
                    ? `${chat.car_image}?t=${uniqueParam}` 
                    : 'https://via.placeholder.com/40';
                
                item.innerHTML = `
                    <img src="${img}" class="chat-item-img">
                    <div class="chat-item-info">
                        <div class="chat-item-header">
                            <div class="chat-item-name">${chat.interlocutor_name}</div>
                            <button class="delete-chat-btn" onclick="deleteChat(event, ${chat.chat_id})" title="Видалити чат">✕</button>
                        </div>
                        <div class="chat-item-car">${chat.car_name}</div>
                        <div class="chat-item-last">${chat.last_message || '...'}</div>
                    </div>
                `;
                
                item.onclick = (e) => {
                    if (!e.target.classList.contains('delete-chat-btn')) {
                        openChatRoom(chat);
                    }
                };
                elements.chatsList.appendChild(item);
                
                if (autoSelectId && chat.chat_id == autoSelectId) {
                    openChatRoom(chat);
                }
            });
        } catch(e) { console.error(e); }
    }

    async function openChatRoom(chat) {
        activeChatId = chat.chat_id;
        elements.chatPlaceholder.style.display = 'none';
        elements.chatRoom.style.display = 'flex';
        
        elements.chatInterlocutorName.textContent = chat.interlocutor_name;
        elements.chatCarName.textContent = chat.car_name;
        
        document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.getElementById(`chat-item-${chat.chat_id}`);
        if(activeItem) activeItem.classList.add('active');

        loadMessages();
        if(chatInterval) clearInterval(chatInterval);
        chatInterval = setInterval(loadMessages, 3000);
    }

    async function loadMessages() {
        if(!activeChatId) return;
        const token = localStorage.getItem('RightWheel_access_token');
        const myUsername = localStorage.getItem('RightWheel_loggedInUser');
        
        try {
            const res = await fetch(`/api/chats/${activeChatId}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const messages = await res.json();
            
            const area = elements.messagesArea;
            const wasScrolledBottom = area.scrollHeight - area.scrollTop === area.clientHeight;
            
            area.innerHTML = messages.map(msg => `
                <div class="message-bubble ${msg.username === myUsername ? 'my' : 'other'}">
                    ${msg.content}
                </div>
            `).join('');
            
            if (wasScrolledBottom || messages.length === 1) {
                area.scrollTop = area.scrollHeight;
            }
        } catch(e) { console.error(e); }
    }

    elements.sendMessageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = elements.messageInput.value.trim();
        if(!text || !activeChatId) return;
        
        const token = localStorage.getItem('RightWheel_access_token');
        const area = elements.messagesArea;
        
        // Оптимістичне додавання
        area.innerHTML += `<div class="message-bubble my" style="opacity:0.5">${text}</div>`;
        area.scrollTop = area.scrollHeight;
        elements.messageInput.value = '';

        try {
            await fetch(`/api/chats/${activeChatId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: text })
            });
            loadMessages();
        } catch(e) { console.error(e); }
    });

    // --- 4. ІНШІ ФУНКЦІЇ ---
    
    // Модалка збережених
    async function openFavoritesModal() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) { if(typeof showLoginModal === 'function') showLoginModal(); return; }
        elements.favoritesModal.style.display = 'flex';
        elements.favAdsGridModal.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Завантаження...</p>';
        try {
            const res = await fetch('/api/market/favorites/list', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const ads = await res.json();
            renderFavoritesInModal(ads);
        } catch (e) { elements.favAdsGridModal.innerHTML = '<p style="color:red">Помилка завантаження</p>'; }
    }

    function renderFavoritesInModal(ads) {
        if (!ads.length) { elements.favAdsGridModal.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--muted);">Список порожній</p>'; return; }
        elements.favAdsGridModal.innerHTML = '';
        ads.forEach(ad => {
            const card = document.createElement('div');
            card.className = 'ad-card';
            card.id = `modal-fav-${ad.id}`;
            
            const imgUrl = ad.main_image || 'https://via.placeholder.com/300x200?text=No+Photo';
            const price = new Intl.NumberFormat('en-US').format(ad.price);

            // ВИПРАВЛЕННЯ ТУТ: Перевірка на undefined
            const brand = ad.brand_name || '';
            const model = ad.model_name || ''; // Якщо моделі немає, буде пустий рядок
            const year = ad.year || '';

            card.innerHTML = `
                <button class="delete-fav-btn" title="Видалити">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
                <img src="${imgUrl}" class="ad-image" loading="lazy">
                <div class="ad-content">
                    <div class="ad-price">$ ${price}</div>
                    <div class="ad-title">${brand} ${model} ${year}</div>
                    <div class="ad-meta">
                        <span>${ad.mileage} тис. км</span> • <span>${ad.transmission}</span>
                    </div>
                </div>
            `;
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-fav-btn')) {
                    window.location.href = `market-detail.html?id=${ad.id}`;
                }
            });

            card.querySelector('.delete-fav-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromFavorites(ad.id);
            });

            elements.favAdsGridModal.appendChild(card);
        });
    }

    async function removeFromFavorites(id) {
        const token = localStorage.getItem('RightWheel_access_token');
        const cardModal = document.getElementById(`modal-fav-${id}`);
        if(cardModal) cardModal.remove();
        favoriteIds = favoriteIds.filter(fid => fid !== id);
        loadAds();
        try {
            await fetch('/api/market/favorites', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ listing_id: id })
            });
        } catch(e) { console.error(e); }
    }

    function closeFavoritesModal() { elements.favoritesModal.style.display = 'none'; }
    if (elements.showFavoritesBtn) elements.showFavoritesBtn.addEventListener('click', openFavoritesModal);
    if (elements.closeFavoritesModalBtn) elements.closeFavoritesModalBtn.addEventListener('click', closeFavoritesModal);
    if (elements.favoritesModalBack) elements.favoritesModalBack.addEventListener('click', closeFavoritesModal);

    // Модалка продажу
    function openSellModal() {
        if (!localStorage.getItem('RightWheel_access_token')) { if(typeof showLoginModal === 'function') showLoginModal(); return; }
        elements.sellModal.style.display = 'flex';
    }
    function closeSellModal() { elements.sellModal.style.display = 'none'; }
    elements.sellPhotos.addEventListener('change', function() {
        elements.photoPreview.innerHTML = '';
        Array.from(this.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img'); img.src = e.target.result; img.style.height = '60px'; img.style.borderRadius = '4px'; elements.photoPreview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
    elements.sellForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(elements.sellForm);
        const token = localStorage.getItem('RightWheel_access_token');
        const equipment = { security: [], comfort: [], media: [] };
        elements.sellForm.querySelectorAll('input[name="opt_security"]:checked').forEach(el => equipment.security.push(el.value));
        elements.sellForm.querySelectorAll('input[name="opt_comfort"]:checked').forEach(el => equipment.comfort.push(el.value));
        elements.sellForm.querySelectorAll('input[name="opt_media"]:checked').forEach(el => equipment.media.push(el.value));
        formData.append('equipment', JSON.stringify(equipment));
        const btn = elements.sellForm.querySelector('button[type="submit"]');
        btn.textContent = 'Публікація...'; btn.disabled = true;
        try {
            const res = await fetch('/api/market/ads', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            closeSellModal();
            elements.sellForm.reset();
            elements.photoPreview.innerHTML = '';

            // --- ЛОГІКА ОПЛАТИ ---
            if (data.status === 'payment_required') {
                if(confirm(`Ліміт безкоштовних оголошень вичерпано. \nПерейти до оплати розміщення (100 грн)?`)) {
                    // Отримуємо дані для LiqPay
                    const payRes = await fetch('/api/payment/liqpay_data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ listing_id: data.listing_id })
                    });
                    const payData = await payRes.json();
                    
                    // Створюємо і відправляємо форму LiqPay динамічно
                    const form = document.createElement('form');
                    form.method = 'POST';
                    form.action = payData.url;
                    
                    const inputData = document.createElement('input');
                    inputData.type = 'hidden';
                    inputData.name = 'data';
                    inputData.value = payData.data;
                    
                    const inputSign = document.createElement('input');
                    inputSign.type = 'hidden';
                    inputSign.name = 'signature';
                    inputSign.value = payData.signature;
                    
                    form.appendChild(inputData);
                    form.appendChild(inputSign);
                    document.body.appendChild(form);
                    form.submit(); // Перехід на LiqPay
                }
            } else {
                // Безкоштовне розміщення
                showInfoModal('Успіх', data.message, 'success');
                loadAds();
            }

        } catch (error) { 
            alert(error.message); 
        } finally { 
            btn.textContent = 'Розмістити оголошення'; 
            btn.disabled = false; 
        }
    });
    elements.openSellModalBtn.addEventListener('click', openSellModal);
    elements.closeSellModalBtn.addEventListener('click', closeSellModal);
    elements.modalBack.addEventListener('click', closeSellModal);
    elements.applyFiltersBtn.addEventListener('click', () => loadAds());
    elements.resetFiltersBtn?.addEventListener('click', () => {
        elements.filterBrand.value = ""; elements.filterModel.innerHTML = '<option value="">Всі моделі</option>'; elements.filterModel.disabled = true;
        elements.filterTransmission.value = ""; elements.filterFuel.value = "";elements.filterBodyType.value = ""; elements.filterYearMin.value = ""; elements.filterYearMax.value = "";
        elements.filterPriceMin.value = ""; elements.filterPriceMax.value = ""; elements.filterMileageMax.value = ""; loadAds();
    });
    elements.sortSelect.addEventListener('change', () => loadAds());

    // --- ОНОВЛЕННЯ ДЛЯ СПОВІЩЕНЬ ---

    // 1. Функція перевірки непрочитаних (Polling)
    async function checkUnreadMessages() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) return;

        try {
            const res = await fetch('/api/chats/unread', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            const badge = document.getElementById('unreadBadge');
            if (data.count > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = data.count > 99 ? '99+' : data.count;
            } else {
                badge.style.display = 'none';
            }
        } catch (e) { console.error("Error checking unread:", e); }
    }

    // Запускаємо перевірку кожні 5 секунд
    setInterval(checkUnreadMessages, 5000);
    // І один раз при завантаженні
    checkUnreadMessages();


    // 2. Оновлюємо функцію openChatRoom, щоб позначати прочитаним
    // Знайдіть існуючу функцію openChatRoom і додайте туди виклик API:
    
    // ... (початок функції openChatRoom)
    async function openChatRoom(chat) {
        activeChatId = chat.chat_id;
        // ... (ваш старий код: відображення блоків, імен) ...
        document.getElementById('chatPlaceholder').style.display = 'none';
        document.getElementById('chatRoom').style.display = 'flex';
        document.getElementById('chatInterlocutorName').textContent = chat.interlocutor_name;
        document.getElementById('chatCarName').textContent = chat.car_name;
        
        // ВІДПРАВЛЯЄМО ЗАПИТ: "Я прочитав цей чат"
        const token = localStorage.getItem('RightWheel_access_token');
        fetch(`/api/chats/${chat.chat_id}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(() => {
            // Одразу оновлюємо лічильник (зменшуємо його)
            checkUnreadMessages();
        });

        // ... (решта вашого старого коду: loadMessages, setInterval) ...
        loadMessages();
        if(chatInterval) clearInterval(chatInterval);
        chatInterval = setInterval(loadMessages, 3000);
    }

    // --- ЛОГІКА ЗБЕРЕЖЕНИХ ПОШУКІВ ---

    const savedSearchesWrapper = document.getElementById('savedSearchesWrapper');
    const savedSearchesContainer = document.getElementById('savedSearchesContainer');
    const saveSearchBtn = document.getElementById('saveSearchBtn');

    // 1. Завантаження списку при старті
    async function loadSavedSearches() {
        const token = localStorage.getItem('RightWheel_access_token');
        if (!token) return;

        try {
            const res = await fetch('/api/me/searches', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const searches = await res.json();

            if (searches.length > 0) {
                savedSearchesWrapper.style.display = 'block';
                savedSearchesContainer.innerHTML = searches.map(s => `
                    <div class="search-chip" onclick="applySavedSearch('${encodeURIComponent(JSON.stringify(s.criteria))}')">
                        <span>${s.title}</span>
                        <button class="delete-search-btn" onclick="deleteSavedSearch(event, ${s.id})">✕</button>
                    </div>
                `).join('');
            } else {
                savedSearchesWrapper.style.display = 'none';
            }
        } catch (e) { console.error(e); }
    }

    // 2. Збереження поточного пошуку (АВТОМАТИЧНА НАЗВА)
    if (saveSearchBtn) {
        saveSearchBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('RightWheel_access_token');
            if (!token) {
                if(typeof showLoginModal === 'function') showLoginModal();
                return;
            }

            // Збираємо критерії
            const criteria = {
                brand_id: elements.filterBrand.value,
                model_id: elements.filterModel.value,
                year_min: elements.filterYearMin.value,
                year_max: elements.filterYearMax.value,
                price_min: elements.filterPriceMin.value,
                price_max: elements.filterPriceMax.value,
                fuel: elements.filterFuel.value,
                transmission: elements.filterTransmission.value,
                body_type: elements.filterBodyType ? elements.filterBodyType.value : "" 
            };

            // --- ГЕНЕРАЦІЯ НАЗВИ ---
            let titleParts = [];

            // 1. Марка та Модель
            const brandText = elements.filterBrand.options[elements.filterBrand.selectedIndex]?.text;
            const modelText = elements.filterModel.options[elements.filterModel.selectedIndex]?.text;

            if (elements.filterBrand.value) {
                titleParts.push(brandText);
                // Додаємо модель, тільки якщо обрана не "Всі моделі"
                if (elements.filterModel.value) {
                    titleParts.push(modelText);
                }
            } else {
                titleParts.push("Всі авто");
            }

            // 2. Роки
            const yMin = elements.filterYearMin.value;
            const yMax = elements.filterYearMax.value;
            if (yMin && yMax) {
                titleParts.push(`${yMin}-${yMax}`);
            } else if (yMin) {
                titleParts.push(`від ${yMin} р.`);
            } else if (yMax) {
                titleParts.push(`до ${yMax} р.`);
            }

            // 3. Інше (опціонально, можна розкоментувати)
            // if (elements.filterFuel.value) titleParts.push(elements.filterFuel.value);

            const autoTitle = titleParts.join(" ");
            // -----------------------

            // Блокуємо кнопку на час запиту
            const originalText = saveSearchBtn.textContent;
            saveSearchBtn.textContent = "Збереження...";
            saveSearchBtn.disabled = true;

            try {
                const res = await fetch('/api/me/searches', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ title: autoTitle, criteria: criteria })
                });
                
                if (res.ok) {
                    loadSavedSearches(); // Оновлюємо список чіпів
                    // Використовуємо кастомне повідомлення замість alert
                    if (typeof showInfoModal === 'function') {
                        showInfoModal('Збережено', `Пошук "${autoTitle}" додано до швидкого доступу.`, 'success');
                    }
                } else {
                    const err = await res.json();
                    alert(err.error || 'Помилка збереження');
                }
            } catch (e) { 
                console.error(e); 
            } finally {
                saveSearchBtn.textContent = originalText;
                saveSearchBtn.disabled = false;
            }
        });
    }

    // 3. Застосування збереженого пошуку (Оновлена версія)
    window.applySavedSearch = async (criteriaStr) => {
        const criteria = JSON.parse(decodeURIComponent(criteriaStr));
        
        // 1. Скидаємо всі фільтри
        elements.resetFiltersBtn.click(); // Це очистить все і завантажить дефолтний список

        // 2. Встановлюємо прості поля
        if (criteria.year_min) elements.filterYearMin.value = criteria.year_min;
        if (criteria.year_max) elements.filterYearMax.value = criteria.year_max;
        if (criteria.price_min) elements.filterPriceMin.value = criteria.price_min;
        if (criteria.price_max) elements.filterPriceMax.value = criteria.price_max;
        if (criteria.fuel) elements.filterFuel.value = criteria.fuel;
        if (criteria.body_type) elements.filterBodyType.value = criteria.body_type;
        if (criteria.transmission) elements.filterTransmission.value = criteria.transmission;
        if (criteria.mileage_max) elements.filterMileageMax.value = criteria.mileage_max; // Додано пробіг, якщо він є

        // 3. Складна логіка для Марки та Моделі
        if (criteria.brand_id) {
            elements.filterBrand.value = criteria.brand_id;
            
            // Вручну викликаємо логіку завантаження моделей
            elements.filterModel.innerHTML = '<option>Завантаження...</option>';
            elements.filterModel.disabled = true;

            try {
                const res = await fetch(`/api/brands/${criteria.brand_id}/models`);
                const models = await res.json();
                
                elements.filterModel.innerHTML = '<option value="">Всі моделі</option>';
                models.forEach(m => elements.filterModel.add(new Option(m.name, m.id)));
                elements.filterModel.disabled = false;

                // Тільки тепер, коли список готовий, вибираємо модель
                if (criteria.model_id) {
                    elements.filterModel.value = criteria.model_id;
                }
            } catch (e) {
                console.error("Помилка завантаження моделей при автозаповненні:", e);
            }
        }

        // 4. Завантажуємо оголошення з новими фільтрами
        loadAds();
        
        // Візуал: прокрутка догори до результатів
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 4. Видалення пошуку
    window.deleteSavedSearch = async (event, id) => {
        event.stopPropagation(); // Щоб не спрацював клік на сам чіп
        if (!confirm('Видалити цей збережений пошук?')) return;
        
        const token = localStorage.getItem('RightWheel_access_token');
        try {
            await fetch(`/api/me/searches/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            loadSavedSearches();
        } catch (e) { console.error(e); }
    };

    // Запускаємо при старті
    loadSavedSearches();

    // Мобільні фільтри
    const mobileFilterBtn = document.getElementById('mobileFilterToggle');
    const sidebar = document.getElementById('marketSidebar');
    
    if (mobileFilterBtn && sidebar) {
        mobileFilterBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (sidebar.classList.contains('open')) {
                mobileFilterBtn.textContent = "✕ Сховати фільтри";
                mobileFilterBtn.classList.remove('secondary');
                mobileFilterBtn.classList.add('primary');
            } else {
                mobileFilterBtn.textContent = "🌪 Показати фільтри";
                mobileFilterBtn.classList.add('secondary');
                mobileFilterBtn.classList.remove('primary');
            }
        });
    }

    // Старт
    loadBrands();
    loadFavoritesIds().then(loadAds);
});