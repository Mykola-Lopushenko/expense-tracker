import { useEffect, useState, useRef } from "react";
import "./App.css";

const API_URL = "https://expense-tracker-backend-v11c.onrender.com";

const CATEGORY_META = {
  Food:      { icon: "🍔", color: "cat-food" },
  Groceries: { icon: "🛒", color: "cat-groceries" },
  Transport: { icon: "🚗", color: "cat-transport" },
  Other:     { icon: "📦", color: "cat-other" },
};

const PERIOD_LABELS = {
  all:   "All Expenses",
  today: "Today",
  week:  "This Week",
  month: "This Month",
  date:  "Selected Date",
};

function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

// ── Auth Screen ────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode]         = useState("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (mode === "register" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/${mode}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      onAuth(data.token, data.email);
    } catch {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">💸</div>
        <h1 className="auth-title">Expense Tracker</h1>
        <p className="auth-subtitle">
          {mode === "login" ? "Sign in to your account" : "Create your account"}
        </p>

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === "login" ? " active" : ""}`}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab${mode === "register" ? " active" : ""}`}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Register
          </button>
        </div>

        <div className="auth-fields" onKeyDown={handleKey}>
          <label className="auth-label">
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              onChange={e => setEmail(e.target.value)}
            />
          </label>
          <label className="auth-label">
            Password
            <input
              type="password"
              placeholder={mode === "register" ? "Min. 8 characters" : "Your password"}
              value={password}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary full" onClick={submit} disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <p className="auth-switch">
          {mode === "login" ? "No account yet? " : "Already have an account? "}
          <button
            className="auth-link"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          >
            {mode === "login" ? "Register" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const [token, setToken]       = useState(() => sessionStorage.getItem("et_token") || "");
  const [userEmail, setUserEmail] = useState(() => sessionStorage.getItem("et_email") || "");

  const handleAuth = (t, email) => {
    sessionStorage.setItem("et_token", t);
    sessionStorage.setItem("et_email", email);
    setToken(t);
    setUserEmail(email);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("et_token");
    sessionStorage.removeItem("et_email");
    setToken("");
    setUserEmail("");
  };

  if (!token) return <AuthScreen onAuth={handleAuth} />;

  return <ExpenseApp token={token} userEmail={userEmail} onLogout={handleLogout} />;
}

// ── Expense App (authenticated) ────────────────────────────
function ExpenseApp({ token, userEmail, onLogout }) {
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [expenses, setExpenses]           = useState([]);
  const [monthlyTotal, setMonthlyTotal]   = useState(0);
  const [summary, setSummary]             = useState(null);
  const [budgetAlert, setBudgetAlert]     = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [searchFilter, setSearchFilter]   = useState(null);
  const [searchTerm, setSearchTerm]       = useState("");
  const [period, setPeriod]               = useState("today");
  const [toast, setToast]                 = useState("");
  const [editingId, setEditingId]         = useState(null);
  const [detailsId, setDetailsId]         = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [activePanel, setActivePanel]     = useState(null);
  const [loading, setLoading]             = useState(false);
  const [selectedDate, setSelectedDate]   = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split("T")[0];
  });
  const [form, setForm] = useState({ description: "", amount: "", category: "" });
  const descRef = useRef(null);

  const apiFetch = (path, options = {}) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...authHeaders, ...(options.headers || {}) },
    });

  // Fetch expenses for selected period
  useEffect(() => {
    const url = period === "date"
      ? `/expenses?period=date&date=${selectedDate}`
      : `/expenses?period=${period}`;
    apiFetch(url)
      .then(res => {
        if (res.status === 401) { onLogout(); return []; }
        return res.json();
      })
      .then(data => Array.isArray(data) && setExpenses(data))
      .catch(() => {});
  }, [period, selectedDate]);

  // Always fetch monthly total for budget bar
  useEffect(() => {
    apiFetch("/expenses?period=month")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const sum = data.reduce((acc, e) => acc + Number(e.amount), 0);
          setMonthlyTotal(sum);
        }
      })
      .catch(() => {});
  }, [expenses]); // re-fetch when expenses change so bar updates after add/delete

  const clearForm = () => {
    setForm({ description: "", amount: "", category: "" });
    setEditingId(null);
    descRef.current?.focus();
  };

  const showToast      = (text) => setToast(text);
  const closeAllPanels = () => { setDetailsId(null); setActivePanel(null); };

  const addExpense = async () => {
    if (!form.description || !form.amount || !form.category) {
      alert("Please fill in all fields."); return;
    }
    setLoading(true);
    try {
      const res        = await apiFetch("/expenses", { method: "POST", body: JSON.stringify(form) });
      const newExpense = await res.json();
      if (period === "all" || period === "today") setExpenses(prev => [newExpense, ...prev]);
      clearForm();
      showToast("Expense added");
    } finally { setLoading(false); }
  };

  const startEdit = (expense) => {
    closeAllPanels();
    setEditingId(expense.id);
    setForm({ description: expense.description, amount: expense.amount, category: expense.category });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEdit = async () => {
    if (!form.description || !form.amount || !form.category) {
      alert("Please fill in all fields."); return;
    }
    setLoading(true);
    try {
      const res     = await apiFetch(`/expenses/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      const updated = await res.json();
      setExpenses(prev => prev.map(e => (e.id === editingId ? updated : e)));
      clearForm();
      showToast("Expense updated");
    } finally { setLoading(false); }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    await apiFetch(`/expenses/${id}`, { method: "DELETE" });
    setExpenses(prev => prev.filter(e => e.id !== id));
    closeAllPanels();
    showToast("Expense deleted");
  };

  const fetchPanel = async (key, path) => {
    closeAllPanels();
    try {
      const res  = await apiFetch(path);
      const data = await res.json();
      if (key === "summary") setSummary(data);
      if (key === "budget")  setBudgetAlert(data);
      if (key === "report")  setMonthlyReport(data);
      if (key === "search")  setSearchFilter(data);
      setActivePanel(key);
    } catch { alert("Could not load data."); }
  };

  const getSummary       = () => fetchPanel("summary", `/expenses/summary?period=${period}`);
  const getBudgetAlert   = () => fetchPanel("budget",  `/expenses/budget-alert?budget=1000&period=${period}&date=${selectedDate}`);
  const getMonthlyReport = () => fetchPanel("report",  `/expenses/monthly-report?period=${period}`);
  const getSearchFilter  = () => fetchPanel("search",  `/expenses/search-filter?search=${encodeURIComponent(searchTerm)}&period=${period}`);

  const changePeriod = (p) => { closeAllPanels(); setPeriod(p); setMobileFiltersOpen(false); };

  const total           = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const budgetPct       = Math.min((monthlyTotal / 1000) * 100, 100);
  const budgetColor     = budgetPct >= 100 ? "danger" : budgetPct >= 80 ? "warning" : "ok";
  const selectedDetails = expenses.find(e => e.id === detailsId);

  return (
    <div className="app">
      <Toast message={toast} onDone={() => setToast("")} />

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-top-row">
          <span className="header-user">👤 {userEmail}</span>
          <button className="btn-logout" onClick={onLogout}>Sign Out</button>
        </div>
        <div className="header-icon" aria-hidden="true">💸</div>
        <h1>Expense Tracker</h1>
        <p className="subtitle">Know where your money goes — before it's gone.</p>

        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-num">${total.toFixed(2)}</span>
            <span className="hero-stat-label">{PERIOD_LABELS[period]}</span>
          </div>
          <div className={`budget-bar-wrap budget-${budgetColor}`}>
            <div className="budget-bar-track">
              <div className="budget-bar-fill" style={{ width: `${budgetPct}%` }} />
            </div>
            <span className="budget-bar-label">
              ${(1000 - monthlyTotal).toFixed(2)} of $1,000 monthly budget remaining
            </span>
          </div>
        </div>
      </header>

      {/* ── Period Filter ── */}
      <div className="filter-header">
        <span className="filter-label">
          Viewing: <strong>{PERIOD_LABELS[period]}</strong>
        </span>
        <button
          className="filter-menu-btn"
          aria-label="Toggle filters"
          onClick={() => setMobileFiltersOpen(o => !o)}
        >
          ☰
        </button>
      </div>

      <div className={`filters-panel${mobileFiltersOpen ? " open" : ""}`}>
        <div className="period-buttons">
          {["all", "today", "week", "month"].map(p => (
            <button
              key={p}
              className={`period-btn${period === p ? " active" : ""}`}
              onClick={() => changePeriod(p)}
            >
              {p === "all" ? "All" : p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>
        <div className="date-filter">
          <input
            type="date"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); changePeriod("date"); }}
          />
        </div>
      </div>

      {/* ── Add / Edit Form ── */}
      <section className={`form${editingId ? " editing" : ""}`}>
        <h2 className="form-title">{editingId ? "✏️ Edit Expense" : "Add Expense"}</h2>
        <div
          className="form-row"
          onKeyDown={e => e.key === "Enter" && (editingId ? saveEdit() : addExpense())}
        >
          <label>
            Description
            <input
              ref={descRef}
              placeholder="e.g. Coffee"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            Amount ($)
            <input
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
            />
          </label>
          <label>
            Category
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Select</option>
              {Object.keys(CATEGORY_META).map(c => (
                <option key={c} value={c}>{CATEGORY_META[c].icon} {c}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="required-note">All fields required · Press Enter to submit</p>
        {editingId ? (
          <div className="button-row">
            <button className="btn-primary" onClick={saveEdit} disabled={loading}>
              {loading ? "Saving…" : "Save Changes"}
            </button>
            <button className="btn-ghost" onClick={clearForm}>Cancel</button>
          </div>
        ) : (
          <button className="btn-primary full" onClick={addExpense} disabled={loading}>
            {loading ? "Adding…" : "+ Add Expense"}
          </button>
        )}
      </section>

      {/* ── Expense List ── */}
      <section className="expense-list">
        {expenses.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🧾</span>
            <p>No expenses yet.</p>
            <p className="empty-sub">Add your first expense above to get started.</p>
          </div>
        ) : (
          expenses.map(expense => {
            const meta = CATEGORY_META[expense.category] || CATEGORY_META["Other"];
            return (
              <div
                className={`expense-item ${meta.color}${detailsId === expense.id ? " expanded" : ""}`}
                key={expense.id}
              >
                <div className="expense-top">
                  <div className="expense-info">
                    <span className="expense-icon" aria-hidden="true">{meta.icon}</span>
                    <div>
                      <span className="expense-desc">{expense.description}</span>
                      <span className={`cat-badge ${meta.color}`}>{expense.category}</span>
                    </div>
                  </div>
                  <div className="expense-right">
                    <span className="expense-amount">${Number(expense.amount).toFixed(2)}</span>
                    <div className="expense-actions">
                      <button
                        className="icon-btn"
                        title="Details"
                        aria-label="View details"
                        onClick={() =>
                          detailsId === expense.id
                            ? setDetailsId(null)
                            : (closeAllPanels(), setDetailsId(expense.id))
                        }
                      >
                        ℹ️
                      </button>
                      <button
                        className="icon-btn"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => startEdit(expense)}
                      >
                        ✏️
                      </button>
                      <button
                        className="icon-btn danger"
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => deleteExpense(expense.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>

                {detailsId === expense.id && selectedDetails && (
                  <div className="details-inline">
                    <div className="details-grid">
                      <span className="detail-label">Date</span>
                      <span>{new Date(selectedDetails.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                      <span className="detail-label">Category</span>
                      <span>{meta.icon} {selectedDetails.category}</span>
                      <span className="detail-label">Amount</span>
                      <span>${Number(selectedDetails.amount).toFixed(2)}</span>
                    </div>
                    <button className="btn-primary" style={{ marginTop: "12px" }} onClick={() => startEdit(selectedDetails)}>
                      Edit This Expense
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* ── Insights ── */}
      <section className="insights-bar">
        <button className={`insight-btn${activePanel === "summary" ? " active" : ""}`} onClick={getSummary}>📊 Summary</button>
        <button className={`insight-btn${activePanel === "budget"  ? " active" : ""}`} onClick={getBudgetAlert}>🔔 Budget Alert</button>
        <button className={`insight-btn${activePanel === "report"  ? " active" : ""}`} onClick={getMonthlyReport}>📅 Monthly Report</button>
      </section>

      <div className="search-bar">
        <input
          placeholder="Search by name, category, or amount…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={e => e.key === "Enter" && getSearchFilter()}
        />
        <button className="btn-search" onClick={getSearchFilter}>Search</button>
      </div>

      {/* ── Panels ── */}
      {activePanel === "summary" && summary && (
        <div className="panel">
          <div className="panel-header">
            <h3>📊 Data Summary</h3>
            <button className="panel-close" onClick={() => setActivePanel(null)}>✕</button>
          </div>
          <div className="stat-grid">
            <StatCard label="Average" value={`$${summary.descriptive_statistics?.amount?.mean?.toFixed(2) ?? "—"}`} />
            <StatCard label="Minimum" value={`$${summary.descriptive_statistics?.amount?.min?.toFixed(2) ?? "—"}`} />
            <StatCard label="Maximum" value={`$${summary.descriptive_statistics?.amount?.max?.toFixed(2) ?? "—"}`} />
            <StatCard label="Missing" value={summary.check_missing?.amount ?? 0} />
          </div>
        </div>
      )}

      {activePanel === "budget" && budgetAlert && (
        <div className={`panel panel-budget panel-budget-${budgetAlert.status}`}>
          <div className="panel-header">
            <h3>🔔 Budget Alert</h3>
            <button className="panel-close" onClick={() => setActivePanel(null)}>✕</button>
          </div>
          <div className="budget-status-badge">{budgetAlert.status.replace(/_/g, " ")}</div>
          <p className="budget-msg">{budgetAlert.message}</p>
          <div className="stat-grid">
            <StatCard label="Budget"    value={`$${Number(budgetAlert.budget).toFixed(2)}`} />
            <StatCard label="Spent"     value={`$${Number(budgetAlert.total_spending).toFixed(2)}`} />
            <StatCard label="Remaining" value={`$${Number(budgetAlert.remaining).toFixed(2)}`} />
          </div>
        </div>
      )}

      {activePanel === "report" && monthlyReport && (
        <div className="panel">
          <div className="panel-header">
            <h3>📅 Monthly Report</h3>
            <button className="panel-close" onClick={() => setActivePanel(null)}>✕</button>
          </div>
          <div className="stat-grid">
            <StatCard label="Total"   value={`$${Number(monthlyReport.total_spending).toFixed(2)}`} />
            <StatCard label="Count"   value={monthlyReport.expense_count} />
            <StatCard label="Average" value={`$${Number(monthlyReport.average_expense).toFixed(2)}`} />
          </div>
          <h4 className="section-label">By Category</h4>
          <div className="category-list">
            {Object.entries(monthlyReport.category_totals || {}).map(([cat, amt]) => {
              const meta = CATEGORY_META[cat] || CATEGORY_META["Other"];
              const pct  = monthlyTotal > 0 ? (amt / monthlyTotal) * 100 : 0;
              return (
                <div key={cat} className={`cat-row ${meta.color}`}>
                  <span className="cat-row-label">{meta.icon} {cat}</span>
                  <div className="cat-row-bar-wrap">
                    <div className="cat-row-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="cat-row-amt">${Number(amt).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activePanel === "search" && searchFilter && (
        <div className="panel">
          <div className="panel-header">
            <h3>🔍 Search Results</h3>
            <button className="panel-close" onClick={() => setActivePanel(null)}>✕</button>
          </div>
          <p className="panel-meta">
            <strong>{searchFilter.filtered_data?.length || 0}</strong> match{searchFilter.filtered_data?.length !== 1 ? "es" : ""} for "{searchTerm}"
          </p>
          {(searchFilter.filtered_data || []).length === 0 ? (
            <p className="empty-sub">No expenses match your search.</p>
          ) : (
            <div className="search-results">
              {(searchFilter.filtered_data || []).map((expense, i) => {
                const meta = CATEGORY_META[expense.category] || CATEGORY_META["Other"];
                return (
                  <div key={i} className={`search-result-row ${meta.color}`}>
                    <span>{meta.icon} {expense.description}</span>
                    <span className="cat-badge">{expense.category}</span>
                    <span className="expense-amount">${Number(expense.amount).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Total ── */}
      <div className="total-box">
        <span className="total-label">Total</span>
        <span className="total-amount">${total.toFixed(2)}</span>
      </div>
    </div>
  );
}