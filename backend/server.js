
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

let expenses = [
  { id: 1, description: "Gas", amount: 65.5, category: "Transport" },
  { id: 2, description: "Restaurant", amount: 120, category: "Food" }
];

// GET all expenses
app.get("/expenses", (req, res) => {
  res.json(expenses);
});

// ADD expense
app.post("/expenses", (req, res) => {
  const { description, amount, category } = req.body;

  if (!description || !amount || !category) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  const newExpense = {
    id: Date.now(),
    description,
    amount: Number(amount),
    category
  };

  expenses.push(newExpense);
  res.json(newExpense);
});

// UPDATE expense
app.put("/expenses/:id", (req, res) => {
  const id = Number(req.params.id);
  const { description, amount, category } = req.body;

  expenses = expenses.map(e =>
    e.id === id ? { ...e, description, amount: Number(amount), category } : e
  );

  res.json({ message: "Updated" });
});

// DELETE expense
app.delete("/expenses/:id", (req, res) => {
  const id = Number(req.params.id);
  expenses = expenses.filter(e => e.id !== id);
  res.json({ message: "Deleted" });
});

app.get("/expenses/summary", async (req, res) => {
  try {
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

app.get("/expenses/budget-alert", async (req, res) => {
  try {
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

app.get("/expenses/monthly-report", async (req, res) => {
  try {
    const response = await axios.post("http://127.0.0.1:5003/api/monthly-report", {
      expenses
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to get monthly report" });
  }
});

app.get("/expenses/search-filter", async (req, res) => {
  try {
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

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});