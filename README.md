# cinema-management-system

A web-based Cinema Management System for movie browsing, seat reservations, ticket booking and cinema administration.

## Local setup

### 1. Set up the backend and database

Install Node.js and PostgreSQL, then create an empty local PostgreSQL database named `cinema_db`.

From the repository root, run these commands in PowerShell:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Open `backend/.env` and update `DATABASE_URL` with your local PostgreSQL username, password, port, and database name. Keep `.env` private and out of Git.

From the `backend` folder, run:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run dev
```

The backend defaults to `http://localhost:5000`. To check that it is running, open `http://localhost:5000/api/health`.

The migrations use the PostgreSQL `btree_gist` extension. If the migration reports a permissions error, ask your PostgreSQL administrator to enable it in your local database.

### 2. Start the frontend

Open a second terminal at the repository root and run:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173` in your browser. Keep both terminals running while you work.
