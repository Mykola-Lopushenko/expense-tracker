# 💸 Expense Tracker

A full-stack expense tracking web application built with React and Node.js. Users can register, log in, and manage their personal expenses — with each account's data fully private and isolated.

**Live demo:** https://expense-tracker-app-d1em.onrender.com/

---

## Features

- **Authentication** — Register and sign in with email and password. Passwords are hashed with bcrypt; sessions use JWT tokens.
- **Private data** — Each user only sees their own expenses. No crossover between accounts.
- **Add, edit, and delete expenses** — Full CRUD with description, amount, category, and date.
- **Period filtering** — View expenses by All, Today, This Week, This Month, or a specific date.
- **Budget tracking** — Live progress bar showing spending against a $1,000 monthly budget.
- **Category breakdown** — Color-coded by Food, Groceries, Transport, and Other.
- **Data insights** — On-demand summary statistics, budget alert, monthly report, and keyword search.
- **Responsive design** — Works on desktop and mobile with a collapsible filter menu.
- **Budget settings** — Set a custom budget amount and choose weekly or monthly tracking. Settings persist across sessions.
- **Timezone-aware filtering** — Expenses are filtered by your local timezone, so "Today" always shows the correct local date.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, CSS |
| Backend | Node.js, Express |
| Database | MongoDB Atlas (via Mongoose) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Hosting | Render (backend), Render Static (frontend) |

---

## Project Structure

```
expense-tracker/
├── backend/
│   ├── server.js        # Express API — auth routes + expense routes
│   ├── package.json
│   └── .env             # MONGO_URI, JWT_SECRET, PORT (not committed)
└── frontend/
    ├── src/
    │   ├── App.jsx      # Main React app + AuthScreen component
    │   └── App.css      # Styles
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 1. Clone the repo

```bash
git clone https://github.com/Mykola-Lopushenko/expense-tracker.git
cd expense-tracker
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret_string
PORT=5000
```

Start the server:

```bash
node server.js
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> Make sure `API_URL` in `src/App.jsx` points to `http://localhost:5000` when running locally.

---

## API Reference

All `/expenses` routes require a `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create a new account |
| POST | `/auth/login` | Sign in and receive a JWT |

### Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/expenses?period=all` | Get expenses (filter by period) |
| POST | `/expenses` | Add a new expense |
| PUT | `/expenses/:id` | Update an expense |
| DELETE | `/expenses/:id` | Delete an expense |
| GET | `/expenses/summary` | Descriptive statistics |
| GET | `/expenses/budget-alert` | Budget status vs $1,000 limit |
| GET | `/expenses/monthly-report` | Totals and category breakdown |
| GET | `/expenses/search-filter?search=food` | Search expenses by keyword |
| GET | `/expenses/dashboard` | Aggregated stats across periods |

**Period options:** `all`, `today`, `week`, `month`, `date` (use with `&date=YYYY-MM-DD`)

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for signing JWT tokens — use a long random string |
| `PORT` | Port for the Express server (default: 5000) |

---

## Deployment (Render)

1. Push your code to GitHub.
2. Create a **Web Service** on Render pointing to the `backend/` folder.
   - Build command: `npm install`
   - Start command: `node server.js`
   - Add `MONGO_URI` and `JWT_SECRET` under Environment Variables.
3. Create a **Static Site** on Render pointing to the `frontend/` folder.
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Update `API_URL` in `App.jsx` to your backend Render URL before deploying the frontend.

---

## License

MIT
