# Local development

## Requirements

- Node.js 22 (the frontend package requires at least 22.12; GitHub Actions builds with Node.js 22).
- npm, included with Node.js.
- Access to a MySQL database configured for this application.

## Install packages

Open a terminal at the repository root, then install each app's packages:

```bash
cd backend
npm install
cd ../frontend
npm install
```

## Configure the backend

Copy `backend/.env.example` to `backend/.env` and fill in your local database and mail settings. Never commit the real `.env` file.

Required database and sign-in values:

```env
DB_HOST=localhost
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
JWT_SECRET=use_a_random_secret_at_least_32_characters_long
```

Optional settings include `PORT`, `JWT_EXPIRES_IN`, `ALLOWED_ORIGIN`, `APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`. The backend defaults `PORT` to `3000` and token lifetime to `8h` if unset.

The app does not include a complete initial database dump or `schema.sql`. Startup migrations can add or update supported columns on an existing database, but they do not replace an approved database backup or initial schema setup. Use a development database when learning or making schema changes.

## Run the app

In one terminal:

```bash
cd backend
npm run dev
```

In another terminal:

```bash
cd frontend
npm run dev
```

Vite serves the frontend during development. The browser API client uses `/api`; configure a local proxy or development server setup for requests to reach the backend when needed. The production site is served by Express from `backend/public`.

## Common commands

| Folder | Command | Purpose |
| --- | --- | --- |
| `backend/` | `npm run dev` | Start the API with Node's watch mode. |
| `backend/` | `npm start` | Start the API normally. |
| `backend/` | `npm run migrate` | Run the migration utility against the configured database. |
| `frontend/` | `npm run dev` | Start Vite for local frontend work. |
| `frontend/` | `npm run build` | Build frontend assets into `frontend/dist`. |
| `frontend/` | `npm run lint` | Run ESLint on frontend files. |
