from flask import Flask, jsonify, request
from flask_cors import CORS 
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, JWTManager
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2
import psycopg2.extras
import json
import os
import random 
import math 
from datetime import date, datetime, timezone
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from werkzeug.utils import secure_filename
from datetime import date, datetime, timezone, timedelta
from werkzeug.utils import secure_filename
import re

# --- ІМПОРТИ ДЛЯ НОВИН ---
import requests 
import trafilatura # <--- ВИКОРИСТОВУЄМО ЦЮ БІБЛІОТЕКУ ЗАМІСТЬ NEWSPAPER
import base64
import hashlib
# -------------------------

app = Flask(__name__)

# --- ВСТАВИТИ ЦЕЙ БЛОК НА ПОЧАТКУ ФАЙЛУ ---

# Налаштування папки для завантажень
UPLOAD_FOLDER = 'static/uploads/avatars'
# Дозволені розширення файлів
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['MARKET_UPLOAD_FOLDER'] = 'static/uploads/market'
os.makedirs(app.config['MARKET_UPLOAD_FOLDER'], exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Створюємо папку, якщо вона ще не існує
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Функція перевірки розширення файлу
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# -------------------------------------------

# --- ЗАМІНИТИ СТАРЕ НАЛАШТУВАННЯ CORS НА ЦЕ ---
CORS(app, 
     resources={r"/*": {"origins": ["http://127.0.0.1:5500", "http://localhost:5500","https://rightwheel.onrender.com",'http://127.0.0.1:5000']}}, 
     allow_headers=["Content-Type", "Authorization"], 
     supports_credentials=True)
# ---------------------------------------------
# ... далі твій код ...
app.json.ensure_ascii = False
app.config['JSON_AS_ASCII'] = False
# === ДОДАЙТЕ ЦІ РЯДКИ ===
# Налаштування секретного ключа для JWT
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY") 

# Також бажано додати загальний ключ Flask (для сесій)
app.config["SECRET_KEY"] = os.getenv("JWT_SECRET_KEY") 
# ========================

jwt = JWTManager(app)

load_dotenv()

# --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ---

DATABASE_URL = os.getenv("DATABASE_URL")
# Наприклад:
# DATABASE_URL = "postgresql://postgres:mysecretpassword@localhost:5432/rightwheel_db"
# --- НАЛАШТУВАННЯ LIQPAY ---
LIQPAY_PUBLIC_KEY = os.getenv('LIQPAY_PUBLIC_KEY')
LIQPAY_PRIVATE_KEY = os.getenv('LIQPAY_PRIVATE_KEY')

# Перевірка (опціонально, щоб знати, якщо забули додати в .env)
if not LIQPAY_PUBLIC_KEY or not LIQPAY_PRIVATE_KEY:
    print("УВАГА: Ключі LiqPay не знайдені в .env файлі!")
# ---------------------------

# Допоміжні функції для LiqPay (щоб не тягнути бібліотеку)
def liqpay_encode(params):
    json_str = json.dumps(params)
    data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
    return data

def liqpay_sign(data, private_key):
    sign_str = private_key + data + private_key
    signature = base64.b64encode(hashlib.sha1(sign_str.encode('utf-8')).digest()).decode('utf-8')
    return signature

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

    # ОНОВЛЕНО: Дістаємо також avatar_url
    user_data, _ = fetch_query("SELECT id, password_hash, avatar_url FROM users WHERE username = %s", (username,))
    
    if not user_data:
        return jsonify({"error": "Невірний логін або пароль"}), 401
    
    user = user_data[0]

    if check_password_hash(user['password_hash'], password):
        access_token = create_access_token(identity=str(user['id']))
        # ОНОВЛЕНО: Повертаємо avatar_url
        return jsonify(
            access_token=access_token, 
            username=username,
            avatar_url=user['avatar_url'] 
        )
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
        
        if cursor.description:
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

def db_execute(query, params=None):
    """Виконує запит (INSERT, UPDATE, DELETE) і повертає успішність."""
    conn = get_db_connection()
    if not conn:
        return False, "Помилка підключення до БД"
    
    try:
        cursor = conn.cursor()
        cursor.execute(query, params or ())
        conn.commit()
        cursor.close()
    except Exception as e:
        print(f"Помилка запиту до БД: {e}")
        conn.rollback()
        return False, f"Помилка запиту до БД: {e}"
    finally:
        if conn:
            conn.close()
            
    return True, None

# --- МАРШРУТИ API ---

@app.route('/api/brands')
def get_all_brands():
    query = "SELECT id, name, country, logo_url FROM brands ORDER BY name ASC"
    brands, error = fetch_query(query)
    if error:
        return jsonify({"error": error}), 500
    return jsonify(brands)

@app.route('/api/brands/<int:brand_id>/models')
def get_models_by_brand(brand_id):
    # Беремо моделі і сортуємо за назвою
    query = "SELECT id, name, image_url, year_start, year_end FROM models WHERE brand_id = %s ORDER BY name ASC"
    models, error = fetch_query(query, (brand_id,))
    
    if error:
        print(f"Error fetching models: {error}")
        return jsonify({"error": error}), 500
        
    return jsonify(models)

@app.route('/api/models/<int:model_id>/generations')
def get_generations_by_model(model_id):
    # Беремо покоління, сортуємо від нових до старих
    query = """
        SELECT id, name, year_start, year_end, body_style, image_url 
        FROM generations 
        WHERE model_id = %s 
        ORDER BY year_start DESC
    """
    generations, error = fetch_query(query, (model_id,))
    
    if error:
        print(f"Error fetching generations: {error}")
        return jsonify({"error": error}), 500
        
    return jsonify(generations)

@app.route('/api/generations/<int:generation_id>/trims')
def get_trims_by_generation(generation_id):
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 15))
    except ValueError:
        page = 1
        limit = 15
        
    offset = (page - 1) * limit
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500
        
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM trims WHERE generation_id = %s", (generation_id,))
        total_items = cursor.fetchone()[0]
        total_pages = math.ceil(total_items / limit) if total_items > 0 else 1
        
        query = """
            SELECT * FROM trims 
            WHERE generation_id = %s 
            ORDER BY year DESC, name ASC
            LIMIT %s OFFSET %s
        """
        params = (generation_id, limit, offset)
        cursor.execute(query, params)
        
        columns = [desc[0] for desc in cursor.description]
        items = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
    except Exception as e:
        print(f"Помилка запиту до БД (trims): {e}")
        return jsonify({"error": f"Помилка запиту до БД: {e}"}), 500
    finally:
        if conn:
            conn.close()
            
    return jsonify({
        "items": items,
        "total_items": total_items,
        "total_pages": total_pages,
        "current_page": page
    })

@app.route('/api/trims/<int:trim_id>')
def get_trim_details(trim_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
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

        trim_data = dict(trim_data_row)

        query_images = "SELECT image_url FROM trim_images WHERE trim_id = %s ORDER BY sort_order ASC"
        cursor.execute(query_images, (trim_id,))
        images_rows = cursor.fetchall()
        
        if images_rows:
            trim_data['images'] = [row['image_url'] for row in images_rows]
        elif trim_data.get('image_url'):
            trim_data['images'] = [trim_data['image_url']]
        else:
            trim_data['images'] = []
            
        cursor.close()
        
    except Exception as e:
        print(f"Помилка запиту до БД (trim details): {e}")
        return jsonify({"error": f"Помилка запиту до БД: {e}"}), 500
    finally:
        if conn:
            conn.close()
            
    return jsonify(trim_data)

@app.route('/api/trims/latest')
def get_latest_trims():
    limit = 6
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

@app.route('/api/search')
def search_cars():
    query_param = request.args.get('q', '').strip()
    results = []

    if len(query_param) < 2:
        return jsonify(results)

    search_term = f"%{query_param}%"

    try:
        conn = get_db_connection()
        if not conn:
             return jsonify({"error": "Помилка підключення до БД"}), 500
        cursor = conn.cursor()

        # 1. Шукаємо БРЕНДИ
        cursor.execute("""
            SELECT id, name, NULL as image_url, 'Бренд' as extra_info, 'brand' as type
            FROM brands
            WHERE name ILIKE %s
            LIMIT 2
        """, (search_term,))
        columns = [desc[0] for desc in cursor.description]
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))

        # 2. Шукаємо МОДЕЛІ (Ось це додасть "Volvo S90" як загальну категорію)
        cursor.execute("""
            SELECT 
                m.id, 
                b.name || ' ' || m.name as name,
                m.image_url, 
                'Всі покоління' as extra_info,
                'model' as type,
                b.id as brand_id, b.name as brand_name
            FROM models m
            JOIN brands b ON m.brand_id = b.id
            WHERE m.name ILIKE %s OR (b.name || ' ' || m.name) ILIKE %s
            LIMIT 3
        """, (search_term, search_term))
        
        columns = [desc[0] for desc in cursor.description]
        for row in cursor.fetchall():
            res = dict(zip(columns, row))
            # Якщо у моделі немає фото, беремо перше фото з її поколінь або заглушку
            if not res['image_url']:
                 res['image_url'] = f"https://via.placeholder.com/60x40?text={res['name']}"
            results.append(res)

        # 3. Шукаємо конкретні ПОКОЛІННЯ
        cursor.execute("""
            SELECT 
                g.id, 
                b.name || ' ' || m.name || ' ' || COALESCE(g.name, '') as name,
                g.image_url,
                g.year_start || ' - ' || COALESCE(CAST(g.year_end AS VARCHAR), 'н.ч.') as extra_info,
                'generation' as type,
                b.id as brand_id, b.name as brand_name,
                m.id as model_id, m.name as model_name,
                g.name as generation_name
            FROM generations g
            JOIN models m ON g.model_id = m.id
            JOIN brands b ON m.brand_id = b.id
            WHERE (b.name || ' ' || m.name || ' ' || COALESCE(g.name, '')) ILIKE %s
            ORDER BY g.year_start DESC
            LIMIT 5
        """, (search_term,))
        
        columns = [desc[0] for desc in cursor.description]
        for row in cursor.fetchall():
            res = dict(zip(columns, row))
            if not res['image_url']:
                res['image_url'] = f"https://via.placeholder.com/60x40?text={res['brand_name']}"
            results.append(res)

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Помилка пошуку: {e}")
        return jsonify({"error": f"Помилка пошуку: {e}"}), 500

    return jsonify(results)

@app.route('/api/search/advanced')
def advanced_search():
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
        limit = int(request.args.get('limit', 15))
    except ValueError:
        page = 1
        limit = 15
        
    offset = (page - 1) * limit

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

    where_sql = ""
    if where_clauses:
        where_sql = " WHERE " + " AND ".join(where_clauses)

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500
        
    try:
        cursor = conn.cursor()
        
        count_query = "SELECT COUNT(t.id) " + base_query_from_joins + where_sql
        cursor.execute(count_query, tuple(params))
        total_items = cursor.fetchone()[0]
        total_pages = math.ceil(total_items / limit) if total_items > 0 else 1
        
        select_query = """
            SELECT t.*, g.name as generation_name, g.year_start, g.year_end,
                   m.id as model_id, m.name as model_name,
                   b.id as brand_id, b.name as make_name, b.country
        """
        
        query = select_query + base_query_from_joins + where_sql
        query += " ORDER BY b.name, m.name, t.year DESC"
        query += " LIMIT %s OFFSET %s"
        
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

    return jsonify({
        "items": items,
        "total_items": total_items,
        "total_pages": total_pages,
        "current_page": page
    })

@app.route('/api/trims/<int:trim_id>/similar')
def get_similar_trims(trim_id):
    limit = 4

    current_trim, error = fetch_query("SELECT body_type, year FROM trims WHERE id = %s", (trim_id,))
    if error or not current_trim:
        return jsonify({"error": "Не вдалося знайти поточну комплектацію"}), 404

    current_body_type = current_trim[0]['body_type']
    current_year = current_trim[0]['year']

    query = """
        SELECT t.id, t.year, t.name, t.engine, t.image_url, 
               m.name as model_name, b.name as make_name,
               m.id as model_id, b.id as brand_id, g.id as generation_id,
               g.name as generation_name, g.year_start, g.year_end
        FROM trims t
        JOIN generations g ON t.generation_id = g.id
        JOIN models m ON g.model_id = m.id
        JOIN brands b ON m.brand_id = b.id
        WHERE t.id != %s AND t.body_type = %s AND t.year BETWEEN %s AND %s
        ORDER BY ABS(t.year - %s)
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

    existing_user, _ = fetch_query("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
    if existing_user:
        return jsonify({"error": "Користувач з таким логіном або email вже існує"}), 409

    hashed_password = generate_password_hash(password)

    query = "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)"
    success, error = db_execute(query, (username, email, hashed_password))

    if not success:
        return jsonify({"error": error}), 500

    return jsonify({"message": "Користувач успішно зареєстрований"}), 201

@app.route('/api/me/favorites/ids', methods=['GET'])
@jwt_required()
def get_user_favorite_ids():
    current_user_id = get_jwt_identity() 
    
    query = "SELECT trim_id FROM user_favorites WHERE user_id = %s"
    results, error = fetch_query(query, (current_user_id,))
    
    if error:
        return jsonify({"error": error}), 500
        
    favorite_ids = [row['trim_id'] for row in results]
    return jsonify(favorite_ids)

@app.route('/api/me/favorites', methods=['POST'])
@jwt_required()
def add_favorite():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    trim_id = data.get('trim_id')

    if not trim_id:
        return jsonify({"error": "trim_id не надано"}), 400

    query = "INSERT INTO user_favorites (user_id, trim_id) VALUES (%s, %s) ON CONFLICT DO NOTHING"
    success, error = db_execute(query, (current_user_id, trim_id))

    if not success:
        return jsonify({"error": error}), 500
    
    return jsonify({"message": "Додано до обраного"}), 201

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
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 15))
    except ValueError:
        page = 1
        limit = 15
    offset = (page - 1) * limit

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

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

        result = dict(generation_data)

        cursor.execute("SELECT image_url FROM generation_images WHERE generation_id = %s ORDER BY sort_order ASC", (generation_id,))
        images_rows = cursor.fetchall()

        main_image_url = result.get('image_url')
        image_list = [row['image_url'] for row in images_rows]
        if main_image_url:
            image_list.insert(0, main_image_url)

        if not image_list:
             image_list.append(f"https://via.placeholder.com/800x500?text={result['make_name']}+{result['model_name']}")

        result['images'] = image_list

        cursor.execute("SELECT title, youtube_video_id FROM generation_videos WHERE generation_id = %s ORDER BY sort_order ASC", (generation_id,))
        result['videos'] = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT COUNT(*) FROM trims WHERE generation_id = %s", (generation_id,))
        total_items = cursor.fetchone()[0]
        total_pages = math.ceil(total_items / limit) if total_items > 0 else 1

        query_trims = """
            SELECT * FROM trims 
            WHERE generation_id = %s 
            ORDER BY name ASC, year DESC
            LIMIT %s OFFSET %s
        """
        cursor.execute(query_trims, (generation_id, limit, offset))
        trims_list = [dict(row) for row in cursor.fetchall()]

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

@app.route('/api/trims/latest')
def get_latest_trims_catalog():
    # Беремо останні 6 доданих комплектацій з Енциклопедії
    # Сортуємо за ID (найновіші ID = останні додані)
    query = """
        SELECT t.*, g.name as generation_name, g.year_start, g.year_end,
            m.id as model_id, m.name as model_name,
            b.id as brand_id, b.name as make_name, b.country
        FROM trims t
        JOIN generations g ON t.generation_id = g.id
        JOIN models m ON g.model_id = m.id
        JOIN brands b ON m.brand_id = b.id
        ORDER BY t.id DESC
        LIMIT 6
    """
    
    latest_trims, error = fetch_query(query)
    
    if error:
        print(f"Latest trims error: {error}")
        return jsonify({"error": error}), 500
        
    return jsonify(latest_trims)

@app.route('/api/forum/topics', methods=['GET'])
def get_forum_topics():
    # Отримуємо параметри фільтрації
    sort_by = request.args.get('sort', 'latest') # 'latest' або 'popular'
    brand_id = request.args.get('brand_id')      # ID бренду (опціонально)
    
    base_query = """
        SELECT 
            t.id, 
            t.title, 
            t.created_at,
            t.brand_id,
            b.name as brand_name,
            u.username AS author_username,
            u.avatar_url AS author_avatar,
            u.id AS author_id,
            (SELECT COUNT(*) FROM forum_posts p WHERE p.topic_id = t.id) - 1 AS post_count
        FROM forum_topics t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN brands b ON t.brand_id = b.id
    """
    
    where_clauses = []
    params = []
    
    # Фільтр по бренду
    if brand_id:
        where_clauses.append("t.brand_id = %s")
        params.append(brand_id)
        
    if where_clauses:
        base_query += " WHERE " + " AND ".join(where_clauses)
        
    # Сортування
    if sort_by == 'popular':
        base_query += " ORDER BY post_count DESC, t.created_at DESC"
    else: # latest
        base_query += " ORDER BY t.created_at DESC"
        
    topics, error = fetch_query(base_query, tuple(params))
    
    if error:
        return jsonify({"error": str(error)}), 500
        
    return jsonify(topics)

@app.route('/api/forum/topics', methods=['POST'])
@jwt_required()
def create_forum_topic():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    title = data.get('title')
    content = data.get('content')
    brand_id = data.get('brand_id') # Отримуємо ID бренду (може бути None)

    if not title or not content:
        return jsonify({"error": "Заголовок та повідомлення обов'язкові"}), 400

    # Перетворюємо порожній рядок на None для SQL
    if brand_id == "":
        brand_id = None

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500
        
    try:
        cursor = conn.cursor()
        
        # Додаємо brand_id у запит
        cursor.execute(
            "INSERT INTO forum_topics (title, user_id, brand_id) VALUES (%s, %s, %s) RETURNING id",
            (title, current_user_id, brand_id)
        )
        new_topic_id = cursor.fetchone()[0]
        
        cursor.execute(
            "INSERT INTO forum_posts (content, user_id, topic_id) VALUES (%s, %s, %s)",
            (content, current_user_id, new_topic_id)
        )
        
        conn.commit()
        cursor.close()
    except Exception as e:
        conn.rollback()
        print(f"Помилка створення теми: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()
            
    return jsonify({"message": "Тему успішно створено", "topic_id": new_topic_id}), 201

@app.route('/api/forum/topics/<int:topic_id>', methods=['GET'])
def get_topic_details(topic_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Тема + автор теми
        cursor.execute(
            """
            SELECT t.id, t.title, t.created_at, 
                   u.username AS author_username, u.avatar_url AS author_avatar, u.id AS author_id
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

        # Пости + автори постів
        cursor.execute(
            """
            SELECT p.id, p.content, p.created_at, 
                   u.username AS author_username, u.avatar_url AS author_avatar, u.id AS author_id
            FROM forum_posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.topic_id = %s
            ORDER BY p.created_at ASC
            """,
            (topic_id,)
        )
        posts_data = [dict(row) for row in cursor.fetchall()]
        
        cursor.close()
        
        result = dict(topic_data)
        result['posts'] = posts_data
        
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


# 3. НОВИЙ ЕНДПОІНТ: Публічний профіль користувача
@app.route('/api/users/<int:user_id>/profile', methods=['GET'])
def get_public_user_profile(user_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database error"}), 500
        
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # 1. Отримуємо розширену інфо про користувача
        # ВАЖЛИВО: Додали created_at, current_car, bio, location
        cursor.execute("""
            SELECT id, username, avatar_url, current_car, bio
            FROM users WHERE id = %s
        """, (user_id,))
        user_data = cursor.fetchone()
        
        if not user_data:
            return jsonify({"error": "Користувача не знайдено"}), 404
            
        user_dict = dict(user_data)

        # 2. Статистика
        cursor.execute("SELECT COUNT(*) AS topic_count FROM forum_topics WHERE user_id = %s", (user_id,))
        topic_count = cursor.fetchone()['topic_count']
        
        cursor.execute("SELECT COUNT(*) AS post_count FROM forum_posts WHERE user_id = %s", (user_id,))
        post_count = cursor.fetchone()['post_count']

        # 3. НОВЕ: Останні теми користувача (щоб вивести їх списком)
        cursor.execute("""
            SELECT id, title, created_at 
            FROM forum_topics 
            WHERE user_id = %s 
            ORDER BY created_at DESC 
            LIMIT 5
        """, (user_id,))
        recent_topics = [dict(row) for row in cursor.fetchall()]
        
        cursor.close()
        
        return jsonify({
            "user": user_dict,
            "stats": {
                "topic_count": topic_count,
                "post_count": post_count
            },
            "recent_topics": recent_topics  # Передаємо список тем
        })
        
    except Exception as e:
        print(f"Profile API Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/forum/topics/<int:topic_id>/reply', methods=['POST'])
@jwt_required()
def add_post_to_topic(topic_id):
    current_user_id = get_jwt_identity()
    data = request.get_json()
    content = data.get('content')

    if not content:
        return jsonify({"error": "Повідомлення не може бути порожнім"}), 400

    topic_check, _ = fetch_query("SELECT id FROM forum_topics WHERE id = %s", (topic_id,))
    if not topic_check:
        return jsonify({"error": "Тему, до якої ви намагаєтесь відповісти, не знайдено"}), 404

    query = "INSERT INTO forum_posts (content, user_id, topic_id) VALUES (%s, %s, %s)"
    success, error = db_execute(query, (content, current_user_id, topic_id))

    if not success:
        return jsonify({"error": error}), 500

    return jsonify({"message": "Відповідь успішно додано"}), 201

@app.route('/api/me/account', methods=['GET'])
@jwt_required()
def get_my_account_details():
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500
        
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # --- ОНОВЛЕНО: Додали bio, current_car ---
        cursor.execute("""
            SELECT username, email, avatar_url, bio, current_car 
            FROM users WHERE id = %s
        """, (user_id,))
        user_data = cursor.fetchone()
        
        if not user_data:
            return jsonify({"error": "Користувача не знайдено"}), 404
            
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
        print(f"Account Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route('/api/me/account/details', methods=['PUT'])
@jwt_required()
def update_account_details():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    current_car = data.get('current_car')
    bio = data.get('bio')

    # Оновлюємо дані в базі
    query = """
        UPDATE users 
        SET current_car = %s, bio = %s 
        WHERE id = %s
    """
    success, error = db_execute(query, (current_car,  bio, user_id))

    if not success:
        return jsonify({"error": error}), 500
        
    return jsonify({"message": "Профіль успішно оновлено!"})

@app.route('/api/me/topics', methods=['GET'])
@jwt_required()
def get_my_topics():
    user_id = get_jwt_identity()
    
    # ОНОВЛЕНИЙ ЗАПИТ: Додали users (u) та brands (b)
    query = """
        SELECT 
            t.id, 
            t.title, 
            t.created_at, 
            t.brand_id,
            b.name as brand_name,
            u.username AS author_username,
            u.avatar_url AS author_avatar,
            u.id AS author_id,
            (SELECT COUNT(*) FROM forum_posts p WHERE p.topic_id = t.id) - 1 AS post_count
        FROM forum_topics t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN brands b ON t.brand_id = b.id
        WHERE t.user_id = %s
        ORDER BY t.created_at DESC
        LIMIT 20;
    """
    topics, error = fetch_query(query, (user_id,))
    
    if error:
        return jsonify({"error": str(error)}), 500
        
    return jsonify(topics)
    
@app.route('/api/me/account/password', methods=['PUT'])
@jwt_required()
def update_my_password():
    user_id = get_jwt_identity()
    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if not old_password or not new_password:
        return jsonify({"error": "Потрібно вказати старий та новий паролі"}), 400

    user_data, error = fetch_query("SELECT password_hash FROM users WHERE id = %s", (user_id,))
    if error or not user_data:
        return jsonify({"error": "Користувача не знайдено"}), 404

    current_hash = user_data[0]['password_hash']
    
    if not check_password_hash(current_hash, old_password):
        return jsonify({"error": "Невірний старий пароль"}), 403

    new_hash = generate_password_hash(new_password)
    success, error = db_execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
    
    if not success:
        return jsonify({"error": error}), 500
        
    return jsonify({"message": "Пароль успішно оновлено"})

@app.route('/api/me/account/email', methods=['PUT'])
@jwt_required()
def update_my_email():
    user_id = get_jwt_identity()
    data = request.get_json()
    new_email = data.get('new_email')
    password = data.get('password')

    if not new_email or not password:
        return jsonify({"error": "Потрібно вказати новий email та поточний пароль"}), 400
        
    existing_user, _ = fetch_query("SELECT id FROM users WHERE email = %s AND id != %s", (new_email, user_id))
    if existing_user:
        return jsonify({"error": "Цей email вже використовується іншим акаунтом"}), 409

    user_data, error = fetch_query("SELECT password_hash FROM users WHERE id = %s", (user_id,))
    if not check_password_hash(user_data[0]['password_hash'], password):
        return jsonify({"error": "Невірний пароль"}), 403
        
    success, error = db_execute("UPDATE users SET email = %s WHERE id = %s", (new_email, user_id))
    
    if not success:
        return jsonify({"error": error}), 500
        
    return jsonify({"message": "Email успішно оновлено", "new_email": new_email})

@app.route('/api/forum/posts/<int:post_id>', methods=['DELETE'])
@jwt_required()
def delete_forum_post(post_id):
    current_user_id = int(get_jwt_identity())

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cursor.execute(
            "SELECT user_id, topic_id FROM forum_posts WHERE id = %s", 
            (post_id,)
        )
        post = cursor.fetchone()

        if not post:
            return jsonify({"error": "Пост не знайдено"}), 404

        if post['user_id'] != current_user_id:
            return jsonify({"error": "Ви не можете видалити чужий пост"}), 403

        cursor.execute(
            "SELECT MIN(id) AS first_post_id FROM forum_posts WHERE topic_id = %s",
            (post['topic_id'],)
        )
        first_post_id = cursor.fetchone()['first_post_id']

        if post_id == first_post_id:
            cursor.execute(
                "DELETE FROM forum_topics WHERE id = %s", 
                (post['topic_id'],)
            )
            message = "Тему (та всі відповіді) успішно видалено"
        else:
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

CAR_OF_THE_DAY_FILE = "car_of_the_day.json"

@app.route('/api/car-of-the-day')
def get_car_of_the_day():
    today = date.today().isoformat()
    current_data = {"date": None, "trim_id": None}
    
    if os.path.exists(CAR_OF_THE_DAY_FILE):
        try:
            with open(CAR_OF_THE_DAY_FILE, 'r') as f:
                current_data = json.load(f)
        except Exception as e:
            print(f"Помилка читання {CAR_OF_THE_DAY_FILE}: {e}")

    selected_trim_id = None
    
    if current_data.get("date") == today and current_data.get("trim_id"):
        selected_trim_id = current_data["trim_id"]
    else:
        conn = get_db_connection()
        if not conn:
             return jsonify({"error": "Помилка підключення до БД"}), 500
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM trims ORDER BY RANDOM() LIMIT 1")
            result = cursor.fetchone()
            cursor.close()
            
            if result:
                selected_trim_id = result[0]
                try:
                    with open(CAR_OF_THE_DAY_FILE, 'w') as f:
                        json.dump({"date": today, "trim_id": selected_trim_id}, f)
                except Exception as e:
                    print(f"Помилка збереження {CAR_OF_THE_DAY_FILE}: {e}")
            else:
                 return jsonify({"error": "Не вдалося вибрати автомобіль дня"}), 404
                 
        except Exception as e:
             return jsonify({"error": str(e)}), 500
        finally:
            if conn:
                conn.close()

    if selected_trim_id:
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
            if os.path.exists(CAR_OF_THE_DAY_FILE):
                os.remove(CAR_OF_THE_DAY_FILE)
            return jsonify({"error": "Автомобіль дня не знайдено в базі даних"}), 404
            
        return jsonify(car_data[0])
    else:
        return jsonify({"error": "Не вдалося визначити автомобіль дня"}), 500

# ==========================================
#        МАРШРУТИ ДЛЯ НОВИН (API)
# ==========================================

# --- ВСТАВИТИ В app.py ЗАМІСТЬ СТАРОЇ ФУНКЦІЇ get_news ---

@app.route('/api/news')
def get_news():
    # --- ВАШ API KEY ---
    NEWS_API_KEY = "65ef854a701444969fdb63b9e26a6b45"
    
    # Запит до API (шукаємо ширше, щоб потім відфільтрувати)
    url = f"https://newsapi.org/v2/everything?q=автомобіль OR машина OR автопром OR кросовер OR електрокар OR bmw OR toyota&language=uk&sortBy=publishedAt&apiKey={NEWS_API_KEY}"

    try:
        response = requests.get(url)
        data = response.json()

        if data.get('status') != 'ok':
            return jsonify({"error": "Помилка зовнішнього API"}), 500

        articles = data.get('articles', [])
        
        # --- СПИСОК ОБОВ'ЯЗКОВИХ СЛІВ (ФІЛЬТР) ---
        # Новина попаде на сайт ТІЛЬКИ якщо в ній є хоча б одне з цих слів
        CAR_KEYWORDS = [
            "авто", "bmw", "audi", "toyota", "mercedes", "ford", "volkswagen", 
            "honda", "tesla", "nissan", "hyundai", "mazda", "lexus", "volvo",
            "двигун", "кросовер", "седан", "позашляховик",
            "електрокар", "гібрид", "тест-драйв", "парковк", "водій", "штраф", "дтп", 
            "палив", "бензин", "дизель", "ремонт", "гальм"
        ]

        formatted_news = []
        
        for index, article in enumerate(articles):
            # 1. Пропускаємо видалені або без фото
            if not article.get('urlToImage') or article.get('title') == '[Removed]':
                continue
            
            title = (article.get('title') or "").lower()
            desc = (article.get('description') or "").lower()
            
            # 2. ЖОРСТКА ПЕРЕВІРКА НА ТЕМУ АВТО
            # Якщо жодного ключового слова немає ні в заголовку, ні в описі - пропускаємо
            is_car_related = any(word in title for word in CAR_KEYWORDS) or \
                             any(word in desc for word in CAR_KEYWORDS)
            
            if not is_car_related:
                continue

            # 3. Очищення тексту від сміття (як робили раніше)
            raw_content = article['description'] or article['content'] or ""
            if not re.search('[а-яА-Яa-zA-Z]', raw_content):
                clean_content = "Натисніть, щоб переглянути деталі..."
            else:
                clean_content = raw_content

            formatted_news.append({
                "id": index,
                "title": article['title'],
                "content": clean_content,
                "image_url": article['urlToImage'],
                "link_url": article['url'],
                "published_at": article['publishedAt'],
                "source": article['source']['name'] # Додамо джерело
            })
            
            # Обмежуємо кількість (наприклад, 12 новин)
            if len(formatted_news) >= 12:
                break

        return jsonify(formatted_news)

    except Exception as e:
        print(f"Помилка отримання новин: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/news/scrape', methods=['POST'])
def scrape_news_content():
    data = request.get_json()
    url = data.get('url')

    if not url:
        return jsonify({"error": "URL is required"}), 400

    try:
        # 1. Завантажуємо сторінку через Trafilatura
        downloaded = trafilatura.fetch_url(url)
        
        if downloaded is None:
             return jsonify({"content": None, "message": "Не вдалося завантажити сторінку (можливо, захист сайту)"}), 200

        # 2. Витягуємо текст
        # include_comments=False, include_tables=False прибирає сміття
        full_text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
        
        if not full_text:
             return jsonify({"content": None, "message": "Текст не знайдено"}), 200

        return jsonify({"content": full_text})

    except Exception as e:
        print(f"Scraping Error: {e}")
        return jsonify({"content": None, "error": str(e)}), 200



# Отримуємо ID з середовища (безпечніше)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

@app.route('/api/auth/google', methods=['POST'])
def google_login():
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({"error": "Токен не надано"}), 400

    try:
        # Верифікація токена через Google
        id_info = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )

        # Отримуємо дані користувача
        email = id_info['email']
        name = id_info.get('name', email.split('@')[0])
        google_picture = id_info.get('picture') # <--- Отримуємо URL фото
        
        if id_info['aud'] != GOOGLE_CLIENT_ID:
            raise ValueError('Could not verify audience.')

        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Шукаємо користувача за email (+ дістаємо avatar_url)
        cursor.execute("SELECT id, username, avatar_url FROM users WHERE email = %s", (email,))
        user_data = cursor.fetchone()

        if user_data:
            # --- КОРИСТУВАЧ ІСНУЄ ---
            user_id = user_data[0]
            username = user_data[1]
            current_avatar = user_data[2]
            
            # Якщо у користувача немає аватарки, але вона є в Google - оновлюємо
            if not current_avatar and google_picture:
                cursor.execute(
                    "UPDATE users SET avatar_url = %s WHERE id = %s", 
                    (google_picture, user_id)
                )
                conn.commit()
                
        else:
            # --- НОВИЙ КОРИСТУВАЧ ---
            random_pass = generate_password_hash(os.urandom(32).hex())
            
            base_name = name.replace(" ", "").lower()
            username = base_name
            counter = 1
            
            while True:
                cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
                if not cursor.fetchone():
                    break
                username = f"{base_name}{counter}"
                counter += 1
            
            # Додаємо нового користувача одразу з фото
            cursor.execute(
                "INSERT INTO users (username, email, password_hash, avatar_url) VALUES (%s, %s, %s, %s) RETURNING id", 
                (username, email, random_pass, google_picture)
            )
            user_id = cursor.fetchone()[0]
            conn.commit()

        cursor.close()
        conn.close()

        access_token = create_access_token(identity=str(user_id))
        # ОНОВЛЕНО: Повертаємо avatar_url
        # (google_picture ми отримали вище в коді, або current_avatar)
        final_avatar = current_avatar if 'current_avatar' in locals() and current_avatar else google_picture

        return jsonify(
            access_token=access_token, 
            username=username,
            avatar_url=final_avatar
        )

    except ValueError as e:
        print(f"Token verification failed: {e}")
        return jsonify({"error": "Недійсний токен Google"}), 401
    except Exception as e:
        print(f"Google Login Error: {e}")
        return jsonify({"error": "Помилка сервера при вході через Google"}), 500
    
# --- ВІКТОРИНА ---
@app.route('/api/quiz/question')
def get_quiz_question():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database error"}), 500

    try:
        cursor = conn.cursor()
        
        # 1. Беремо більше машин (12), щоб мати запас для фільтрації повторів
        query = """
            SELECT t.id, b.name || ' ' || m.name AS car_name, t.image_url
            FROM trims t
            JOIN generations g ON t.generation_id = g.id
            JOIN models m ON g.model_id = m.id
            JOIN brands b ON m.brand_id = b.id
            WHERE t.image_url IS NOT NULL AND t.image_url != ''
            ORDER BY RANDOM()
            LIMIT 12
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        if not rows:
            return jsonify({"error": "Немає даних"}), 404

        # 2. Фільтруємо унікальні назви
        unique_options = []
        seen_names = set()
        
        # Перше авто в списку - буде "правильним" (ми його передамо окремо)
        correct_car_row = rows[0]
        correct_name = correct_car_row[1]
        
        unique_options.append(correct_name)
        seen_names.add(correct_name)
        
        # Добираємо ще 3 неправильних варіанти, слідкуючи, щоб назви не повторювались
        for row in rows[1:]:
            name = row[1]
            if name not in seen_names:
                unique_options.append(name)
                seen_names.add(name)
            
            if len(unique_options) == 4:
                break
        
        # Якщо не назбирали 4 унікальних (мало моделей в базі), повертаємо скільки є
        if len(unique_options) < 2:
             return jsonify({"error": "Замало унікальних моделей в базі"}), 400

        return jsonify({
            "image_url": correct_car_row[2],
            "correct_answer": correct_name,
            "options": unique_options 
        })

    except Exception as e:
        print(f"Quiz Error: {e}")
        return jsonify({"error": str(e)}), 500
    

@app.route('/api/me/account/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    if 'file' not in request.files:
        return jsonify({"error": "Файл не знайдено"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "Файл не обрано"}), 400
        
    if file and allowed_file(file.filename):
        user_id = get_jwt_identity()
        
        # Генеруємо ім'я файлу
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = secure_filename(f"user_{user_id}_{int(datetime.now().timestamp())}.{ext}")
        
        # Шлях для збереження на диск
        basedir = os.path.abspath(os.path.dirname(__file__))
        save_path = os.path.join(basedir, app.config['UPLOAD_FOLDER'], filename)
        
        # --- ВСТАВИТИ ТУТ ---
        file.seek(0)  # Повертаємо "курсор" на початок файлу, щоб він не записався порожнім
        # -------------------
        
        file.save(save_path)
        
        # Шлях для бази даних (для HTML)
        db_path = f"/static/uploads/avatars/{filename}"
        
        success, error = db_execute("UPDATE users SET avatar_url = %s WHERE id = %s", (db_path, user_id))
        
        if success:
            return jsonify({"message": "Аватарку оновлено", "avatar_url": db_path})
        else:
            return jsonify({"error": error}), 500
    
    return jsonify({"error": "Недопустимий тип файлу"}), 400


# --- MARKETPLACE API ---

@app.route('/api/market/ads', methods=['GET'])
def get_market_ads():
    # Отримуємо всі параметри фільтрації з URL
    brand_id = request.args.get('brand_id')
    model_id = request.args.get('model_id')
    price_min = request.args.get('price_min')
    price_max = request.args.get('price_max')
    year_min = request.args.get('year_min')
    year_max = request.args.get('year_max')
    mileage_max = request.args.get('mileage_max')
    transmission = request.args.get('transmission')
    engine = request.args.get('engine')
    body_type = request.args.get('body_type')  # <-- Новий фільтр
    sort = request.args.get('sort', 'newest')

    # === SQL ЗАПИТ ===
    # 1. Вибираємо всі дані оголошення (l.*)
    # 2. Підтягуємо назви бренду та моделі (JOIN brands, models)
    # 3. Підтягуємо дані продавця (JOIN users)
    # 4. Підзапит для фото: бере головне (is_main=TRUE), або найперше завантажене, якщо головного немає.
    query = """
        SELECT l.*, 
               b.name as brand_name, 
               m.name as model_name, 
               u.username, u.avatar_url as user_avatar,
               (
                   SELECT image_url 
                   FROM listing_images li 
                   WHERE li.listing_id = l.id 
                   ORDER BY li.is_main DESC, li.id ASC 
                   LIMIT 1
               ) as main_image
        FROM listings l
        JOIN brands b ON l.brand_id = b.id
        JOIN models m ON l.model_id = m.id
        JOIN users u ON l.user_id = u.id
        WHERE l.is_active = TRUE AND l.is_paid = TRUE
    """
    
    params = []

    # --- ДИНАМІЧНІ ФІЛЬТРИ ---
    if brand_id:
        query += " AND l.brand_id = %s"
        params.append(brand_id)
    
    if model_id: 
        query += " AND l.model_id = %s"
        params.append(model_id)
        
    if price_min:
        query += " AND l.price >= %s"
        params.append(price_min)
        
    if price_max:
        query += " AND l.price <= %s"
        params.append(price_max)
        
    if year_min:
        query += " AND l.year >= %s"
        params.append(year_min)
        
    if year_max:
        query += " AND l.year <= %s"
        params.append(year_max)
        
    if mileage_max:
        query += " AND l.mileage <= %s"
        params.append(mileage_max)
        
    if transmission:
        query += " AND l.transmission = %s"
        params.append(transmission)
        
    if engine:
        query += " AND l.engine_type = %s"
        params.append(engine)

    if body_type:
        query += " AND l.body_type = %s"
        params.append(body_type)

    # --- СОРТУВАННЯ ---
    if sort == 'cheaper':
        query += " ORDER BY l.price ASC"
    elif sort == 'expensive':
        query += " ORDER BY l.price DESC"
    else:
        query += " ORDER BY l.created_at DESC"

    # Виконуємо запит
    ads, error = fetch_query(query, tuple(params))
    
    if error:
        return jsonify({"error": error}), 500
    
    return jsonify(ads)

@app.route('/api/market/ads', methods=['POST'])
@jwt_required()
def create_market_ad():
    user_id = get_jwt_identity()
    
    # Отримуємо дані
    brand_id = request.form.get('brand_id')
    model_id = request.form.get('model_id')
    year = request.form.get('year')
    price = request.form.get('price')
    mileage = request.form.get('mileage')
    engine = request.form.get('engine')
    transmission = request.form.get('transmission')
    location = request.form.get('location')
    phone = request.form.get('phone')
    description = request.form.get('description')
    license_plate = request.form.get('license_plate')
    vin_code = request.form.get('vin_code')
    color = request.form.get('color')
    engine_volume = request.form.get('engine_volume')
    equipment = request.form.get('equipment')
    drive = request.form.get('drive')
    
    # НОВІ ПОЛЯ
    body_type = request.form.get('body_type')
    fuel_consumption = request.form.get('fuel_consumption')
    
    if not all([brand_id, model_id, year, price, phone]):
        return jsonify({"error": "Заповніть обов'язкові поля"}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # 1. ПЕРЕВІРКА ЛІМІТУ (Скільки вже є оголошень?)
        cursor.execute("SELECT COUNT(*) FROM listings WHERE user_id = %s", (user_id,))
        count = cursor.fetchone()[0]
        
        # Перші 2 - безкоштовно (True), далі - платно (False)
        is_paid = True if count < 2 else False
        
        # ОНОВЛЕНИЙ INSERT
        cursor.execute("""
            INSERT INTO listings (
                user_id, brand_id, model_id, year, price, mileage, 
                engine_type, transmission, location, phone, description,
                license_plate, vin_code, color, engine_volume, equipment, drive,
                body_type, fuel_consumption, 
                is_paid, is_active
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id, brand_id, model_id, year, price, mileage, 
            engine, transmission, location, phone, description, 
            license_plate, vin_code, color, engine_volume, equipment, drive,
            body_type, fuel_consumption,
            is_paid, True # Активне одразу, але фільтруватиметься по is_paid
        ))
        listing_id = cursor.fetchone()[0]
        
        # Збереження фото (без змін)
        files = request.files.getlist('photos')
        for i, file in enumerate(files):
            if file and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = secure_filename(f"ad_{listing_id}_{i}_{int(datetime.now().timestamp())}.{ext}")
                save_path = os.path.join(app.config['MARKET_UPLOAD_FOLDER'], filename)
                file.save(save_path)
                db_path = f"/static/uploads/market/{filename}"
                cursor.execute("INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (%s, %s, %s)", 
                               (listing_id, db_path, (i == 0)))
        
        conn.commit()
        return jsonify({"message": "Оголошення успішно додано!"}), 201
    except Exception as e:
        conn.rollback()
        print(e)
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# Вставте це в app.py перед запуском сервера (перед if __name__ == '__main__':)

@app.route('/api/market/ads/<int:ad_id>', methods=['GET'])
def get_market_ad_details(ad_id):
    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database error"}), 500

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # 1. Основна інформація
        query = """
            SELECT l.*, 
                   b.name as brand_name, 
                   m.name as model_name,
                   u.username, u.avatar_url as user_avatar, u.email as user_email
            FROM listings l
            JOIN brands b ON l.brand_id = b.id
            JOIN models m ON l.model_id = m.id
            JOIN users u ON l.user_id = u.id
            WHERE l.id = %s
        """
        cursor.execute(query, (ad_id,))
        ad_data = cursor.fetchone()
        
        if not ad_data:
            return jsonify({"error": "Оголошення не знайдено"}), 404
            
        result = dict(ad_data)
        
        # 2. Фотографії (ОНОВЛЕНО: Отримуємо ID та URL)
        cursor.execute("SELECT id, image_url FROM listing_images WHERE listing_id = %s ORDER BY is_main DESC, id ASC", (ad_id,))
        rows = cursor.fetchall()
        
        # Формуємо список з ID
        images_data = [{'id': r['id'], 'url': r['image_url']} for r in rows]
        
        result = dict(ad_data)
        result['images_data'] = images_data  # <--- ЦЕ ПОЛЕ ОБОВ'ЯЗКОВЕ
        result['images'] = [img['url'] for img in images_data]

        cursor.close()
        return jsonify(result)

    except Exception as e:
        print(f"Error fetching ad details: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

# --- MARKET FAVORITES API ---

@app.route('/api/market/favorites/ids', methods=['GET'])
@jwt_required()
def get_market_favorite_ids():
    user_id = get_jwt_identity()
    query = "SELECT listing_id FROM market_favorites WHERE user_id = %s"
    rows, error = fetch_query(query, (user_id,))
    if error: return jsonify([]), 500
    return jsonify([r['listing_id'] for r in rows])

@app.route('/api/market/favorites', methods=['POST'])
@jwt_required()
def toggle_market_favorite():
    user_id = get_jwt_identity()
    data = request.get_json()
    listing_id = data.get('listing_id')

    # Перевіряємо, чи вже є в обраному
    check_q = "SELECT 1 FROM market_favorites WHERE user_id = %s AND listing_id = %s"
    exists, _ = fetch_query(check_q, (user_id, listing_id))

    if exists:
        # Видаляємо
        success, err = db_execute("DELETE FROM market_favorites WHERE user_id = %s AND listing_id = %s", (user_id, listing_id))
        action = 'removed'
    else:
        # Додаємо
        success, err = db_execute("INSERT INTO market_favorites (user_id, listing_id) VALUES (%s, %s)", (user_id, listing_id))
        action = 'added'

    if not success: return jsonify({"error": err}), 500
    return jsonify({"message": "Success", "action": action})

@app.route('/api/market/favorites/list', methods=['GET'])
@jwt_required()
def get_my_market_favorites():
    user_id = get_jwt_identity()
    
    # ОНОВЛЕНИЙ ЗАПИТ: Додано JOIN models m та m.name as model_name
    query = """
        SELECT l.*, 
               b.name as brand_name, 
               m.name as model_name,
               u.username,
               (SELECT image_url FROM listing_images li WHERE li.listing_id = l.id AND li.is_main = TRUE LIMIT 1) as main_image
        FROM market_favorites mf
        JOIN listings l ON mf.listing_id = l.id
        JOIN brands b ON l.brand_id = b.id
        JOIN models m ON l.model_id = m.id
        JOIN users u ON l.user_id = u.id
        WHERE mf.user_id = %s AND l.is_active = TRUE
        ORDER BY mf.created_at DESC
    """
    
    ads, error = fetch_query(query, (user_id,))
    if error: return jsonify({"error": error}), 500
    return jsonify(ads)

# --- ДОДАТИ В app.py ---

@app.route('/api/market/ads/<int:ad_id>', methods=['DELETE'])
@jwt_required()
def delete_market_ad(ad_id):
    current_user_id = get_jwt_identity()
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database error"}), 500
        
    try:
        cursor = conn.cursor()
        
        # 1. Перевіряємо, чи існує оголошення і чи належить воно користувачу
        cursor.execute("SELECT user_id FROM listings WHERE id = %s", (ad_id,))
        ad = cursor.fetchone()
        
        if not ad:
            return jsonify({"error": "Оголошення не знайдено"}), 404
            
        # Конвертуємо ID в стрічку або int для порівняння (залежно від формату в токені)
        if str(ad[0]) != str(current_user_id):
            return jsonify({"error": "Ви не маєте прав видаляти це оголошення"}), 403
            
        # 2. Видаляємо (каскадне видалення фото відбудеться автоматично завдяки foreign key, якщо налаштовано, інакше треба видаляти вручну)
        cursor.execute("DELETE FROM listings WHERE id = %s", (ad_id,))
        conn.commit()
        
        cursor.close()
        return jsonify({"message": "Оголошення успішно видалено"}), 200
        
    except Exception as e:
        print(e)
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


# --- CHAT API ---

@app.route('/api/chats/start', methods=['POST'])
@jwt_required()
def start_chat():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    listing_id = data.get('listing_id')
    
    if not listing_id:
        return jsonify({"error": "No listing ID"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # 1. Дізнаємось хто продавець
        cursor.execute("SELECT user_id FROM listings WHERE id = %s", (listing_id,))
        listing = cursor.fetchone()
        if not listing:
            return jsonify({"error": "Оголошення не знайдено"}), 404
        
        seller_id = listing['user_id']
        
        if seller_id == current_user_id:
            return jsonify({"error": "Ви не можете писати самі собі"}), 400

        # 2. Перевіряємо, чи чат вже існує
        cursor.execute("""
            SELECT id FROM chats 
            WHERE listing_id = %s AND buyer_id = %s
        """, (listing_id, current_user_id))
        chat = cursor.fetchone()
        
        if chat:
            return jsonify({"chat_id": chat['id']}) # Чат вже є, повертаємо ID
            
        # 3. Створюємо новий чат
        cursor.execute("""
            INSERT INTO chats (listing_id, buyer_id, seller_id)
            VALUES (%s, %s, %s) RETURNING id
        """, (listing_id, current_user_id, seller_id))
        new_chat_id = cursor.fetchone()[0]
        
        conn.commit()
        return jsonify({"chat_id": new_chat_id})
        
    except Exception as e:
        conn.rollback()
        print(e)
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/chats', methods=['GET'])
@jwt_required()
def get_my_chats():
    user_id = int(get_jwt_identity())
    
    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database error"}), 500
    
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    # ОНОВЛЕНИЙ ЗАПИТ: Надійніший вибір фото
    query = """
        SELECT 
            c.id as chat_id,
            l.id as listing_id,
            b.name || ' ' || m.name as car_name,
            (
                SELECT image_url 
                FROM listing_images li 
                WHERE li.listing_id = l.id 
                ORDER BY li.is_main DESC, li.id ASC 
                LIMIT 1
            ) as car_image,
            CASE 
                WHEN c.buyer_id = %s THEN s.username 
                ELSE buyer.username 
            END as interlocutor_name,
            (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM chats c
        JOIN listings l ON c.listing_id = l.id
        JOIN brands b ON l.brand_id = b.id
        JOIN models m ON l.model_id = m.id
        JOIN users s ON c.seller_id = s.id
        JOIN users buyer ON c.buyer_id = buyer.id
        WHERE c.buyer_id = %s OR c.seller_id = %s
        ORDER BY c.created_at DESC
    """
    
    try:
        cursor.execute(query, (user_id, user_id, user_id))
        chats = [dict(row) for row in cursor.fetchall()]
        return jsonify(chats)
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/chats/<int:chat_id>/messages', methods=['GET'])
@jwt_required()
def get_messages(chat_id):
    user_id = int(get_jwt_identity())
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Перевірка доступу до чату
        cursor.execute("SELECT 1 FROM chats WHERE id = %s AND (buyer_id = %s OR seller_id = %s)", (chat_id, user_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Access denied"}), 403
            
        cursor.execute("""
            SELECT m.*, u.username 
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE chat_id = %s
            ORDER BY m.created_at ASC
        """, (chat_id,))
        messages = [dict(row) for row in cursor.fetchall()]
        return jsonify(messages)
    finally:
        conn.close()

@app.route('/api/chats/<int:chat_id>/messages', methods=['POST'])
@jwt_required()
def send_message(chat_id):
    user_id = int(get_jwt_identity())
    data = request.get_json()
    content = data.get('content')
    
    if not content: return jsonify({"error": "Empty message"}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO messages (chat_id, sender_id, content) VALUES (%s, %s, %s)", 
                       (chat_id, user_id, content))
        conn.commit()
        return jsonify({"status": "sent"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/chats/<int:chat_id>', methods=['DELETE'])
@jwt_required()
def delete_chat(chat_id):
    user_id = int(get_jwt_identity())
    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database error"}), 500
    
    try:
        cursor = conn.cursor()
        
        # Перевірка прав
        cursor.execute("SELECT 1 FROM chats WHERE id = %s AND (buyer_id = %s OR seller_id = %s)", 
                       (chat_id, user_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Чат не знайдено або немає прав"}), 403
            
        # Видалення
        cursor.execute("DELETE FROM chats WHERE id = %s", (chat_id,))
        conn.commit()
        
        return jsonify({"message": "Чат видалено"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/market/ads/<int:ad_id>', methods=['PUT'])
@jwt_required()
def update_market_ad(ad_id):
    current_user_id = int(get_jwt_identity())
    data = request.form
    
    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database error"}), 500
    
    try:
        cursor = conn.cursor()
        
        # 1. Перевірка прав
        cursor.execute("SELECT user_id FROM listings WHERE id = %s", (ad_id,))
        listing = cursor.fetchone()
        if not listing or listing[0] != current_user_id:
            return jsonify({"error": "Доступ заборонено"}), 403

        # === ВИПРАВЛЕННЯ: Обробка числових полів ===
        # Якщо прийшов пустий рядок, замінюємо його на None (SQL NULL)
        def clean_num(val):
            return val if val and val.strip() else None

        engine_vol = clean_num(data.get('engine_volume'))
        fuel_cons = clean_num(data.get('fuel_consumption'))
        price = clean_num(data.get('price'))
        mileage = clean_num(data.get('mileage'))
        # ============================================

        # 2. Оновлення текстових полів
        query = """
            UPDATE listings 
            SET price = %s, mileage = %s, description = %s, phone = %s, location = %s,
                engine_type = %s, engine_volume = %s, transmission = %s, drive = %s,
                color = %s, vin_code = %s, license_plate = %s,
                body_type = %s, fuel_consumption = %s
            WHERE id = %s
        """
        cursor.execute(query, (
            price, mileage, data.get('description'), 
            data.get('phone'), data.get('location'), data.get('engine'), 
            engine_vol, data.get('transmission'), data.get('drive'), 
            data.get('color'), data.get('vin_code'), data.get('license_plate'),
            data.get('body_type'), fuel_cons,
            ad_id
        ))
        
        # ... (ДАЛІ ЙДЕ КОД ДЛЯ ФОТО, ВІН ЗАЛИШАЄТЬСЯ БЕЗ ЗМІН) ...
        # (Просто скопіюйте сюди блок "3. ВИДАЛЕННЯ ФОТО" і "4. Додавання НОВИХ фото" з минулої версії)
        
        # --- ПОЧАТОК БЛОКУ ФОТО ---
        photos_to_delete_str = data.get('photos_to_delete', '')
        if photos_to_delete_str:
            photo_ids = [int(x) for x in photos_to_delete_str.split(',') if x.strip()]
            if photo_ids:
                placeholders = ','.join(['%s'] * len(photo_ids))
                cursor.execute(f"SELECT image_url FROM listing_images WHERE id IN ({placeholders}) AND listing_id = %s", (*photo_ids, ad_id))
                rows = cursor.fetchall()
                base_dir = os.path.abspath(os.path.dirname(__file__))
                for row in rows:
                    try:
                        file_path = os.path.join(base_dir, row[0].lstrip('/'))
                        if os.path.exists(file_path): os.remove(file_path)
                    except Exception as e: print(f"Error deleting file: {e}")
                cursor.execute(f"DELETE FROM listing_images WHERE id IN ({placeholders}) AND listing_id = %s", (*photo_ids, ad_id))

        files = request.files.getlist('photos')
        for i, file in enumerate(files):
            if file and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = secure_filename(f"ad_{ad_id}_upd_{int(datetime.now().timestamp())}_{i}.{ext}")
                save_path = os.path.join(app.config['MARKET_UPLOAD_FOLDER'], filename)
                file.save(save_path)
                db_path = f"/static/uploads/market/{filename}"
                cursor.execute("INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (%s, %s, FALSE)", (ad_id, db_path))
        # --- КІНЕЦЬ БЛОКУ ФОТО ---

        conn.commit()
        return jsonify({"message": "Оголошення оновлено"}), 200

    except Exception as e:
        conn.rollback()
        print(f"Update error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# --- ДОДАТИ В app.py ---

@app.route('/api/chats/unread', methods=['GET'])
@jwt_required()
def get_unread_count():
    user_id = int(get_jwt_identity())
    conn = get_db_connection()
    if not conn: return jsonify({"count": 0})
    
    try:
        cursor = conn.cursor()
        # Рахуємо повідомлення, де:
        # 1. Отримувач - це поточний юзер (тобто відправник НЕ ми)
        # 2. Повідомлення належить до чату, де ми є учасником
        # 3. is_read = FALSE
        query = """
            SELECT COUNT(m.id)
            FROM messages m
            JOIN chats c ON m.chat_id = c.id
            WHERE m.is_read = FALSE 
              AND m.sender_id != %s 
              AND (c.buyer_id = %s OR c.seller_id = %s)
        """
        cursor.execute(query, (user_id, user_id, user_id))
        count = cursor.fetchone()[0]
        return jsonify({"count": count})
    except Exception as e:
        print(f"Error counting unread: {e}")
        return jsonify({"count": 0})
    finally:
        conn.close()

@app.route('/api/chats/<int:chat_id>/read', methods=['POST'])
@jwt_required()
def mark_chat_read(chat_id):
    user_id = int(get_jwt_identity())
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Позначаємо прочитаними всі повідомлення в цьому чаті, 
        # які відправив НЕ поточний користувач
        cursor.execute("""
            UPDATE messages 
            SET is_read = TRUE 
            WHERE chat_id = %s AND sender_id != %s
        """, (chat_id, user_id))
        conn.commit()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# --- API ЗБЕРЕЖЕНИХ ПОШУКІВ ---

@app.route('/api/me/searches', methods=['GET'])
@jwt_required()
def get_my_searches():
    current_user_id = get_jwt_identity()
    
    query = "SELECT id, title, criteria, created_at FROM saved_searches WHERE user_id = %s ORDER BY created_at DESC"
    searches, error = fetch_query(query, (current_user_id,))
    
    if error:
        return jsonify({"error": error}), 500
        
    # Якщо база повертає criteria як рядок, треба розпарсити його назад у JSON
    # Якщо ви використовуєте JSONB у Postgres і psycopg2.extras, це може робитись автоматично,
    # але про всяк випадок додамо перевірку:
    for s in searches:
        if isinstance(s['criteria'], str):
            try:
                s['criteria'] = json.loads(s['criteria'])
            except:
                pass 

    return jsonify(searches)

@app.route('/api/me/searches', methods=['POST'])
@jwt_required()
def save_search():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    title = data.get('title')
    criteria = data.get('criteria') # Це словник (dict)

    if not title or not criteria:
        return jsonify({"error": "Неповні дані"}), 400

    # Конвертуємо словник критеріїв у JSON-рядок для збереження
    criteria_json = json.dumps(criteria)

    query = "INSERT INTO saved_searches (user_id, title, criteria) VALUES (%s, %s, %s)"
    success, error = db_execute(query, (current_user_id, title, criteria_json))

    if not success:
        return jsonify({"error": error}), 500

    return jsonify({"message": "Пошук збережено"}), 201

@app.route('/api/me/searches/<int:search_id>', methods=['DELETE'])
@jwt_required()
def delete_saved_search(search_id):
    current_user_id = get_jwt_identity()
    
    # Видаляємо тільки якщо цей пошук належить поточному користувачу
    query = "DELETE FROM saved_searches WHERE id = %s AND user_id = %s"
    success, error = db_execute(query, (search_id, current_user_id))
    
    if not success:
        return jsonify({"error": error}), 500
        
    return jsonify({"message": "Пошук видалено"}), 200

# --- API ДЛЯ ОГОЛОШЕНЬ КОРИСТУВАЧА ---

# 1. Для "Мого кабінету" (захищений, бере ID з токена)
@app.route('/api/me/ads', methods=['GET'])
@jwt_required()
def get_my_ads():
    current_user_id = get_jwt_identity()
    return fetch_user_ads(current_user_id)

# 2. Для Публічного профілю (відкритий, бере ID з URL)
@app.route('/api/users/<int:user_id>/ads', methods=['GET'])
def get_public_user_ads(user_id):
    return fetch_user_ads(user_id)

# Спільна функція для запиту до бази
def fetch_user_ads(user_id):
    query = """
        SELECT l.id, l.price, l.year,
               b.name as brand_name, 
               m.name as model_name,
               (
                   SELECT image_url 
                   FROM listing_images li 
                   WHERE li.listing_id = l.id 
                   ORDER BY li.is_main DESC, li.id ASC 
                   LIMIT 1
               ) as main_image
        FROM listings l
        JOIN brands b ON l.brand_id = b.id
        JOIN models m ON l.model_id = m.id
        WHERE l.user_id = %s
        ORDER BY l.created_at DESC
    """
    ads, error = fetch_query(query, (user_id,))
    
    if error:
        return jsonify({"error": error}), 500
        
    return jsonify(ads)

@app.route('/api/payment/liqpay_data', methods=['POST'])
@jwt_required()
def get_liqpay_data():
    data = request.get_json()
    listing_id = data.get('listing_id')
    amount = 100 # Вартість 100 грн
    
    # Параметри для LiqPay
    params = {
        'action': 'pay',
        'amount': amount,
        'currency': 'UAH',
        'description': f'Розміщення авто (ID: {listing_id})',
        'order_id': f'ad_pay_{listing_id}_{int(datetime.now().timestamp())}',
        'version': '3',
        'public_key': LIQPAY_PUBLIC_KEY,
        'result_url': 'http://127.0.0.1:5500/market.html', # Куди повернути юзера після оплати
        'server_url': 'http://YOUR_NGROK_URL/api/payment/callback' # Webhook (потрібен реальний IP або ngrok)
    }
    
    # Кодуємо дані
    data_encoded = liqpay_encode(params)
    signature = liqpay_sign(data_encoded, LIQPAY_PRIVATE_KEY)
    
    return jsonify({
        "data": data_encoded,
        "signature": signature,
        "url": "https://www.liqpay.ua/api/3/checkout"
    })

# Webhook (Тут LiqPay звітує про оплату)
@app.route('/api/payment/callback', methods=['POST'])
def payment_callback():
    data = request.form.get('data')
    signature = request.form.get('signature')
    
    # Перевірка підпису
    expected_sign = liqpay_sign(data, LIQPAY_PRIVATE_KEY)
    if signature != expected_sign:
        return "Invalid signature", 400
        
    # Декодування даних
    import base64
    decoded_json = base64.b64decode(data).decode('utf-8')
    payment_info = json.loads(decoded_json)
    
    if payment_info.get('status') == 'success':
        # Витягуємо ID оголошення з order_id (ad_pay_123_timestamp)
        order_id = payment_info.get('order_id')
        listing_id = int(order_id.split('_')[2])
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE listings SET is_paid = TRUE WHERE id = %s", (listing_id,))
        conn.commit()
        conn.close()
        
    return "OK", 200

from flask import render_template, send_from_directory

# 1. Головна сторінка
@app.route('/')
def index():
    return render_template('main.html')

# 2. Універсальний маршрут для інших HTML сторінок
# (щоб працювали посилання типу /market.html, /forum.html)
@app.route('/<path:filename>')
def serve_html(filename):
    # Дозволяємо відкривати тільки .html файли з папки templates
    if filename.endswith('.html'):
        return render_template(filename)
    return "File not found", 404

# 3. Маршрут для завантажених файлів (фото авто/аватари)
# Flask за замовчуванням роздає static, але uploads треба налаштувати, якщо вони всередині static
# Якщо папка uploads лежить в static/uploads, то додатковий код не потрібен.

# --- ЗАПУСК СЕРВЕРА ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)