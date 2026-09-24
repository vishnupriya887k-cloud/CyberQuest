require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 5000;
const QUIZ_DURATION_SECONDS = 10 * 60;

app.use(express.json({ limit: "100kb" }));

const allowedOrigin = process.env.CLIENT_ORIGIN || "*";
app.use(cors({
  origin: allowedOrigin === "*" ? true : allowedOrigin,
  credentials: false
}));

app.use(express.static(path.join(__dirname, "public")));

const questionBank = [
  {
    id: 1,
    question: "Which protocol is primarily used to securely transfer web pages over the Internet?",
    options: ["HTTP", "HTTPS", "FTP", "SMTP"],
    answer: 1
  },
  {
    id: 2,
    question: "Which of the following is a symmetric encryption algorithm?",
    options: ["RSA", "ECC", "AES", "DSA"],
    answer: 2
  },
  {
    id: 3,
    question: "What does CIA stand for in information security?",
    options: [
      "Confidentiality, Integrity, Availability",
      "Control, Inspection, Authentication",
      "Cybersecurity, Intelligence, Access",
      "Confidentiality, Inspection, Authorization"
    ],
    answer: 0
  },
  {
    id: 4,
    question: "Which device is commonly used to filter network traffic based on security rules?",
    options: ["Firewall", "Repeater", "Hub", "Printer"],
    answer: 0
  },
  {
    id: 5,
    question: "Which attack attempts to overwhelm a service with a large amount of traffic?",
    options: ["Phishing", "DDoS", "SQL Injection", "Shoulder Surfing"],
    answer: 1
  },
  {
    id: 6,
    question: "Which HTTP status code means 'Not Found'?",
    options: ["200", "301", "404", "500"],
    answer: 2
  },
  {
    id: 7,
    question: "Which technology is used to store a password securely instead of storing the original password?",
    options: ["Hashing", "Plain text", "Encoding", "Compression"],
    answer: 0
  },
  {
    id: 8,
    question: "What is the main purpose of multi-factor authentication?",
    options: [
      "To increase Internet speed",
      "To provide more than one verification factor",
      "To compress passwords",
      "To hide a website"
    ],
    answer: 1
  },
  {
    id: 9,
    question: "Which language is commonly used to query relational databases?",
    options: ["HTML", "CSS", "SQL", "XML"],
    answer: 2
  },
  {
    id: 10,
    question: "Which attack injects malicious SQL statements into an application's database query?",
    options: ["SQL Injection", "DDoS", "Brute Force", "DNS Spoofing"],
    answer: 0
  },
  {
    id: 11,
    question: "Which port is the default port for HTTPS?",
    options: ["21", "25", "80", "443"],
    answer: 3
  },
  {
    id: 12,
    question: "What is phishing primarily designed to do?",
    options: [
      "Improve network speed",
      "Trick users into revealing sensitive information",
      "Encrypt a hard disk",
      "Repair a server"
    ],
    answer: 1
  },
  {
    id: 13,
    question: "Which data structure follows the LIFO principle?",
    options: ["Queue", "Stack", "Linked List", "Tree"],
    answer: 1
  },
  {
    id: 14,
    question: "Which algorithm is commonly used to find the shortest path from a source vertex in a graph with non-negative edge weights?",
    options: ["Dijkstra's algorithm", "Kruskal's algorithm", "KMP", "Binary Search"],
    answer: 0
  },
  {
    id: 15,
    question: "Which DNS record type maps a domain name to an IPv4 address?",
    options: ["MX", "CNAME", "A", "TXT"],
    answer: 2
  }
];

const teamSchema = new mongoose.Schema({
  teamName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 80
  },
  normalizedTeamName: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  startedAt: {
    type: Date,
    required: true
  },
  completedAt: {
    type: Date,
    default: null
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 15
  },
  timeTakenSeconds: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ["started", "completed", "time_up"],
    default: "started"
  }
}, { timestamps: true });

const Team = mongoose.model("Team", teamSchema);

function normalizeTeamName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function createAdminToken() {
  return jwt.sign(
    { role: "admin", username: process.env.ADMIN_USERNAME || "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Admin login required." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") throw new Error("Invalid role");
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired admin session." });
  }
}

function publicQuestions() {
  return questionBank.map(q => ({
    id: q.id,
    question: q.question,
    options: q.options
  }));
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "CyberQuest" });
});

// Get quiz questions
app.get("/api/quiz", (req, res) => {
  res.json({
    title: "CyberQuest",
    durationSeconds: QUIZ_DURATION_SECONDS,
    totalQuestions: questionBank.length,
    questions: publicQuestions()
  });
});

// Check whether a team has already entered
app.post("/api/teams/check", async (req, res) => {
  try {
    const normalized = normalizeTeamName(req.body.teamName);

    if (!normalized) {
      return res.status(400).json({ message: "Enter a team name." });
    }

    const existing = await Team.findOne({ normalizedTeamName: normalized }).lean();

    res.json({
      exists: !!existing,
      message: existing
        ? "This team has already entered CyberQuest."
        : "Team is eligible to start."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error." });
  }
});

// Start quiz - the unique database index prevents duplicate teams even on simultaneous requests
app.post("/api/quiz/start", async (req, res) => {
  try {
    const teamName = String(req.body.teamName || "").trim().replace(/\s+/g, " ");
    const normalizedTeamName = normalizeTeamName(teamName);

    if (teamName.length < 2 || teamName.length > 80) {
      return res.status(400).json({ message: "Team name must be 2 to 80 characters." });
    }

    const existing = await Team.findOne({ normalizedTeamName }).lean();
    if (existing) {
      return res.status(409).json({
        message: "This team has already participated. A team can enter only once."
      });
    }

    const startedAt = new Date();

    try {
      const team = await Team.create({
        teamName,
        normalizedTeamName,
        startedAt,
        status: "started"
      });

      res.status(201).json({
        teamId: team._id,
        teamName: team.teamName,
        startedAt: team.startedAt,
        durationSeconds: QUIZ_DURATION_SECONDS,
        questions: publicQuestions()
      });
    } catch (error) {
      // Handles race condition: two devices submit the same team at almost exactly the same time.
      if (error.code === 11000) {
        return res.status(409).json({
          message: "This team has already participated. A team can enter only once."
        });
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not start the quiz." });
  }
});

// Submit quiz
app.post("/api/quiz/submit", async (req, res) => {
  try {
    const { teamId, answers } = req.body;

    if (!mongoose.isValidObjectId(teamId)) {
      return res.status(400).json({ message: "Invalid team session." });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: "Invalid answer data." });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team session not found." });
    }

    if (team.status !== "started") {
      return res.status(409).json({
        message: "This quiz has already been submitted.",
        score: team.score,
        timeTakenSeconds: team.timeTakenSeconds,
        status: team.status
      });
    }

    const now = new Date();
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - team.startedAt.getTime()) / 1000)
    );

    const finalTime = Math.min(elapsedSeconds, QUIZ_DURATION_SECONDS);
    const timeUp = elapsedSeconds >= QUIZ_DURATION_SECONDS;

    let score = 0;

    for (const q of questionBank) {
      const submitted = answers.find(a => Number(a.questionId) === q.id);
      const selected = submitted ? Number(submitted.answer) : -1;

      if (selected === q.answer) score++;
    }

    team.score = score;
    team.timeTakenSeconds = finalTime;
    team.completedAt = now;
    team.status = timeUp ? "time_up" : "completed";

    await team.save();

    res.json({
      message: timeUp ? "Time is up. Quiz submitted automatically." : "Quiz submitted successfully.",
      score,
      total: questionBank.length,
      timeTakenSeconds: finalTime,
      status: team.status
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not submit the quiz." });
  }
});

// Admin login
app.post("/api/admin/login", (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");

  const expectedUsername = process.env.ADMIN_USERNAME || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    return res.status(500).json({
      message: "ADMIN_PASSWORD is not configured on the server."
    });
  }

  if (username !== expectedUsername || password !== expectedPassword) {
    return res.status(401).json({ message: "Invalid admin username or password." });
  }

  res.json({
    token: createAdminToken(),
    username: expectedUsername
  });
});

// Admin results
app.get("/api/admin/results", requireAdmin, async (req, res) => {
  try {
    const teams = await Team.find({})
      .select("teamName score timeTakenSeconds status startedAt completedAt createdAt")
      .sort({ score: -1, timeTakenSeconds: 1, createdAt: 1 })
      .lean();

    res.json({ teams });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load results." });
  }
});

// Admin dashboard statistics
app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [total, completed, timeUp, started] = await Promise.all([
      Team.countDocuments(),
      Team.countDocuments({ status: "completed" }),
      Team.countDocuments({ status: "time_up" }),
      Team.countDocuments({ status: "started" })
    ]);

    res.json({ total, completed, timeUp, started });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load statistics." });
  }
});

// Single-page frontend fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`CyberQuest running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
