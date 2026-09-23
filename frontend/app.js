// Состояние калькулятора
const state = {
  current: "0",      // число, которое сейчас вводится
  previous: null,    // первый операнд
  operator: null,    // выбранная операция: + - * /
  resetNext: false,  // начать ввод нового числа при следующей цифре
};

// История вычислений. Хранится на сервере (Flask), здесь — её копия для отображения.
const calcHistory = [];

// Если страница открыта как файл, обращаемся к серверу по полному адресу
const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:5000" : "";
const HISTORY_URL = `${API_BASE}/api/history`;

const resultEl = document.getElementById("result");
const expressionEl = document.getElementById("expression");

const OP_SYMBOLS = { "+": "+", "-": "−", "*": "×", "/": "÷" };

// Вычисление. Пока считаем в браузере, позже здесь будет запрос к бэкенду на Flask.
function calculate(a, op, b) {
  const x = parseFloat(a);
  const y = parseFloat(b);
  switch (op) {
    case "+": return x + y;
    case "-": return x - y;
    case "*": return x * y;
    case "/":
      if (y === 0) throw new Error("Деление на ноль");
      return x / y;
  }
}

// Убираем хвосты вида 0.1 + 0.2 = 0.30000000000000004
function formatNumber(n) {
  return String(parseFloat(n.toPrecision(12)));
}

function render() {
  resultEl.textContent = state.current.replace(".", ",");
  expressionEl.textContent = state.operator
    ? `${state.previous.replace(".", ",")} ${OP_SYMBOLS[state.operator]}`
    : "";
  document.querySelectorAll(".key.op").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.op === state.operator && state.resetNext);
  });
}

function showError(message) {
  state.current = "0";
  state.previous = null;
  state.operator = null;
  state.resetNext = true;
  render();
  resultEl.textContent = message;
}

function inputDigit(d) {
  if (state.resetNext) {
    state.current = d;
    state.resetNext = false;
  } else if (state.current === "0") {
    state.current = d;
  } else if (state.current.replace(/[-.]/g, "").length < 15) {
    state.current += d;
  }
}

function inputDot() {
  if (state.resetNext) {
    state.current = "0.";
    state.resetNext = false;
  } else if (!state.current.includes(".")) {
    state.current += ".";
  }
}

function chooseOperator(op) {
  // Если уже есть операция и введено второе число, сначала досчитываем
  if (state.operator && !state.resetNext) {
    if (!evaluate()) return;
  }
  state.previous = state.current;
  state.operator = op;
  state.resetNext = true;
}

function evaluate() {
  if (!state.operator) return true;
  try {
    const value = calculate(state.previous, state.operator, state.current);
    const expr = `${state.previous} ${OP_SYMBOLS[state.operator]} ${state.current}`;
    state.current = formatNumber(value);
    addToHistory(expr, state.current);
    state.previous = null;
    state.operator = null;
    state.resetNext = true;
    return true;
  } catch (e) {
    showError(e.message);
    return false;
  }
}

function handleAction(action) {
  switch (action) {
    case "clear":
      state.current = "0";
      state.previous = null;
      state.operator = null;
      state.resetNext = false;
      break;
    case "sign":
      if (state.current !== "0") {
        state.current = state.current.startsWith("-")
          ? state.current.slice(1)
          : "-" + state.current;
      }
      break;
    case "percent":
      state.current = formatNumber(parseFloat(state.current) / 100);
      break;
    case "backspace":
      if (state.resetNext) break;
      state.current = state.current.length > 1 && state.current !== "-0"
        ? state.current.slice(0, -1)
        : "0";
      if (state.current === "-") state.current = "0";
      break;
    case "dot":
      inputDot();
      break;
    case "equals":
      if (!evaluate()) return;
      break;
  }
  render();
}

// ---------- История ----------
const historyEl = document.getElementById("history");
const historyListEl = document.getElementById("history-list");
const historyEmptyEl = document.getElementById("history-empty");
const historyToggleEl = document.getElementById("history-toggle");
const historyOfflineEl = document.getElementById("history-offline");

const toDisplay = (s) => s.replace(/\./g, ",");

function setOffline(offline) {
  historyOfflineEl.hidden = !offline;
}

// Загрузить историю с сервера
async function loadHistory() {
  try {
    const res = await fetch(HISTORY_URL);
    if (!res.ok) throw new Error(res.status);
    const items = await res.json();
    calcHistory.length = 0;
    calcHistory.push(...items);
    setOffline(false);
  } catch {
    setOffline(true);
  }
  renderHistory();
}

// Добавить запись: сразу показываем, в фоне отправляем на сервер
async function addToHistory(expression, result) {
  calcHistory.unshift({ expression, result }); // новые сверху
  renderHistory();
  try {
    const res = await fetch(HISTORY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expression, result }),
    });
    if (!res.ok) throw new Error(res.status);
    setOffline(false);
  } catch {
    setOffline(true);
  }
}

async function clearHistory() {
  try {
    const res = await fetch(HISTORY_URL, { method: "DELETE" });
    if (!res.ok) throw new Error(res.status);
    setOffline(false);
  } catch {
    setOffline(true);
  }
  calcHistory.length = 0;
  renderHistory();
}

function renderHistory() {
  historyListEl.innerHTML = "";
  calcHistory.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.dataset.index = i;
    li.innerHTML = `<div class="expr"></div><div class="value"></div>`;
    li.querySelector(".expr").textContent = toDisplay(item.expression) + " =";
    if (item.timestamp) li.title = item.timestamp;
    li.querySelector(".value").textContent = toDisplay(item.result);
    historyListEl.appendChild(li);
  });
  historyEmptyEl.hidden = calcHistory.length > 0;
}

function toggleHistory(show = historyEl.hidden) {
  historyEl.hidden = !show;
  historyToggleEl.classList.toggle("active", show);
}

historyToggleEl.addEventListener("click", () => toggleHistory());

document.getElementById("history-clear").addEventListener("click", clearHistory);

// Клик по записи — подставить её результат в калькулятор
historyListEl.addEventListener("click", (e) => {
  const li = e.target.closest(".history-item");
  if (!li) return;
  state.current = calcHistory[li.dataset.index].result;
  state.resetNext = true;
  toggleHistory(false);
  render();
});

// Клики по кнопкам
document.querySelector(".keys").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.digit !== undefined) {
    inputDigit(btn.dataset.digit);
    render();
  } else if (btn.dataset.op) {
    chooseOperator(btn.dataset.op);
    render();
  } else if (btn.dataset.action) {
    handleAction(btn.dataset.action);
  }
});

// Ввод с клавиатуры
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (/^[0-9]$/.test(k)) {
    inputDigit(k);
    render();
  } else if (["+", "-", "*", "/"].includes(k)) {
    e.preventDefault();
    chooseOperator(k);
    render();
  } else if (k === "Enter" || k === "=") {
    e.preventDefault();
    handleAction("equals");
  } else if (k === "." || k === ",") {
    handleAction("dot");
  } else if (k === "Backspace") {
    handleAction("backspace");
  } else if (k === "Escape" || k === "Delete") {
    handleAction("clear");
  } else if (k === "%") {
    handleAction("percent");
  } else if (k === "h" || k === "H" || k === "р" || k === "Р") {
    toggleHistory();
  }
});

render();
loadHistory();
