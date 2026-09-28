const PROGRAM_URL = "https://univer.glavbukh.ru/promo/233790?utm_source=knowledge_test&utm_medium=webapp&utm_campaign=attestation_2027";
const STORAGE_KEY = "glavbukh-test-progress-v2";
const questions = window.TEST_QUESTIONS || [];

const screens = {
  intro: document.querySelector("#intro-screen"),
  quiz: document.querySelector("#quiz-screen"),
  result: document.querySelector("#result-screen")
};

const state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.answers)) return saved;
  } catch (_) {}
  return { current: 0, answers: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function track(eventName, params = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });
  window.dispatchEvent(new CustomEvent("gb-analytics", { detail: { eventName, params } }));
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => { element.hidden = key !== name; });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startTest(reset = false) {
  if (reset) {
    state.current = 0;
    state.answers = [];
    saveState();
  }
  if (state.answers.length >= questions.length && questions.length) {
    renderResult();
    return;
  }
  state.current = Math.min(state.answers.length, questions.length - 1);
  track("test_start", { resumed: state.answers.length > 0 });
  renderQuestion();
  showScreen("quiz");
}

function renderQuestion() {
  const item = questions[state.current];
  if (!item) return;
  document.querySelector("#question-number").textContent = `Вопрос ${state.current + 1} из ${questions.length}`;
  document.querySelector("#progress-percent").textContent = `${Math.round((state.current / questions.length) * 100)}%`;
  document.querySelector("#progress-bar").style.width = `${(state.current / questions.length) * 100}%`;
  document.querySelector("#question-category").textContent = item.category;
  document.querySelector("#question-title").textContent = item.question;

  const container = document.querySelector("#answers");
  container.innerHTML = "";
  item.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.className = "answer";
    button.type = "button";
    button.textContent = answer;
    button.addEventListener("click", () => submitAnswer(index));
    container.appendChild(button);
  });
}

function submitAnswer(answerIndex) {
  const item = questions[state.current];
  state.answers[state.current] = {
    category: item.category,
    answer: answerIndex,
    correct: answerIndex === item.correct
  };
  track("question_answer", { question: state.current + 1, category: item.category });
  state.current += 1;
  saveState();

  if (state.current >= questions.length) {
    track("test_complete");
    renderResult();
  } else {
    renderQuestion();
  }
}

function getLevel(percent) {
  if (percent >= 95) return {
    title: "Экспертный результат",
    text: "Вы уверенно ориентируетесь в профессиональных вопросах. Следующий шаг — подтвердить квалификацию, проверить себя на сложных практических ситуациях и систематизировать знания с учётом изменений 2027 года."
  };
  if (percent >= 75) return {
    title: "Уверенный профессиональный уровень",
    text: "У вас сильная практическая база. Программа поможет точечно обновить знания, разобраться в новых требованиях и подготовиться к изменениям без пробелов."
  };
  if (percent >= 50) return {
    title: "Хорошая база — есть зоны роста",
    text: "Вы справляетесь с большинством рабочих ситуаций, но отдельные темы требуют внимания. В программе вы сможете закрыть пробелы и отработать изменения на практике."
  };
  return {
    title: "Знания важно систематизировать",
    text: "В нескольких рабочих темах обнаружились зоны риска. Последовательное обучение поможет укрепить базу и увереннее применять новые правила в ежедневной работе."
  };
}

function renderResult() {
  const correct = state.answers.filter(item => item.correct).length;
  const percent = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  const level = getLevel(percent);

  document.querySelector("#score").textContent = `${percent}%`;
  document.querySelector("#result-title").textContent = level.title;
  document.querySelector("#result-copy").textContent = level.text;
  document.querySelector("#program-link").href = PROGRAM_URL;

  const categories = {};
  state.answers.forEach(item => {
    categories[item.category] ||= { correct: 0, total: 0 };
    categories[item.category].total += 1;
    if (item.correct) categories[item.category].correct += 1;
  });

  const breakdown = document.querySelector("#breakdown");
  breakdown.innerHTML = "";
  Object.entries(categories).forEach(([name, value]) => {
    const categoryPercent = Math.round((value.correct / value.total) * 100);
    const row = document.createElement("div");
    row.className = "breakdown-row";
    const colorClass = categoryPercent >= 75 ? "high" : categoryPercent >= 50 ? "medium" : "low";
    row.innerHTML = `<strong>${name}</strong><div class="mini-track"><div class="mini-bar ${colorClass}" style="width:${categoryPercent}%"></div></div><span>${categoryPercent}%</span>`;
    breakdown.appendChild(row);
  });

  track("result_view", { percent, level: level.title });
  showScreen("result");
}

document.querySelector("#start-button").addEventListener("click", () => startTest(false));
document.querySelector("#restart-button").addEventListener("click", () => startTest(true));
document.querySelector("#program-link").addEventListener("click", () => track("program_click", { program: "233790" }));

if (state.answers.length > 0 && state.answers.length < questions.length) {
  document.querySelector("#start-button").textContent = "Продолжить тест";
}

// WebMCP: те же действия доступны поддерживающим эту технологию браузерам и агентам.
if (document.modelContext?.registerTool) {
  const safeRegister = tool => Promise.resolve(document.modelContext.registerTool(tool)).catch(() => {});
  safeRegister({
    name: "read_test_progress",
    title: "Показать прогресс теста",
    description: "Возвращает текущий прогресс диагностического теста без изменения ответов.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => ({ answered: state.answers.length, total: questions.length, completed: state.answers.length >= questions.length })
  });
  safeRegister({
    name: "start_knowledge_test",
    title: "Начать тест знаний",
    description: "Открывает тест для практикующих бухгалтеров. Может начать его заново.",
    inputSchema: {
      type: "object",
      properties: { restart: { type: "boolean" } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async input => {
      startTest(Boolean(input?.restart));
      return { status: "started", question: state.current + 1, total: questions.length };
    }
  });
}

track("test_open");
