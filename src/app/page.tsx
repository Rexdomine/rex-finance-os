'use client';

import { useEffect, useMemo, useState } from 'react';
import { checkExpenseDecision, getMonthlyExpenseAmount, type ExpenseDecision } from '@/lib/finance';

type Currency = 'NGN' | 'USD';
type Priority = 'critical' | 'high' | 'medium' | 'low';
type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
type DebtStatus = 'active' | 'paid' | 'paused';
type Urgency = 'urgent' | 'normal' | 'flexible';
type ExpensePriority = 'must-pay' | 'important' | 'flexible' | 'pauseable';
type DestinationType = 'expense' | 'goal' | 'debt' | 'savings' | 'investment' | 'lifestyle' | 'buffer';

type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  deadline: string;
  priority: Priority;
  status: GoalStatus;
  strategy: 'deadline-based' | 'fixed-percentage' | 'fixed-amount' | 'manual';
  notes?: string;
};

type Debt = {
  id: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  currency: Currency;
  minimumDueAmount: number;
  dueDate: string;
  urgency: Urgency;
  status: DebtStatus;
  strategy: 'minimum-first' | 'aggressive-payoff' | 'percentage-income' | 'manual';
  notes?: string;
};

type RecurringExpense = {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  frequency: 'weekly' | 'monthly' | 'yearly' | 'one-time';
  category: string;
  priority: ExpensePriority;
  dueDay?: number;
  workCritical: boolean;
};

type Income = {
  source: string;
  amount: number;
  currency: Currency;
  exchangeRate: number;
  date: string;
  notes?: string;
};

type AllocationItem = {
  id: string;
  destinationName: string;
  destinationType: DestinationType;
  amount: number;
  currency: Currency;
  priority: string;
  reason: string;
};

type AllocationPlan = {
  mode: string;
  inputAmountNgn: number;
  items: AllocationItem[];
  warnings: string[];
  recommendations: string[];
};

type AppState = {
  goals: Goal[];
  debts: Debt[];
  expenses: RecurringExpense[];
  incomes: Income[];
  lastPlan?: AllocationPlan;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = 'rex-finance-os-v1';

const defaultState: AppState = {
  goals: [
    {
      id: 'move-out',
      name: 'Move-Out Fund',
      targetAmount: 6000000,
      currentAmount: 1200000,
      currency: 'NGN',
      deadline: '2026-08-31',
      priority: 'critical',
      status: 'active',
      strategy: 'deadline-based',
      notes: 'Rent, agent fee, legal, caution, moving logistics, and part of inverter setup.',
    },
    {
      id: 'emergency',
      name: 'Emergency Buffer',
      targetAmount: 300000,
      currentAmount: 0,
      currency: 'NGN',
      deadline: '2026-08-31',
      priority: 'high',
      status: 'active',
      strategy: 'fixed-percentage',
      notes: 'Protects against irregular income gaps.',
    },
    {
      id: 'investment-seed',
      name: 'Investment Seed',
      targetAmount: 250000,
      currentAmount: 0,
      currency: 'NGN',
      deadline: '2026-12-31',
      priority: 'medium',
      status: 'active',
      strategy: 'fixed-percentage',
      notes: 'Small consistent wealth-building contributions.',
    },
  ],
  debts: [
    {
      id: 'bank-debt',
      name: 'Bank Debt',
      totalAmount: 359000,
      remainingAmount: 359000,
      currency: 'NGN',
      minimumDueAmount: 180120,
      dueDate: '2026-06-30',
      urgency: 'urgent',
      status: 'active',
      strategy: 'minimum-first',
      notes: 'Current month due amount is ₦180,120; remaining can be handled next cycle.',
    },
  ],
  expenses: [
    { id: 'openai', name: 'OpenAI Max', amount: 100, currency: 'USD', frequency: 'monthly', category: 'Work tools', priority: 'must-pay', workCritical: true },
    { id: 'wispr', name: 'Wispr Flow', amount: 12, currency: 'USD', frequency: 'monthly', category: 'Work tools', priority: 'must-pay', workCritical: true },
    { id: 'vps-hosting', name: 'VPS Hosting', amount: 96, currency: 'USD', frequency: 'yearly', category: 'Work tools', priority: 'must-pay', workCritical: true },
    { id: 'internet', name: 'Internet', amount: 50000, currency: 'NGN', frequency: 'monthly', category: 'Work tools', priority: 'must-pay', workCritical: true },
    { id: 'food', name: 'Food', amount: 120000, currency: 'NGN', frequency: 'monthly', category: 'Essentials', priority: 'must-pay', workCritical: false },
    { id: 'electricity', name: 'Electricity', amount: 50000, currency: 'NGN', frequency: 'monthly', category: 'Essentials', priority: 'must-pay', workCritical: true },
    { id: 'fuel', name: 'Fuel / Transport', amount: 100000, currency: 'NGN', frequency: 'monthly', category: 'Essentials', priority: 'must-pay', workCritical: true },
    { id: 'phone', name: 'Phone / Data', amount: 30000, currency: 'NGN', frequency: 'monthly', category: 'Essentials', priority: 'must-pay', workCritical: true },
    { id: 'family', name: 'Family Support Cap', amount: 75000, currency: 'NGN', frequency: 'monthly', category: 'Family', priority: 'important', workCritical: false },
    { id: 'prime', name: 'Prime Video', amount: 2500, currency: 'NGN', frequency: 'monthly', category: 'Subscriptions', priority: 'flexible', workCritical: false },
    { id: 'netflix', name: 'Netflix', amount: 8500, currency: 'NGN', frequency: 'monthly', category: 'Subscriptions', priority: 'flexible', workCritical: false },
    { id: 'lifestyle', name: 'Lifestyle Cap', amount: 50000, currency: 'NGN', frequency: 'monthly', category: 'Lifestyle', priority: 'flexible', workCritical: false },
  ],
  incomes: [],
};

function formatMoney(amount: number, currency: Currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  }).format(Math.max(0, amount || 0));
}

function toNgn(amount: number, currency: Currency, exchangeRate: number) {
  return currency === 'USD' ? amount * exchangeRate : amount;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function generateAllocation(state: AppState, income: Income): AllocationPlan {
  const amountNgn = toNgn(income.amount, income.currency, income.exchangeRate || 1600);
  const items: AllocationItem[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let remaining = amountNgn;

  const activeCriticalGoal = state.goals
    .filter((goal) => goal.status === 'active' && goal.priority === 'critical' && goal.targetAmount > goal.currentAmount)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];

  const mode = amountNgn < 500000 ? 'Survival Mode' : amountNgn < 1500000 ? 'Stability Mode' : 'Move-Out Attack Mode';

  const addItem = (destinationName: string, destinationType: DestinationType, rawAmount: number, priority: string, reason: string) => {
    const amount = Math.max(0, Math.min(remaining, Math.round(rawAmount)));
    if (amount <= 0) return;
    items.push({ id: uid(), destinationName, destinationType, amount, currency: 'NGN', priority, reason });
    remaining -= amount;
  };

  const mustPayExpenses = state.expenses.filter((expense) => expense.priority === 'must-pay');
  const monthlyMustPayNgn = mustPayExpenses.reduce((sum, expense) => sum + getMonthlyExpenseAmount(expense, income.exchangeRate || 1600), 0);
  const expenseCap = mode === 'Survival Mode' ? amountNgn * 0.6 : mode === 'Stability Mode' ? amountNgn * 0.35 : Math.min(monthlyMustPayNgn, amountNgn * 0.32);
  let expensePool = expenseCap;

  mustPayExpenses.forEach((expense) => {
    if (expensePool <= 0) return;
    const desired = getMonthlyExpenseAmount(expense, income.exchangeRate || 1600);
    const allocation = Math.min(desired, expensePool);
    addItem(expense.name, 'expense', allocation, expense.workCritical ? 'work-critical' : 'must-pay', expense.workCritical ? 'Keeps work and income engine running.' : 'Covers core survival spending.');
    expensePool -= allocation;
  });

  const urgentDebts = state.debts.filter((debt) => debt.status === 'active' && debt.remainingAmount > 0 && debt.urgency === 'urgent');
  urgentDebts.forEach((debt) => {
    const base = debt.minimumDueAmount || Math.min(debt.remainingAmount, amountNgn * 0.15);
    const cap = mode === 'Survival Mode' ? amountNgn * 0.15 : mode === 'Stability Mode' ? amountNgn * 0.15 : Math.min(base, amountNgn * 0.2);
    addItem(debt.name, 'debt', Math.min(base, debt.remainingAmount, cap), 'urgent debt', 'Debt pressure comes before lifestyle and most flexible spending.');
  });

  const savingsRate = mode === 'Survival Mode' ? 0.05 : mode === 'Stability Mode' ? 0.07 : 0.08;
  const investmentRate = mode === 'Survival Mode' ? 0.03 : mode === 'Stability Mode' ? 0.05 : 0.05;
  addItem('Emergency Savings', 'savings', Math.max(amountNgn * savingsRate, amountNgn < 100000 ? 1000 : 0), 'protective', 'Save something every time money enters, even if small.');
  addItem('Investment Seed', 'investment', Math.max(amountNgn * investmentRate, amountNgn < 100000 ? 1000 : 0), 'wealth-building', 'Small consistent investing builds the habit before wealth scales.');

  if (activeCriticalGoal) {
    const goalRemaining = activeCriticalGoal.targetAmount - activeCriticalGoal.currentAmount;
    const targetDate = new Date(activeCriticalGoal.deadline + 'T23:59:59');
    const weeksLeft = daysBetween(new Date(), targetDate) / 7;
    const weeklyNeed = goalRemaining / Math.max(1, weeksLeft);
    const goalRate = mode === 'Survival Mode' ? 0.1 : mode === 'Stability Mode' ? 0.3 : 0.65;
    const goalAllocation = Math.min(goalRemaining, Math.max(amountNgn * goalRate, mode === 'Move-Out Attack Mode' ? Math.min(weeklyNeed, remaining) : 0));
    addItem(activeCriticalGoal.name, 'goal', goalAllocation, 'critical goal', `Deadline-based push. Current weekly target is about ${formatMoney(weeklyNeed)}.`);
    if (remaining < weeklyNeed && mode !== 'Move-Out Attack Mode') {
      warnings.push(`${activeCriticalGoal.name} needs about ${formatMoney(weeklyNeed)} weekly. This income may not fully keep pace.`);
    }
  }

  const importantExpenses = state.expenses.filter((expense) => expense.priority === 'important');
  importantExpenses.forEach((expense) => {
    addItem(expense.name, 'expense', Math.min(getMonthlyExpenseAmount(expense, income.exchangeRate || 1600), amountNgn * 0.08), 'important cap', 'Useful support category, but capped while critical goals are active.');
  });

  const lifestyleCap = state.expenses.find((expense) => expense.id === 'lifestyle')?.amount ?? 50000;
  addItem('Controlled Lifestyle', 'lifestyle', Math.min(lifestyleCap, mode === 'Survival Mode' ? amountNgn * 0.05 : amountNgn * 0.08), 'controlled', 'Guilt-free spending, but protected from eating the move-out goal.');

  if (remaining > 0) {
    const destination = activeCriticalGoal?.name ?? 'Buffer';
    addItem(destination, activeCriticalGoal ? 'goal' : 'buffer', remaining, activeCriticalGoal ? 'extra goal push' : 'buffer', activeCriticalGoal ? 'Extra unassigned cash should accelerate the critical goal.' : 'Keep unassigned cash as buffer.');
  }

  if (amountNgn < monthlyMustPayNgn) {
    warnings.push(`This income is below your estimated must-pay monthly expenses of ${formatMoney(monthlyMustPayNgn)}.`);
  }
  if (activeCriticalGoal) {
    const remainingAfterPlan = Math.max(0, activeCriticalGoal.targetAmount - activeCriticalGoal.currentAmount - items.filter((item) => item.destinationName === activeCriticalGoal.name).reduce((sum, item) => sum + item.amount, 0));
    recommendations.push(`${activeCriticalGoal.name} would have ${formatMoney(remainingAfterPlan)} left after this allocation.`);
  }
  recommendations.push('Review the split before spending. The plan is advice; you can still manually adjust it.');

  return { mode, inputAmountNgn: amountNgn, items, warnings, recommendations };
}

function progress(current: number, target: number) {
  return Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
}

function migrateState(stored: AppState): AppState {
  if (stored.expenses.some((expense) => expense.id === 'vps-hosting')) return stored;
  const wisprIndex = stored.expenses.findIndex((expense) => expense.id === 'wispr');
  const vps: RecurringExpense = { id: 'vps-hosting', name: 'VPS Hosting', amount: 96, currency: 'USD', frequency: 'yearly', category: 'Work tools', priority: 'must-pay', workCritical: true };
  const expenses = [...stored.expenses];
  expenses.splice(wisprIndex >= 0 ? wisprIndex + 1 : 0, 0, vps);
  return { ...stored, expenses };
}

export default function Home() {
  const [state, setState] = useState<AppState>(() => {
    if (typeof window === 'undefined') return defaultState;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? migrateState(JSON.parse(stored)) : defaultState;
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'income' | 'checker' | 'goals' | 'debts' | 'expenses'>('dashboard');
  const [income, setIncome] = useState<Income>({ source: 'Freelance / Remote work', amount: 850000, currency: 'NGN', exchangeRate: 1600, date: new Date().toISOString().slice(0, 10), notes: '' });
  const [goalDraft, setGoalDraft] = useState({ name: '', targetAmount: '', currentAmount: '0', deadline: '', priority: 'medium' as Priority });
  const [debtDraft, setDebtDraft] = useState({ name: '', totalAmount: '', remainingAmount: '', minimumDueAmount: '', dueDate: '', urgency: 'normal' as Urgency });
  const [expenseDraft, setExpenseDraft] = useState({ name: '', amount: '', currency: 'NGN' as Currency, frequency: 'monthly' as RecurringExpense['frequency'], category: 'Essentials', priority: 'important' as ExpensePriority, workCritical: false });
  const [decisionDraft, setDecisionDraft] = useState({ name: 'Sneakers', amount: '120000', currency: 'NGN' as Currency, category: 'Clothing', exchangeRate: '1600' });
  const [expenseDecision, setExpenseDecision] = useState<ExpenseDecision | null>(null);
  const [hasLoadedServerState, setHasLoadedServerState] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Loading finance ledger...');
  const [ledgerMode, setLedgerMode] = useState<'turso-libsql' | 'local-libsql' | null>(null);

  useEffect(() => {
    let active = true;

    async function loadServerState() {
      try {
        const response = await fetch('/api/finance-state', { cache: 'no-store' });
        if (!response.ok) throw new Error('SQLite API unavailable');
        const data = (await response.json()) as { state: AppState; mode?: 'turso-libsql' | 'local-libsql' };
        if (!active) return;
        setState(migrateState(data.state));
        setLedgerMode(data.mode ?? null);
        setSyncStatus(data.mode === 'turso-libsql' ? 'Turso cloud ledger connected' : 'Local SQLite ledger connected');
      } catch {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && active) setState(migrateState(JSON.parse(stored)));
        if (active) setSyncStatus('SQLite sync unavailable — using browser fallback');
      } finally {
        if (active) setHasLoadedServerState(true);
      }
    }

    loadServerState();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hasLoadedServerState) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/finance-state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('SQLite save failed');
        const data = (await response.json()) as { mode?: 'turso-libsql' | 'local-libsql' };
        const currentMode = data.mode ?? ledgerMode;
        setLedgerMode(currentMode ?? null);
        setSyncStatus(currentMode === 'turso-libsql' ? 'Saved to Turso cloud ledger' : 'Saved to local SQLite ledger');
      } catch {
        if (!controller.signal.aborted) setSyncStatus('SQLite save failed — browser copy kept');
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [hasLoadedServerState, ledgerMode, state]);

  const dashboard = useMemo(() => {
    const activeGoals = state.goals.filter((goal) => goal.status === 'active');
    const activeDebts = state.debts.filter((debt) => debt.status === 'active');
    const goalRemaining = activeGoals.reduce((sum, goal) => sum + Math.max(0, goal.targetAmount - goal.currentAmount), 0);
    const debtRemaining = activeDebts.reduce((sum, debt) => sum + Math.max(0, debt.remainingAmount), 0);
    const monthlyExpenses = state.expenses.reduce((sum, expense) => sum + getMonthlyExpenseAmount(expense, 1600), 0);
    const totalIncome = state.incomes.reduce((sum, item) => sum + toNgn(item.amount, item.currency, item.exchangeRate), 0);
    return { activeGoals, activeDebts, goalRemaining, debtRemaining, monthlyExpenses, totalIncome };
  }, [state]);

  const runAllocation = () => {
    const plan = generateAllocation(state, income);
    setState((previous) => ({ ...previous, incomes: [income, ...previous.incomes].slice(0, 25), lastPlan: plan }));
    setActiveTab('dashboard');
  };

  const applyLastPlan = () => {
    if (!state.lastPlan) return;
    setState((previous) => ({
      ...previous,
      goals: previous.goals.map((goal) => {
        const add = previous.lastPlan?.items.filter((item) => item.destinationType === 'goal' && item.destinationName === goal.name).reduce((sum, item) => sum + item.amount, 0) ?? 0;
        const currentAmount = Math.min(goal.targetAmount, goal.currentAmount + add);
        return { ...goal, currentAmount, status: currentAmount >= goal.targetAmount ? 'completed' : goal.status };
      }),
      debts: previous.debts.map((debt) => {
        const paid = previous.lastPlan?.items.filter((item) => item.destinationType === 'debt' && item.destinationName === debt.name).reduce((sum, item) => sum + item.amount, 0) ?? 0;
        const remainingAmount = Math.max(0, debt.remainingAmount - paid);
        return { ...debt, remainingAmount, status: remainingAmount <= 0 ? 'paid' : debt.status };
      }),
    }));
  };

  const addGoal = () => {
    if (!goalDraft.name || !goalDraft.targetAmount) return;
    setState((previous) => ({
      ...previous,
      goals: [...previous.goals, { id: uid(), name: goalDraft.name, targetAmount: Number(goalDraft.targetAmount), currentAmount: Number(goalDraft.currentAmount || 0), currency: 'NGN', deadline: goalDraft.deadline || '2026-12-31', priority: goalDraft.priority, status: 'active', strategy: 'deadline-based' }],
    }));
    setGoalDraft({ name: '', targetAmount: '', currentAmount: '0', deadline: '', priority: 'medium' });
  };

  const addDebt = () => {
    if (!debtDraft.name || !debtDraft.totalAmount) return;
    setState((previous) => ({
      ...previous,
      debts: [...previous.debts, { id: uid(), name: debtDraft.name, totalAmount: Number(debtDraft.totalAmount), remainingAmount: Number(debtDraft.remainingAmount || debtDraft.totalAmount), currency: 'NGN', minimumDueAmount: Number(debtDraft.minimumDueAmount || 0), dueDate: debtDraft.dueDate || new Date().toISOString().slice(0, 10), urgency: debtDraft.urgency, status: 'active', strategy: 'minimum-first' }],
    }));
    setDebtDraft({ name: '', totalAmount: '', remainingAmount: '', minimumDueAmount: '', dueDate: '', urgency: 'normal' });
  };

  const addExpense = () => {
    if (!expenseDraft.name || !expenseDraft.amount) return;
    setState((previous) => ({
      ...previous,
      expenses: [...previous.expenses, { id: uid(), name: expenseDraft.name, amount: Number(expenseDraft.amount), currency: expenseDraft.currency, frequency: expenseDraft.frequency, category: expenseDraft.category, priority: expenseDraft.priority, workCritical: expenseDraft.workCritical }],
    }));
    setExpenseDraft({ name: '', amount: '', currency: 'NGN', frequency: 'monthly', category: 'Essentials', priority: 'important', workCritical: false });
  };

  const runExpenseDecision = () => {
    setExpenseDecision(checkExpenseDecision(state, {
      name: decisionDraft.name,
      amount: Number(decisionDraft.amount || 0),
      currency: decisionDraft.currency,
      category: decisionDraft.category,
      exchangeRate: Number(decisionDraft.exchangeRate || 1600),
      date: new Date().toISOString().slice(0, 10),
    }));
  };

  const resetData = () => setState(defaultState);

  return (
    <main className="min-h-screen bg-[#07130f] text-white">
      <section className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-400/20 via-slate-950 to-black p-6 shadow-2xl shadow-emerald-950/30">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-300">Groot Finance Command Center</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Rex Finance OS</h1>
              <p className="mt-4 max-w-3xl text-lg text-emerald-50/80">Log income once. Get a clear split across goals, debt, savings, investments, work tools, and lifestyle — built for variable NGN/USD income.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm text-emerald-100/70">Current mode</p>
              <p className="text-2xl font-bold">Move-Out Attack</p>
              <p className="text-sm text-emerald-200">Save/invest stays on, even small.</p>
              <p className="mt-3 rounded-full bg-black/25 px-3 py-1 text-xs font-bold text-emerald-100">{syncStatus}</p>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
          {(['dashboard', 'income', 'checker', 'goals', 'debts', 'expenses'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition ${activeTab === tab ? 'bg-emerald-400 text-black' : 'bg-white/5 text-white hover:bg-white/10'}`}>{tab}</button>
          ))}
          <button onClick={resetData} className="ml-auto rounded-xl bg-red-400/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-400/20">Reset demo data</button>
        </nav>

        {activeTab === 'dashboard' && (
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Metric title="Income logged" value={formatMoney(dashboard.totalIncome)} note="SQLite ledger history" />
              <Metric title="Active goal gap" value={formatMoney(dashboard.goalRemaining)} note="All active goals" />
              <Metric title="Debt remaining" value={formatMoney(dashboard.debtRemaining)} note="Active debts only" />
              <Metric title="Monthly expense map" value={formatMoney(dashboard.monthlyExpenses)} note="Includes USD tools @ ₦1,600/$" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Active goals">
                <div className="space-y-4">
                  {dashboard.activeGoals.map((goal) => (
                    <div key={goal.id} className="rounded-2xl bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold">{goal.name}</p>
                          <p className="text-sm text-white/60">{formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)} · {goal.deadline}</p>
                        </div>
                        <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">{progress(goal.currentAmount, goal.targetAmount)}%</span>
                      </div>
                      <div className="mt-3 h-3 rounded-full bg-black/40"><div className="h-3 rounded-full bg-emerald-400" style={{ width: `${progress(goal.currentAmount, goal.targetAmount)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Latest allocation plan">
                {state.lastPlan ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-emerald-400/10 p-4">
                      <p className="text-sm text-emerald-200">{state.lastPlan.mode}</p>
                      <p className="text-2xl font-black">{formatMoney(state.lastPlan.inputAmountNgn)}</p>
                    </div>
                    <div className="max-h-[28rem] space-y-3 overflow-auto pr-1">
                      {state.lastPlan.items.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold">{item.destinationName}</p>
                              <p className="text-xs uppercase tracking-widest text-white/40">{item.destinationType} · {item.priority}</p>
                              <p className="mt-2 text-sm text-white/60">{item.reason}</p>
                            </div>
                            <p className="whitespace-nowrap font-black text-emerald-300">{formatMoney(item.amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {state.lastPlan.warnings.map((warning) => <p key={warning} className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">⚠ {warning}</p>)}
                    {state.lastPlan.recommendations.map((recommendation) => <p key={recommendation} className="rounded-xl bg-blue-400/10 p-3 text-sm text-blue-100">💡 {recommendation}</p>)}
                    <button onClick={applyLastPlan} className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-black text-black hover:bg-emerald-300">Apply plan to goal/debt progress</button>
                  </div>
                ) : <p className="text-white/60">No allocation generated yet. Add income to cook the first split.</p>}
              </Panel>
            </div>
          </div>
        )}

        {activeTab === 'income' && (
          <Panel title="Add income and generate split">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Source" value={income.source} onChange={(value) => setIncome({ ...income, source: value })} />
              <Input label="Amount" type="number" value={String(income.amount)} onChange={(value) => setIncome({ ...income, amount: Number(value) })} />
              <Select label="Currency" value={income.currency} onChange={(value) => setIncome({ ...income, currency: value as Currency })} options={['NGN', 'USD']} />
              <Input label="USD→NGN exchange rate" type="number" value={String(income.exchangeRate)} onChange={(value) => setIncome({ ...income, exchangeRate: Number(value) })} />
              <Input label="Date received" type="date" value={income.date} onChange={(value) => setIncome({ ...income, date: value })} />
              <Input label="Notes" value={income.notes || ''} onChange={(value) => setIncome({ ...income, notes: value })} />
            </div>
            <button onClick={runAllocation} className="mt-6 rounded-2xl bg-emerald-400 px-6 py-3 font-black text-black hover:bg-emerald-300">Generate Groot Split</button>
          </Panel>
        )}

        {activeTab === 'checker' && (
          <Panel title="Expense decision checker">
            <p className="mb-5 max-w-3xl text-white/60">Test a planned expense before spending. Groot checks it against active goals, debts, work-critical rules, savings/investment discipline, and your Move-Out Attack Mode.</p>
            <div className="grid gap-4 md:grid-cols-5">
              <Input label="Expense name" value={decisionDraft.name} onChange={(value) => setDecisionDraft({ ...decisionDraft, name: value })} />
              <Input label="Amount" type="number" value={decisionDraft.amount} onChange={(value) => setDecisionDraft({ ...decisionDraft, amount: value })} />
              <Select label="Currency" value={decisionDraft.currency} onChange={(value) => setDecisionDraft({ ...decisionDraft, currency: value as Currency })} options={['NGN', 'USD']} />
              <Input label="Category" value={decisionDraft.category} onChange={(value) => setDecisionDraft({ ...decisionDraft, category: value })} />
              <Input label="USD→NGN rate" type="number" value={decisionDraft.exchangeRate} onChange={(value) => setDecisionDraft({ ...decisionDraft, exchangeRate: value })} />
            </div>
            <button onClick={runExpenseDecision} className="mt-6 rounded-2xl bg-emerald-400 px-6 py-3 font-black text-black hover:bg-emerald-300">Check before spending</button>

            {expenseDecision && (
              <div className={`mt-6 rounded-3xl border p-5 ${expenseDecision.verdict === 'approve' ? 'border-emerald-300/30 bg-emerald-400/10' : expenseDecision.verdict === 'caution' ? 'border-amber-300/30 bg-amber-400/10' : 'border-red-300/30 bg-red-400/10'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white/50">Verdict</p>
                    <h3 className="mt-1 text-3xl font-black capitalize">{expenseDecision.verdict}</h3>
                    <p className="mt-2 text-white/75">{expenseDecision.summary}</p>
                  </div>
                  <div className="rounded-2xl bg-black/25 p-4 text-right">
                    <p className="text-xs text-white/50">Goal impact</p>
                    <p className="text-2xl font-black">{formatMoney(expenseDecision.goalImpactAmount)}</p>
                    <p className="text-xs text-white/50">Expense: {formatMoney(expenseDecision.amountNgn)}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 font-bold">Why Groot says this</p>
                    <ul className="space-y-2 text-sm text-white/70">{expenseDecision.reasons.map((reason) => <li key={reason} className="rounded-xl bg-black/20 p-3">{reason}</li>)}</ul>
                  </div>
                  <div>
                    <p className="mb-2 font-bold">Recommended move</p>
                    <ul className="space-y-2 text-sm text-white/70">{expenseDecision.recommendations.map((recommendation) => <li key={recommendation} className="rounded-xl bg-black/20 p-3">{recommendation}</li>)}</ul>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        )}

        {activeTab === 'goals' && (
          <Panel title="Goals">
            <div className="grid gap-3 md:grid-cols-5">
              <Input label="Goal name" value={goalDraft.name} onChange={(value) => setGoalDraft({ ...goalDraft, name: value })} />
              <Input label="Target amount" type="number" value={goalDraft.targetAmount} onChange={(value) => setGoalDraft({ ...goalDraft, targetAmount: value })} />
              <Input label="Current amount" type="number" value={goalDraft.currentAmount} onChange={(value) => setGoalDraft({ ...goalDraft, currentAmount: value })} />
              <Input label="Deadline" type="date" value={goalDraft.deadline} onChange={(value) => setGoalDraft({ ...goalDraft, deadline: value })} />
              <Select label="Priority" value={goalDraft.priority} onChange={(value) => setGoalDraft({ ...goalDraft, priority: value as Priority })} options={['critical', 'high', 'medium', 'low']} />
            </div>
            <button onClick={addGoal} className="mt-4 rounded-xl bg-emerald-400 px-5 py-2 font-bold text-black">Add goal</button>
            <List items={state.goals.map((goal) => `${goal.name} — ${formatMoney(goal.currentAmount)} / ${formatMoney(goal.targetAmount)} — ${goal.status}`)} />
          </Panel>
        )}

        {activeTab === 'debts' && (
          <Panel title="Debts">
            <div className="grid gap-3 md:grid-cols-6">
              <Input label="Debt name" value={debtDraft.name} onChange={(value) => setDebtDraft({ ...debtDraft, name: value })} />
              <Input label="Total" type="number" value={debtDraft.totalAmount} onChange={(value) => setDebtDraft({ ...debtDraft, totalAmount: value })} />
              <Input label="Remaining" type="number" value={debtDraft.remainingAmount} onChange={(value) => setDebtDraft({ ...debtDraft, remainingAmount: value })} />
              <Input label="Min due" type="number" value={debtDraft.minimumDueAmount} onChange={(value) => setDebtDraft({ ...debtDraft, minimumDueAmount: value })} />
              <Input label="Due date" type="date" value={debtDraft.dueDate} onChange={(value) => setDebtDraft({ ...debtDraft, dueDate: value })} />
              <Select label="Urgency" value={debtDraft.urgency} onChange={(value) => setDebtDraft({ ...debtDraft, urgency: value as Urgency })} options={['urgent', 'normal', 'flexible']} />
            </div>
            <button onClick={addDebt} className="mt-4 rounded-xl bg-emerald-400 px-5 py-2 font-bold text-black">Add debt</button>
            <List items={state.debts.map((debt) => `${debt.name} — remaining ${formatMoney(debt.remainingAmount)} — min due ${formatMoney(debt.minimumDueAmount)} — ${debt.status}`)} />
          </Panel>
        )}

        {activeTab === 'expenses' && (
          <Panel title="Expenses and bills">
            <div className="grid gap-3 md:grid-cols-7">
              <Input label="Expense name" value={expenseDraft.name} onChange={(value) => setExpenseDraft({ ...expenseDraft, name: value })} />
              <Input label="Amount" type="number" value={expenseDraft.amount} onChange={(value) => setExpenseDraft({ ...expenseDraft, amount: value })} />
              <Select label="Currency" value={expenseDraft.currency} onChange={(value) => setExpenseDraft({ ...expenseDraft, currency: value as Currency })} options={['NGN', 'USD']} />
              <Select label="Frequency" value={expenseDraft.frequency} onChange={(value) => setExpenseDraft({ ...expenseDraft, frequency: value as RecurringExpense['frequency'] })} options={['monthly', 'yearly', 'weekly', 'one-time']} />
              <Input label="Category" value={expenseDraft.category} onChange={(value) => setExpenseDraft({ ...expenseDraft, category: value })} />
              <Select label="Priority" value={expenseDraft.priority} onChange={(value) => setExpenseDraft({ ...expenseDraft, priority: value as ExpensePriority })} options={['must-pay', 'important', 'flexible', 'pauseable']} />
              <label className="flex items-end gap-2 rounded-xl bg-white/5 p-3 text-sm"><input type="checkbox" checked={expenseDraft.workCritical} onChange={(event) => setExpenseDraft({ ...expenseDraft, workCritical: event.target.checked })} /> Work-critical</label>
            </div>
            <button onClick={addExpense} className="mt-4 rounded-xl bg-emerald-400 px-5 py-2 font-bold text-black">Add expense</button>
            <List items={state.expenses.map((expense) => `${expense.name} — ${formatMoney(expense.amount, expense.currency)} ${expense.frequency === 'yearly' ? 'yearly' : 'monthly'} — monthly planning: ${formatMoney(getMonthlyExpenseAmount(expense, 1600))} — ${expense.priority}${expense.workCritical ? ' — work-critical' : ''}`)} />
          </Panel>
        )}
      </section>
    </main>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5"><p className="text-sm text-white/50">{title}</p><p className="mt-2 text-2xl font-black text-emerald-300">{value}</p><p className="mt-1 text-xs text-white/40">{note}</p></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20"><h2 className="mb-4 text-2xl font-black">{title}</h2>{children}</section>;
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/40">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white outline-none focus:border-emerald-300" /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/40">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white outline-none focus:border-emerald-300">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function List({ items }: { items: string[] }) {
  return <div className="mt-5 space-y-2">{items.map((item) => <div key={item} className="rounded-xl bg-white/5 p-3 text-sm text-white/75">{item}</div>)}</div>;
}
