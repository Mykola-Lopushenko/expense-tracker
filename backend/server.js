require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

const MONTHLY_BUDGET = 1000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(error => console.error("MongoDB connection error:", error));

const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const Expense = mongoose.model("Expense", expenseSchema);

const formatExpense = (expense) => ({
  id: expense._id.toString(),
  description: expense.description,
  amount: expense.amount,
  category: expense.category,
  date: expense.date
});

const getDateFilter = (period, selectedDate) => {
  const now = selectedDate ? new Date(selectedDate) : new Date();
  let startDate;
  let endDate;

  if (period === "date") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (period === "today") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day;
    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
  } else if (period === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    return {};
  }

  if (endDate) {
    return {
      date: {
        $gte: startDate,
        $lt: endDate
      }
    };
  }

  return {
    date: {
      $gte: startDate
    }
  };
};

const getExpensesByPeriod = async (period, selectedDate) => {
  const filter = getDateFilter(period, selectedDate);
  return Expense.find(filter).sort({ date: -1 });
};

const getExpenseStats = (expenses) => {
  const amounts = expenses.map(expense => Number(expense.amount));

  if (amounts.length === 0) {
    return {
      totalSpending: 0,
      expenseCount: 0,
      averageExpense: 0,
      minimumExpense: 0,
      maximumExpense: 0,
      categoryTotals: {}
    };
  }

  const totalSpending = amounts.reduce((sum, amount) => sum + amount, 0);

  const categoryTotals = expenses.reduce((totals, expense) => {
    const category = expense.category || "Other";
    totals[category] = (totals[category] || 0) + Number(expense.amount);
    return totals;
  }, {});

  return {
    totalSpending,
    expenseCount: expenses.length,
    averageExpense: totalSpending / expenses.length,
    minimumExpense: Math.min(...amounts),
    maximumExpense: Math.max(...amounts),
    categoryTotals
  };
};

const getBudgetAlert = (totalSpending, budget) => {
  const remaining = budget - totalSpending;

  let status;
  let message;

  if (remaining < 0) {
    status = "over_budget";
    message = `You are over budget by $${Math.abs(remaining).toFixed(2)}.`;
  } else if (remaining <= budget * 0.2) {
    status = "close_to_budget";
    message = `You are close to your budget limit. You have $${remaining.toFixed(2)} remaining.`;
  } else {
    status = "under_budget";
    message = `You are under budget. You have $${remaining.toFixed(2)} remaining.`;
  }

  return {
    budget,
    total_spending: totalSpending,
    remaining,
    status,
    message
  };
};

app.get("/", (req, res) => {
  res.send("Expense Tracker API is running");
});

// GET expenses by period
app.get("/expenses", async (req, res) => {
  try {
    const period = req.query.period || "all";
    const selectedDate = req.query.date;
    const expenses = await getExpensesByPeriod(period, selectedDate);

    res.json(expenses.map(formatExpense));
  } catch (error) {
    console.error("GET /expenses error:", error);
    res.status(500).json({
      error: "Failed to get expenses",
      details: error.message
    });
  }
});

// ADD expense
app.post("/expenses", async (req, res) => {
  try {
    const { description, amount, category, date } = req.body;

    if (!description || !amount || !category) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const newExpense = await Expense.create({
      description,
      amount: Number(amount),
      category,
      date: date || new Date()
    });

    res.json(formatExpense(newExpense));
  } catch (error) {
    res.status(500).json({ error: "Failed to add expense" });
  }
});

// UPDATE expense
app.put("/expenses/:id", async (req, res) => {
  try {
    const { description, amount, category, date } = req.body;

    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      {
        description,
        amount: Number(amount),
        category,
        date: date || new Date()
      },
      { new: true }
    );

    if (!updatedExpense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json(formatExpense(updatedExpense));
  } catch (error) {
    res.status(500).json({ error: "Failed to update expense" });
  }
});

// DELETE expense
app.delete("/expenses/:id", async (req, res) => {
  try {
    const deletedExpense = await Expense.findByIdAndDelete(req.params.id);

    if (!deletedExpense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

// SUMMARY
app.get("/expenses/summary", async (req, res) => {
  try {
    const period = req.query.period || "all";
    const selectedDate = req.query.date;
    const expenses = await getExpensesByPeriod(period, selectedDate);

    const stats = getExpenseStats(expenses);

    res.json({
      descriptive_statistics: {
        amount: {
          mean: stats.averageExpense,
          min: stats.minimumExpense,
          max: stats.maximumExpense
        }
      },
      check_missing: {
        amount: expenses.filter(expense => expense.amount === null || expense.amount === undefined).length
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get expense summary" });
  }
});

// BUDGET ALERT
app.get("/expenses/budget-alert", async (req, res) => {
  try {
    const period = req.query.period || "month";
    const selectedDate = req.query.date;
    const expenses = await getExpensesByPeriod(period, selectedDate);

    const budget = Number(req.query.budget || MONTHLY_BUDGET);
    const stats = getExpenseStats(expenses);

    res.json(getBudgetAlert(stats.totalSpending, budget));
  } catch (error) {
    res.status(500).json({ error: "Failed to get budget alert" });
  }
});

// MONTHLY REPORT
app.get("/expenses/monthly-report", async (req, res) => {
  try {
    const period = req.query.period || "month";
    const selectedDate = req.query.date;
    const expenses = await getExpensesByPeriod(period, selectedDate);

    const stats = getExpenseStats(expenses);

    res.json({
      total_spending: stats.totalSpending,
      expense_count: stats.expenseCount,
      average_expense: stats.averageExpense,
      category_totals: stats.categoryTotals
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get monthly report" });
  }
});

// SEARCH AND FILTER
app.get("/expenses/search-filter", async (req, res) => {
  try {
    const period = req.query.period || "all";
    const selectedDate = req.query.date;
    const searchText = (req.query.search || "").toLowerCase();

    const expenses = await getExpensesByPeriod(period, selectedDate);

    const filteredData = expenses
      .map(formatExpense)
      .filter(expense =>
        expense.description.toLowerCase().includes(searchText) ||
        expense.category.toLowerCase().includes(searchText) ||
        String(expense.amount).includes(searchText)
      );

    res.json({
      filtered_data: filteredData
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to search and filter expenses" });
  }
});

// DASHBOARD
app.get("/expenses/dashboard", async (req, res) => {
  try {
    const todayExpenses = await getExpensesByPeriod("today");
    const weekExpenses = await getExpensesByPeriod("week");
    const monthExpenses = await getExpensesByPeriod("month");

    const todayStats = getExpenseStats(todayExpenses);
    const weekStats = getExpenseStats(weekExpenses);
    const monthStats = getExpenseStats(monthExpenses);

    const budgetAlert = getBudgetAlert(monthStats.totalSpending, MONTHLY_BUDGET);

    const topCategory = Object.entries(monthStats.categoryTotals).sort(
      (a, b) => b[1] - a[1]
    )[0];

    res.json({
      monthly_budget: MONTHLY_BUDGET,
      today_total: todayStats.totalSpending,
      week_total: weekStats.totalSpending,
      month_total: monthStats.totalSpending,
      month_remaining: budgetAlert.remaining,
      month_transaction_count: monthStats.expenseCount,
      top_category: topCategory
        ? {
            category: topCategory[0],
            amount: topCategory[1]
          }
        : null,
      category_totals: monthStats.categoryTotals
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get dashboard data" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});