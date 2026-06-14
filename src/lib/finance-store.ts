import { createClient, type Client, type Config, type InStatement, type Row } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

const DEFAULT_LOCAL_DB_PATH = process.env.REX_FINANCE_DB_PATH ?? join(process.cwd(), 'data', 'rex-finance-os.sqlite');

type StoreMode = 'turso-libsql' | 'local-libsql';

type ClientFactory = (config: Config) => Client;

export type FinanceStoreOptions = {
  tursoDatabaseUrl?: string;
  tursoAuthToken?: string;
  localDbPath?: string;
  clientFactory?: ClientFactory;
};

export type FinanceStore = {
  mode: StoreMode;
  getAppState: () => Promise<AppState>;
  saveAppState: (state: AppState) => Promise<void>;
  listIncomes: () => Promise<Income[]>;
  listAllocationPlans: () => Promise<AllocationPlan[]>;
  close: () => Promise<void>;
};

function resolveConfig(options: FinanceStoreOptions = {}): { mode: StoreMode; config: Config } {
  const tursoDatabaseUrl = options.tursoDatabaseUrl ?? process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = options.tursoAuthToken ?? process.env.TURSO_AUTH_TOKEN;

  if (tursoDatabaseUrl && tursoAuthToken) {
    return { mode: 'turso-libsql', config: { url: tursoDatabaseUrl, authToken: tursoAuthToken } };
  }

  const dbPath = options.localDbPath ?? DEFAULT_LOCAL_DB_PATH;
  mkdirSync(dirname(dbPath), { recursive: true });
  return { mode: 'local-libsql', config: { url: `file:${dbPath}` } };
}

function payload<T>(row: Row | undefined): T | undefined {
  if (!row) return undefined;
  return JSON.parse(String(row.payload)) as T;
}

async function configureSchema(client: Client) {
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;

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

function goalStatement(goal: Goal): InStatement {
  return {
    sql: `INSERT INTO goals (id, name, target_amount, current_amount, currency, deadline, priority, status, strategy, notes, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [goal.id, goal.name, goal.targetAmount, goal.currentAmount, goal.currency, goal.deadline, goal.priority, goal.status, goal.strategy, goal.notes ?? null, JSON.stringify(goal)],
  };
}

function debtStatement(debt: Debt): InStatement {
  return {
    sql: `INSERT INTO debts (id, name, total_amount, remaining_amount, currency, minimum_due_amount, due_date, urgency, status, strategy, notes, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [debt.id, debt.name, debt.totalAmount, debt.remainingAmount, debt.currency, debt.minimumDueAmount, debt.dueDate, debt.urgency, debt.status, debt.strategy, debt.notes ?? null, JSON.stringify(debt)],
  };
}

function expenseStatement(expense: RecurringExpense): InStatement {
  return {
    sql: `INSERT INTO expenses (id, name, amount, currency, frequency, category, priority, work_critical, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [expense.id, expense.name, expense.amount, expense.currency, expense.frequency, expense.category, expense.priority, expense.workCritical ? 1 : 0, JSON.stringify(expense)],
  };
}

function incomeStatement(income: Income): InStatement {
  return {
    sql: `INSERT INTO incomes (source, amount, currency, exchange_rate, received_on, notes, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [income.source, income.amount, income.currency, income.exchangeRate, income.date, income.notes ?? null, JSON.stringify(income)],
  };
}

function planStatement(plan: AllocationPlan): InStatement {
  return {
    sql: `INSERT INTO allocation_plans (mode, input_amount_ngn, warnings, recommendations, payload)
          VALUES (?, ?, ?, ?, ?)`,
    args: [plan.mode, plan.inputAmountNgn, JSON.stringify(plan.warnings), JSON.stringify(plan.recommendations), JSON.stringify(plan)],
  };
}

function itemStatement(planId: number, item: AllocationItem): InStatement {
  return {
    sql: `INSERT INTO allocation_items (id, plan_id, destination_name, destination_type, amount, currency, priority, reason, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [item.id, planId, item.destinationName, item.destinationType, item.amount, item.currency, item.priority, item.reason, JSON.stringify(item)],
  };
}

export async function createFinanceStore(options: FinanceStoreOptions = {}): Promise<FinanceStore> {
  const { mode, config } = resolveConfig(options);
  const client = (options.clientFactory ?? createClient)(config);
  await configureSchema(client);

  return {
    mode,
    async getAppState() {
      const result = await client.execute('SELECT payload FROM app_state WHERE id = 1');
      return payload<AppState>(result.rows[0]) ?? buildDefaultState();
    },
    async saveAppState(state: AppState) {
      const statements: InStatement[] = [
        { sql: 'DELETE FROM allocation_items' },
        { sql: 'DELETE FROM allocation_plans' },
        { sql: 'DELETE FROM goals' },
        { sql: 'DELETE FROM debts' },
        { sql: 'DELETE FROM expenses' },
        { sql: 'DELETE FROM incomes' },
        {
          sql: `INSERT INTO app_state (id, payload, updated_at)
                VALUES (1, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
          args: [JSON.stringify(state)],
        },
        ...state.goals.map(goalStatement),
        ...state.debts.map(debtStatement),
        ...state.expenses.map(expenseStatement),
        ...state.incomes.map(incomeStatement),
      ];

      await client.batch(statements, 'write');

      if (state.lastPlan) {
        const planResult = await client.execute(planStatement(state.lastPlan));
        const planId = Number(planResult.lastInsertRowid);
        if (planId > 0 && state.lastPlan.items.length > 0) {
          await client.batch(state.lastPlan.items.map((item) => itemStatement(planId, item)), 'write');
        }
      }
    },
    async listIncomes() {
      const result = await client.execute('SELECT payload FROM incomes ORDER BY id DESC');
      return result.rows.map((row) => payload<Income>(row)).filter((income): income is Income => Boolean(income));
    },
    async listAllocationPlans() {
      const result = await client.execute('SELECT payload FROM allocation_plans ORDER BY id DESC');
      return result.rows.map((row) => payload<AllocationPlan>(row)).filter((plan): plan is AllocationPlan => Boolean(plan));
    },
    async close() {
      client.close();
    },
  };
}

let singletonStore: Promise<FinanceStore> | null = null;

export function getFinanceStore() {
  singletonStore ??= createFinanceStore();
  return singletonStore;
}
