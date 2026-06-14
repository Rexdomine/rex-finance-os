import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  buildDefaultState,
  type AllocationItem,
  type AllocationPlan,
  type AppState,
  type Debt,
  type Goal,
  type Income,
  type RecurringExpense,
} from './finance';

const DEFAULT_DB_PATH = process.env.REX_FINANCE_DB_PATH
  ?? (process.env.VERCEL ? '/tmp/rex-finance-os.sqlite' : join(process.cwd(), 'data', 'rex-finance-os.sqlite'));

type JsonRow = { payload: string } & Record<string, unknown>;

type FinanceStore = {
  getAppState: () => AppState;
  saveAppState: (state: AppState) => void;
  listIncomes: () => Income[];
  listAllocationPlans: () => AllocationPlan[];
  close: () => void;
};

function parsePayload<T>(row: JsonRow): T {
  return JSON.parse(row.payload) as T;
}

function ensureParentDirectory(dbPath: string) {
  if (dbPath === ':memory:') return;
  mkdirSync(dirname(dbPath), { recursive: true });
}

function configureSchema(db: Database.Database) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL,
      currency TEXT NOT NULL,
      deadline TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      strategy TEXT NOT NULL,
      notes TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      remaining_amount REAL NOT NULL,
      currency TEXT NOT NULL,
      minimum_due_amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      urgency TEXT NOT NULL,
      status TEXT NOT NULL,
      strategy TEXT NOT NULL,
      notes TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      frequency TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      work_critical INTEGER NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      exchange_rate REAL NOT NULL,
      received_on TEXT NOT NULL,
      notes TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS allocation_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL,
      input_amount_ngn REAL NOT NULL,
      warnings TEXT NOT NULL,
      recommendations TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS allocation_items (
      id TEXT NOT NULL,
      plan_id INTEGER NOT NULL REFERENCES allocation_plans(id) ON DELETE CASCADE,
      destination_name TEXT NOT NULL,
      destination_type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      priority TEXT NOT NULL,
      reason TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (plan_id, id)
    );

    CREATE INDEX IF NOT EXISTS idx_incomes_received_on ON incomes(received_on DESC);
    CREATE INDEX IF NOT EXISTS idx_allocation_plans_created_at ON allocation_plans(created_at DESC);
  `);
}

export function createFinanceStore(dbPath = DEFAULT_DB_PATH): FinanceStore {
  ensureParentDirectory(dbPath);
  const db = new Database(dbPath);
  configureSchema(db);

  const saveTransaction = db.transaction((state: AppState) => {
    db.prepare(`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
    `).run(JSON.stringify(state));

    db.prepare('DELETE FROM goals').run();
    db.prepare('DELETE FROM debts').run();
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM incomes').run();
    db.prepare('DELETE FROM allocation_plans').run();

    const insertGoal = db.prepare(`
      INSERT INTO goals (id, name, target_amount, current_amount, currency, deadline, priority, status, strategy, notes, payload)
      VALUES (@id, @name, @targetAmount, @currentAmount, @currency, @deadline, @priority, @status, @strategy, @notes, @payload)
    `);
    const insertDebt = db.prepare(`
      INSERT INTO debts (id, name, total_amount, remaining_amount, currency, minimum_due_amount, due_date, urgency, status, strategy, notes, payload)
      VALUES (@id, @name, @totalAmount, @remainingAmount, @currency, @minimumDueAmount, @dueDate, @urgency, @status, @strategy, @notes, @payload)
    `);
    const insertExpense = db.prepare(`
      INSERT INTO expenses (id, name, amount, currency, frequency, category, priority, work_critical, payload)
      VALUES (@id, @name, @amount, @currency, @frequency, @category, @priority, @workCritical, @payload)
    `);
    const insertIncome = db.prepare(`
      INSERT INTO incomes (source, amount, currency, exchange_rate, received_on, notes, payload)
      VALUES (@source, @amount, @currency, @exchangeRate, @date, @notes, @payload)
    `);
    const insertPlan = db.prepare(`
      INSERT INTO allocation_plans (mode, input_amount_ngn, warnings, recommendations, payload)
      VALUES (@mode, @inputAmountNgn, @warnings, @recommendations, @payload)
    `);
    const insertItem = db.prepare(`
      INSERT INTO allocation_items (id, plan_id, destination_name, destination_type, amount, currency, priority, reason, payload)
      VALUES (@id, @planId, @destinationName, @destinationType, @amount, @currency, @priority, @reason, @payload)
    `);

    state.goals.forEach((goal: Goal) => insertGoal.run({ ...goal, notes: goal.notes ?? null, payload: JSON.stringify(goal) }));
    state.debts.forEach((debt: Debt) => insertDebt.run({ ...debt, notes: debt.notes ?? null, payload: JSON.stringify(debt) }));
    state.expenses.forEach((expense: RecurringExpense) => insertExpense.run({ ...expense, workCritical: expense.workCritical ? 1 : 0, payload: JSON.stringify(expense) }));
    state.incomes.forEach((income: Income) => insertIncome.run({ ...income, notes: income.notes ?? null, payload: JSON.stringify(income) }));

    if (state.lastPlan) {
      const result = insertPlan.run({
        mode: state.lastPlan.mode,
        inputAmountNgn: state.lastPlan.inputAmountNgn,
        warnings: JSON.stringify(state.lastPlan.warnings),
        recommendations: JSON.stringify(state.lastPlan.recommendations),
        payload: JSON.stringify(state.lastPlan),
      });
      const planId = Number(result.lastInsertRowid);
      state.lastPlan.items.forEach((item: AllocationItem) => insertItem.run({ ...item, planId, payload: JSON.stringify(item) }));
    }
  });

  return {
    getAppState() {
      const row = db.prepare('SELECT payload FROM app_state WHERE id = 1').get() as JsonRow | undefined;
      return row ? parsePayload<AppState>(row) : buildDefaultState();
    },
    saveAppState(state: AppState) {
      saveTransaction(state);
    },
    listIncomes() {
      return (db.prepare('SELECT payload FROM incomes ORDER BY id DESC').all() as JsonRow[]).map(parsePayload<Income>);
    },
    listAllocationPlans() {
      return (db.prepare('SELECT payload FROM allocation_plans ORDER BY id DESC').all() as JsonRow[]).map(parsePayload<AllocationPlan>);
    },
    close() {
      db.close();
    },
  };
}

let singletonStore: FinanceStore | null = null;

export function getFinanceStore() {
  singletonStore ??= createFinanceStore();
  return singletonStore;
}
