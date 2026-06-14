# Rex Finance OS

A personal variable-income finance command center for Rex.

Live app: https://rex-finance-os.vercel.app

Rex Finance OS helps decide what to do when money enters: fund work-critical tools, essentials, debts, savings, investments, active goals, and controlled lifestyle spending.

## Current MVP

- Dashboard for income, active goals, debts, and monthly expense pressure
- Income entry with NGN/USD exchange rate support
- Automatic Groot Split allocation engine
- Goal tracking, including the Move-Out Fund
- Dynamic debt tracking and repayment planning
- Savings and investment contributions in every allocation where feasible
- Recurring expenses with monthly/yearly/weekly/one-time frequency support
- Expense Decision Checker with approve/caution/delay/avoid verdicts
- SQLite-backed finance ledger through a Next.js API route
- Browser LocalStorage fallback if SQLite sync is unavailable

## Rex defaults

- Move-Out Fund: ₦6,000,000 target with ₦1,200,000 saved
- Bank Debt: ₦359,000 with ₦180,120 current due
- OpenAI Max: $100/month
- Wispr Flow: $12/month
- VPS Hosting: $96/year, planned as $8/month
- Internet: ₦50,000/month
- Core essentials and lifestyle caps

## Local development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Architecture

```text
Browser UI
  ↓
Next.js /api/finance-state
  ↓
Finance store selector
  ├─ Production: Turso/libSQL cloud database when TURSO_DATABASE_URL + TURSO_AUTH_TOKEN exist
  └─ Local dev fallback: file-based libSQL SQLite
  ↓
Goals, debts, expenses, incomes, allocation plans, allocation line items
```

The app now treats **Turso/libSQL** as the production source of truth for finance history. LocalStorage remains only as a browser fallback copy if the API is unavailable.

Production environment variables:

```bash
TURSO_DATABASE_URL=libsql://your-database-org.turso.io
TURSO_AUTH_TOKEN=your_turso_database_token
```

For local development without Turso, the app uses a local libSQL SQLite file. You can set the path with:

```bash
REX_FINANCE_DB_PATH=/persistent/path/rex-finance-os.sqlite
```

This keeps the same SQLite model locally while using durable Turso cloud SQLite in production.

## Quality checks

```bash
npm test
npm run lint
npm run build
```

## Privacy/persistence note

The app writes finance state to Turso/libSQL in production through `/api/finance-state` and keeps a LocalStorage fallback copy in the browser. Local development can use file-based libSQL SQLite; production Vercel should use `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for durable cloud persistence.

## Future upgrades

- Auth + database
- Hosted encrypted user data
- Transaction history export
- Bank/import integrations
- Telegram reminders
- AI monthly finance review
