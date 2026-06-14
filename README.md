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
- Client-side LocalStorage persistence for MVP privacy and speed

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

## Quality checks

```bash
npm test
npm run lint
npm run build
```

## Privacy note

The MVP stores data in the browser using LocalStorage. No database or login is active yet. This keeps the first launch simple, but data is browser/device-specific.

## Future upgrades

- Auth + database
- Hosted encrypted user data
- Transaction history export
- Bank/import integrations
- Telegram reminders
- AI monthly finance review
