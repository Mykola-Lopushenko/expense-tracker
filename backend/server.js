require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

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

// DATA SUMMARY MICROSERVICE
app.get("/expenses/summary", async (req, res) => {
  try {
    const period = req.query.period || "all";
    const selectedDate = req.query.date;
    const expenses = await getExpensesByPeriod(period, selectedDate);

    const response = await axios.post("http://127.0.0.1:5001/api/summary", {
      data: expenses.map(expense => ({
        description: expense.description,
        amount: expense.amount,
        category: expense.category
      })),
      actions: ["descriptive_statistics", "check_missing"]
    });

    res.json(response.data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to get expense summary" });
  }
});

// BUDGET ALERT MICROSERVICE
app.get("/expenses/budget-alert", async (req, res) => {
  try {
    const period = req.query.period || "all";
    const selectedDate = req.query.date;
    const expenses = await getExpensesByPeriod(period, selectedDate);

    const budget = Number(req.query.budget || 250);
    const totalSpending = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0
    );

    const response = await axios.post("http://127.0.0.1:5002/api/budget-alert", {
      budget,
      total_spending: totalSpending
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to get budget alert" });
  }
});

// MONTHLY REPORT MICROSERVICE
app.get("/expenses/monthly-report", async (req, res) => {
  try {
    const period = req.query.period || "all";
    const selectedDate = req.query.date;
    const expenses = await getExpensesByPeriod(period, selectedDate);

    const response = await axios.post("http://127.0.0.1:5003/api/monthly-report", {
      expenses: expenses.map(formatExpense)
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to get monthly report" });
  }
});

// SEARCH AND FILTER MICROSERVICE
app.get("/expenses/search-filter", async (req, res) => {
  try {
    const period = req.query.period || "all";
    const selectedDate = req.query.date;
    const expenses = await getExpensesByPeriod(period, selectedDate);

    const searchText = req.query.search || "Food";

    const response = await axios.post("http://127.0.0.1:5004/api/filter", {
      data: expenses.map(expense => ({
        description: expense.description,
        amount: expense.amount,
        category: expense.category
      })),
      search_text: searchText,
      case_sensitive: false
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to search and filter expenses" });
  }
});

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Expense Tracker API is running");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});