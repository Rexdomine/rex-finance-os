# Rex Finance OS — Product Specification

## Product vision

Rex Finance OS is a personal finance command center for variable income, built around the way Rex actually earns: remote work, freelance/client payments, mixed NGN/USD income, irregular payment dates, urgent goals, work-critical tools, debt obligations, and the need to save/invest no matter how small the income is.

The app should not feel like boring accounting software. It should feel like Groot is sitting beside Rex when money enters and saying: "This is what this money should do."

## MVP promise

When Rex logs income, the app automatically recommends how to split the money across:

1. Must-pay expenses and work tools
2. Active goals such as the Move-Out Fund
3. Active debts and repayment plans
4. Emergency savings
5. Investments
6. Lifestyle/flexible spending

The app should also allow Rex to create future goals and debts without hard-coding the current situation.

---

# Current Rex defaults

## Income profile

- Income sources: remote job, freelance/client work
- Income amount: variable
- Currency: NGN and USD
- Frequency: irregular — weekly, monthly, or every few months
- Payment date: no fixed date
- Stability: variable

## Active major goal

### Move-Out Fund

- Target amount: ₦6,000,000
- Current saved: ₦1,200,000
- Remaining: ₦4,800,000
- Deadline: 2026-08-31
- Covers: rent, agent fee, legal, caution, moving logistics, and part of inverter setup
- Priority: critical

## Current debt

### Bank Debt

- Total: ₦359,000
- Current due: ₦180,120
- Status: active
- Urgency: somewhat urgent
- Repayment behavior: not constant; user should be able to create/edit debts and let the planner recommend repayment based on income

## Work-critical expenses

- OpenAI Max: $100/month — must-have
- Wispr Flow: $12/month — must-have
- VPS hosting: $8/month, paid yearly as $96/year — must-have because it hosts Groot infrastructure
- Internet: ₦50,000/month — must-have
- Phone/data: estimated ₦30,000/month
- Electricity: estimated ₦50,000/month
- Fuel/transport: estimated ₦100,000/month

## Living/flexible expenses

- Food: ₦100,000–₦150,000/month; planning cap ₦120,000
- Prime: ₦2,500/month
- Netflix: ₦8,500/month
- Family support: starter cap ₦50,000–₦75,000/month
- Lifestyle: starter cap ₦50,000/month until move-out goal is complete
- Clothing: pause unless urgent until move-out goal is complete

## Savings and investing rule

Rex wants to save and invest no matter how little. Therefore every allocation mode should include at least a small savings/investment contribution where possible.

MVP default minimums:

- Emergency savings minimum: 3%–5% of income if essentials are not underfunded
- Investment minimum: 2%–5% of income if income is above survival threshold
- If income is extremely small, the app can recommend a symbolic amount such as ₦1,000–₦5,000 for savings/investments, but must warn if survival needs are not funded

---

# Core concepts

## 1. Goals

Goals are flexible targets Rex can create, fund, pause, complete, or archive.

Fields:

- Name
- Target amount
- Current amount
- Currency
- Deadline
- Priority: critical, high, medium, low
- Status: active, paused, completed, archived
- Funding strategy:
  - deadline-based
  - fixed percentage
  - fixed amount per income
  - manual
- Notes

Goal examples:

- Move-Out Fund
- Emergency Fund
- New Laptop
- Travel
- Investment Capital
- Rent Renewal
- Business Capital
- Car Maintenance

## 2. Debts

Debts are separate from goals because they reduce risk/obligation rather than build assets.

Fields:

- Name
- Total amount
- Remaining amount
- Currency
- Minimum due amount
- Due date
- Urgency: urgent, normal, flexible
- Status: active, paid, paused
- Repayment strategy:
  - pay minimum first
  - aggressive payoff
  - percentage of income
  - manual amount
- Notes

The allocation engine should include active debts and recommend repayment based on urgency and available income.

## 3. Recurring expenses

Fields:

- Name
- Amount
- Currency
- Frequency
- Category
- Priority:
  - must-pay
  - important
  - flexible
  - pauseable
- Due day/date
- Work-critical: yes/no
- Notes

## 4. Income entries

Fields:

- Source
- Amount
- Currency
- Exchange rate if USD
- Amount converted to NGN
- Amount retained in USD
- Date received
- Notes

## 5. Allocation plans

When income is entered, the app produces an allocation plan with line items.

Each line item should show:

- Destination name
- Destination type: expense, goal, debt, savings, investment, lifestyle, buffer
- Amount
- Currency
- Priority
- Reason

---

# Allocation engine v1

The engine should be deterministic, explainable, and editable later.

## Inputs

- Income amount and currency
- Active goals
- Active debts
- Recurring expenses
- User settings
- Current date
- Exchange rate assumption

## Outputs

- Allocation mode
- Allocation items
- Total allocated
- Unallocated remainder, if any
- Goal progress preview
- Debt progress preview
- Warnings
- Recommendations

## Modes

### Survival Mode

Triggered when income is below ₦500,000 or when must-pay expenses are unfunded.

Recommended priority:

1. Food/basic essentials
2. Work-critical tools and internet
3. Phone/data/electricity/transport
4. Minimum urgent debt contribution
5. Small emergency savings
6. Small investment if possible
7. Small active goal contribution
8. Lifestyle only if money remains

Default split guide:

- 60% operations/essentials
- 15% urgent debts
- 10% active goals
- 5% emergency savings
- 3% investment
- 7% lifestyle/buffer

### Stability Mode

Triggered when income is ₦500,000–₦1,500,000.

Default split guide:

- 35% operations/essentials
- 15% active debts
- 30% critical goals
- 7% emergency savings
- 5% investment
- 8% lifestyle/buffer

### Attack Mode

Triggered when income is above ₦1,500,000 or when a critical deadline goal is active.

Default split guide:

- Fund urgent monthly obligations first
- Fund current minimum debt due if unpaid
- 50%–70% of remaining balance to critical active goals
- 5%–10% emergency savings
- 5% investment
- Controlled lifestyle cap

## Deadline-based goal logic

For each active goal with a deadline:

- Remaining amount = target - current
- Weeks remaining = deadline - today
- Required weekly amount = remaining / weeks remaining
- Required monthly amount = remaining / months remaining

The app should show whether Rex is:

- ahead
- on track
- behind

For Move-Out Fund:

- Remaining: ₦4,800,000
- Deadline: 2026-08-31
- Weekly target from mid-June: about ₦431,000/week

## Debt repayment logic

For active debts:

1. If a minimum due amount exists and due date is near, prioritize that before lifestyle and most goals.
2. If debt urgency is urgent, allocate a higher percentage.
3. If debt is flexible, allocate after must-pay essentials, savings minimum, and critical goals.
4. When remaining amount hits zero, mark debt as paid and remove it from future allocation.

## Savings and investments logic

Savings and investments should be distinct:

- Emergency savings protects against income gaps
- Investments build wealth over time

Even during goal attack mode, include small contributions where possible.

Default minimums:

- Emergency savings: 5% of income, or symbolic minimum if low income
- Investments: 2%–5% of income, but never before survival essentials

---

# MVP screens

## 1. Dashboard

Shows:

- Total income logged
- Active goal progress
- Move-Out Fund progress
- Active debt remaining
- Monthly recurring expenses
- Savings and investment totals
- Latest allocation result
- Alerts and warnings

## 2. Add Income

Form fields:

- Source
- Amount
- Currency
- Exchange rate
- Date
- Notes

Actions:

- Generate allocation plan
- Save income
- Save allocation result

## 3. Allocation Result

Shows:

- Allocation mode
- Itemized split
- Reasons
- Goal progress after allocation
- Debt remaining after allocation
- Savings/investment contribution
- Warnings

## 4. Goals

- List active goals
- Add/edit goal
- Pause/complete/archive goal
- Progress bars

## 5. Debts

- List active debts
- Add/edit debt
- Set minimum due and deadline
- Track repayment progress
- Mark as paid

## 6. Expenses

- List recurring expenses
- Add/edit expense
- Categorize priority
- Mark work-critical

## 7. Transactions

- Income history
- Allocation history
- Manual expenses/contributions

## 8. Expense Decision Checker

Rex can enter a planned expense before spending and receive a verdict:

- approve
- caution
- delay
- avoid

The checker compares the expense against active critical goals, debt pressure, work-critical rules, savings/investment discipline, and spending caps.

Examples:

- OpenAI Max → approve as work-critical
- VPS hosting → approve as work-critical
- Clothing/lifestyle while Move-Out Fund is behind → delay or caution
- Large unplanned purchase → delay and use a 48-hour pause rule

---

# MVP technical recommendation

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Turso/libSQL cloud SQLite for production ledger persistence
- File-based libSQL SQLite for local development fallback
- Browser LocalStorage only as an offline/fallback copy

## Updated production architecture

```text
User Browser
  ↓
Next.js UI on Vercel/local server
  ↓
/api/finance-state Route Handler
  ↓
Finance store selector
  ├─ Production: Turso/libSQL via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
  └─ Local dev: file-based libSQL SQLite
  ↓
Normalized finance tables + full app-state snapshot
```

Turso/libSQL stores:

- goals
- debts
- recurring expenses
- income history
- allocation plans
- allocation line items
- latest full app state snapshot

Reason for Turso/libSQL upgrade:

- Income logs must survive Vercel deploys, serverless restarts, and browser/device changes
- Rex Finance OS manages important life/finance data, so temporary serverless storage is not acceptable
- Turso keeps the SQLite model while providing a managed, durable cloud database
- Local development remains simple because the same libSQL client can use a local SQLite file

Required production environment variables:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

## Later upgrade path

- Add authentication before multi-user or sensitive shared-device use
- Add scheduled backups/export snapshots
- Add export/import JSON backup
- Add CSV/PDF export
- Add Telegram reminders
- Add bank imports if needed

---

# MVP acceptance criteria

The MVP is successful when Rex can:

1. Open the web app.
2. See default Rex financial setup preloaded.
3. Add income in NGN or USD.
4. Generate an automatic allocation plan.
5. See exact destination items such as OpenAI, Netflix, debt, Move-Out Fund, savings, investments, lifestyle.
6. Create/edit goals.
7. Create/edit debts.
8. See repayment recommendations for active debts.
9. See savings and investment allocation in every reasonable plan.
10. See dashboard progress for active goals and debts.

---

# Build priority

1. Data model and default seed data
2. Allocation engine
3. Dashboard
4. Add Income flow
5. Goal manager
6. Debt manager
7. Expense manager
8. Local persistence
9. Mobile-friendly UI polish

---

# Product tone

Use clear, motivating language:

- "Move-Out Attack Mode"
- "Protect this money"
- "This expense delays your goal"
- "You are on track"
- "Debt pressure reduced"
- "Savings still funded"
- "Investment seed planted"

The app should be practical, founder-friendly, and direct.
