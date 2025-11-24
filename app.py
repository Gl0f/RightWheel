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

# --- ІМПОРТИ ДЛЯ НОВИН ---
import requests 
import trafilatura # <--- ВИКОРИСТОВУЄМО ЦЮ БІБЛІОТЕКУ ЗАМІСТЬ NEWSPAPER
# -------------------------

app = Flask(__name__)

# --- ЗАМІНИТИ СТАРЕ НАЛАШТУВАННЯ CORS НА ЦЕ ---
CORS(app, 
     resources={r"/*": {"origins": ["http://127.0.0.1:5500", "http://localhost:5500"]}}, 
     allow_headers=["Content-Type", "Authorization"], 
     supports_credentials=True)
# ---------------------------------------------
# ... далі твій код ...
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

    user_data, _ = fetch_query("SELECT id, password_hash FROM users WHERE username = %s", (username,))
    
    if not user_data:
        return jsonify({"error": "Невірний логін або пароль"}), 401
    
    user = user_data[0]

    if check_password_hash(user['password_hash'], password):
        access_token = create_access_token(identity=str(user['id']))
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
    query = "SELECT id, name, image_url, year_start, year_end FROM models WHERE brand_id = %s ORDER BY name ASC"
    models, error = fetch_query(query, (brand_id,))
    if error:
        return jsonify({"error": error}), 500
    return jsonify(models)

@app.route('/api/models/<int:model_id>/generations')
def get_generations_by_model(model_id):
    query = "SELECT id, name, year_start, year_end, body_style, image_url FROM generations g WHERE model_id = %s ORDER BY year_start DESC, name ASC"
    generations, error = fetch_query(query, (model_id,))
    if error:
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

        cursor.execute("""
            SELECT id, name, 'brand' as type, country
            FROM brands
            WHERE name ILIKE %s
            ORDER BY name ASC
            LIMIT 5
        """, (search_term,))
        columns = [desc[0] for desc in cursor.description]
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))

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
            if len(results) < 15:
                 results.append(dict(zip(columns, row)))

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
        SELECT t.id, t.year, t.name, t.engine,
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

@app.route('/api/forum/topics', methods=['GET'])
def get_forum_topics():
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
@jwt_required()
def create_forum_topic():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    title = data.get('title')
    content = data.get('content')

    if not title or not content:
        return jsonify({"error": "Заголовок та повідомлення не можуть бути порожніми"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Помилка підключення до БД"}), 500
        
    try:
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO forum_topics (title, user_id) VALUES (%s, %s) RETURNING id",
            (title, current_user_id)
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
        return jsonify({"error": "Внутрішня помилка сервера при створенні теми"}), 500
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
        
        cursor.execute("SELECT username, email FROM users WHERE id = %s", (user_id,))
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
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/me/topics', methods=['GET'])
@jwt_required()
def get_my_topics():
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

@app.route('/api/news')
def get_news():
    """
    Отримує свіжі автомобільні новини з NewsAPI.
    """
    
    # --- ВАЖЛИВО: Вставте свій API ключ нижче ---
    NEWS_API_KEY = "65ef854a701444969fdb63b9e26a6b45"
    # --------------------------------------------

    if NEWS_API_KEY == "ТУТ_ВСТАВТЕ_ВАШ_КЛЮЧ":
        print("УВАГА: Ви не вставили ключ NewsAPI в app.py!")
        return jsonify([])

    url = f"https://newsapi.org/v2/everything?q=автомобіль OR bmw OR toyota OR volkswagen&language=uk&sortBy=publishedAt&apiKey={NEWS_API_KEY}"

    try:
        response = requests.get(url)
        data = response.json()

        if data.get('status') != 'ok':
            print(f"NewsAPI Error: {data.get('message')}")
            return jsonify({"error": "Помилка зовнішнього API"}), 500

        articles = data.get('articles', [])
        
        formatted_news = []
        for index, article in enumerate(articles):
            if not article.get('urlToImage') or article.get('title') == '[Removed]':
                continue
                
            formatted_news.append({
                "id": index,
                "title": article['title'],
                "content": article['description'] or article['content'] or "",
                "image_url": article['urlToImage'],
                "link_url": article['url'],
                "published_at": article['publishedAt']
            })
            
            if len(formatted_news) >= 9:
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



@app.route('/api/auth/google', methods=['POST'])
def google_login():
    data = request.get_json()
    token = data.get('token')
    
    # --- ВСТАВТЕ ВАШ CLIENT ID ТУТ ---
    GOOGLE_CLIENT_ID = "597725200058-jkofhkeccrpuknq2tpf7tbado5vcfg01.apps.googleusercontent.com" 

    try:
        id_info = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = id_info['email']
        name = id_info.get('name', email.split('@')[0])

        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Перевіряємо, чи є користувач
        cursor.execute("SELECT id, username FROM users WHERE email = %s", (email,))
        user_data = cursor.fetchone()

        if user_data:
            user_id = user_data[0] # id
            username = user_data[1] # username
        else:
            # Реєструємо нового
            random_pass = generate_password_hash(os.urandom(16).hex())
            base_name = name.replace(" ", "")
            username = base_name
            counter = 1
            # Унікальний логін
            while True:
                cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
                if not cursor.fetchone(): break
                username = f"{base_name}{counter}"
                counter += 1
            
            cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING id", 
                           (username, email, random_pass))
            user_id = cursor.fetchone()[0]
            conn.commit()

        cursor.close()
        conn.close()

        access_token = create_access_token(identity=str(user_id))
        return jsonify(access_token=access_token, username=username)

    except Exception as e:
        print(f"Google Error: {e}")
        return jsonify({"error": "Помилка входу через Google"}), 500
    
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
# --- ЗАПУСК СЕРВЕРА ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)