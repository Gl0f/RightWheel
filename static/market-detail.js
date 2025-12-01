document.addEventListener('DOMContentLoaded', () => {
    
    const params = new URLSearchParams(window.location.search);
    const adId = params.get('id');
    
    // Глобальні змінні
    let currentAdData = null;
    let currentImageIndex = 0;
    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxImg = document.getElementById('lightboxImage');

    // Елементи форми редагування
    const editModal = document.getElementById('editAdModal');
    const closeEditBtn = document.getElementById('closeEditModalBtn');
    const editForm = document.getElementById('editAdForm');
    const modalBack = editModal?.querySelector('.modal-back');
    const editPhotoInput = document.getElementById('editPhotos');
    const editPhotoPreview = document.getElementById('editPhotoPreview');

    if (!adId) {
        document.getElementById('pageLoader').innerHTML = '<p style="color:red">Помилка: ID оголошення не вказано.</p>';
        return;
    }

    // --- 1. ЛОГІКА ПРЕВ\'Ю ФОТО ---
    if (editPhotoInput && editPhotoPreview) {
        editPhotoInput.addEventListener('change', function() {
            editPhotoPreview.innerHTML = ''; 
            if (this.files.length === 0) return;

            Array.from(this.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.height = '60px';
                    img.style.width = '80px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '4px';
                    img.style.border = '1px solid #4A5568';
                    editPhotoPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    // Закриття модалки
    const closeEdit = () => { if(editModal) editModal.style.display = 'none'; };
    if(closeEditBtn) closeEditBtn.addEventListener('click', closeEdit);
    if(modalBack) modalBack.addEventListener('click', closeEdit);

    // --- 2. ЛОГІКА ЗБЕРЕЖЕННЯ ---
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentAdData) return;

            const btn = editForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = "Збереження...";
            btn.disabled = true;

            const formData = new FormData(editForm);
            const token = localStorage.getItem('RightWheel_access_token');

            try {
                const res = await fetch(`/api/market/ads/${currentAdData.id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (res.ok) {
                    showInfoModal('Успіх', 'Оголошення оновлено!', 'success');
                    closeEdit();
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    const err = await res.json();
                    alert(err.error || 'Помилка оновлення');
                }
            } catch (err) {
                console.error(err);
                alert('Помилка з\'єднання');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // Завантаження
    loadAdDetails(adId);

    async function loadAdDetails(id) {
        try {
            const res = await fetch(`/api/market/ads/${id}`);
            if (!res.ok) throw new Error("Оголошення не знайдено");
            const ad = await res.json();
            currentAdData = ad; 
            
            renderPage(ad);
            
            // Запуск додаткових функцій
            setTimeout(() => {
                loadSimilarAds(ad);
                setupLightbox();
                // Тут ми викликаємо генерацію аналітики, якщо функція існує
            }, 100);

        } catch (e) {
            console.error(e);
            document.getElementById('pageLoader').innerHTML = `<p style="color:red">Оголошення не знайдено або видалено.</p>`;
        }
    }

    function renderPage(ad) {
        document.getElementById('pageLoader').style.display = 'none';
        const container = document.getElementById('adDetailContainer');
        container.style.display = 'block';

        const titleText = `${ad.brand_name} ${ad.model_name} ${ad.year}`;
        let subTitleParts = [];
        if (ad.generation_name) subTitleParts.push(ad.generation_name);
        if (ad.name) subTitleParts.push(ad.name);
        const subTitleText = subTitleParts.join(' • ');

        document.title = `${titleText} — RightWheel`;
        document.getElementById('breadcrumbTitle').textContent = titleText;

        const priceUsd = new Intl.NumberFormat('en-US').format(ad.price);
        const priceUah = new Intl.NumberFormat('uk-UA').format(Math.round(ad.price * 41.5));

        const mileage = `${ad.mileage} тис. км`;
        let engine = ad.engine_type;
        if (ad.engine_volume) engine += `, ${ad.engine_volume} л`;
        
        const avatarUrl = ad.user_avatar 
            ? (ad.user_avatar.startsWith('http') ? ad.user_avatar : `${ad.user_avatar}`)
            : `https://ui-avatars.com/api/?name=${ad.username}&background=random`;

        const images = ad.images && ad.images.length > 0 ? ad.images : ['https://via.placeholder.com/800x600?text=No+Photo'];
        const mainImage = images[0];
        
        const thumbnailsHtml = images.map((src, idx) => 
            `<img src="${src}" class="${idx===0?'active':''}" onclick="document.getElementById('riaMainImg').src='${src}'; document.querySelectorAll('.ria-thumbnails img').forEach(e=>e.classList.remove('active')); this.classList.add('active'); window.currentImageIndex = ${idx};">`
        ).join('');

        let identifiersHtml = `<div class="identifiers-container" style="margin-top: 15px; margin-bottom: 25px;">`;
        if (ad.license_plate) {
            identifiersHtml += `<div class="plate-box"><div class="plate-flag"></div><div class="plate-number">${ad.license_plate}</div></div>`;
        }
        if (ad.vin_code) {
            identifiersHtml += `<div class="vin-box"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38A169" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span class="vin-text">${ad.vin_code}</span></div>`;
        }
        identifiersHtml += `</div>`;

        // Аналітика ціни (виклик функції, яку ми додали внизу)
        const priceAnalyticsHtml = getAnalyticsHtml(ad.price);

        let equipmentHtml = '';
        let equipment = { security: [], comfort: [], media: [] };
        try { if (ad.equipment) equipment = JSON.parse(ad.equipment); } catch (e) {}
        const renderEqGroup = (title, items) => {
            if (!items || items.length === 0) return '';
            const listHtml = items.map(item => `<div class="equipment-item">${item}</div>`).join('');
            return `<div class="equipment-group"><div class="equipment-title">${title}</div><div class="equipment-list">${listHtml}</div></div>`;
        };
        const secHtml = renderEqGroup('Безпека', equipment.security);
        const comHtml = renderEqGroup('Комфорт', equipment.comfort);
        const medHtml = renderEqGroup('Мультимедіа', equipment.media);
        if (secHtml || comHtml || medHtml) {
            equipmentHtml = `<div class="equipment-section"><h3 style="font-size: 20px; font-weight:700; margin-bottom: 15px; border-bottom: 1px solid #4A5568; padding-bottom: 10px;">Комплектація</h3>${secHtml}${comHtml}${medHtml}</div>`;
        }

        const currentUser = localStorage.getItem('RightWheel_loggedInUser');
        const isOwner = (currentUser && currentUser === ad.username);
        
        let actionButtonsHtml = '';
        if (isOwner) {
            actionButtonsHtml = `
                <button id="editAdBtn" class="contact-btn" style="background-color: #3182CE; color: white; border: none;">✏️ Редагувати оголошення</button>
                <button id="deleteAdBtn" class="contact-btn" style="background-color: #E53E3E; color: white; border: none; margin-top: 10px;">🗑 Видалити оголошення</button>
            `;
        } else {
            actionButtonsHtml = `
                <button class="contact-btn btn-green" onclick="this.textContent='${ad.phone}'; this.style.background='#276749';">(0xx) xxx-xx-xx Показати</button>
                <button id="writeToChatBtn" class="contact-btn btn-outline">💬 Написати в чат</button>
            `;
        }

        const sellerProfileLink = `user-profile.html?id=${ad.user_id}`;
        const sellerBlockHtml = `
            <div class="ria-seller-card">
                <a href="${sellerProfileLink}" style="text-decoration: none; color: inherit;">
                    <div class="seller-header" style="cursor: pointer;">
                        <div class="seller-avatar-circle"><img src="${avatarUrl}"></div>
                        <div class="seller-name-box">
                            <span class="seller-role">Професійний продавець</span>
                            <span class="seller-name" style="text-decoration: underline; text-decoration-color: transparent; transition: 0.2s;">${ad.username}</span>
                            <div style="font-size: 11px; color: #38A169; display: flex; align-items: center; gap: 4px;">✔ Перевірено банком</div>
                        </div>
                    </div>
                </a>
                ${actionButtonsHtml}
            </div>
        `;

        container.innerHTML = `
            <div class="ria-layout">
                <div class="ria-gallery-column">
                    <div><img id="riaMainImg" src="${mainImage}" class="ria-main-image"><div class="ria-thumbnails" style="margin-top: 10px;">${thumbnailsHtml}</div></div>
                    <div class="ria-specs-line">
                        <div class="ria-spec-item"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4C7.58 4 4 7.58 4 12h2c0-3.31 2.69-6 6-6s6 2.69 6 6h2c0-4.42-3.58-8-8-8zm-5.74 3.69l1.41 1.41C8.86 8.22 10.37 7.5 12 7.5V5.5c-2.3 0-4.42.82-6.06 2.19zM12 20c-4.42 0-8-3.58-8-8h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.42-3.58 8-8 8z"/><path d="M13.47 13.59L16.5 10.5l-1.41-1.41-3.03 3.03c-.41-.22-.87-.34-1.36-.34-1.66 0-3 1.34-3 3 0 1.66 1.34 3 3 3s3-1.34 3-3c0-.49-.12-.95-.33-1.36z"/></svg>${mileage}</div>
                        <div class="ria-spec-item"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/><path d="M20.94 11c.46-4.17-3.77-7.48-7.94-7.06-3.28.33-5.85 3.02-6 6.32l-.12 2.05L4.76 13.5c-.83.54-1.09 1.61-.62 2.48l.02.04c.52.96 1.77 1.28 2.7.67l2.88-1.89c.63.44 1.33.77 2.09.96L12 22h2l.17-6.23c.76-.19 1.46-.52 2.09-.96l2.88 1.89c.93.61 2.17.29 2.7-.67l.02-.04c.46-.87.2-1.94-.63-2.48l-2.12-1.17.12-2.05c-.14-1.79-1.18-3.36-2.69-4.33.62-.23 1.3-.36 2.01-.36 2.8 0 5.09 2.12 5.36 4.86.25 2.55-1.51 4.76-3.95 5.47L19 18.5c3.39-.89 5.8-4.04 5.46-7.5h-3.52z"/></svg>${ad.transmission || 'Ручна'}</div>
                        <div class="ria-spec-item"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>${ad.engine_type || 'Паливо не вказано'}</div>
                        <div class="ria-spec-item"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${ad.location}</div>
                    </div>
                    ${identifiersHtml}
                    <div>
                        <h2 style="font-size:20px; font-weight:700; margin-bottom:15px; border-bottom:1px solid #4A5568; padding-bottom:10px;">Опис від продавця</h2>
                        <p style="white-space: pre-wrap; color: var(--text); line-height: 1.6;">${ad.description || 'Опис відсутній.'}</p>
                    </div>
                    <div class="details-grid">
                        <div class="detail-group">
                            ${ad.generation_name ? `<div class="detail-item"><span class="detail-label">Покоління:</span> <span class="detail-val">${ad.generation_name}</span></div>` : ''}
                            <div class="detail-item"><span class="detail-label">Рік випуску:</span> <span class="detail-val">${ad.year}</span></div>
                            <div class="detail-item"><span class="detail-label">Двигун:</span> <span class="detail-val">${engine}</span></div>
                            ${ad.body_type ? `<div class="detail-item"><span class="detail-label">Кузов:</span> <span class="detail-val">${ad.body_type}</span></div>` : ''}
                        </div>
                        <div class="detail-group">
                            ${ad.drive && ad.drive !== 'Не вказано' ? `<div class="detail-item"><span class="detail-label">Привід:</span> <span class="detail-val">${ad.drive}</span></div>` : ''}
                            ${ad.color && ad.color !== 'Не вказано' ? `<div class="detail-item"><span class="detail-label">Колір:</span> <span class="detail-val">${ad.color}</span></div>` : ''}
                        </div>
                    </div>
                    ${equipmentHtml}
                </div>
                <div class="ria-sidebar-column">
                    <div class="ria-title-block"><h1>${titleText}</h1></div>
                    <div class="ria-price-block"><span class="ria-price-usd">${priceUsd} $</span><span class="ria-price-uah">• ${priceUah} грн</span>
                        ${priceAnalyticsHtml} </div>
                    <div class="desktop-only-sidebar">${sellerBlockHtml}</div>
                </div>
            </div>
            <div class="mobile-only-seller" style="display:none;">${sellerBlockHtml}</div>
        `;
        
        if (window.innerWidth <= 900) {
            const mobSeller = document.querySelector('.mobile-only-seller');
            if(mobSeller) mobSeller.style.display = 'block';
        }

        // --- ОБРОБНИКИ КНОПОК ---
        
        const deleteBtn = document.getElementById('deleteAdBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if(confirm('Ви впевнені, що хочете видалити це оголошення?')) {
                    deleteBtn.disabled = true;
                    deleteBtn.textContent = "Видалення...";
                    const token = localStorage.getItem('RightWheel_access_token');
                    try {
                        const res = await fetch(`/api/market/ads/${ad.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            showInfoModal('Успіх', 'Оголошення видалено!', 'success');
                            setTimeout(() => { window.location.href = 'market.html'; }, 1500);
                        } else {
                            alert('Помилка видалення');
                            deleteBtn.disabled = false;
                        }
                    } catch(e) { console.error(e); deleteBtn.disabled = false; }
                }
            });
        }

        const editBtn = document.getElementById('editAdBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                document.getElementById('editPrice').value = ad.price;
                document.getElementById('editMileage').value = ad.mileage;
                document.getElementById('editPhone').value = ad.phone;
                document.getElementById('editLocation').value = ad.location;
                document.getElementById('editDescription').value = ad.description || '';
                
                if(ad.engine_type) document.getElementById('editEngineType').value = ad.engine_type;
                if(ad.engine_volume) document.getElementById('editEngineVol').value = ad.engine_volume;
                if(ad.transmission) document.getElementById('editTransmission').value = ad.transmission;
                if(ad.drive) document.getElementById('editDrive').value = ad.drive;
                if(ad.color) document.getElementById('editColor').value = ad.color;
                if(ad.vin_code) document.getElementById('editVin').value = ad.vin_code;
                if(ad.license_plate) document.getElementById('editPlate').value = ad.license_plate;
                if(ad.body_type) document.getElementById('editBodyType').value = ad.body_type;
                if(ad.fuel_consumption) document.getElementById('editFuelCons').value = ad.fuel_consumption;
                // -----------------

                const photosContainer = document.getElementById('existingPhotosContainer');
                const photosGrid = document.getElementById('existingPhotosGrid');
                const photosDeleteInput = document.getElementById('photosToDeleteInput');
                
                photosDeleteInput.value = ''; 
                photosGrid.innerHTML = '';

                const imagesData = ad.images_data || ad.images.map(url => ({id: null, url: url}));

                if (imagesData && imagesData.length > 0) {
                    photosContainer.style.display = 'block';
                    imagesData.forEach(img => {
                        const div = document.createElement('div');
                        div.className = 'edit-photo-item';
                        div.innerHTML = `<img src="${img.url}">${img.id ? `<button type="button" class="remove-photo-btn" title="Видалити">✕</button>` : ''}`;
                        
                        if (img.id) {
                            const btn = div.querySelector('.remove-photo-btn');
                            btn.onclick = () => {
                                let deletedIds = photosDeleteInput.value ? photosDeleteInput.value.split(',') : [];
                                const idStr = img.id.toString();
                                if (deletedIds.includes(idStr)) {
                                    deletedIds = deletedIds.filter(id => id !== idStr);
                                    div.classList.remove('deleted');
                                    btn.style.background = 'rgba(229, 62, 62, 0.9)';
                                    btn.textContent = '✕';
                                } else {
                                    deletedIds.push(idStr);
                                    div.classList.add('deleted');
                                    btn.style.background = '#38A169';
                                    btn.textContent = '↩';
                                }
                                photosDeleteInput.value = deletedIds.join(',');
                            };
                        }
                        photosGrid.appendChild(div);
                    });
                } else {
                    photosContainer.style.display = 'none';
                }

                editModal.style.display = 'flex';
            });
        }

        const writeBtn = document.getElementById('writeToChatBtn');
        if (writeBtn) {
            writeBtn.addEventListener('click', async () => {
                const token = localStorage.getItem('RightWheel_access_token');
                if (!token) {
                    if (typeof showLoginModal === 'function') showLoginModal();
                    return;
                }
                try {
                    const res = await fetch('/api/chats/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ listing_id: ad.id })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        window.location.href = `market.html?open_chat=${data.chat_id}`;
                    } else {
                        alert(data.error);
                    }
                } catch (e) { console.error(e); }
            });
        }
    }

    // --- 4. ДОДАНІ ФУНКЦІЇ (які були відсутні) ---

    function getAnalyticsHtml(price) {
        const randomFactor = 0.9 + Math.random() * 0.2; 
        const avgPrice = Math.round(price * randomFactor);
        const diffPercent = ((price - avgPrice) / avgPrice) * 100;
        let label = "Справедлива ціна"; let cssClass = "fair"; let width = "50%"; let color = "#ECC94B";
        if (diffPercent < -5) { label = "Хороша ціна"; cssClass = "good"; width = "30%"; color = "#48BB78"; }
        else if (diffPercent > 5) { label = "Вище ринку"; cssClass = "high"; width = "80%"; color = "#F56565"; }
        return `<div class="price-analytics-box"><div class="price-badge ${cssClass}">${label}</div><p class="price-text">Середня ціна: ${new Intl.NumberFormat('en-US').format(avgPrice)} $</p><div class="price-bar-container"><div class="price-bar-fill" style="width:${width}; background:${color};"></div></div></div>`;
    }

// --- ФУНКЦІЯ СХОЖИХ АВТО (Гарантований показ) ---
    async function loadSimilarAds(currentAd) {
        const container = document.getElementById('similarAdsContainer');
        const grid = document.getElementById('similarAdsGrid');
        
        if (!container || !grid) return;

        try {
            // 1. Спробуємо знайти авто тієї ж марки
            let res = await fetch(`/api/market/ads?brand_id=${currentAd.brand_id}`);
            let ads = await res.json();
            
            // Прибираємо поточне авто зі списку
            let similar = ads.filter(a => a.id !== currentAd.id);

            // 2. Якщо авто цієї марки мало (менше 3) -> довантажуємо просто "Свіжі пропозиції"
            if (similar.length < 3) {
                const resAll = await fetch(`/api/market/ads`);
                const allAds = await resAll.json();
                
                // Додаємо авто, які не є поточним і ще не в списку
                const extraAds = allAds.filter(a => a.id !== currentAd.id && !similar.find(s => s.id === a.id));
                similar = similar.concat(extraAds);
            }

            // Беремо перші 4 результати
            const finalAds = similar.slice(0, 4);

            if (finalAds.length > 0) {
                container.style.display = 'block'; // <--- ВАЖЛИВО: Явно показуємо контейнер
                
                grid.innerHTML = finalAds.map(ad => {
                    const img = ad.main_image || 'https://via.placeholder.com/300x200?text=No+Photo';
                    const price = new Intl.NumberFormat('en-US').format(ad.price);
                    
                    return `
                        <div class="similar-ad-card" onclick="window.location.href='market-detail.html?id=${ad.id}'">
                            <img src="${img}">
                            <div class="similar-ad-content">
                                <div class="similar-ad-price">$ ${price}</div>
                                <div class="similar-ad-title">${ad.brand_name} ${ad.model_name} ${ad.year}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                console.log("Схожих авто зовсім не знайдено (база пуста?)");
                container.style.display = 'none';
            }
        } catch (e) { 
            console.error("Помилка завантаження схожих авто:", e); 
        }
    }

    function setupLightbox() {
        const mainImg = document.getElementById('riaMainImg');
        if(!mainImg) return;
        mainImg.style.cursor = "zoom-in";
        mainImg.addEventListener('click', () => { window.openLightbox(0); });
        document.querySelector('.lightbox-close').addEventListener('click', () => { lightboxModal.style.display = 'none'; });
        lightboxModal.addEventListener('click', (e) => { if(e.target === lightboxModal) lightboxModal.style.display = 'none'; });
    }

    window.openLightbox = (index) => {
        if (!currentAdData || !currentAdData.images) return;
        currentImageIndex = index;
        updateLightboxImage();
        document.getElementById('lightboxModal').style.display = 'flex';
    };

    window.changeSlide = (n) => {
        if (!currentAdData || !currentAdData.images) return;
        currentImageIndex += n;
        if (currentImageIndex >= currentAdData.images.length) currentImageIndex = 0;
        if (currentImageIndex < 0) currentImageIndex = currentAdData.images.length - 1;
        updateLightboxImage();
    };

    function updateLightboxImage() {
        document.getElementById('lightboxImage').src = currentAdData.images[currentImageIndex];
    }
});