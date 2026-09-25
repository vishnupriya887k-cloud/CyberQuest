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
    question: "A penetration tester discovers that a server accepts a user-controlled parameter such as file=../../../../etc/passwd. The application returns the contents of the targeted file. Which vulnerability has been demonstrated?",
    options: ["Server-Side Request Forgery (SSRF)", "Local File Inclusion / Path Traversal", "Cross-Site Scripting", "XML External Entity (XXE)"],
    answer: 1
  },
  {
    id: 2,
    question: "During an internal security assessment, a tester captures an NTLM authentication exchange and later successfully authenticates to another service using the captured exchange without knowing the user's plaintext password. Which attack technique is most closely associated with this scenario?",
    options: ["Pass-the-Hash", "Credential Stuffing", "Password Spraying", "DNS Tunneling"],
    answer: 0
  },
  {
    id: 3,
    question: "During a penetration test, an analyst finds that a web server makes HTTP requests to a URL supplied by the user. The tester demonstrates that the server can access an internal cloud metadata endpoint that is unreachable directly from the Internet. What vulnerability is being demonstrated?",
    options: ["Blind SQL Injection", "Server-Side Request Forgery (SSRF)", "Cross-Site Request Forgery (CSRF)", "HTTP Request Smuggling"],
    answer: 1
  },
  {
    id: 4,
    question: "A web application accepts a user-controlled URL and retrieves the requested resource from its own server. During testing, the application can reach services that are inaccessible from the tester's external network. What security issue should the tester investigate?",
    options: ["Cross-Site Request Forgery", "Server-side request abuse", "Client-side template injection", "Session fixation"],
    answer: 1
  },
  {
    id: 5,
    question: "During an internal assessment, a tester obtains an authentication value associated with a Windows account. Instead of recovering the original password, the tester uses the obtained value to authenticate to another system where the account has access. Which technique best describes this?",
    options: ["Password spraying", "Pass-the-Hash", "Kerberoasting", "Credential stuffing"],
    answer: 1
  },
  {
    id: 6,
    question: "During a security assessment, an application uses a JWT for authentication. The tester modifies the token's claims and finds that the server accepts the modified token without properly validating its signature. What security issue is most directly indicated?",
    options: ["Broken access control", "Improper JWT signature validation", "SQL injection", "DNS poisoning"],
    answer: 1
  },
  {
    id: 7,
    question: "A tester discovers that an application generates password-reset tokens using a predictable value based on the user's timestamp. What is the primary security concern?",
    options: ["Weak randomness allowing token prediction", "Cross-Site Request Forgery", "DNS tunneling", "Buffer overflow"],
    answer: 0
  },
  {
    id: 8,
    question: "An internal application uses an account with excessive database privileges. A SQL injection vulnerability is discovered that allows database queries to execute under that account. Which security principle was violated, increasing the potential impact?",
    options: ["Defense in depth", "Least privilege", "Non-repudiation", "Data minimization"],
    answer: 1
  },
  {
    id: 9,
    question: "A web application allows a user to modify the user_id parameter in a request and access another user's private profile without performing an authorization check. What vulnerability does this most closely represent?",
    options: ["Insecure Direct Object Reference / Broken Access Control", "Server-Side Request Forgery", "Cross-Site Scripting", "XML External Entity"],
    answer: 0
  },
  {
    id: 10,
    question: "During an authorized penetration test, a tester discovers that a web application accepts serialized objects from users and automatically deserializes them without validating their integrity or type. Why is this particularly dangerous?",
    options: ["It can potentially lead to unauthorized object manipulation or code execution", "It only causes slower DNS resolution", "It prevents HTTPS from functioning", "It automatically exposes the user's IP address"],
    answer: 0
  },
  {
    id: 11,
    question: "What does the TOCTOU vulnerability class exploit?",
    options: ["Weak password policies", "Race condition between checking and using a resource", "Buffer overflow in stack memory", "Insecure cookie storage"],
    answer: 1
  },
  {
    id: 12,
    question: "What is Kerberoasting primarily used to attack?",
    options: ["Web session cookies", "Service account credentials via Kerberos tickets", "DNS cache records", "SSL certificates"],
    answer: 1
  },
  {
    id: 13,
    question: "Which attack relays a victim's authentication hash to a server without cracking the actual password?",
    options: ["Rainbow table attack", "Pass-the-Hash", "Brute force attack", "Dictionary attack"],
    answer: 1
  },
  {
    id: 14,
    question: "What does IDOR stand for?",
    options: ["Internal Data Object Retrieval", "Insecure Direct Object Reference", "Indirect Denial of Resource", "Isolated Domain Object Request"],
    answer: 1
  },
  {
    id: 15,
    question: "In SSL Stripping attacks, what does the attacker primarily manipulate?",
    options: ["DNS records", "Downgrading HTTPS to HTTP during connection setup", "TLS certificate chains", "Browser cookies"],
    answer: 1
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

// Delete a team result (admin only)
app.delete("/api/admin/results/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid team ID." });
    }

    const deleted = await Team.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Team result not found." });
    }

    res.json({
      message: `Result for "${deleted.teamName}" deleted successfully.`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete the team result." });
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
