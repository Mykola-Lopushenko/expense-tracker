import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [budgetAlert, setBudgetAlert] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [searchFilter, setSearchFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState("Food");
  const [period, setPeriod] = useState("all");
  const [message, setMessage] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [detailsId, setDetailsId] = useState(null);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: ""
  });

  useEffect(() => {
    const url =
      period === "date"
        ? `http://localhost:5000/expenses?period=date&date=${selectedDate}`
        : `http://localhost:5000/expenses?period=${period}`;

    fetch(url)
      .then(res => res.json())
      .then(data => setExpenses(data));
  }, [period, selectedDate]);

  const clearForm = () => {
    setForm({ description: "", amount: "", category: "" });
    setEditingId(null);
  };

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2000);
  };

  const closeAllPanels = () => {
    setDetailsId(null);
    setSummary(null);
    setBudgetAlert(null);
    setMonthlyReport(null);
    setSearchFilter(null);
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

    if (period === "all" || period === "today") {
      setExpenses([newExpense, ...expenses]);
    }

    clearForm();
    showMessage("Expense added successfully");
  };

  const startEdit = (expense) => {
    closeAllPanels();
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

    const res = await fetch(`http://localhost:5000/expenses/${editingId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(form)
    });

    const updatedExpense = await res.json();

    setExpenses(
      expenses.map(expense =>
        expense.id === editingId ? updatedExpense : expense
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
    closeAllPanels();
    showMessage("Expense deleted successfully");
  };

  const getSummary = async () => {
    try {
      closeAllPanels();

      const res = await fetch(
        `http://localhost:5000/expenses/summary?period=${period}`
      );
      const data = await res.json();

      setSummary(data);
    } catch (error) {
      alert("Could not get expense summary.");
    }
  };

  const getBudgetAlert = async () => {
    try {
      closeAllPanels();

      const res = await fetch(
        `http://localhost:5000/expenses/budget-alert?budget=1000&period=${period}&date=${selectedDate}`
      );

      const data = await res.json();

      setBudgetAlert(data);
    } catch (error) {
      alert("Could not get budget alert.");
    }
  };

  const getMonthlyReport = async () => {
    try {
      closeAllPanels();

      const res = await fetch(
        `http://localhost:5000/expenses/monthly-report?period=${period}`
      );

      const data = await res.json();

      setMonthlyReport(data);
    } catch (error) {
      alert("Could not get monthly report.");
    }
  };

  const getSearchFilter = async () => {
    try {
      closeAllPanels();

      const res = await fetch(
        `http://localhost:5000/expenses/search-filter?search=${encodeURIComponent(searchTerm)}&period=${period}`
      );

      const data = await res.json();

      setSearchFilter(data);
    } catch (error) {
      alert("Could not search and filter expenses.");
    }
  };

  const openDetails = (id) => {
    closeAllPanels();
    setDetailsId(id);
  };

  const changePeriod = (newPeriod) => {
    closeAllPanels();
    setPeriod(newPeriod);
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

      <div className="period-buttons">
        <button onClick={() => changePeriod("all")}>All</button>
        <button onClick={() => changePeriod("today")}>Today</button>
        <button onClick={() => changePeriod("week")}>This Week</button>
        <button onClick={() => changePeriod("month")}>This Month</button>
      </div>

      <div className="date-filter">
        <input
          type="date"
          value={selectedDate}
          onChange={e => {
            setSelectedDate(e.target.value);
            changePeriod("date");
          }}
        />
      </div>

      <div className="form">
        <div className="form-row">
          <label>
            Description *
            <input
              placeholder="Example: Coffee"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <label>
            Amount *
            <input
              placeholder="Example: 9.99"
              type="number"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
            />
          </label>

          <label>
            Category *
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
                  onClick={() => openDetails(expense.id)}
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

      <div className="microservice-buttons">
        <button onClick={getSummary}>Get Data Summary</button>
        <button onClick={getBudgetAlert}>Check Budget Alert</button>
        <button onClick={getMonthlyReport}>Generate Monthly Report</button>
      </div>

      <div className="search-filter-box">
        <input
          placeholder="Search expenses, e.g. Food"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <button onClick={getSearchFilter}>Search / Filter Expenses</button>
      </div>

      {summary && (
        <div className="summary">
          <h2>Data Summary Microservice</h2>
          <p>Average Expense: ${summary.descriptive_statistics?.amount?.mean?.toFixed(2)}</p>
          <p>Minimum Expense: ${summary.descriptive_statistics?.amount?.min?.toFixed(2)}</p>
          <p>Maximum Expense: ${summary.descriptive_statistics?.amount?.max?.toFixed(2)}</p>
          <p>Missing Amount Values: {summary.check_missing?.amount}</p>
        </div>
      )}

      {budgetAlert && (
        <div className="summary">
          <h2>Budget Alert Microservice</h2>
          <p><strong>Status:</strong> {budgetAlert.status}</p>
          <p><strong>Remaining:</strong> ${Number(budgetAlert.remaining).toFixed(2)}</p>
          <p>{budgetAlert.message}</p>
        </div>
      )}

      {monthlyReport && (
        <div className="summary">
          <h2>Monthly Report Microservice</h2>
          <p><strong>Total Spending:</strong> ${Number(monthlyReport.total_spending).toFixed(2)}</p>
          <p><strong>Expense Count:</strong> {monthlyReport.expense_count}</p>
          <p><strong>Average Expense:</strong> ${Number(monthlyReport.average_expense).toFixed(2)}</p>

          <h3>Category Totals</h3>

          <div className="category-totals">
            {Object.entries(monthlyReport.category_totals || {}).map(([category, amount]) => (
              <p key={category}>
                <strong>{category}:</strong> ${Number(amount).toFixed(2)}
              </p>
            ))}
          </div>
        </div>
      )}

      {searchFilter && (
        <div className="summary">
          <h2>Search and Filter Microservice</h2>

          <p>
            <strong>Search Term:</strong> {searchTerm}
          </p>

          <p>
            <strong>Matches Found:</strong> {searchFilter.filtered_data?.length || 0}
          </p>

          <div className="category-totals">
            {(searchFilter.filtered_data || []).map((expense, index) => (
              <p key={index}>
                <strong>{expense.description}</strong> - ${Number(expense.amount).toFixed(2)} ({expense.category})
              </p>
            ))}
          </div>
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

          <p>
            <strong>Date:</strong> {new Date(selectedDetails.date).toLocaleDateString()}
          </p>

          <div className="details-actions">
            <button className="primary" onClick={() => startEdit(selectedDetails)}>
              Edit This Expense
            </button>

            <button className="secondary" onClick={() => setDetailsId(null)}>
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