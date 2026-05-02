
const express = require("express");
const cors = require("cors");

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
    e.id === id ? { ...e, description, amount, category } : e
  );

  res.json({ message: "Updated" });
});

// DELETE expense
app.delete("/expenses/:id", (req, res) => {
  const id = Number(req.params.id);
  expenses = expenses.filter(e => e.id !== id);
  res.json({ message: "Deleted" });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});