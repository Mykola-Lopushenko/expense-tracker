require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const mongoose  = require("mongoose");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const MONTHLY_BUDGET = 1000;
const JWT_SECRET     = process.env.JWT_SECRET || "change-this-secret-in-production";

// ── Database ──────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(error => console.error("MongoDB connection error:", error));

// ── Models ────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

const expenseSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true },
    amount:      { type: Number, required: true },
    category:    { type: String, required: true },
    date:        { type: Date,   default: Date.now },
  },
  { timestamps: true }
);

const Expense = mongoose.model("Expense", expenseSchema);

// ── Helpers ───────────────────────────────────────────────
const formatExpense = (expense) => ({
  id:          expense._id.toString(),
  description: expense.description,
  amount:      expense.amount,
  category:    expense.category,
  date:        expense.date,
});

/**
 * Build a MongoDB date filter that respects the user's local timezone.
 * tzOffset = client's getTimezoneOffset() in minutes (e.g. 420 for UTC-7).
 * We shift UTC boundaries so "today" means today in the user's timezone.
 */
const getDateFilter = (period, selectedDate, tzOffset = 0) => {
  // tzOffset from JS is positive when BEHIND UTC (e.g. LA = +420)
  // We subtract it to convert local midnight → UTC
  const offsetMs = tzOffset * 60 * 1000;

  let startUTC, endUTC;

  if (period === "date" || period === "today") {
    let baseDate;
    if (selectedDate) {
      // selectedDate is already local YYYY-MM-DD — parse as local midnight
      const [y, m, d] = selectedDate.split("-").map(Number);
      baseDate = new Date(Date.UTC(y, m - 1, d));
    } else {
      // Get today in user's local timezone
      const nowLocal = new Date(Date.now() - offsetMs);
      baseDate = new Date(Date.UTC(
        nowLocal.getUTCFullYear(),
        nowLocal.getUTCMonth(),
        nowLocal.getUTCDate()
      ));
    }
    // local midnight → UTC
    startUTC = new Date(baseDate.getTime() + offsetMs);
    endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  } else if (period === "week") {
    const nowLocal  = new Date(Date.now() - offsetMs);
    const dayOfWeek = nowLocal.getUTCDay();
    const monday    = new Date(Date.UTC(
      nowLocal.getUTCFullYear(),
      nowLocal.getUTCMonth(),
      nowLocal.getUTCDate() - dayOfWeek
    ));
    startUTC = new Date(monday.getTime() + offsetMs);

  } else if (period === "month") {
    const nowLocal = new Date(Date.now() - offsetMs);
    const firstDay = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), 1));
    startUTC = new Date(firstDay.getTime() + offsetMs);

  } else {
    return {};
  }

  return endUTC
    ? { date: { $gte: startUTC, $lt: endUTC } }
    : { date: { $gte: startUTC } };
};

const getExpensesByPeriod = async (userId, period, selectedDate, tzOffset = 0) => {
  const filter = { userId, ...getDateFilter(period, selectedDate, tzOffset) };
  return Expense.find(filter).sort({ date: -1 });
};

const getExpenseStats = (expenses) => {
  const amounts = expenses.map(e => Number(e.amount));
  if (amounts.length === 0) {
    return { totalSpending: 0, expenseCount: 0, averageExpense: 0,
             minimumExpense: 0, maximumExpense: 0, categoryTotals: {} };
  }
  const totalSpending  = amounts.reduce((s, a) => s + a, 0);
  const categoryTotals = expenses.reduce((totals, e) => {
    const cat = e.category || "Other";
    totals[cat] = (totals[cat] || 0) + Number(e.amount);
    return totals;
  }, {});
  return {
    totalSpending,
    expenseCount:   expenses.length,
    averageExpense: totalSpending / expenses.length,
    minimumExpense: Math.min(...amounts),
    maximumExpense: Math.max(...amounts),
    categoryTotals,
  };
};

const getBudgetAlertData = (totalSpending, budget) => {
  const remaining = budget - totalSpending;
  let status, message;
  if (remaining < 0) {
    status  = "over_budget";
    message = `You are over budget by $${Math.abs(remaining).toFixed(2)}.`;
  } else if (remaining <= budget * 0.2) {
    status  = "close_to_budget";
    message = `You are close to your budget. $${remaining.toFixed(2)} remaining.`;
  } else {
    status  = "under_budget";
    message = `You are under budget. $${remaining.toFixed(2)} remaining.`;
  }
  return { budget, total_spending: totalSpending, remaining, status, message };
};

// ── Auth Middleware ───────────────────────────────────────
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// helper to parse tzOffset from query string
const parseTz = (req) => parseInt(req.query.tzOffset || "0", 10);

// ── Auth Routes ───────────────────────────────────────────
app.get("/", (req, res) => res.send("Expense Tracker API is running"));

app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)      return res.status(400).json({ error: "Email and password are required" });
    if (password.length < 8)      return res.status(400).json({ error: "Password must be at least 8 characters" });
    const existing = await User.findOne({ email });
    if (existing)                 return res.status(409).json({ error: "An account with this email already exists" });
    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ email, password: hashed });
    const token  = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, email: user.email });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const user  = await User.findOne({ email });
    if (!user)               return res.status(401).json({ error: "Invalid email or password" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)              return res.status(401).json({ error: "Invalid email or password" });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, email: user.email });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── Expense Routes (all protected) ───────────────────────
app.get("/expenses", requireAuth, async (req, res) => {
  try {
    const expenses = await getExpensesByPeriod(
      req.userId,
      req.query.period || "all",
      req.query.date,
      parseTz(req)
    );
    res.json(expenses.map(formatExpense));
  } catch (error) {
    res.status(500).json({ error: "Failed to get expenses", details: error.message });
  }
});

app.post("/expenses", requireAuth, async (req, res) => {
  try {
    const { description, amount, category, date } = req.body;
    if (!description || !amount || !category) return res.status(400).json({ error: "Required fields missing" });
    const newExpense = await Expense.create({
      userId: req.userId,
      description,
      amount:   Number(amount),
      category,
      date:     date || new Date(),
    });
    res.json(formatExpense(newExpense));
  } catch {
    res.status(500).json({ error: "Failed to add expense" });
  }
});

app.put("/expenses/:id", requireAuth, async (req, res) => {
  try {
    const { description, amount, category, date } = req.body;
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.userId });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      { description, amount: Number(amount), category, date: date || new Date() },
      { new: true }
    );
    res.json(formatExpense(updated));
  } catch {
    res.status(500).json({ error: "Failed to update expense" });
  }
});

app.delete("/expenses/:id", requireAuth, async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.userId });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

app.get("/expenses/summary", requireAuth, async (req, res) => {
  try {
    const expenses = await getExpensesByPeriod(req.userId, req.query.period || "all", req.query.date, parseTz(req));
    const stats    = getExpenseStats(expenses);
    res.json({
      descriptive_statistics: { amount: { mean: stats.averageExpense, min: stats.minimumExpense, max: stats.maximumExpense } },
      check_missing: { amount: expenses.filter(e => e.amount == null).length },
    });
  } catch {
    res.status(500).json({ error: "Failed to get summary" });
  }
});

app.get("/expenses/budget-alert", requireAuth, async (req, res) => {
  try {
    const expenses = await getExpensesByPeriod(req.userId, req.query.period || "month", req.query.date, parseTz(req));
    const stats    = getExpenseStats(expenses);
    res.json(getBudgetAlertData(stats.totalSpending, Number(req.query.budget || MONTHLY_BUDGET)));
  } catch {
    res.status(500).json({ error: "Failed to get budget alert" });
  }
});

app.get("/expenses/monthly-report", requireAuth, async (req, res) => {
  try {
    const expenses = await getExpensesByPeriod(req.userId, req.query.period || "month", req.query.date, parseTz(req));
    const stats    = getExpenseStats(expenses);
    res.json({
      total_spending:  stats.totalSpending,
      expense_count:   stats.expenseCount,
      average_expense: stats.averageExpense,
      category_totals: stats.categoryTotals,
    });
  } catch {
    res.status(500).json({ error: "Failed to get monthly report" });
  }
});

app.get("/expenses/search-filter", requireAuth, async (req, res) => {
  try {
    const searchText = (req.query.search || "").toLowerCase();
    const expenses   = await getExpensesByPeriod(req.userId, req.query.period || "all", req.query.date, parseTz(req));
    const filtered   = expenses.map(formatExpense).filter(e =>
      e.description.toLowerCase().includes(searchText) ||
      e.category.toLowerCase().includes(searchText) ||
      String(e.amount).includes(searchText)
    );
    res.json({ filtered_data: filtered });
  } catch {
    res.status(500).json({ error: "Failed to search expenses" });
  }
});

app.get("/expenses/dashboard", requireAuth, async (req, res) => {
  try {
    const tz = parseTz(req);
    const [todayExp, weekExp, monthExp] = await Promise.all([
      getExpensesByPeriod(req.userId, "today", null, tz),
      getExpensesByPeriod(req.userId, "week",  null, tz),
      getExpensesByPeriod(req.userId, "month", null, tz),
    ]);
    const monthStats  = getExpenseStats(monthExp);
    const budgetAlert = getBudgetAlertData(monthStats.totalSpending, MONTHLY_BUDGET);
    const topCategory = Object.entries(monthStats.categoryTotals).sort((a, b) => b[1] - a[1])[0];
    res.json({
      monthly_budget:          MONTHLY_BUDGET,
      today_total:             getExpenseStats(todayExp).totalSpending,
      week_total:              getExpenseStats(weekExp).totalSpending,
      month_total:             monthStats.totalSpending,
      month_remaining:         budgetAlert.remaining,
      month_transaction_count: monthStats.expenseCount,
      top_category:            topCategory ? { category: topCategory[0], amount: topCategory[1] } : null,
      category_totals:         monthStats.categoryTotals,
    });
  } catch {
    res.status(500).json({ error: "Failed to get dashboard" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

