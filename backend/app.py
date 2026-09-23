"""Бэкенд калькулятора: хранит историю вычислений в текстовом файле.

Сами вычисления выполняются на клиенте, сервер только сохраняет и отдаёт историю.

API:
    GET    /api/history  — список записей (новые сверху)
    POST   /api/history  — добавить запись {"expression": "12 + 7", "result": "19"}
    DELETE /api/history  — очистить историю

Также сервер раздаёт фронтенд: http://127.0.0.1:5000/
"""

from datetime import datetime
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, request, send_from_directory

ROOT_DIR = Path(__file__).resolve().parent.parent   # корень проекта «Калькулятор»
FRONTEND_DIR = ROOT_DIR / "frontend"
HISTORY_FILE = ROOT_DIR / "history.txt"

# Формат строки в history.txt (поля разделены табуляцией):
# 2026-09-23 10:30:00<TAB>12 + 7<TAB>19
SEPARATOR = "\t"
MAX_FIELD_LENGTH = 100

app = Flask(__name__, static_folder=None)
file_lock = Lock()


# ---------- Работа с файлом истории ----------

def read_history():
    """Читает историю из файла. Возвращает список, новые записи первыми."""
    if not HISTORY_FILE.exists():
        return []
    items = []
    with file_lock:
        lines = HISTORY_FILE.read_text(encoding="utf-8").splitlines()
    for line in lines:
        parts = line.split(SEPARATOR)
        if len(parts) != 3:
            continue  # пропускаем повреждённые строки
        timestamp, expression, result = parts
        items.append({"timestamp": timestamp, "expression": expression, "result": result})
    items.reverse()
    return items


def append_history(expression, result):
    """Дописывает одну запись в конец файла."""
    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "expression": expression,
        "result": result,
    }
    line = SEPARATOR.join([entry["timestamp"], expression, result]) + "\n"
    with file_lock:
        with HISTORY_FILE.open("a", encoding="utf-8") as f:
            f.write(line)
    return entry


def clear_history():
    with file_lock:
        HISTORY_FILE.write_text("", encoding="utf-8")


def clean_field(value):
    """Проверяет поле запроса: непустая строка без переводов строк и табуляций."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or len(value) > MAX_FIELD_LENGTH:
        return None
    if any(ch in value for ch in ("\n", "\r", "\t")):
        return None
    return value


# ---------- API ----------

@app.get("/api/history")
def get_history():
    return jsonify(read_history())


@app.post("/api/history")
def add_history():
    data = request.get_json(silent=True) or {}
    expression = clean_field(data.get("expression"))
    result = clean_field(data.get("result"))
    if expression is None or result is None:
        return jsonify({"error": "Нужны строковые поля expression и result"}), 400
    return jsonify(append_history(expression, result)), 201


@app.delete("/api/history")
def delete_history():
    clear_history()
    return "", 204


# Разрешаем запросы с других адресов — например, если index.html открыт как файл
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/api/history", methods=["OPTIONS"])
def history_options():
    return "", 204


# ---------- Фронтенд ----------

@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
