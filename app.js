const state = {
  questions: [],
  answers: {},
  current: 0,
  teamId: null,
  teamName: "",
  startedAt: null,
  durationSeconds: 600,
  timerInterval: null,
  submitted: false,
  adminToken: localStorage.getItem("cyberquest_admin_token") || "",
  results: []
};

const $ = (id) => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const min = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = {};
  try { data = await response.json(); } catch {}

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

async function startQuiz(event) {
  event.preventDefault();
  $("startError").textContent = "";

  const teamName = $("teamName").value.trim().replace(/\s+/g, " ");

  try {
    // Server performs the real uniqueness check.
    const data = await api("/api/quiz/start", {
      method: "POST",
      body: JSON.stringify({ teamName })
    });

    state.teamId = data.teamId;
    state.teamName = data.teamName;
    state.startedAt = new Date(data.startedAt);
    state.durationSeconds = data.durationSeconds;
    state.questions = data.questions;
    state.answers = {};
    state.current = 0;
    state.submitted = false;

    $("quizTeamName").textContent = state.teamName;

    showScreen("quizScreen");
    renderQuestion();
    startTimer();
  } catch (error) {
    $("startError").textContent = error.message;
  }
}

function startTimer() {
  clearInterval(state.timerInterval);

  const tick = () => {
    if (state.submitted) return;

    const elapsed = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
    const remaining = Math.max(0, state.durationSeconds - elapsed);

    $("timer").textContent = formatTime(remaining);

    if (remaining <= 60) {
      $("timer").style.borderColor = "rgba(251,113,133,.7)";
      $("timer").style.color = "#fb7185";
    }

    if (remaining === 0) {
      clearInterval(state.timerInterval);
      submitQuiz(true);
    }
  };

  tick();
  state.timerInterval = setInterval(tick, 500);
}

function renderQuestion() {
  const q = state.questions[state.current];
  if (!q) return;

  $("questionNumber").textContent = String(q.id).padStart(2, "0");
  $("questionCounter").textContent = `Question ${state.current + 1} of ${state.questions.length}`;
  $("questionText").textContent = q.question;
  $("progressBar").style.width = `${((state.current + 1) / state.questions.length) * 100}%`;

  const letters = ["A", "B", "C", "D"];
  const selected = state.answers[q.id];

  $("options").innerHTML = q.options.map((option, index) => `
    <div class="option ${selected === index ? "selected" : ""}" data-index="${index}">
      <div class="option-letter">${letters[index]}</div>
      <div>${escapeHtml(option)}</div>
    </div>
  `).join("");

  document.querySelectorAll(".option").forEach(el => {
    el.addEventListener("click", () => {
      state.answers[q.id] = Number(el.dataset.index);
      renderQuestion();
    });
  });

  $("prevBtn").disabled = state.current === 0;
  $("prevBtn").style.opacity = state.current === 0 ? ".45" : "1";
  $("nextBtn").textContent =
    state.current === state.questions.length - 1 ? "Submit Quiz ✓" : "Next →";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("prevBtn").addEventListener("click", () => {
  if (state.current > 0) {
    state.current--;
    renderQuestion();
  }
});

$("nextBtn").addEventListener("click", () => {
  if (state.current < state.questions.length - 1) {
    state.current++;
    renderQuestion();
  } else {
    submitQuiz(false);
  }
});

async function submitQuiz(autoSubmitted) {
  if (state.submitted) return;

  state.submitted = true;
  clearInterval(state.timerInterval);

  const answers = Object.entries(state.answers).map(([questionId, answer]) => ({
    questionId: Number(questionId),
    answer: Number(answer)
  }));

  try {
    const result = await api("/api/quiz/submit", {
      method: "POST",
      body: JSON.stringify({
        teamId: state.teamId,
        answers
      })
    });

    $("resultMessage").textContent = autoSubmitted
      ? "The 10-minute limit was reached and your answers were submitted automatically."
      : "Your answers have been submitted successfully.";

    $("resultScore").textContent = `${result.score}/${result.total}`;
    $("resultTime").textContent = formatTime(result.timeTakenSeconds);
    $("resultStatus").textContent = result.status === "time_up" ? "Time Up" : "Completed";

    showScreen("resultScreen");
  } catch (error) {
    // A network interruption should not make a team think they can restart.
    // The server decides whether the submission was already accepted.
    state.submitted = false;
    $("resultMessage").textContent = error.message;
    showScreen("resultScreen");
  }
}

// Admin
$("adminOpenBtn").addEventListener("click", () => {
  if (state.adminToken) {
    showScreen("adminScreen");
    loadAdminDashboard();
  } else {
    showScreen("adminLoginScreen");
  }
});

$("adminCloseBtn").addEventListener("click", () => showScreen("startScreen"));

$("startForm").addEventListener("submit", startQuiz);

$("adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("adminLoginError").textContent = "";

  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("adminUsername").value,
        password: $("adminPassword").value
      })
    });

    state.adminToken = data.token;
    localStorage.setItem("cyberquest_admin_token", data.token);
    $("adminPassword").value = "";

    showScreen("adminScreen");
    loadAdminDashboard();
  } catch (error) {
    $("adminLoginError").textContent = error.message;
  }
});

async function adminApi(url) {
  return api(url, {
    headers: {
      Authorization: `Bearer ${state.adminToken}`
    }
  });
}

async function loadAdminDashboard() {
  try {
    const [results, stats] = await Promise.all([
      adminApi("/api/admin/results"),
      adminApi("/api/admin/stats")
    ]);

    state.results = results.teams;

    $("statTotal").textContent = stats.total;
    $("statCompleted").textContent = stats.completed;
    $("statTimeUp").textContent = stats.timeUp;
    $("statStarted").textContent = stats.started;

    renderResults();
  } catch (error) {
    if (error.message.toLowerCase().includes("session") ||
        error.message.toLowerCase().includes("expired") ||
        error.message.toLowerCase().includes("login")) {
      logoutAdmin();
    } else {
      alert(error.message);
    }
  }
}

function renderResults() {
  const search = $("searchInput").value.trim().toLowerCase();
  const rows = state.results.filter(team =>
    team.teamName.toLowerCase().includes(search)
  );

  $("resultsBody").innerHTML = rows.map((team, index) => {
    const started = new Date(team.startedAt).toLocaleString();
    const time = team.timeTakenSeconds == null
      ? "—"
      : formatTime(team.timeTakenSeconds);

    const statusText = team.status === "time_up"
      ? "Time Up"
      : team.status === "completed"
        ? "Completed"
        : "In Progress";

    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(team.teamName)}</strong></td>
        <td>${team.score}/15</td>
        <td>${time}</td>
        <td><span class="status ${team.status}">${statusText}</span></td>
        <td>${escapeHtml(started)}</td>
      </tr>
    `;
  }).join("");

  if (!rows.length) {
    $("resultsBody").innerHTML =
      `<tr><td colspan="6">No teams found.</td></tr>`;
  }
}

$("searchInput").addEventListener("input", renderResults);
$("refreshBtn").addEventListener("click", loadAdminDashboard);

$("logoutBtn").addEventListener("click", logoutAdmin);

function logoutAdmin() {
  state.adminToken = "";
  localStorage.removeItem("cyberquest_admin_token");
  showScreen("startScreen");
}

$("exportBtn").addEventListener("click", () => {
  if (!state.results.length) return;

  const header = ["Team Name", "Mark", "Time Taken", "Status", "Started At"];
  const rows = state.results.map(t => [
    t.teamName,
    `${t.score}/15`,
    t.timeTakenSeconds == null ? "" : formatTime(t.timeTakenSeconds),
    t.status,
    new Date(t.startedAt).toISOString()
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cyberquest-results.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// If admin token exists, keep it; actual API verification happens when dashboard opens.
