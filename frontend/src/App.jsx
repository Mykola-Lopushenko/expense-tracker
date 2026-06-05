import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");


  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: ""
  });

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/expenses")
      .then(res => res.json())
      .then(data => setExpenses(data));
  }, []);

  const clearForm = () => {
    setForm({ description: "", amount: "", category: "" });
    setEditingId(null);
  };

  const addExpense = async () => {
    if (!form.description || !form.amount || !form.category) {
      alert("Required: Please fill in all fields.");
      return;
    }

    const res = await fetch("http://localhost:5000/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    const newExpense = await res.json();
    setExpenses([...expenses, newExpense]);
    clearForm();

    setMessage("Expense added successfully");
    setTimeout(() => setMessage(""), 2000);
  };

  const startEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      description: expense.description,
      amount: expense.amount,
      category: expense.category
    });
  };

  const saveEdit = async () => {
    if (!form.description || !form.amount || !form.category) {
      alert("Required: Please fill in all fields.");
      return;
    }

    await fetch(`http://localhost:5000/expenses/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    setExpenses(
      expenses.map(expense =>
        expense.id === editingId
          ? {
              ...expense,
              description: form.description,
              amount: Number(form.amount),
              category: form.category
            }
          : expense
      )
    );

    clearForm();

    setMessage("Expense updated successfully");
    setTimeout(() => setMessage(""), 2000);
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Deleting this expense cannot be undone. Continue?")) return;

    await fetch(`http://localhost:5000/expenses/${id}`, {
      method: "DELETE"
    });

    setExpenses(expenses.filter(expense => expense.id !== id));

    setMessage("Expense deleted successfully");
    setTimeout(() => setMessage(""), 2000);
  };

  const getSummary = async () => {
    try {
      const res = await fetch("http://localhost:5000/expenses/summary");
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      alert("Could not get expense summary.");
    }
  };
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <div className="app">
      <h1>Expense Tracker</h1>

      <div className="form">
        <input
          placeholder="Description"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />

        <input
          placeholder="Amount"
          type="number"
          value={form.amount}
          onChange={e => setForm({ ...form, amount: e.target.value })}
        />

        <select
          value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value })}
        >
          <option value="">Select Category</option>
          <option value="Food">Food</option>
          <option value="Groceries">Groceries</option>
          <option value="Transport">Transport</option>
          <option value="Other">Other</option>
        </select>

        {editingId ? (
          <>
            <button onClick={saveEdit}>Save Changes</button>
            <button onClick={clearForm}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={addExpense}>Add Expense</button>
            <button onClick={clearForm}>Cancel</button>
          </>
        )}
      </div>

      {message && <p className="success">{message}</p>}

      <div className="expense-list">
        {expenses.map(expense => (
          <div className="expense-item" key={expense.id}>
            <span>
              {expense.description} - ${Number(expense.amount).toFixed(2)} ({expense.category})
            </span>

            <button onClick={() => startEdit(expense)}>Edit</button>
            <button onClick={() => deleteExpense(expense.id)}>Delete</button>
          </div>
        ))}
      </div>
      
      <button onClick={getSummary}>Get Data Summary</button>

      {summary && (
        <div className="summary">
          <h2>Data Summary Microservice</h2>

          <p>
            Average Expense: $
            {summary.descriptive_statistics?.amount?.mean?.toFixed(2)}
          </p>

          <p>
            Minimum Expense: $
            {summary.descriptive_statistics?.amount?.min?.toFixed(2)}
          </p>

          <p>
            Maximum Expense: $
            {summary.descriptive_statistics?.amount?.max?.toFixed(2)}
          </p>

          <p>
            Missing Amount Values: {summary.check_missing?.amount}
          </p>
        </div>
      )}

      <h2>Total: ${total.toFixed(2)}</h2>
    </div>
  );
}

export default App;