# Калькулятор

Веб-калькулятор: фронтенд на JavaScript, бэкенд на Python + Flask.

- Вычисления выполняются в браузере (`frontend/app.js`).
- Бэкенд хранит историю вычислений в файле `history.txt` в корне проекта.

## Структура

```
Калькулятор/
├── frontend/          # HTML, CSS, JS
│   ├── index.html
│   ├── style.css
│   └── app.js
├── backend/           # Flask-сервер
│   ├── app.py
│   └── requirements.txt
└── history.txt        # создаётся автоматически при первом вычислении
```

## Запуск

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Откройте http://127.0.0.1:5000 в браузере.

Если открыть `frontend/index.html` как файл, калькулятор тоже работает, а история
сохраняется, пока запущен сервер. Без сервера история показывается только до
перезагрузки страницы.

## API

| Метод  | Адрес          | Описание                                            |
|--------|----------------|-----------------------------------------------------|
| GET    | `/api/history` | Список записей, новые сверху                        |
| POST   | `/api/history` | Добавить запись: `{"expression": "12 + 7", "result": "19"}` |
| DELETE | `/api/history` | Очистить историю                                    |

## Формат history.txt

Одна строка — одно вычисление, поля разделены табуляцией:

```
2026-09-23 10:30:00	12 + 7	19
```
