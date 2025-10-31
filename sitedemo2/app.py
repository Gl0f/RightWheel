from flask import Flask, jsonify
import psycopg2
import os

app = Flask(__name__)

# --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ---
# Замініть на ваші реальні дані
DATABASE_URL = "postgresql://PostgreSQL18:iroveg51@localhost:5432/rightwheel_db"
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

# --- МАРШРУТИ API ---

# 1. Отримати всі марки
@app.route('/api/brands')
def get_all_brands():
    query = "SELECT id, name, country FROM brands ORDER BY name ASC"
    brands, error = fetch_query(query)
    if error:
        return jsonify({"error": error}), 500
    return jsonify(brands)

# 2. Отримати моделі для конкретної марки (за її ID)
@app.route('/api/brands/<int:brand_id>/models')
def get_models_by_brand(brand_id):
    query = "SELECT id, name FROM models WHERE brand_id = %s ORDER BY name ASC"
    models, error = fetch_query(query, (brand_id,))
    if error:
        return jsonify({"error": error}), 500
    return jsonify(models)

# 3. Отримати покоління для конкретної моделі (за її ID)
@app.route('/api/models/<int:model_id>/generations')
def get_generations_by_model(model_id):
    # Сортуємо за роком початку (новіші перші)
    query = "SELECT id, name, year_start, year_end FROM generations WHERE model_id = %s ORDER BY year_start DESC, name ASC"
    generations, error = fetch_query(query, (model_id,))
    if error:
        return jsonify({"error": error}), 500
    return jsonify(generations)

# 4. Отримати комплектації для конкретного покоління (за його ID)
@app.route('/api/generations/<int:generation_id>/trims')
def get_trims_by_generation(generation_id):
    # Вибираємо всі колонки з таблиці trims
    query = "SELECT * FROM trims WHERE generation_id = %s ORDER BY year DESC, name ASC"
    trims, error = fetch_query(query, (generation_id,))
    if error:
        return jsonify({"error": error}), 500
    return jsonify(trims)

# 5. Отримати повну інформацію про одну комплектацію (за її ID)
@app.route('/api/trims/<int:trim_id>')
def get_trim_details(trim_id):
    # Вибираємо всі колонки з таблиці trims
    query = "SELECT * FROM trims WHERE id = %s"
    # fetch_query повертає список, беремо перший (і єдиний) елемент
    trims, error = fetch_query(query, (trim_id,))
    if error:
        return jsonify({"error": error}), 500
    if not trims:
        return jsonify({"error": "Комплектацію не знайдено"}), 404
    return jsonify(trims[0]) # Повертаємо один об'єкт, а не список

# --- ЗАПУСК СЕРВЕРА ---
if __name__ == '__main__':
    # debug=True автоматично перезавантажує сервер при зміні коду
    # port=5000 вказує порт для бекенду
    app.run(debug=True, port=5000)