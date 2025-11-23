document.addEventListener('DOMContentLoaded', () => {

    const elements = {
        usernameTitle: document.getElementById('accountUsernameTitle'),
        statsContainer: document.getElementById('accountStatsContainer'),
        topicsList: document.getElementById('myTopicsList'),
        
        emailForm: document.getElementById('changeEmailForm'),
        emailInput: document.getElementById('accEmail'),
        emailPasswordInput: document.getElementById('accEmailPassword'),
        
        passwordForm: document.getElementById('changePasswordForm'),
        oldPasswordInput: document.getElementById('accOldPassword'),
        newPasswordInput: document.getElementById('accNewPassword'),
        confirmPasswordInput: document.getElementById('accConfirmPassword'),
        goToComparisonBtn: document.getElementById('goToComparisonBtn'),
    };

    let authToken = null;

    async function loadAccountDetails() {
        if (!authToken) return;
        
        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/account', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.status === 401) {
                window.location.href = 'main.html';
                return;
            }
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.msg);
            
            elements.usernameTitle.textContent = `Кабінет: ${data.user.username}`;
            elements.emailInput.value = data.user.email;
            
            elements.statsContainer.innerHTML = `
                <div class="stat-item">
                    <span>Створено тем:</span>
                    <strong>${data.stats.topic_count}</strong>
                </div>
                <div class="stat-item">
                    <span>Всього повідомлень:</span>
                    <strong>${data.stats.post_count}</strong>
                </div>
            `;
            
        } catch (error) {
            console.error('Помилка завантаження акаунту:', error);
            elements.statsContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    async function loadMyTopics() {
        if (!authToken) return;

        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/topics', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!response.ok) {
                 const data = await response.json();
                 throw new Error(data.error || data.msg);
            }
            
            const topics = await response.json();
            
            if (topics.length === 0) {
                elements.topicsList.innerHTML = '<p style="color: var(--muted);">Ви ще не створили жодної теми.</p>';
                return;
            }
            elements.topicsList.innerHTML = topics.map(topic => {
                const topicLink = `topic.html?id=${topic.id}`;
                const createdDate = new Date(topic.created_at).toLocaleDateString('uk-UA');
                
                return `
                    <a href="${topicLink}" class="my-topic-item">
                        <span class="my-topic-title">${topic.title}</span>
                        <span class="my-topic-meta">
                            <span>${createdDate}</span>
                            <span>Відповідей: ${topic.post_count}</span>
                        </span>
                    </a>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Помилка завантаження тем:', error);
            elements.topicsList.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    function loadComparisonList() {
        if (!elements.goToComparisonBtn) return;

        let comparisonList = [];
        try {
            // Завантажуємо список порівняння з localStorage
            const savedComparison = localStorage.getItem('RightWheel_comparison');
            comparisonList = savedComparison ? JSON.parse(savedComparison) : [];
        } catch (e) { 
            console.error("Помилка завантаження списку порівняння:", e); 
            comparisonList = []; 
        }

        const count = comparisonList.length;
        const buttonText = elements.goToComparisonBtn.querySelector('span');

        if (buttonText) {
            buttonText.textContent = `Переглянути список (${count})`;
        }

        // Робимо кнопку активною, лише якщо список не порожній
        if (count > 0) {
            elements.goToComparisonBtn.disabled = false;
            elements.goToComparisonBtn.addEventListener('click', () => {
                window.location.href = 'comparison.html';
            });
        } else {
            elements.goToComparisonBtn.disabled = true;
        }
    }


    async function handleChangeEmail(e) {
        e.preventDefault();
        const newEmail = elements.emailInput.value;
        const password = elements.emailPasswordInput.value;
        
        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/account/email', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ new_email: newEmail, password: password })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.msg);
            
            showInfoModal('Успіх', data.message, 'success');
            elements.emailInput.value = data.new_email;
            elements.emailPasswordInput.value = '';
            
        } catch (error) {
            showInfoModal('Помилка', error.message, 'error');
        }
    }


    async function handleChangePassword(e) {
        e.preventDefault();
        const oldPassword = elements.oldPasswordInput.value;
        const newPassword = elements.newPasswordInput.value;
        const confirmPassword = elements.confirmPasswordInput.value;

        if (newPassword !== confirmPassword) {
            showInfoModal('Помилка', 'Нові паролі не співпадають.', 'error');
            return;
        }
        
        try {
            const response = await fetch('http://127.0.0.1:5000/api/me/account/password', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.msg);

            showInfoModal('Успіх', data.message, 'success');
            elements.passwordForm.reset();
            
        } catch (error) {
             showInfoModal('Помилка', error.message, 'error');
        }
    }
    function initAccountPage() {
        authToken = localStorage.getItem('RightWheel_access_token');
        
        if (!authToken) {
            window.location.href = 'main.html';
            return;
        }

        loadAccountDetails();
        loadMyTopics();
        loadComparisonList();
        
        elements.emailForm.addEventListener('submit', handleChangeEmail);
        elements.passwordForm.addEventListener('submit', handleChangePassword);
    }

    initAccountPage();
});