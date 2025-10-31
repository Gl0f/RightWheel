from flask import Flask, jsonify, request
from flask_cors import CORS 
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, JWTManager
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2
import psycopg2.extras
import psycopg2.extras 
import json
import os
import random 
from datetime import date
import math 
from datetime import datetime, timezone
from dotenv import load_dotenv
from flask import render_template

app = Flask(__name__)
CORS(app, allow_headers=["Content-Type", "Authorization"])
app.json.ensure_ascii = False
app.config['JSON_AS_ASCII'] = False

app.config["JWT_SECRET_KEY"] = "vova-secret-key-for-project-2025"
jwt = JWTManager(app)

load_dotenv()

# --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ---

DATABASE_URL = os.getenv("DATABASE_URL")
# Наприклад:
# DATABASE_URL = "postgresql://postgres:mysecretpassword@localhost:5432/rightwheel_db"

def get_db_connection():
    """Створює з'єднання з базою даних."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Помилка підключення до БД: {e}")
        return None



@app.route('/api/auth/login', methods=['POST'])
def login_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Потрібно ввести логін та пароль"}), 400

    # 1. Шукаємо користувача в БД
    # Важливо: fetch_query повертає список, беремо [0]
    user_data, _ = fetch_query("SELECT id, password_hash FROM users WHERE username = %s", (username,))
    
    if not user_data:
        return jsonify({"error": "Невірний логін або пароль"}), 401
    
    user = user_data[0] # user = {'id': 1, 'password_hash': '...'}

    # 2. Перевіряємо хеш пароля
    if check_password_hash(user['password_hash'], password):
        # 3. Створюємо токен
        # Ми "запам'ятовуємо" ID користувача всередині токена
        access_token = create_access_token(identity=str(user['id'])) # <--- ✅ ВИПРАВЛЕНО
        return jsonify(access_token=access_token)
    else:
        return jsonify({"error": "Невірний логін або пароль"}), 401

def fetch_query(query, params=None):
    """Виконує запит і повертає результат у вигляді списку словників."""
    conn = get_db_connection()
    if not conn:
        return None, "Помилка підключення до БД"

    results = []
    try:
        cursor = conn.cursor()
        cursor.execute(query, params or ())
        
        # Перетворюємо результат у список словників
        columns = [desc[0] for desc in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
    except Exception as e:
        print(f"Помилка запиту до БД: {e}")
        return None, f"Помилка запиту до БД: {e}"
    finally:
        if conn:
            conn.close()
            
    return results, None

# Нова функція для виконання CUD (Create, Update, Delete) запитів
def db_execute(query, params=None):
    """Виконує запит (INSERT, UPDATE, DELETE) і повертає успішність."""
    conn = get_db_connection()
    if not conn:
        return False, "Помилка підключення до БД"
    
    try:
        cursor = conn.cursor()
        cursor.execute(query, params or ())
        conn.commit() # <--- Важливо: підтверджуємо зміни
        cursor.close()
    except Exception as e:
        print(f"Помилка запиту до БД: {e}")
        conn.rollback() # <--- Важливо: відкочуємо зміни при помилці
        return False, f"Помилка запиту до БД: {e}"
    finally:
        if conn:
            conn.close()
            
    return True, None # Повертаємо успіх

# --- МАРШРУТИ API ---

@app.route('/')
def index():
    try:
        # Використовуємо вашу власну функцію для отримання даних
        query = "SELECT id, name, country, logo_url FROM brands ORDER BY name ASC"
        brands, error = fetch_query(query)
        
        if error:
            # Якщо сталася помилка з базою даних
            return f"Помилка отримання даних з БД: {error}", 500
        
        # Відмальовуємо HTML-шаблон 'index.html' і передаємо в нього бренди
        return render_template('main.html', brands=brands)
        
    except Exception as e:
        # Загальна помилка, якщо щось пішло не так
        return f"Сталася помилка сервера: {str(e)}", 500

# 1. Отримати всі марки
@app.route('/api/brands')
def get_all_brands():
    query = "SELECT id, name, country, logo_url FROM brands ORDER BY name ASC" # Додано logo_url
    brands, error = fetch_query(query)
    if error:
        return jsonify({"error": error}), 500
    return jsonify(brands)

# 2. Отримати моделі для конкретної марки (за її ID)
@app.route('/api/brands/<int:brand_id>/models')
def get_models_by_brand(brand_id):
    query = "SELECT id, name, image_url, year_start, year_end FROM models WHERE brand_id = %s ORDER BY name ASC"
    models, error = fetch_query(query, (brand_id,))
    if error:
        return jsonify({"error": error}), 500
    return jsonify(models)

# 3. Отримати покоління для конкретної моделі (за її ID)
@app.route('/api/models/<int:model_id>/generations')
def get_generations_by_model(model_id):
    # Сортуємо за роком початку (новіші перші)
    query = "SELECT id, name, year_start, year_end, body_style, image_url FROM generations g WHERE model_id = %s ORDER BY year_start DESC, name ASC"
    generations, error = fetch_query(query, (model_id,))
    if error:
        return jsonify({"error": error}), 500
    return jsonify(generations)

# 4. Отримати комплектації для конкретного покоління (з пагінацією)
@app.route('/api/generations/<int:generation_id>/trims')
def get_trims_by_generation(generation_id):
    
    # 1. Отримуємо параметри сторінки з URL (напр., ?page=1&limit=15)
    try:
        # Встановлюємо значення за замовчуванням
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 15))
    except ValueError:
        page = 1
        limit = 15
        
    # 2. Розраховуємо OFFSET (зсув) для SQL
    offset = (page - 1) * limit
    
    # 3. Нам потрібно виконати ДВА запити
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500
        
    try:
        cursor = conn.cursor()
        
        # --- ЗАПИТ 1: Рахуємо ЗАГАЛЬНУ кількість авто ---
        # Це потрібно, щоб знати, скільки всього сторінок
        cursor.execute("SELECT COUNT(*) FROM trims WHERE generation_id = %s", (generation_id,))
        total_items = cursor.fetchone()[0]
        
        # Розраховуємо загальну кількість сторінок
        total_pages = math.ceil(total_items / limit) if total_items > 0 else 1
        
        # --- ЗАПИТ 2: Отримуємо "порцію" авто ---
        # Використовуємо LIMIT (скільки) та OFFSET (звідки почати)
        query = """
            SELECT * FROM trims 
            WHERE generation_id = %s 
            ORDER BY year DESC, name ASC
            LIMIT %s OFFSET %s
        """
        params = (generation_id, limit, offset)
        
        cursor.execute(query, params)
        
        # Перетворюємо результат у список словників
        columns = [desc[0] for desc in cursor.description]
        items = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
    except Exception as e:
        print(f"Помилка запиту до БД (trims): {e}")
        return jsonify({"error": f"Помилка запиту до БД: {e}"}), 500
    finally:
        if conn:
            conn.close()
            
    # 4. Повертаємо новий об'єкт з даними пагінації
    return jsonify({
        "items": items,                 # Список авто на поточній сторінці
        "total_items": total_items,     # Загальна кількість авто
        "total_pages": total_pages,     # Загальна кількість сторінок
        "current_page": page            # Поточна сторінка
    })

# 5. Отримати повну інформацію про одну комплектацію (за її ID)
@app.route('/api/trims/<int:trim_id>')
def get_trim_details(trim_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500

    try:
        # Використовуємо DictCursor, щоб отримувати результати як словники
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # --- ЗАПИТ 1: Отримуємо основні дані про комплектацію ---
        # (Це ваш існуючий запит, він правильний, оскільки t.* забирає всі нові колонки)
        query_trim = """
            SELECT t.*, g.name as generation_name, g.year_start, g.year_end,
                   m.id as model_id, m.name as model_name,
                   b.id as brand_id, b.name as make_name, b.country
            FROM trims t
            JOIN generations g ON t.generation_id = g.id
            JOIN models m ON g.model_id = m.id
            JOIN brands b ON m.brand_id = b.id
            WHERE t.id = %s
        """
        cursor.execute(query_trim, (trim_id,))
        trim_data_row = cursor.fetchone()

        if not trim_data_row:
            cursor.close()
            conn.close()
            return jsonify({"error": "Комплектацію не знайдено"}), 404

        # Перетворюємо DictRow на звичайний словник, щоб його можна було змінити
        trim_data = dict(trim_data_row)

        # --- ЗАПИТ 2: Отримуємо галерею зображень ---
        query_images = """
            SELECT image_url 
            FROM trim_images 
            WHERE trim_id = %s 
            ORDER BY sort_order ASC
        """
        cursor.execute(query_images, (trim_id,))
        images_rows = cursor.fetchall()
        
        # Додаємо список URL зображень до нашого об'єкта
        # Якщо в галереї нічого немає, використовуємо головне зображення
        if images_rows:
            trim_data['images'] = [row['image_url'] for row in images_rows]
        elif trim_data.get('image_url'):
            trim_data['images'] = [trim_data['image_url']]
        else:
            trim_data['images'] = [] # Порожній список, якщо фото немає
            
        cursor.close()
        
    except Exception as e:
        print(f"Помилка запиту до БД (trim details): {e}")
        return jsonify({"error": f"Помилка запиту до БД: {e}"}), 500
    finally:
        if conn:
            conn.close()
            
    # Повертаємо один об'єкт з усіма даними
    return jsonify(trim_data)


# 6. Отримати останні додані комплектації
@app.route('/api/trims/latest')
def get_latest_trims():
    limit = 6 # Скільки останніх авто показувати
    # Обираємо всі колонки, сортуємо за ID в зворотньому порядку і беремо перші 'limit'
    # Нам також потрібні назви марки та моделі, тому використовуємо JOIN
    # Оновлений запит в get_latest_trims (app.py)
    query = """
        SELECT t.*, g.name as generation_name, g.year_start, g.year_end,
            m.id as model_id, m.name as model_name,
            b.id as brand_id, b.name as make_name, b.country
        FROM trims t
        JOIN generations g ON t.generation_id = g.id
        JOIN models m ON g.model_id = m.id
        JOIN brands b ON m.brand_id = b.id
        ORDER BY t.id DESC
        LIMIT %s
    """
    latest_trims, error = fetch_query(query, (limit,))
    if error:
        return jsonify({"error": error}), 500
    return jsonify(latest_trims)


# 7. Глобальний пошук за марками та моделями
@app.route('/api/search')
def search_cars():
    # Отримуємо пошуковий запит з URL (?q=...)
    query_param = request.args.get('q', '').strip()
    results = []

    if len(query_param) < 2: # Не шукаємо надто короткі запити
        return jsonify(results)

    search_term = f"%{query_param}%" # Додаємо '%' для пошуку підрядка

    try:
        conn = get_db_connection()
        if not conn:
             return jsonify({"error": "Помилка підключення до БД"}), 500
        cursor = conn.cursor()

        # Шукаємо збіги в марках
        cursor.execute("""
            SELECT id, name, 'brand' as type, country
            FROM brands
            WHERE name ILIKE %s
            ORDER BY name ASC
            LIMIT 5
        """, (search_term,))
        # Додаємо результати до загального списку
        columns = [desc[0] for desc in cursor.description]
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))

        # Шукаємо збіги в моделях (разом з назвою марки)
        cursor.execute("""
            SELECT m.id, m.name, 'model' as type, b.name as brand_name, b.id as brand_id
            FROM models m
            JOIN brands b ON m.brand_id = b.id
            WHERE m.name ILIKE %s
            ORDER BY b.name ASC, m.name ASC
            LIMIT 10
        """, (search_term,))
        columns = [desc[0] for desc in cursor.description]
        for row in cursor.fetchall():
            # Додаємо лише якщо ще не перевищили ліміт
            if len(results) < 15:
                 results.append(dict(zip(columns, row)))

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Помилка пошуку: {e}")
        return jsonify({"error": f"Помилка пошуку: {e}"}), 500

    # Можна ще додати пошук по trims, якщо потрібно

    return jsonify(results) # Повертаємо змішаний список марок та моделей


# Не забудьте додати 'request' до імпортів Flask на початку файлу!
# from flask import Flask, jsonify, request


# 8. Розширений пошук (з пагінацією)
@app.route('/api/search/advanced')
def advanced_search():
    # --- 1. Збираємо фільтри та параметри пагінації ---
    filters = {
        'make': request.args.get('make'),
        'body_type': request.args.get('body_type'),
        'fuel': request.args.get('fuel'),
        'drive': request.args.get('drive'),
        'year_from': request.args.get('year_from', type=int),
        'year_to': request.args.get('year_to', type=int),
        'power_from': request.args.get('power_from', type=int),
        'power_to': request.args.get('power_to', type=int)
    }
    
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 15)) # Використаємо 15 за замовчуванням
    except ValueError:
        page = 1
        limit = 15
        
    offset = (page - 1) * limit

    # --- 2. Будуємо SQL-запит динамічно ---
    # Нам потрібні JOIN-и для фільтрації по 'make' (b.name)
    base_query_from_joins = """
        FROM trims t
        JOIN generations g ON t.generation_id = g.id
        JOIN models m ON g.model_id = m.id
        JOIN brands b ON m.brand_id = b.id
    """
    
    where_clauses = []
    params = []

    if filters['make']:
        where_clauses.append("b.name = %s")
        params.append(filters['make'])
    if filters['body_type']:
        where_clauses.append("t.body_type = %s")
        params.append(filters['body_type'])
    if filters['fuel']:
        where_clauses.append("t.fuel = %s")
        params.append(filters['fuel'])
    if filters['drive']:
        where_clauses.append("t.drive = %s")
        params.append(filters['drive'])
    if filters['year_from']:
        where_clauses.append("t.year >= %s")
        params.append(filters['year_from'])
    if filters['year_to']:
        where_clauses.append("t.year <= %s")
        params.append(filters['year_to'])
    if filters['power_from']:
        where_clauses.append("t.power_hp >= %s")
        params.append(filters['power_from'])
    if filters['power_to']:
        where_clauses.append("t.power_hp <= %s")
        params.append(filters['power_to'])

    # Збираємо WHERE частину
    where_sql = ""
    if where_clauses:
        where_sql = " WHERE " + " AND ".join(where_clauses)

    # --- 3. Виконуємо два запити ---
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500
        
    try:
        cursor = conn.cursor()
        
        # --- ЗАПИТ 1: Рахуємо ЗАГАЛЬНУ кількість ---
        count_query = "SELECT COUNT(t.id) " + base_query_from_joins + where_sql
        cursor.execute(count_query, tuple(params)) # Параметри тут ті самі
        total_items = cursor.fetchone()[0]
        total_pages = math.ceil(total_items / limit) if total_items > 0 else 1
        
        # --- ЗАПИТ 2: Отримуємо "порцію" авто ---
        select_query = """
            SELECT t.*, g.name as generation_name, g.year_start, g.year_end,
                   m.id as model_id, m.name as model_name,
                   b.id as brand_id, b.name as make_name, b.country
        """
        
        query = select_query + base_query_from_joins + where_sql
        query += " ORDER BY b.name, m.name, t.year DESC" # Сортування
        query += " LIMIT %s OFFSET %s" # Пагінація
        
        # Додаємо параметри пагінації до списку
        params_with_pagination = tuple(params) + (limit, offset)
        
        cursor.execute(query, params_with_pagination)
        
        columns = [desc[0] for desc in cursor.description]
        items = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
    except Exception as e:
        print(f"Помилка розширеного пошуку: {e}")
        return jsonify({"error": f"Помилка розширеного пошуку: {e}"}), 500
    finally:
        if conn:
            conn.close()

    # --- 4. Повертаємо новий об'єкт ---
    return jsonify({
        "items": items,
        "total_items": total_items,
        "total_pages": total_pages,
        "current_page": page
    })


# 9. Отримати схожі комплектації
@app.route('/api/trims/<int:trim_id>/similar')
def get_similar_trims(trim_id):
    limit = 4 # Скільки схожих авто показувати

    # Спочатку отримуємо дані поточного авто, щоб знати його тип кузова та рік
    current_trim, error = fetch_query("SELECT body_type, year FROM trims WHERE id = %s", (trim_id,))
    if error or not current_trim:
        return jsonify({"error": "Не вдалося знайти поточну комплектацію"}), 404

    current_body_type = current_trim[0]['body_type']
    current_year = current_trim[0]['year']

    # Шукаємо інші авто з тим же типом кузова та роком +/- 2
    query = """
        SELECT t.id, t.year, t.name, t.engine,
               m.name as model_name, b.name as make_name,
               -- Додаємо всі ID та імена для формування посилання на клієнті
               m.id as model_id, b.id as brand_id, g.id as generation_id,
               g.name as generation_name, g.year_start, g.year_end
        FROM trims t
        JOIN generations g ON t.generation_id = g.id
        JOIN models m ON g.model_id = m.id
        JOIN brands b ON m.brand_id = b.id
        WHERE t.id != %s AND t.body_type = %s AND t.year BETWEEN %s AND %s
        ORDER BY ABS(t.year - %s) -- Сортуємо за близькістю року
        LIMIT %s
    """
    params = (trim_id, current_body_type, current_year - 2, current_year + 2, current_year, limit)

    similar_trims, error = fetch_query(query, params)
    if error:
        return jsonify({"error": error}), 500

    return jsonify(similar_trims)


@app.route('/api/auth/register', methods=['POST'])
def register_user():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"error": "Потрібно заповнити всі поля"}), 400

    # 1. Перевіряємо, чи користувач вже існує
    existing_user, _ = fetch_query("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
    if existing_user:
        return jsonify({"error": "Користувач з таким логіном або email вже існує"}), 409

    # 2. Хешуємо пароль
    hashed_password = generate_password_hash(password)

    # 3. Зберігаємо в БД
    query = "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)"
    success, error = db_execute(query, (username, email, hashed_password))

    if not success:
        return jsonify({"error": error}), 500

    return jsonify({"message": "Користувач успішно зареєстрований"}), 201

# 1. ОТРИМАТИ список ID обраних для поточного користувача
@app.route('/api/me/favorites/ids', methods=['GET'])
@jwt_required()
def get_user_favorite_ids():
    # Дістаємо ID користувача, який "зашитий" у токені
    current_user_id = get_jwt_identity() 
    
    query = "SELECT trim_id FROM user_favorites WHERE user_id = %s"
    results, error = fetch_query(query, (current_user_id,))
    
    if error:
        return jsonify({"error": error}), 500
        
    # Повертаємо простий масив ID, наприклад: [101, 305, 40]
    favorite_ids = [row['trim_id'] for row in results]
    return jsonify(favorite_ids)

# 2. ДОДАТИ авто до обраного
@app.route('/api/me/favorites', methods=['POST'])
@jwt_required()
def add_favorite():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    trim_id = data.get('trim_id')

    if not trim_id:
        return jsonify({"error": "trim_id не надано"}), 400

    # "ON CONFLICT DO NOTHING" - безпечна команда, 
    # вона просто нічого не зробить, якщо такий запис вже є
    query = "INSERT INTO user_favorites (user_id, trim_id) VALUES (%s, %s) ON CONFLICT DO NOTHING"
    success, error = db_execute(query, (current_user_id, trim_id))

    if not success:
        return jsonify({"error": error}), 500
    
    return jsonify({"message": "Додано до обраного"}), 201 # 201 = Created

# 3. ВИДАЛИТИ авто з обраного
@app.route('/api/me/favorites/<int:trim_id>', methods=['DELETE'])
@jwt_required()
def remove_favorite(trim_id):
    current_user_id = get_jwt_identity()
    
    query = "DELETE FROM user_favorites WHERE user_id = %s AND trim_id = %s"
    success, error = db_execute(query, (current_user_id, trim_id))
    
    if not success:
        return jsonify({"error": error}), 500

    return jsonify({"message": "Видалено з обраного"}), 200


@app.route('/api/generations/<int:generation_id>/details')
def get_generation_details(generation_id):

    # 1. Отримуємо параметри пагінації для комплектацій
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 15)) # Або інше значення за замовчуванням
    except ValueError:
        page = 1
        limit = 15
    offset = (page - 1) * limit

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500

    try:
        # Використовуємо DictCursor для зручного доступу до полів
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # --- ЗАПИТ 1: Основні дані покоління (з нової колонки description) ---
        cursor.execute("""
            SELECT g.*, g.name as generation_name,
                   m.id as model_id, m.name as model_name,
                   b.id as brand_id, b.name as make_name
            FROM generations g
            JOIN models m ON g.model_id = m.id
            JOIN brands b ON m.brand_id = b.id
            WHERE g.id = %s
        """, (generation_id,))
        generation_data = cursor.fetchone()

        if not generation_data:
            cursor.close()
            conn.close()
            return jsonify({"error": "Покоління не знайдено"}), 404

        # Перетворюємо на звичайний dict, щоб додавати ключі
        result = dict(generation_data)

        # --- ЗАПИТ 2: Галерея фото покоління ---
        cursor.execute("SELECT image_url FROM generation_images WHERE generation_id = %s ORDER BY sort_order ASC", (generation_id,))
        images_rows = cursor.fetchall()

        # Додаємо головне фото (з таблиці generations) на початок списку
        main_image_url = result.get('image_url')
        image_list = [row['image_url'] for row in images_rows]
        if main_image_url:
            image_list.insert(0, main_image_url)

        # Якщо фото взагалі немає, додаємо заглушку
        if not image_list:
             image_list.append(f"https://via.placeholder.com/800x500?text={result['make_name']}+{result['model_name']}")

        result['images'] = image_list

        # --- ЗАПИТ 3: Відеоогляди покоління ---
        cursor.execute("SELECT title, youtube_video_id FROM generation_videos WHERE generation_id = %s ORDER BY sort_order ASC", (generation_id,))
        result['videos'] = [dict(row) for row in cursor.fetchall()]

        # --- ЗАПИТ 4: Рахуємо загальну кількість КОМПЛЕКТАЦІЙ ---
        cursor.execute("SELECT COUNT(*) FROM trims WHERE generation_id = %s", (generation_id,))
        total_items = cursor.fetchone()[0]
        total_pages = math.ceil(total_items / limit) if total_items > 0 else 1

        # --- ЗАПИТ 5: Отримуємо "порцію" КОМПЛЕКТАЦІЙ ---
        query_trims = """
            SELECT * FROM trims 
            WHERE generation_id = %s 
            ORDER BY name ASC, year DESC
            LIMIT %s OFFSET %s
        """
        cursor.execute(query_trims, (generation_id, limit, offset))
        trims_list = [dict(row) for row in cursor.fetchall()]

        # --- Збираємо все в один об'єкт ---
        result['trims_pagination'] = {
            "items": trims_list,
            "total_items": total_items,
            "total_pages": total_pages,
            "current_page": page
        }

        cursor.close()

    except Exception as e:
        print(f"Помилка запиту до БД (generation details): {e}")
        return jsonify({"error": f"Помилка запиту до БД: {e}"}), 500
    finally:
        if conn:
            conn.close()

    return jsonify(result)


@app.route('/api/forum/topics', methods=['GET'])
def get_forum_topics():
    """
    Отримує список всіх тем форуму.
    """
    # Цей запит об'єднує теми з користувачами (щоб отримати ім'я автора)
    # і підраховує кількість постів у кожній темі.
    # (COUNT(*) - 1) - це кількість *відповідей*, оскільки перший пост - це сама тема.
    query = """
        SELECT 
            t.id, 
            t.title, 
            t.created_at,
            u.username AS author_username,
            (SELECT COUNT(*) FROM forum_posts p WHERE p.topic_id = t.id) - 1 AS post_count
        FROM 
            forum_topics t
        JOIN 
            users u ON t.user_id = u.id
        ORDER BY 
            t.created_at DESC;
    """
    topics, error = fetch_query(query)
    
    if error:
        print(f"Помилка завантаження тем: {error}")
        return jsonify({"error": str(error)}), 500
        
    return jsonify(topics)

@app.route('/api/forum/topics', methods=['POST'])
@jwt_required() # Захищаємо маршрут, лише залогінені користувачі можуть створювати теми
def create_forum_topic():
    """
    Створює нову тему форуму та перший пост у ній.
    """
    current_user_id = get_jwt_identity()
    data = request.get_json()
    title = data.get('title')
    content = data.get('content') # Це текст першого повідомлення

    if not title or not content:
        return jsonify({"error": "Заголовок та повідомлення не можуть бути порожніми"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500
        
    try:
        cursor = conn.cursor()
        
        # 1. Створюємо саму тему в таблиці forum_topics
        cursor.execute(
            "INSERT INTO forum_topics (title, user_id) VALUES (%s, %s) RETURNING id",
            (title, current_user_id)
        )
        # Отримуємо ID щойно створеної теми
        new_topic_id = cursor.fetchone()[0]
        
        # 2. Додаємо перше повідомлення в таблицю forum_posts
        cursor.execute(
            "INSERT INTO forum_posts (content, user_id, topic_id) VALUES (%s, %s, %s)",
            (content, current_user_id, new_topic_id)
        )
        
        conn.commit() # Підтверджуємо обидві операції
        cursor.close()
    except Exception as e:
        conn.rollback() # Відкочуємо зміни, якщо сталася помилка
        print(f"Помилка створення теми: {e}")
        return jsonify({"error": "Внутрішня помилка сервера при створенні теми"}), 500
    finally:
        if conn:
            conn.close()
            
    # Повертаємо 201 (Created)
    return jsonify({"message": "Тему успішно створено", "topic_id": new_topic_id}), 201


@app.route('/api/forum/topics/<int:topic_id>', methods=['GET'])
def get_topic_details(topic_id):
    """
    Отримує деталі однієї теми (заголовок) та всі повідомлення в ній.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # 1. Отримуємо основну інформацію про тему
        cursor.execute(
            """
            SELECT t.id, t.title, t.created_at, u.username AS author_username
            FROM forum_topics t
            JOIN users u ON t.user_id = u.id
            WHERE t.id = %s
            """,
            (topic_id,)
        )
        topic_data = cursor.fetchone()
        
        if not topic_data:
            cursor.close()
            conn.close()
            return jsonify({"error": "Тему не знайдено"}), 404

        # 2. Отримуємо всі повідомлення (пости) для цієї теми
        cursor.execute(
            """
            SELECT p.id, p.content, p.created_at, u.username AS author_username
            FROM forum_posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.topic_id = %s
            ORDER BY p.created_at ASC
            """,
            (topic_id,)
        )
        posts_data = [dict(row) for row in cursor.fetchall()]
        
        cursor.close()
        
        # Збираємо все в один об'єкт
        result = dict(topic_data)
        result['posts'] = posts_data
        
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/forum/topics/<int:topic_id>/reply', methods=['POST'])
@jwt_required()
def add_post_to_topic(topic_id):
    """
    Додає нове повідомлення (відповідь) до існуючої теми.
    """
    current_user_id = get_jwt_identity()
    data = request.get_json()
    content = data.get('content')

    if not content:
        return jsonify({"error": "Повідомлення не може бути порожнім"}), 400

    # Перевіримо, чи тема взагалі існує (опціонально, але бажано)
    topic_check, _ = fetch_query("SELECT id FROM forum_topics WHERE id = %s", (topic_id,))
    if not topic_check:
        return jsonify({"error": "Тему, до якої ви намагаєтесь відповісти, не знайдено"}), 404

    # Додаємо пост
    query = "INSERT INTO forum_posts (content, user_id, topic_id) VALUES (%s, %s, %s)"
    success, error = db_execute(query, (content, current_user_id, topic_id))

    if not success:
        return jsonify({"error": error}), 500

    return jsonify({"message": "Відповідь успішно додано"}), 201


@app.route('/api/me/account', methods=['GET'])
@jwt_required()
def get_my_account_details():
    """
    Отримує основні дані профілю та статистику.
    """
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500
        
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # 1. Дані користувача
        cursor.execute("SELECT username, email FROM users WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()
        
        if not user_data:
            return jsonify({"error": "Користувача не знайдено"}), 404
            
        # 2. Статистика
        cursor.execute("SELECT COUNT(*) AS topic_count FROM forum_topics WHERE user_id = %s", (user_id,))
        topic_count = cursor.fetchone()['topic_count']
        
        cursor.execute("SELECT COUNT(*) AS post_count FROM forum_posts WHERE user_id = %s", (user_id,))
        post_count = cursor.fetchone()['post_count']
        
        cursor.close()
        
        return jsonify({
            "user": dict(user_data),
            "stats": {
                "topic_count": topic_count,
                "post_count": post_count
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/me/topics', methods=['GET'])
@jwt_required()
def get_my_topics():
    """
    Отримує список тем, створених поточним користувачем.
    """
    user_id = get_jwt_identity()
    query = """
        SELECT id, title, created_at, (SELECT COUNT(*) FROM forum_posts p WHERE p.topic_id = t.id) - 1 AS post_count
        FROM forum_topics t
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 20;
    """
    topics, error = fetch_query(query, (user_id,))
    
    if error:
        return jsonify({"error": str(error)}), 500
        
    return jsonify(topics)
    
@app.route('/api/me/account/password', methods=['PUT'])
@jwt_required()
def update_my_password():
    """
    Оновлює пароль поточного користувача.
    """
    user_id = get_jwt_identity()
    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if not old_password or not new_password:
        return jsonify({"error": "Потрібно вказати старий та новий паролі"}), 400

    # 1. Отримуємо поточний хеш
    user_data, error = fetch_query("SELECT password_hash FROM users WHERE id = %s", (user_id,))
    if error or not user_data:
        return jsonify({"error": "Користувача не знайдено"}), 404

    current_hash = user_data[0]['password_hash']
    
    # 2. Перевіряємо старий пароль
    if not check_password_hash(current_hash, old_password):
        return jsonify({"error": "Невірний старий пароль"}), 403

    # 3. Оновлюємо на новий
    new_hash = generate_password_hash(new_password)
    success, error = db_execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
    
    if not success:
        return jsonify({"error": error}), 500
        
    return jsonify({"message": "Пароль успішно оновлено"})



@app.route('/api/me/account/email', methods=['PUT'])
@jwt_required()
def update_my_email():
    """
    Оновлює email поточного користувача.
    """
    user_id = get_jwt_identity()
    data = request.get_json()
    new_email = data.get('new_email')
    password = data.get('password')

    if not new_email or not password:
        return jsonify({"error": "Потрібно вказати новий email та поточний пароль"}), 400
        
    # 1. Перевіряємо, чи не зайнятий новий email
    existing_user, _ = fetch_query("SELECT id FROM users WHERE email = %s AND id != %s", (new_email, user_id))
    if existing_user:
        return jsonify({"error": "Цей email вже використовується іншим акаунтом"}), 409

    # 2. Перевіряємо пароль
    user_data, error = fetch_query("SELECT password_hash FROM users WHERE id = %s", (user_id,))
    if not check_password_hash(user_data[0]['password_hash'], password):
        return jsonify({"error": "Невірний пароль"}), 403
        
    # 3. Оновлюємо email
    success, error = db_execute("UPDATE users SET email = %s WHERE id = %s", (new_email, user_id))
    
    if not success:
        return jsonify({"error": error}), 500
        
    return jsonify({"message": "Email успішно оновлено", "new_email": new_email})



@app.route('/api/forum/posts/<int:post_id>', methods=['DELETE'])
@jwt_required()
def delete_forum_post(post_id):
    current_user_id = int(get_jwt_identity()) # Переконуємось, що це число

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # 1. Отримуємо пост і перевіряємо, чи належить він користувачу
        cursor.execute(
            "SELECT user_id, topic_id FROM forum_posts WHERE id = %s", 
            (post_id,)
        )
        post = cursor.fetchone()

        if not post:
            return jsonify({"error": "Пост не знайдено"}), 404

        if post['user_id'] != current_user_id:
            return jsonify({"error": "Ви не можете видалити чужий пост"}), 403 # Forbidden

        # 2. Перевіряємо, чи це перший пост (тобто, чи треба видаляти всю тему)
        cursor.execute(
            "SELECT MIN(id) AS first_post_id FROM forum_posts WHERE topic_id = %s",
            (post['topic_id'],)
        )
        first_post_id = cursor.fetchone()['first_post_id']

        if post_id == first_post_id:
            # Це перший пост. Видаляємо всю тему (ON DELETE CASCADE в БД видалить пости)
            cursor.execute(
                "DELETE FROM forum_topics WHERE id = %s", 
                (post['topic_id'],)
            )
            message = "Тему (та всі відповіді) успішно видалено"
        else:
            # Це просто відповідь. Видаляємо один пост.
            cursor.execute(
                "DELETE FROM forum_posts WHERE id = %s", 
                (post_id,)
            )
            message = "Відповідь успішно видалено"

        conn.commit()
        cursor.close()
        
        return jsonify({"message": message})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


# --- Шлях до файлу для зберігання "автомобіля дня" ---
CAR_OF_THE_DAY_FILE = "car_of_the_day.json"

@app.route('/api/car-of-the-day')
def get_car_of_the_day():
    """
    Отримує "Автомобіль дня". Вибирає новий, якщо дата змінилася.
    """
    today = date.today().isoformat() # Отримуємо поточну дату як 'YYYY-MM-DD'
    current_data = {"date": None, "trim_id": None}
    
    # 1. Спробуємо прочитати збережені дані
    if os.path.exists(CAR_OF_THE_DAY_FILE):
        try:
            with open(CAR_OF_THE_DAY_FILE, 'r') as f:
                current_data = json.load(f)
        except Exception as e:
            print(f"Помилка читання {CAR_OF_THE_DAY_FILE}: {e}")
            # Продовжуємо, ніби файлу не було

    selected_trim_id = None
    
    # 2. Перевіряємо дату
    if current_data.get("date") == today and current_data.get("trim_id"):
        # Дата та сама, використовуємо збережений ID
        selected_trim_id = current_data["trim_id"]
        print(f"Використовуємо кешований Автомобіль дня ID: {selected_trim_id}")
    else:
        # Дата змінилася або даних немає. Вибираємо новий автомобіль.
        print("Вибираємо новий Автомобіль дня...")
        conn = get_db_connection()
        if not conn:
             return jsonify({"error": "Помилка підключення до БД"}), 500
        try:
            cursor = conn.cursor()
            # Вибираємо випадковий ID з таблиці trims
            # Важливо: Це може бути повільно на дуже великих таблицях!
            # Альтернатива: отримати COUNT(*), згенерувати випадкове число N,
            # вибрати запис з OFFSET N LIMIT 1.
            cursor.execute("SELECT id FROM trims ORDER BY RANDOM() LIMIT 1")
            result = cursor.fetchone()
            cursor.close()
            
            if result:
                selected_trim_id = result[0]
                # Зберігаємо новий вибір у файл
                try:
                    with open(CAR_OF_THE_DAY_FILE, 'w') as f:
                        json.dump({"date": today, "trim_id": selected_trim_id}, f)
                    print(f"Збережено новий Автомобіль дня ID: {selected_trim_id} на дату {today}")
                except Exception as e:
                    print(f"Помилка збереження {CAR_OF_THE_DAY_FILE}: {e}")
            else:
                 return jsonify({"error": "Не вдалося вибрати автомобіль дня (база порожня?)"}), 404
                 
        except Exception as e:
             return jsonify({"error": str(e)}), 500
        finally:
            if conn:
                conn.close()

    # 3. Завантажуємо повні дані для обраного ID
    if selected_trim_id:
        # Використовуємо JOIN, щоб отримати назви марки/моделі
        query = """
            SELECT t.*, g.name as generation_name, g.year_start, g.year_end,
                   m.id as model_id, m.name as model_name,
                   b.id as brand_id, b.name as make_name, b.country
            FROM trims t
            JOIN generations g ON t.generation_id = g.id
            JOIN models m ON g.model_id = m.id
            JOIN brands b ON m.brand_id = b.id
            WHERE t.id = %s
        """
        car_data, error = fetch_query(query, (selected_trim_id,))
        
        if error:
            return jsonify({"error": error}), 500
        if not car_data:
            # Можливо, автомобіль видалили з бази після того, як його обрали.
            # Видалимо файл кешу, щоб наступного разу обрати новий.
            if os.path.exists(CAR_OF_THE_DAY_FILE):
                os.remove(CAR_OF_THE_DAY_FILE)
            return jsonify({"error": "Автомобіль дня не знайдено в базі даних"}), 404
            
        return jsonify(car_data[0]) # Повертаємо один об'єкт автомобіля
    else:
        # Сюди ми не повинні потрапити, але про всяк випадок
        return jsonify({"error": "Не вдалося визначити автомобіль дня"}), 500


# --- ЗАПУСК СЕРВЕРА ---
if __name__ == '__main__':
    # debug=True автоматично перезавантажує сервер при зміні коду
    # port=5000 вказує порт для бекенду
    app.run(debug=True, port=5000)