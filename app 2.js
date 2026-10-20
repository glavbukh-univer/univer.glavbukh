const PROGRAM_URL = "https://univer.glavbukh.ru/promo/233790?utm_source=knowledge_test&utm_medium=webapp&utm_campaign=attestation_2027";
const STORAGE_KEY = "glavbukh-test-progress-v2";
const METRIKA_COUNTER_ID = 113132415;
const METRIKA_GOALS = new Set([
  "test_start",
  "test_halfway",
  "test_complete",
  "program_details_open",
  "certificate_open",
  "program_click",
  "test_restart"
]);
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
  if (METRIKA_GOALS.has(eventName) && typeof window.ym === "function") {
    window.ym(METRIKA_COUNTER_ID, "reachGoal", eventName, params);
  }
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
    state.completionTracked = false;
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
  if (state.current === Math.ceil(questions.length / 2)) {
    track("test_halfway", { answered: state.current, total: questions.length });
  }
  saveState();

  if (state.current >= questions.length) {
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

function getProgramButtonText(percent) {
  if (percent < 50) return "Закрыть пробелы в знаниях";
  if (percent < 80) return "Подготовиться к изменениям 2027";
  return "Подтвердить квалификацию";
}

function getResultBand(percent) {
  if (percent < 50) return "low";
  if (percent < 80) return "medium";
  return "high";
}

function animateScore(percent) {
  const score = document.querySelector("#score");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    score.textContent = `${percent}%`;
    return;
  }

  const duration = 700;
  const startedAt = performance.now();
  const tick = now => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    score.textContent = `${Math.round(percent * eased)}%`;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderWeakTopics(categories) {
  const container = document.querySelector("#weak-topics");
  const list = document.querySelector("#weak-topics-list");
  const ranked = Object.entries(categories)
    .map(([name, value]) => ({ name, percent: Math.round((value.correct / value.total) * 100) }))
    .sort((a, b) => a.percent - b.percent);

  list.innerHTML = "";
  if (!ranked.length || ranked[0].percent === 100) {
    container.hidden = true;
    return;
  }

  const minimumPercent = ranked[0].percent;
  const weakestTopics = ranked.filter(topic => topic.percent === minimumPercent);
  container.querySelector("p").textContent = weakestTopics.length === 1
    ? "В первую очередь обратите внимание на тему:"
    : "В первую очередь обратите внимание на темы:";

  weakestTopics.forEach(topic => {
    const item = document.createElement("span");
    item.textContent = `${topic.name} — ${topic.percent}%`;
    list.appendChild(item);
  });
  container.hidden = false;
}

function renderResult() {
  const correct = state.answers.filter(item => item.correct).length;
  const percent = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  const level = getLevel(percent);

  const categories = {};
  state.answers.forEach(item => {
    categories[item.category] ||= { correct: 0, total: 0 };
    categories[item.category].total += 1;
    if (item.correct) categories[item.category].correct += 1;
  });

  const categoryScores = Object.fromEntries(
    Object.entries(categories).map(([name, value]) => [name, Math.round((value.correct / value.total) * 100)])
  );
  const scoreValues = Object.values(categoryScores);
  const weakestScore = scoreValues.length ? Math.min(...scoreValues) : 0;
  const weakestTopics = Object.entries(categoryScores)
    .filter(([, score]) => score === weakestScore && score < 100)
    .map(([name]) => name);
  const resultBand = getResultBand(percent);

  if (!state.completionTracked && state.answers.length >= questions.length) {
    const resultParams = {
      correct,
      total: questions.length,
      percent,
      level: level.title,
      result_band: resultBand,
      weakest_score: weakestScore,
      weak_topics: weakestTopics.join(", ") || "нет"
    };
    track("test_complete", resultParams);
    if (typeof window.ym === "function") {
      window.ym(METRIKA_COUNTER_ID, "params", { test_result: resultParams });
    }
    state.completionTracked = true;
    saveState();
  }

  document.querySelector("#score").textContent = "0%";
  document.querySelector("#result-title").textContent = level.title;
  document.querySelector("#result-copy").textContent = level.text;
  const programLink = document.querySelector("#program-link");
  programLink.href = `${PROGRAM_URL}&utm_content=result_${resultBand}`;
  programLink.textContent = getProgramButtonText(percent);

  const breakdown = document.querySelector("#breakdown");
  breakdown.innerHTML = "";
  breakdown.classList.remove("is-visible");
  Object.entries(categories).forEach(([name, value]) => {
    const categoryPercent = Math.round((value.correct / value.total) * 100);
    const row = document.createElement("div");
    row.className = "breakdown-row";
    const colorClass = categoryPercent >= 75 ? "high" : categoryPercent >= 50 ? "medium" : "low";
    row.innerHTML = `<strong>${name}</strong><div class="mini-track"><div class="mini-bar ${colorClass}" style="--target-width:${categoryPercent}%"></div></div><span>${categoryPercent}%</span>`;
    breakdown.appendChild(row);
  });

  renderWeakTopics(categories);
  animateScore(percent);
  requestAnimationFrame(() => requestAnimationFrame(() => breakdown.classList.add("is-visible")));

  track("result_view", { percent, level: level.title });
  showScreen("result");
}

document.querySelector("#start-button").addEventListener("click", () => startTest(false));
document.querySelector("#restart-button").addEventListener("click", () => {
  track("test_restart");
  startTest(true);
});
document.querySelector("#program-link").addEventListener("click", () => track("program_click", { program: "233790" }));

const programDisclosure = document.querySelector("#program-disclosure");
programDisclosure.addEventListener("toggle", () => {
  if (programDisclosure.open) track("program_details_open");
});

const certificatePreview = document.querySelector("#certificate-preview");
const certificateDialog = document.querySelector("#certificate-dialog");
const certificateClose = document.querySelector("#certificate-close");

certificatePreview.addEventListener("click", event => {
  track("certificate_open");
  const useFullImage = window.matchMedia("(max-width: 800px)").matches
    || typeof certificateDialog.showModal !== "function";
  if (useFullImage) return;
  event.preventDefault();
  certificateDialog.showModal();
});
certificateClose.addEventListener("click", () => certificateDialog.close());
certificateDialog.addEventListener("click", event => {
  if (event.target === certificateDialog) certificateDialog.close();
});

if (state.answers.length > 0 && state.answers.length < questions.length) {
  document.querySelector("#start-button").textContent = "Продолжить тест";
}

// WebMCP: те же действия доступны поддерживающим эту технологию браузерам и агентам.
if (document.modelContext?.registerTool) {
  const safeRegister = tool => Promise.resolve(document.modelContext.registerTool(tool)).catch(() => {});
  safeRegister({
    name: "read_test_progress",
    title: "Показать прогресс теста",
    description: "Возвращает текущий прогресс теста без изменения ответов.",
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
