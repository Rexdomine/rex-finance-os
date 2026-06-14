# Rex Finance OS — Project Context

Read this file before resuming Rex Finance OS work.

## Owner

Rex / Princewill Ejiogu

## Project purpose

Build a personal mini web application that helps Rex manage irregular NGN/USD income from remote work and freelance/client projects. The app should automatically split any income received into bills, work tools, goals, debts, emergency savings, investments, and lifestyle spending.

## Current product name

Rex Finance OS

## Current financial context

Rex has variable income, no fixed payment date, and earns in NGN and USD. The current major goal is a Move-Out Fund.

### Move-Out Fund

- Target: ₦6,000,000
- Current saved: ₦1,200,000
- Remaining: ₦4,800,000
- Deadline: 2026-08-31
- Covers: rent, agent fee, legal, caution, moving logistics, and some inverter setup

### Current debt

- Bank debt: ₦359,000
- Current due this month: ₦180,120
- Debt feature must be dynamic, not hard-coded, because debts can be added and paid off over time

### Must-have tools

- OpenAI Max: $100/month
- Wispr Flow: $12/month
- VPS hosting: $8/month, paid yearly as $96/year
- These are work-critical because Rex uses them to run Groot and productivity workflows

### Other known recurring expenses

- Internet: ₦50,000/month
- Prime: ₦2,500/month
- Netflix: ₦8,500/month
- Food planning cap: ₦120,000/month
- Electricity estimate: ₦50,000/month
- Fuel/transport estimate: ₦100,000/month
- Phone/data estimate: ₦30,000/month
- Family support starter cap: ₦50,000–₦75,000/month
- Lifestyle cap until move-out target: ₦50,000/month
- Clothing paused unless urgent

## Product requirements

MVP must let Rex:

1. Create and manage goals.
2. Create and manage debts.
3. Create and manage recurring expenses.
4. Add income in NGN or USD.
5. Generate an automatic allocation plan.
6. Always include savings and investments where feasible, even if small.
7. See goal progress and debt progress.
8. Get clear advice on where each naira/dollar should go.
9. Check a planned expense before spending and get approve/caution/delay/avoid guidance.

## Recommended MVP stack

- Next.js
- TypeScript
- Tailwind CSS
- Turso/libSQL cloud SQLite ledger via `/api/finance-state` for production income, goals, debts, expenses, and allocation plans
- File-based libSQL SQLite fallback for local development
- LocalStorage fallback copy only

Production persistence note:

- Vercel production must set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- If Turso env vars are missing, the app falls back to local file-based libSQL, which is useful for development but not durable on Vercel serverless.

Future upgrade:

- Auth
- Scheduled backups/export snapshots
- CSV/PDF export
- Telegram reminders

## Existing files

- `/opt/data/rex-finance-os/PRODUCT_SPEC.md` — full product specification
- `/opt/data/rex-finance-os/PROJECT_CONTEXT.md` — this context file

## Build notes

Use a practical, mobile-first UI. Keep the app local/private for now. Seed the default Rex setup into the app so he can use it immediately.

## Immediate next step

Scaffold the Next.js app and implement the MVP using the product spec.
