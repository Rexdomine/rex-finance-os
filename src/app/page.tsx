'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAllocationPlanToProgress,
  buildDefaultState,
  checkExpenseDecision,
  deleteAllocationPlan,
  formatMoney,
  generateAllocation,
  getUsdToNgnRate,
  getAllocationPlanProgressTotals,
  getAllocationPlanSignature,
  getMonthlyExpenseAmount,
  migrateAppState,
  toNgn,
  toUsd,
  updateRecurringExpense,
  type AppState,
  type Currency,
  type ExpenseDecision,
  type ExpensePriority,
  type Income,
  type Priority,
  type RecurringExpense,
  type Urgency,
} from '@/lib/finance';


const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = 'rex-finance-os-v1';

const getDefaultState = () => buildDefaultState();

type ExpenseEditDraft = {
  amount: string;
  currency: Currency;
  frequency: RecurringExpense['frequency'];
  category: string;
  priority: ExpensePriority;
  workCritical: boolean;
};

/**
 * Formats exchange rates for compact dashboard and settings display.
 */
function formatRate(rate: number) {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(rate);
}

/**
 * Calculates bounded percentage progress toward a goal target.
 */
function progress(current: number, target: number) {
  return Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
}

/**
 * Applies domain migration to browser/server-loaded state before rendering.
 */
function migrateState(stored: Partial<AppState>): AppState {
  return migrateAppState(stored);
}

/**
 * Main Rex Finance OS dashboard and management screen.
 */
export default function Home() {
  const [state, setState] = useState<AppState>(() => {
    if (typeof window === 'undefined') return getDefaultState();
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? migrateState(JSON.parse(stored)) : getDefaultState();
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'income' | 'checker' | 'goals' | 'debts' | 'expenses' | 'settings'>('dashboard');
  const [income, setIncome] = useState<Income>({ source: 'Freelance / Remote work', amount: 850000, currency: 'NGN', exchangeRate: getUsdToNgnRate(getDefaultState()), date: new Date().toISOString().slice(0, 10), notes: '' });
  const [goalDraft, setGoalDraft] = useState({ name: '', targetAmount: '', currentAmount: '0', deadline: '', priority: 'medium' as Priority });
  const [debtDraft, setDebtDraft] = useState({ name: '', totalAmount: '', remainingAmount: '', minimumDueAmount: '', dueDate: '', urgency: 'normal' as Urgency });
  const [expenseDraft, setExpenseDraft] = useState({ name: '', amount: '', currency: 'NGN' as Currency, frequency: 'monthly' as RecurringExpense['frequency'], category: 'Essentials', priority: 'important' as ExpensePriority, workCritical: false });
  const [decisionDraft, setDecisionDraft] = useState({ name: 'Sneakers', amount: '120000', currency: 'NGN' as Currency, category: 'Clothing', exchangeRate: String(getUsdToNgnRate(getDefaultState())) });
  const [expenseDecision, setExpenseDecision] = useState<ExpenseDecision | null>(null);
  const [expenseStatus, setExpenseStatus] = useState<string | null>(null);
  const [expenseStatusTone, setExpenseStatusTone] = useState<'success' | 'warning'>('success');
  const [expenseToDelete, setExpenseToDelete] = useState<RecurringExpense | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<RecurringExpense | null>(null);
  const [expenseEditDraft, setExpenseEditDraft] = useState<ExpenseEditDraft | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [isDeletePlanDialogOpen, setIsDeletePlanDialogOpen] = useState(false);
  const [hasLoadedServerState, setHasLoadedServerState] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Loading finance ledger...');
  const [ledgerMode, setLedgerMode] = useState<'turso-libsql' | 'local-libsql' | null>(null);
  const [rateStatus, setRateStatus] = useState<string | null>(null);
  const [isRefreshingRate, setIsRefreshingRate] = useState(false);
  const hasStartedAutoRateRefresh = useRef(false);

  const usdToNgnRate = getUsdToNgnRate(state);

  useEffect(() => {
    let active = true;

    async function loadServerState() {
      try {
        const response = await fetch('/api/finance-state', { cache: 'no-store' });
        if (!response.ok) throw new Error('SQLite API unavailable');
        const data = (await response.json()) as { state: AppState; mode?: 'turso-libsql' | 'local-libsql' };
        if (!active) return;
        const migrated = migrateState(data.state);
        setState(migrated);
        setIncome((previous) => ({ ...previous, exchangeRate: getUsdToNgnRate(migrated) }));
        setDecisionDraft((previous) => ({ ...previous, exchangeRate: String(getUsdToNgnRate(migrated)) }));
        setLedgerMode(data.mode ?? null);
        setSyncStatus(data.mode === 'turso-libsql' ? 'Turso cloud ledger connected' : 'Local SQLite ledger connected');
      } catch {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && active) {
          const migrated = migrateState(JSON.parse(stored));
          setState(migrated);
          setIncome((previous) => ({ ...previous, exchangeRate: getUsdToNgnRate(migrated) }));
          setDecisionDraft((previous) => ({ ...previous, exchangeRate: String(getUsdToNgnRate(migrated)) }));
        }
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
    const monthlyExpenses = state.expenses.reduce((sum, expense) => sum + getMonthlyExpenseAmount(expense, usdToNgnRate), 0);
    const totalIncome = state.incomes.reduce((sum, item) => sum + toNgn(item.amount, item.currency, item.exchangeRate), 0);
    return { activeGoals, activeDebts, goalRemaining, debtRemaining, monthlyExpenses, totalIncome };
  }, [state, usdToNgnRate]);

  const currentPlanSignature = getAllocationPlanSignature(state.lastPlan);
  const isLastPlanApplied = Boolean(state.lastPlan && state.appliedPlanSignature === currentPlanSignature);
  const deletePlanImpact = getAllocationPlanProgressTotals(state.lastPlan);

  const runAllocation = () => {
    const planIncome = { ...income, exchangeRate: usdToNgnRate };
    const plan = generateAllocation(state, planIncome);
    setState((previous) => ({ ...previous, incomes: [planIncome, ...previous.incomes].slice(0, 25), lastPlan: plan, appliedPlanSignature: undefined }));
    setApplyStatus(null);
    setIsDeletePlanDialogOpen(false);
    setActiveTab('dashboard');
  };

  const applyLastPlan = () => {
    if (!state.lastPlan) return;

    const currentSignature = getAllocationPlanSignature(state.lastPlan);
    if (state.appliedPlanSignature === currentSignature) {
      setApplyStatus('Already applied — this plan will not be counted twice.');
      return;
    }

    const { goalTotal, debtTotal } = getAllocationPlanProgressTotals(state.lastPlan);
    setState((previous) => applyAllocationPlanToProgress(previous));
    setApplyStatus(`Applied: ${formatMoney(goalTotal)} added to goals and ${formatMoney(debtTotal)} paid down from debts. Saving to Turso...`);
  };

  const deleteLastPlan = () => {
    if (!state.lastPlan) return;
    setIsDeletePlanDialogOpen(true);
  };

  const confirmDeleteLastPlan = () => {
    if (!state.lastPlan) return;
    const { goalTotal, debtTotal } = getAllocationPlanProgressTotals(state.lastPlan);
    setState((previous) => deleteAllocationPlan(previous));
    setIsDeletePlanDialogOpen(false);
    setApplyStatus(isLastPlanApplied
      ? `Allocation plan deleted, income log cleared, and progress reversed: ${formatMoney(goalTotal)} removed from goals and ${formatMoney(debtTotal)} restored to debts. Saving to Turso...`
      : 'Allocation plan deleted and the linked income log cleared. No goal or debt progress had been applied yet. Saving to Turso...');
  };

  const cancelDeleteLastPlan = () => setIsDeletePlanDialogOpen(false);

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
    if (!expenseDraft.name || !expenseDraft.amount) {
      setExpenseStatusTone('warning');
      setExpenseStatus('Add an expense name and amount first.');
      return;
    }

    const addedExpense = {
      id: uid(),
      name: expenseDraft.name,
      amount: Number(expenseDraft.amount),
      currency: expenseDraft.currency,
      frequency: expenseDraft.frequency,
      category: expenseDraft.category,
      priority: expenseDraft.priority,
      workCritical: expenseDraft.workCritical,
    };

    setState((previous) => ({
      ...previous,
      expenses: [...previous.expenses, addedExpense],
    }));
    setExpenseStatusTone('success');
    setExpenseStatus(`Expense added: ${addedExpense.name} — ${formatMoney(addedExpense.amount, addedExpense.currency)} ${addedExpense.frequency}. Saving to ledger...`);
    setExpenseDraft({ name: '', amount: '', currency: 'NGN', frequency: 'monthly', category: 'Essentials', priority: 'important', workCritical: false });
  };

  const requestEditExpense = (expense: RecurringExpense) => {
    setExpenseToEdit(expense);
    setExpenseEditDraft({
      amount: String(expense.amount),
      currency: expense.currency,
      frequency: expense.frequency,
      category: expense.category,
      priority: expense.priority,
      workCritical: expense.workCritical,
    });
  };

  const cancelEditExpense = () => {
    setExpenseToEdit(null);
    setExpenseEditDraft(null);
  };

  const confirmEditExpense = () => {
    if (!expenseToEdit || !expenseEditDraft) return;
    const nextAmount = Number(expenseEditDraft.amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0 || !expenseEditDraft.category.trim()) {
      setExpenseStatusTone('warning');
      setExpenseStatus('Enter a positive amount and category before updating the expense.');
      return;
    }

    setState((previous) => updateRecurringExpense(previous, expenseToEdit.id, {
      amount: nextAmount,
      currency: expenseEditDraft.currency,
      frequency: expenseEditDraft.frequency,
      category: expenseEditDraft.category.trim(),
      priority: expenseEditDraft.priority,
      workCritical: expenseEditDraft.workCritical,
    }));
    setExpenseStatusTone('success');
    setExpenseStatus(`Expense updated: ${expenseToEdit.name} — ${formatMoney(nextAmount, expenseEditDraft.currency)} ${expenseEditDraft.frequency}. Saving to ledger...`);
    cancelEditExpense();
  };

  const requestDeleteExpense = (expense: RecurringExpense) => {
    setExpenseToDelete(expense);
  };

  const cancelDeleteExpense = () => setExpenseToDelete(null);

  const confirmDeleteExpense = () => {
    if (!expenseToDelete) return;
    setState((previous) => ({
      ...previous,
      expenses: previous.expenses.filter((expense) => expense.id !== expenseToDelete.id),
    }));
    setExpenseStatusTone('success');
    setExpenseStatus(`Expense deleted: ${expenseToDelete.name}. Saving to ledger...`);
    setExpenseToDelete(null);
  };

  const runExpenseDecision = () => {
    setExpenseDecision(checkExpenseDecision(state, {
      name: decisionDraft.name,
      amount: Number(decisionDraft.amount || 0),
      currency: decisionDraft.currency,
      category: decisionDraft.category,
      exchangeRate: usdToNgnRate,
      date: new Date().toISOString().slice(0, 10),
    }));
  };

  const refreshExchangeRate = async () => {
    setIsRefreshingRate(true);
    setRateStatus('Refreshing live USD/NGN rate...');
    try {
      const response = await fetch('/api/exchange-rate', { cache: 'no-store' });
      const data = (await response.json()) as { rate?: { usdToNgn: number; source: 'open-er-api'; provider?: string; updatedAt?: string }; error?: string };
      if (!response.ok || !data.rate) throw new Error(data.error ?? 'Unable to refresh USD/NGN exchange rate.');
      setState((previous) => ({
        ...previous,
        exchangeRateSettings: {
          usdToNgn: data.rate!.usdToNgn,
          source: data.rate!.source,
          provider: data.rate!.provider,
          updatedAt: data.rate!.updatedAt ?? new Date().toISOString(),
          autoRefresh: previous.exchangeRateSettings.autoRefresh,
        },
      }));
      setIncome((previous) => ({ ...previous, exchangeRate: data.rate!.usdToNgn }));
      setDecisionDraft((previous) => ({ ...previous, exchangeRate: String(data.rate!.usdToNgn) }));
      setRateStatus(`Live USD/NGN rate updated: ₦${formatRate(data.rate.usdToNgn)}/$`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh USD/NGN exchange rate.';
      setRateStatus(`Rate refresh failed — keeping ₦${formatRate(usdToNgnRate)}/$. ${message}`);
    } finally {
      setIsRefreshingRate(false);
    }
  };

  const saveManualExchangeRate = (value: string) => {
    const nextRate = Number(value);
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      setRateStatus('Enter a positive USD/NGN rate before saving.');
      return;
    }
    setState((previous) => ({
      ...previous,
      exchangeRateSettings: {
        ...previous.exchangeRateSettings,
        usdToNgn: nextRate,
        source: 'manual',
        updatedAt: new Date().toISOString(),
        error: undefined,
      },
    }));
    setIncome((previous) => ({ ...previous, exchangeRate: nextRate }));
    setDecisionDraft((previous) => ({ ...previous, exchangeRate: String(nextRate) }));
    setRateStatus(`Manual USD/NGN rate saved: ₦${formatRate(nextRate)}/$`);
  };

  useEffect(() => {
    if (!hasLoadedServerState || !state.exchangeRateSettings.autoRefresh) {
      hasStartedAutoRateRefresh.current = false;
      return;
    }
    if (hasStartedAutoRateRefresh.current) return;
    hasStartedAutoRateRefresh.current = true;
    refreshExchangeRate();
    const intervalId = window.setInterval(refreshExchangeRate, 60 * 60 * 1000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoadedServerState, state.exchangeRateSettings.autoRefresh]);

  const resetData = () => setState(getDefaultState());

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
          {(['dashboard', 'income', 'checker', 'goals', 'debts', 'expenses', 'settings'] as const).map((tab) => (
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
              <Metric title="Monthly expense map" value={formatMoney(dashboard.monthlyExpenses)} note={`Includes USD tools @ ₦${formatRate(usdToNgnRate)}/$`} />
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
                      <p className="mt-1 text-sm text-emerald-100/75">USD equivalent: {formatMoney(state.lastPlan.inputAmountUsd ?? toUsd(state.lastPlan.inputAmountNgn, state.lastPlan.exchangeRate ?? income.exchangeRate), 'USD')}</p>
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
                            <div className="text-right">
                              <p className="whitespace-nowrap font-black text-emerald-300">{formatMoney(item.amount)}</p>
                              <p className="mt-1 whitespace-nowrap text-xs font-semibold text-white/50">≈ {formatMoney(item.amountUsd ?? toUsd(item.amount, state.lastPlan?.exchangeRate ?? income.exchangeRate), 'USD')}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(state.lastPlan.excludedExpenses ?? []).length > 0 && (
                      <div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-200/70">Allocation transparency</p>
                            <h3 className="mt-1 text-xl font-black text-amber-50">Excluded from this allocation</h3>
                          </div>
                          <p className="text-sm text-amber-100/70">Shows the reason each expense was excluded.</p>
                        </div>
                        <div className="mt-4 space-y-3">
                          {(state.lastPlan.excludedExpenses ?? []).map((expense) => (
                            <div key={expense.expenseId} className="rounded-2xl bg-black/25 p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-bold text-white">{expense.expenseName}</p>
                                  <p className="text-xs uppercase tracking-widest text-white/40">{expense.category} · {expense.priority}</p>
                                </div>
                                <p className="font-black text-amber-200">Excluded {formatMoney(expense.excludedAmountNgn ?? expense.monthlyAmountNgn)}</p>
                                <p className="text-xs text-white/40">Monthly amount: {formatMoney(expense.monthlyAmountNgn)}</p>
                              </div>
                              <p className="mt-3 text-sm text-amber-50/80">{expense.reason}</p>
                              <div className="mt-3">
                                <p className="text-xs font-black uppercase tracking-[0.25em] text-white/35">Rules/constraints</p>
                                <ul className="mt-2 space-y-2 text-sm text-white/60">
                                  {expense.rules.map((rule) => <li key={rule} className="rounded-xl bg-white/[0.04] p-2">{rule}</li>)}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {state.lastPlan.warnings.map((warning) => <p key={warning} className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">⚠ {warning}</p>)}
                    {state.lastPlan.recommendations.map((recommendation) => <p key={recommendation} className="rounded-xl bg-blue-400/10 p-3 text-sm text-blue-100">💡 {recommendation}</p>)}
                    {applyStatus && <p className="rounded-xl bg-emerald-400/10 p-3 text-sm font-semibold text-emerald-100">✅ {applyStatus}</p>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={applyLastPlan}
                        disabled={isLastPlanApplied}
                        className={`rounded-2xl px-4 py-3 font-black text-black transition ${isLastPlanApplied ? 'cursor-not-allowed bg-emerald-200/60' : 'bg-emerald-400 hover:bg-emerald-300'}`}
                      >
                        {isLastPlanApplied ? 'Plan already applied' : 'Apply plan to goal/debt progress'}
                      </button>
                      <button
                        onClick={deleteLastPlan}
                        className="rounded-2xl border border-red-300/30 bg-red-400/10 px-4 py-3 font-black text-red-100 transition hover:bg-red-400/20"
                      >
                        Delete allocation plan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applyStatus && <p className="rounded-xl bg-emerald-400/10 p-3 text-sm font-semibold text-emerald-100">✅ {applyStatus}</p>}
                    <p className="text-white/60">No allocation generated yet. Add income to cook the first split.</p>
                  </div>
                )}
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
              <Input label="USD→NGN exchange rate" type="number" value={String(usdToNgnRate)} onChange={saveManualExchangeRate} />
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
              <Input label="USD→NGN rate" type="number" value={String(usdToNgnRate)} onChange={saveManualExchangeRate} />
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
            {expenseStatus && (
              <p
                aria-live="polite"
                className={`mt-3 rounded-xl border p-3 text-sm font-semibold ${expenseStatusTone === 'success' ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/25 bg-amber-400/10 text-amber-100'}`}
              >
                {expenseStatusTone === 'success' ? '✅' : '⚠️'} {expenseStatus}
              </p>
            )}
            <div className="mt-5 space-y-2">
              {state.expenses.map((expense) => (
                <div key={expense.id} className="flex flex-col gap-3 rounded-xl bg-white/5 p-3 text-sm text-white/75 sm:flex-row sm:items-center sm:justify-between">
                  <span>{expense.name} — {formatMoney(expense.amount, expense.currency)} {expense.frequency === 'yearly' ? 'yearly' : 'monthly'} — monthly planning: {formatMoney(getMonthlyExpenseAmount(expense, usdToNgnRate))} — {expense.priority}{expense.workCritical ? ' — work-critical' : ''}</span>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      onClick={() => requestEditExpense(expense)}
                      className="self-start rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/20 sm:self-auto"
                    >
                      Edit expense
                    </button>
                    <button
                      onClick={() => requestDeleteExpense(expense)}
                      className="self-start rounded-xl border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-400/20 sm:self-auto"
                    >
                      Delete expense
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}


        {activeTab === 'settings' && (
          <Panel title="Exchange rate settings">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-emerald-300/15 bg-emerald-400/10 p-5">
                <p className="text-sm text-emerald-100/70">Active USD→NGN rate</p>
                <p className="mt-2 text-4xl font-black text-emerald-300">₦{formatRate(usdToNgnRate)}/$</p>
                <p className="mt-3 text-sm text-white/65">
                  Source: {state.exchangeRateSettings.source === 'open-er-api' ? 'Live API via ExchangeRate-API open endpoint' : 'Manual fallback'}
                  {state.exchangeRateSettings.updatedAt ? ` · Updated ${state.exchangeRateSettings.updatedAt}` : ''}
                </p>
                <p className="mt-2 text-xs text-white/45">All USD income, subscriptions, allocation equivalents, reports, and expense checks now read this managed rate instead of a hardcoded ₦1,600/$ value.</p>
              </div>
              <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <Input label="Manual USD→NGN rate" type="number" value={String(usdToNgnRate)} onChange={saveManualExchangeRate} />
                <button
                  onClick={refreshExchangeRate}
                  disabled={isRefreshingRate}
                  className={`w-full rounded-2xl px-5 py-3 font-black text-black transition ${isRefreshingRate ? 'cursor-not-allowed bg-emerald-200/70' : 'bg-emerald-400 hover:bg-emerald-300'}`}
                >
                  {isRefreshingRate ? 'Refreshing...' : 'Refresh live USD/NGN rate'}
                </button>
                <label className="flex items-center gap-3 rounded-2xl bg-black/25 p-3 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={state.exchangeRateSettings.autoRefresh}
                    onChange={(event) => setState((previous) => ({ ...previous, exchangeRateSettings: { ...previous.exchangeRateSettings, autoRefresh: event.target.checked } }))}
                  />
                  Auto-refresh from the free API when the dashboard loads
                </label>
                {rateStatus && <p className="rounded-xl bg-blue-400/10 p-3 text-sm font-semibold text-blue-100" aria-live="polite">{rateStatus}</p>}
              </div>
            </div>
          </Panel>
        )}
        {isDeletePlanDialogOpen && state.lastPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-plan-title">
            <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-red-300/30 bg-[#081711] shadow-2xl shadow-black/60">
              <div className="border-b border-white/10 bg-gradient-to-br from-red-400/20 via-slate-950 to-emerald-950/40 p-6">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-red-200">Confirm deletion</p>
                <h3 id="delete-plan-title" className="mt-3 text-2xl font-black text-white">Delete this allocation plan?</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  {isLastPlanApplied
                    ? 'This plan has already updated your goals/debts. Deleting it will also clear the linked income log and reverse the applied Move-Out/debt progress from this exact allocation.'
                    : 'This plan has not been applied yet. Deleting it will remove the visible allocation plan and clear the linked income log.'}
                </p>
              </div>
              <div className="space-y-4 p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-widest text-white/40">Income log to clear</p>
                    <p className="mt-2 text-xl font-black text-emerald-100">{formatMoney(state.lastPlan.inputAmountNgn)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-widest text-white/40">Goal progress to remove</p>
                    <p className="mt-2 text-xl font-black text-red-100">{formatMoney(isLastPlanApplied ? deletePlanImpact.goalTotal : 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-widest text-white/40">Debt balance to restore</p>
                    <p className="mt-2 text-xl font-black text-amber-100">{formatMoney(isLastPlanApplied ? deletePlanImpact.debtTotal : 0)}</p>
                  </div>
                </div>
                <p className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  Groot safety check: this cannot be undone automatically after saving. If this was the wrong plan, cancel and review first.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={cancelDeleteLastPlan} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-black text-white transition hover:bg-white/15">
                    Cancel, keep plan
                  </button>
                  <button onClick={confirmDeleteLastPlan} className="rounded-2xl bg-red-400 px-4 py-3 font-black text-black transition hover:bg-red-300">
                    {isLastPlanApplied ? 'Yes, delete and reverse' : 'Yes, delete plan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {expenseToEdit && expenseEditDraft && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-6" role="dialog" aria-modal="true" aria-labelledby="edit-expense-title">
            <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-emerald-300/30 bg-[#081711] shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-3rem)]">
              <div className="shrink-0 border-b border-white/10 bg-gradient-to-br from-emerald-400/20 via-slate-950 to-black p-5 sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-200">Manage expense</p>
                <h3 id="edit-expense-title" className="mt-3 text-2xl font-black text-white">Edit expense</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Update {expenseToEdit.name} when prices change, or recategorize it when it becomes must-pay, important, flexible, pauseable, or work-critical.
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-white/40">Expense being edited</p>
                  <p className="mt-2 text-xl font-black text-white">{expenseToEdit.name}</p>
                  <p className="mt-1 text-sm text-white/60">
                    Current monthly planning: {formatMoney(getMonthlyExpenseAmount(expenseToEdit, usdToNgnRate))}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Amount" type="number" value={expenseEditDraft.amount} onChange={(value) => setExpenseEditDraft({ ...expenseEditDraft, amount: value })} />
                  <Select label="Currency" value={expenseEditDraft.currency} onChange={(value) => setExpenseEditDraft({ ...expenseEditDraft, currency: value as Currency })} options={['NGN', 'USD']} />
                  <Select label="Frequency" value={expenseEditDraft.frequency} onChange={(value) => setExpenseEditDraft({ ...expenseEditDraft, frequency: value as RecurringExpense['frequency'] })} options={['monthly', 'yearly', 'weekly', 'one-time']} />
                  <Input label="Category" value={expenseEditDraft.category} onChange={(value) => setExpenseEditDraft({ ...expenseEditDraft, category: value })} />
                  <Select label="Priority" value={expenseEditDraft.priority} onChange={(value) => setExpenseEditDraft({ ...expenseEditDraft, priority: value as ExpensePriority })} options={['must-pay', 'important', 'flexible', 'pauseable']} />
                  <label className="flex items-end gap-2 rounded-xl bg-white/5 p-3 text-sm">
                    <input type="checkbox" checked={expenseEditDraft.workCritical} onChange={(event) => setExpenseEditDraft({ ...expenseEditDraft, workCritical: event.target.checked })} /> Work-critical
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={cancelEditExpense} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-black text-white transition hover:bg-white/15">
                    Cancel, keep current expense
                  </button>
                  <button onClick={confirmEditExpense} className="rounded-2xl bg-emerald-400 px-4 py-3 font-black text-black transition hover:bg-emerald-300">
                    Update this expense
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {expenseToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-expense-title">
            <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-red-300/30 bg-[#081711] shadow-2xl shadow-black/60">
              <div className="border-b border-white/10 bg-gradient-to-br from-red-400/20 via-slate-950 to-emerald-950/40 p-6">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-red-200">Confirm expense removal</p>
                <h3 id="delete-expense-title" className="mt-3 text-2xl font-black text-white">Delete this expense?</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  This removes the expense from your monthly expense map and future allocation planning. It will not touch income history, goals, or debts.
                </p>
              </div>
              <div className="space-y-4 p-6">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-white/40">Expense to remove</p>
                  <p className="mt-2 text-xl font-black text-white">{expenseToDelete.name}</p>
                  <p className="mt-1 text-sm text-white/60">
                    {formatMoney(expenseToDelete.amount, expenseToDelete.currency)} {expenseToDelete.frequency} · monthly planning {formatMoney(getMonthlyExpenseAmount(expenseToDelete, usdToNgnRate))}
                  </p>
                </div>
                <p className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  Groot safety check: cancel if you only wanted to review this expense. Confirming will save the updated expense list to the ledger.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={cancelDeleteExpense} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-black text-white transition hover:bg-white/15">
                    Cancel, keep expense
                  </button>
                  <button onClick={confirmDeleteExpense} className="rounded-2xl bg-red-400 px-4 py-3 font-black text-black transition hover:bg-red-300">
                    Yes, delete expense
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

/**
 * Displays a compact dashboard metric card.
 */
function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5"><p className="text-sm text-white/50">{title}</p><p className="mt-2 text-2xl font-black text-emerald-300">{value}</p><p className="mt-1 text-xs text-white/40">{note}</p></div>;
}

/**
 * Provides the shared visual container for tab content.
 */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20"><h2 className="mb-4 text-2xl font-black">{title}</h2>{children}</section>;
}

/**
 * Shared labeled input control.
 */
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/40">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white outline-none focus:border-emerald-300" /></label>;
}

/**
 * Shared labeled select control.
 */
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/40">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white outline-none focus:border-emerald-300">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

/**
 * Renders simple text rows for management lists.
 */
function List({ items }: { items: string[] }) {
  return <div className="mt-5 space-y-2">{items.map((item) => <div key={item} className="rounded-xl bg-white/5 p-3 text-sm text-white/75">{item}</div>)}</div>;
}
