import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [detailsId, setDetailsId] = useState(null);

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: ""
  });

  useEffect(() => {
    fetch("http://localhost:5000/expenses")
      .then(res => res.json())
      .then(data => setExpenses(data));
  }, []);

  const clearForm = () => {
    setForm({ description: "", amount: "", category: "" });
    setEditingId(null);
  };

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2000);
  };

  const addExpense = async () => {
    if (!form.description || !form.amount || !form.category) {
      alert("Required: Please fill in all fields.");
      return;
    }

    const res = await fetch("http://localhost:5000/expenses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(form)
    });

    const newExpense = await res.json();

    setExpenses([...expenses, newExpense]);
    clearForm();
    showMessage("Expense added successfully");
  };

  const startEdit = (expense) => {
    setEditingId(expense.id);
    setDetailsId(null);

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
      headers: {
        "Content-Type": "application/json"
      },
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
    showMessage("Expense updated successfully");
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Deleting this expense cannot be undone. Continue?")) {
      return;
    }

    await fetch(`http://localhost:5000/expenses/${id}`, {
      method: "DELETE"
    });

    setExpenses(expenses.filter(expense => expense.id !== id));
    setDetailsId(null);
    showMessage("Expense deleted successfully");
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
  const selectedDetails = expenses.find(expense => expense.id === detailsId);
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <div className="app">
      <h1>Expense Tracker</h1>
      <p className="subtitle">Track expenses and see total spending instantly.</p>

      <ul className="feature-info">
        <li>Track daily expenses</li>
        <li>Monitor total spending</li>
        <li>Edit expenses anytime</li>
      </ul>

      <div className="form">
        <div className="form-row">
          <label>
            Description *
            <input
              placeholder="Example: Coffee"
              value={form.description}
              onChange={e =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>

          <label>
            Amount *
            <input
              placeholder="Example: 9.99"
              type="number"
              value={form.amount}
              onChange={e =>
                setForm({ ...form, amount: e.target.value })
              }
            />
          </label>

          <label>
            Category *
            <select
              value={form.category}
              onChange={e =>
                setForm({ ...form, category: e.target.value })
              }
            >
              <option value="">Select Category</option>
              <option value="Food">Food</option>
              <option value="Groceries">Groceries</option>
              <option value="Transport">Transport</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <p className="required-note">* Required fields</p>

        {editingId ? (
          <div className="button-row">
            <button className="primary" onClick={saveEdit}>
              Save Changes
            </button>
            <button className="secondary" onClick={clearForm}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="primary" onClick={addExpense}>
            Add Expense
          </button>
        )}
      </div>

      {message && <p className="success">{message}</p>}

      <div className="expense-list">
        {expenses.map(expense => (
          <div className="expense-item" key={expense.id}>
            <div className="expense-top">
              <span>
                {expense.description} - ${Number(expense.amount).toFixed(2)}
              </span>

              <div className="expense-actions">
                <button
                  className="details-btn"
                  onClick={() => setDetailsId(expense.id)}
                >
                  Details
                </button>

                <button
                  className="secondary"
                  onClick={() => startEdit(expense)}
                >
                  Edit
                </button>

                <button
                  className="delete-btn"
                  onClick={() => deleteExpense(expense.id)}
                >
                  Delete
                </button>
              </div>
            </div>
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

      {selectedDetails && (
        <div className="details-box">
          <h3>Expense Details</h3>
          <p>
            <strong>Description:</strong> {selectedDetails.description}
          </p>
          <p>
            <strong>Amount:</strong> ${Number(selectedDetails.amount).toFixed(2)}
          </p>
          <p>
            <strong>Category:</strong> {selectedDetails.category}
          </p>
        <div className="details-actions">
          <button
            className="primary"
            onClick={() => startEdit(selectedDetails)}
          >
            Edit This Expense
          </button>

          <button
            className="secondary"
            onClick={() => setDetailsId(null)}
          >
            Close Details
          </button>
        </div>
        </div>
      )}

      <div className="total-box">
        Total: ${total.toFixed(2)}
      </div>
    </div>
  );
}

export default App;