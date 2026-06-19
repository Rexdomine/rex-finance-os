export type Currency = 'NGN' | 'USD';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
export type DebtStatus = 'active' | 'paid' | 'paused';
export type Urgency = 'urgent' | 'normal' | 'flexible';
export type ExpensePriority = 'must-pay' | 'important' | 'flexible' | 'pauseable';
export type DestinationType = 'expense' | 'goal' | 'debt' | 'savings' | 'investment' | 'lifestyle' | 'buffer';
export type DecisionVerdict = 'approve' | 'caution' | 'delay' | 'avoid';

export type Goal = { id: string; name: string; targetAmount: number; currentAmount: number; currency: Currency; deadline: string; priority: Priority; status: GoalStatus; strategy: 'deadline-based' | 'fixed-percentage' | 'fixed-amount' | 'manual'; notes?: string; };
export type Debt = { id: string; name: string; totalAmount: number; remainingAmount: number; currency: Currency; minimumDueAmount: number; dueDate: string; urgency: Urgency; status: DebtStatus; strategy: 'minimum-first' | 'aggressive-payoff' | 'percentage-income' | 'manual'; notes?: string; };
export type RecurringExpense = { id: string; name: string; amount: number; currency: Currency; frequency: 'weekly' | 'monthly' | 'yearly' | 'one-time'; category: string; priority: ExpensePriority; dueDay?: number; workCritical: boolean; };
/**
 * Editable fields for a goal, excluding its stable identity.
 */
export type GoalUpdate = Partial<Omit<Goal, 'id' | 'name' | 'currency' | 'strategy'>>;
/**
 * Editable fields for a debt, excluding its stable identity.
 */
export type DebtUpdate = Partial<Omit<Debt, 'id' | 'name' | 'currency' | 'strategy'>>;
/**
 * Editable fields for a recurring expense, excluding its stable identity.
 */
export type RecurringExpenseUpdate = Partial<Omit<RecurringExpense, 'id' | 'name'>>;
export type Income = { source: string; amount: number; currency: Currency; exchangeRate: number; date: string; notes?: string; };
export type ExchangeRateSource = 'manual' | 'open-er-api';
export type ExchangeRateSettings = { usdToNgn: number; source: ExchangeRateSource; provider?: string; updatedAt?: string; autoRefresh: boolean; error?: string; };
export type AllocationItem = { id: string; destinationName: string; destinationType: DestinationType; amount: number; amountUsd?: number; currency: Currency; priority: string; reason: string; };
export type AllocationExclusion = { expenseId: string; expenseName: string; category: string; priority: ExpensePriority; monthlyAmountNgn: number; excludedAmountNgn: number; reason: string; rules: string[]; };
export type AllocationPlan = { mode: string; inputAmountNgn: number; inputAmountUsd?: number; exchangeRate?: number; items: AllocationItem[]; excludedExpenses: AllocationExclusion[]; warnings: string[]; recommendations: string[]; };
export type AppState = { goals: Goal[]; debts: Debt[]; expenses: RecurringExpense[]; incomes: Income[]; exchangeRateSettings: ExchangeRateSettings; lastPlan?: AllocationPlan; appliedPlanSignature?: string; };
export type ExpenseDecisionInput = { name: string; amount: number; currency: Currency; category: string; exchangeRate: number; date: string; };
export type ExpenseDecision = { verdict: DecisionVerdict; summary: string; amountNgn: number; goalImpactAmount: number; reasons: string[]; recommendations: string[]; };

const uid = () => Math.random().toString(36).slice(2, 10);
export const DEFAULT_USD_TO_NGN_RATE = 1600;

/**
 * Builds default USD to NGN exchange-rate settings for fresh or legacy app state.
 */
export function buildDefaultExchangeRateSettings(): ExchangeRateSettings {
  return { usdToNgn: DEFAULT_USD_TO_NGN_RATE, source: 'manual', autoRefresh: true };
}

/**
 * Returns the active managed USD to NGN rate, falling back safely when state is incomplete.
 */
export function getUsdToNgnRate(stateOrSettings?: Pick<AppState, 'exchangeRateSettings'> | ExchangeRateSettings) {
  const settings = stateOrSettings && 'exchangeRateSettings' in stateOrSettings ? stateOrSettings.exchangeRateSettings : stateOrSettings;
  const rate = Number(settings?.usdToNgn);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_TO_NGN_RATE;
}

/**
 * Updates a goal by id while preserving immutable state and goal identity.
 */
export function updateGoal(state: AppState, goalId: string, updates: GoalUpdate): AppState {
  return {
    ...state,
    goals: state.goals.map((goal) => (goal.id === goalId ? { ...goal, ...updates, id: goal.id } : goal)),
  };
}

/**
 * Updates a debt by id while preserving immutable state and debt identity.
 */
export function updateDebt(state: AppState, debtId: string, updates: DebtUpdate): AppState {
  return {
    ...state,
    debts: state.debts.map((debt) => (debt.id === debtId ? { ...debt, ...updates, id: debt.id } : debt)),
  };
}

/**
 * Upgrades partial or legacy persisted app state into the current complete AppState shape.
 */
export function migrateAppState(stored: Partial<AppState>): AppState {
  const defaults = buildDefaultState();
  const legacyRate = Number(stored.exchangeRateSettings?.usdToNgn ?? stored.lastPlan?.exchangeRate ?? stored.incomes?.find((income) => income.exchangeRate > 0)?.exchangeRate ?? DEFAULT_USD_TO_NGN_RATE);
  const exchangeRateSettings: ExchangeRateSettings = {
    ...buildDefaultExchangeRateSettings(),
    ...stored.exchangeRateSettings,
    usdToNgn: Number.isFinite(legacyRate) && legacyRate > 0 ? legacyRate : DEFAULT_USD_TO_NGN_RATE,
  };

  return {
    ...defaults,
    ...stored,
    goals: Array.isArray(stored.goals) ? stored.goals : defaults.goals,
    debts: Array.isArray(stored.debts) ? stored.debts : defaults.debts,
    expenses: Array.isArray(stored.expenses) ? stored.expenses : defaults.expenses,
    incomes: Array.isArray(stored.incomes) ? stored.incomes : defaults.incomes,
    exchangeRateSettings,
  };
}

/**
 * Updates a recurring expense by id while preserving immutable state and expense identity.
 */
export function updateRecurringExpense(state: AppState, expenseId: string, updates: RecurringExpenseUpdate): AppState {
  return {
    ...state,
    expenses: state.expenses.map((expense) => (expense.id === expenseId ? { ...expense, ...updates, id: expense.id } : expense)),
  };
}

/**
 * Seeds the default finance state used for first-run/demo data.
 */
export function buildDefaultState(): AppState {
  return {
    goals: [
      { id: 'move-out', name: 'Move-Out Fund', targetAmount: 6000000, currentAmount: 1200000, currency: 'NGN', deadline: '2026-08-31', priority: 'critical', status: 'active', strategy: 'deadline-based', notes: 'Rent, agent fee, legal, caution, moving logistics, and part of inverter setup.' },
      { id: 'emergency', name: 'Emergency Buffer', targetAmount: 300000, currentAmount: 0, currency: 'NGN', deadline: '2026-08-31', priority: 'high', status: 'active', strategy: 'fixed-percentage', notes: 'Protects against irregular income gaps.' },
      { id: 'investment-seed', name: 'Investment Seed', targetAmount: 250000, currentAmount: 0, currency: 'NGN', deadline: '2026-12-31', priority: 'medium', status: 'active', strategy: 'fixed-percentage', notes: 'Small consistent wealth-building contributions.' },
    ],
    debts: [
      { id: 'bank-debt', name: 'Bank Debt', totalAmount: 359000, remainingAmount: 359000, currency: 'NGN', minimumDueAmount: 180120, dueDate: '2026-06-30', urgency: 'urgent', status: 'active', strategy: 'minimum-first', notes: 'Current month due amount is ₦180,120; remaining can be handled next cycle.' },
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
      { id: 'clothing', name: 'Clothing Cap', amount: 50000, currency: 'NGN', frequency: 'monthly', category: 'Clothing', priority: 'flexible', workCritical: false },
    ],
    incomes: [],
    exchangeRateSettings: buildDefaultExchangeRateSettings(),
  };
}

/**
 * Formats an amount as NGN or USD currency for UI display.
 */
export function formatMoney(amount: number, currency: Currency = 'NGN') {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-NG', { style: 'currency', currency, maximumFractionDigits: currency === 'NGN' ? 0 : 2 }).format(Math.max(0, amount || 0));
}

/**
 * Converts an amount from its source currency into NGN using the provided USD rate.
 */
export function toNgn(amount: number, currency: Currency, exchangeRate: number) {
  return currency === 'USD' ? amount * exchangeRate : amount;
}

/**
 * Converts a NGN amount into a USD equivalent using the provided exchange rate.
 */
export function toUsd(amountNgn: number, exchangeRate: number) {
  return exchangeRate > 0 ? amountNgn / exchangeRate : 0;
}

/**
 * Normalizes recurring expenses into a monthly NGN planning amount.
 */
export function getMonthlyExpenseAmount(expense: RecurringExpense, exchangeRate: number) {
  const baseNgn = toNgn(expense.amount, expense.currency, exchangeRate);
  if (expense.frequency === 'yearly') return baseNgn / 12;
  if (expense.frequency === 'weekly') return baseNgn * 4.345;
  return baseNgn;
}

/**
 * Counts whole calendar days between two dates for deadline-based goal pacing.
 */
function daysBetween(start: Date, end: Date) { return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))); }

const CASH_AT_HAND_INCOME_CAP_RATE = 0.08;

/**
 * Detects expenses that intentionally represent cash-at-hand / CAH liquidity.
 */
function isCashAtHandExpense(expense: RecurringExpense) {
  const normalizedName = expense.name.trim().toLowerCase();
  const normalizedCategory = expense.category.trim().toLowerCase();
  return normalizedName === 'cah' || normalizedName.includes('cash at hand') || normalizedCategory.includes('cash at hand') || normalizedCategory === 'liquidity';
}

/**
 * Limits CAH auto-funding to discretionary expenses so must-pay/important items are not double-funded.
 */
function isDiscretionaryCashAtHandExpense(expense: RecurringExpense) {
  return isCashAtHandExpense(expense) && (expense.priority === 'flexible' || expense.priority === 'pauseable');
}

/**
 * Returns the requested CAH percentage allowed for the current planning mode.
 */
function getCashAtHandFundingRate(mode: string) {
  if (mode === 'Survival Mode') return 0.25;
  if (mode === 'Stability Mode') return 0.5;
  return 0.75;
}

/**
 * Returns the total income share available to all CAH expenses combined.
 */
function getCashAtHandIncomeCapRate() {
  return CASH_AT_HAND_INCOME_CAP_RATE;
}

/**
 * Explains the unfunded portion of a recurring expense after the allocation rules run.
 */
function buildExpenseExclusion(expense: RecurringExpense, mode: string, monthlyAmountNgn: number, fundedAmountNgn: number): AllocationExclusion | null {
  const unfundedAmount = Math.max(0, Math.round(monthlyAmountNgn - fundedAmountNgn));
  if (unfundedAmount <= 0) return null;

  const rules = [
    `${mode} controls how much income can go to expenses before debts, savings, investments, and active goals.`,
    'Must-pay and work-critical expenses are considered first from the expense pool.',
    'Flexible/pauseable expenses are excluded unless they match an explicit lifestyle, clothing, or cash-at-hand cap rule.',
  ];

  let reason = `Excluded because ${expense.priority} expenses are not directly funded in ${mode} unless an explicit cap rule includes them.`;
  if (isDiscretionaryCashAtHandExpense(expense)) {
    const rate = getCashAtHandFundingRate(mode);
    reason = fundedAmountNgn > 0
      ? `Partially funded because cash at hand is treated as a realistic emergency/spending window in ${mode}, capped at ${Math.round(rate * 100)}% of the amount you requested and ${Math.round(getCashAtHandIncomeCapRate() * 100)}% of this income.`
      : `Excluded because there was no room left to fund cash at hand after higher-priority obligations in ${mode}.`;
    rules.push(`Cash at hand receives up to ${Math.round(rate * 100)}% of its requested monthly amount in ${mode}.`);
    rules.push('This keeps emergency/church/quick household cash visible without letting it silently overpower debt, savings, or active goals.');
  } else if (expense.priority === 'must-pay') {
    reason = fundedAmountNgn > 0
      ? 'Partially excluded because the must-pay expense pool was exhausted before the full monthly amount could be funded.'
      : 'Excluded because the capped must-pay expense pool was exhausted before this expense was reached.';
  } else if (expense.priority === 'important') {
    reason = fundedAmountNgn > 0
      ? 'Partially excluded because important expenses are capped after urgent debts, savings/investments, and critical goals are considered.'
      : 'Excluded because important expenses are considered only after higher-priority obligations and there was no room under the current allocation constraints.';
    rules.push('Important expenses are capped at up to 8% of this income per item after higher-priority allocations.');
  } else if (expense.priority === 'flexible' || expense.priority === 'pauseable') {
    reason = `Excluded because ${expense.priority} expenses are discretionary in ${mode}; only the built-in lifestyle/clothing cap rules are funded automatically.`;
    rules.push('Create or rename a planned discretionary cap such as Lifestyle Cap/Clothing Cap, or mark a truly essential bill as must-pay/work-critical, to have it considered automatically.');
  }

  return {
    expenseId: expense.id,
    expenseName: expense.name,
    category: expense.category,
    priority: expense.priority,
    monthlyAmountNgn: Math.round(monthlyAmountNgn),
    excludedAmountNgn: unfundedAmount,
    reason,
    rules,
  };
}

/**
 * Appends missing seeded recurring expenses without altering existing expense rows.
 */
export function ensureDefaultRecurringExpenses(state: AppState): AppState {
  const defaults = buildDefaultState().expenses;
  const expenses = [...state.expenses];

  defaults.forEach((defaultExpense) => {
    if (!expenses.some((expense) => expense.id === defaultExpense.id)) {
      expenses.push(defaultExpense);
    }
  });

  return { ...state, expenses };
}

/**
 * Generates a Naira-first allocation plan with USD equivalents for the provided income.
 */
export function generateAllocation(state: AppState, income: Income): AllocationPlan {
  const exchangeRate = income.exchangeRate || DEFAULT_USD_TO_NGN_RATE;
  const amountNgn = toNgn(income.amount, income.currency, exchangeRate);
  const inputAmountUsd = toUsd(amountNgn, exchangeRate);
  const items: AllocationItem[] = [];
  const fundedExpenseAmounts = new Map<string, number>();
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let remaining = amountNgn;
  const activeCriticalGoal = state.goals.filter((goal) => goal.status === 'active' && goal.priority === 'critical' && goal.targetAmount > goal.currentAmount).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
  const mode = amountNgn < 500000 ? 'Survival Mode' : amountNgn < 1500000 ? 'Stability Mode' : 'Move-Out Attack Mode';
  const cashAtHandBudgetCap = amountNgn * getCashAtHandIncomeCapRate();
  const cashAtHandReserve = Math.min(
    cashAtHandBudgetCap,
    state.expenses
      .filter((expense) => isDiscretionaryCashAtHandExpense(expense))
      .reduce((sum, expense) => sum + getMonthlyExpenseAmount(expense, exchangeRate) * getCashAtHandFundingRate(mode), 0),
  );
  const addItem = (destinationName: string, destinationType: DestinationType, rawAmount: number, priority: string, reason: string, expenseId?: string) => {
    const amount = Math.max(0, Math.min(remaining, Math.round(rawAmount)));
    if (amount <= 0) return;
    items.push({ id: uid(), destinationName, destinationType, amount, amountUsd: toUsd(amount, exchangeRate), currency: 'NGN', priority, reason });
    if (expenseId) fundedExpenseAmounts.set(expenseId, (fundedExpenseAmounts.get(expenseId) ?? 0) + amount);
    remaining -= amount;
  };
  const mustPayExpenses = state.expenses.filter((expense) => expense.priority === 'must-pay');
  const monthlyMustPayNgn = mustPayExpenses.reduce((sum, expense) => sum + getMonthlyExpenseAmount(expense, exchangeRate), 0);
  const expenseCap = mode === 'Survival Mode' ? amountNgn * 0.6 : mode === 'Stability Mode' ? amountNgn * 0.35 : Math.min(monthlyMustPayNgn, amountNgn * 0.32);
  let expensePool = expenseCap;
  mustPayExpenses.forEach((expense) => {
    if (expensePool <= 0) return;
    const allocation = Math.min(getMonthlyExpenseAmount(expense, exchangeRate), expensePool);
    addItem(expense.name, 'expense', allocation, expense.workCritical ? 'work-critical' : 'must-pay', expense.workCritical ? 'Keeps work and income engine running.' : 'Covers core survival spending.', expense.id);
    expensePool -= allocation;
  });
  state.debts.filter((debt) => debt.status === 'active' && debt.remainingAmount > 0 && debt.urgency === 'urgent').forEach((debt) => {
    const base = debt.minimumDueAmount || Math.min(debt.remainingAmount, amountNgn * 0.15);
    const cap = mode === 'Survival Mode' ? amountNgn * 0.15 : mode === 'Stability Mode' ? amountNgn * 0.15 : Math.min(base, amountNgn * 0.2);
    addItem(debt.name, 'debt', Math.min(base, debt.remainingAmount, cap), 'urgent debt', 'Debt pressure comes before lifestyle and most flexible spending.');
  });
  addItem('Emergency Savings', 'savings', Math.max(amountNgn * (mode === 'Survival Mode' ? 0.05 : mode === 'Stability Mode' ? 0.07 : 0.08), amountNgn < 100000 ? 1000 : 0), 'protective', 'Save something every time money enters, even if small.');
  addItem('Investment Seed', 'investment', Math.max(amountNgn * (mode === 'Survival Mode' ? 0.03 : 0.05), amountNgn < 100000 ? 1000 : 0), 'wealth-building', 'Small consistent investing builds the habit before wealth scales.');
  const lifestyleExpense = state.expenses.find((expense) => expense.id === 'lifestyle');
  if (lifestyleExpense) {
    addItem(lifestyleExpense.name, 'lifestyle', Math.min(getMonthlyExpenseAmount(lifestyleExpense, exchangeRate), mode === 'Survival Mode' ? amountNgn * 0.04 : amountNgn * 0.08), 'honest living cap', 'Planned guilt-free outing money so the budget stays realistic, not punishing.', lifestyleExpense.id);
  }
  const clothingExpense = state.expenses.find((expense) => expense.id === 'clothing');
  if (clothingExpense) {
    addItem(clothingExpense.name, 'expense', Math.min(getMonthlyExpenseAmount(clothingExpense, exchangeRate), mode === 'Survival Mode' ? amountNgn * 0.02 : amountNgn * 0.04), 'honest clothing cap', 'Allows at least one planned clothing item without turning it into untracked impulse spending.', clothingExpense.id);
  }
  if (activeCriticalGoal) {
    const goalRemaining = activeCriticalGoal.targetAmount - activeCriticalGoal.currentAmount;
    const weeksLeft = daysBetween(new Date(income.date || new Date()), new Date(activeCriticalGoal.deadline + 'T23:59:59')) / 7;
    const weeklyNeed = goalRemaining / Math.max(1, weeksLeft);
    const goalRate = mode === 'Survival Mode' ? 0.1 : mode === 'Stability Mode' ? 0.3 : 0.65;
    const desiredGoalAllocation = Math.max(amountNgn * goalRate, mode === 'Move-Out Attack Mode' ? Math.min(weeklyNeed, remaining) : 0);
    const goalAllocationAfterCashReserve = Math.min(goalRemaining, Math.max(0, Math.min(desiredGoalAllocation, remaining - cashAtHandReserve)));
    addItem(activeCriticalGoal.name, 'goal', goalAllocationAfterCashReserve, 'critical goal', `Deadline-based push. Current weekly target is about ${formatMoney(weeklyNeed)}.`);
  }
  let cashAtHandAllocated = 0;
  state.expenses
    .filter((expense) => isDiscretionaryCashAtHandExpense(expense))
    .forEach((expense) => {
      const rate = getCashAtHandFundingRate(mode);
      const monthlyAmount = getMonthlyExpenseAmount(expense, exchangeRate);
      const remainingCashAtHandCap = Math.max(0, cashAtHandBudgetCap - cashAtHandAllocated);
      const allocation = Math.min(monthlyAmount * rate, remainingCashAtHandCap);
      addItem(
        expense.name,
        'buffer',
        allocation,
        'cash-at-hand cap',
        `Cash at hand gets up to ${Math.round(rate * 100)}% of your requested amount in ${mode}, capped at ${Math.round(getCashAtHandIncomeCapRate() * 100)}% of this income, so you have emergency/church/quick household cash without breaking the larger plan.`,
        expense.id,
      );
      cashAtHandAllocated += Math.max(0, Math.round(allocation));
    });
  state.expenses.filter((expense) => expense.priority === 'important').forEach((expense) => addItem(expense.name, 'expense', Math.min(getMonthlyExpenseAmount(expense, exchangeRate), amountNgn * 0.08), 'important cap', 'Useful support category, but capped while critical goals are active.', expense.id));
  if (remaining > 0) addItem(activeCriticalGoal?.name ?? 'Buffer', activeCriticalGoal ? 'goal' : 'buffer', remaining, activeCriticalGoal ? 'extra goal push' : 'buffer', activeCriticalGoal ? 'Extra unassigned cash should accelerate the critical goal.' : 'Keep unassigned cash as buffer.');
  if (amountNgn < monthlyMustPayNgn) warnings.push(`This income is below your estimated must-pay monthly expenses of ${formatMoney(monthlyMustPayNgn)}.`);
  if (activeCriticalGoal) {
    const added = items.filter((item) => item.destinationType === 'goal' && item.destinationName === activeCriticalGoal.name).reduce((sum, item) => sum + item.amount, 0);
    recommendations.push(`${activeCriticalGoal.name} would have ${formatMoney(Math.max(0, activeCriticalGoal.targetAmount - activeCriticalGoal.currentAmount - added))} left after this allocation.`);
  }
  recommendations.push('Review the split before spending. The plan is advice; you can still manually adjust it.');
  const excludedExpenses = state.expenses
    .map((expense) => buildExpenseExclusion(expense, mode, getMonthlyExpenseAmount(expense, exchangeRate), fundedExpenseAmounts.get(expense.id) ?? 0))
    .filter((expense): expense is AllocationExclusion => Boolean(expense));
  return { mode, inputAmountNgn: amountNgn, inputAmountUsd, exchangeRate, items, excludedExpenses, warnings, recommendations };
}

/**
 * Applies the current allocation plan to goal and debt progress exactly once.
 */
export function applyAllocationPlanToProgress(state: AppState): AppState {
  if (!state.lastPlan) return state;

  const signature = getAllocationPlanSignature(state.lastPlan);
  if (state.appliedPlanSignature === signature) return state;

  const goals = state.goals.map((goal) => {
    const add = state.lastPlan?.items
      .filter((item) => item.destinationType === 'goal' && item.destinationName === goal.name)
      .reduce((sum, item) => sum + item.amount, 0) ?? 0;
    const currentAmount = Math.min(goal.targetAmount, goal.currentAmount + add);
    return { ...goal, currentAmount, status: currentAmount >= goal.targetAmount ? 'completed' as const : goal.status };
  });

  const debts = state.debts.map((debt) => {
    const paid = state.lastPlan?.items
      .filter((item) => item.destinationType === 'debt' && item.destinationName === debt.name)
      .reduce((sum, item) => sum + item.amount, 0) ?? 0;
    const remainingAmount = Math.max(0, debt.remainingAmount - paid);
    return { ...debt, remainingAmount, status: remainingAmount <= 0 ? 'paid' as const : debt.status };
  });

  return { ...state, goals, debts, appliedPlanSignature: signature };
}

/**
 * Creates a stable signature for allocation progress items to prevent double-application.
 */
export function getAllocationPlanSignature(plan?: AllocationPlan) {
  if (!plan) return '';
  return JSON.stringify({
    inputAmountNgn: plan.inputAmountNgn,
    mode: plan.mode,
    progressItems: plan.items
      .filter((item) => item.destinationType === 'goal' || item.destinationType === 'debt')
      .map((item) => [item.destinationName, item.destinationType, item.amount]),
  });
}

/**
 * Totals goal and debt progress represented by an allocation plan.
 */
export function getAllocationPlanProgressTotals(plan?: AllocationPlan) {
  const items = plan?.items ?? [];
  return {
    goalTotal: items.filter((item) => item.destinationType === 'goal').reduce((sum, item) => sum + item.amount, 0),
    debtTotal: items.filter((item) => item.destinationType === 'debt').reduce((sum, item) => sum + item.amount, 0),
  };
}

/**
 * Removes the visible allocation plan and reverses its applied progress when necessary.
 */
export function deleteAllocationPlan(state: AppState): AppState {
  const shouldReverseAppliedProgress = Boolean(
    state.lastPlan && state.appliedPlanSignature === getAllocationPlanSignature(state.lastPlan),
  );

  const goals = shouldReverseAppliedProgress
    ? state.goals.map((goal) => {
      const applied = state.lastPlan?.items
        .filter((item) => item.destinationType === 'goal' && item.destinationName === goal.name)
        .reduce((sum, item) => sum + item.amount, 0) ?? 0;
      const currentAmount = Math.max(0, goal.currentAmount - applied);
      return { ...goal, currentAmount, status: goal.status === 'completed' && currentAmount < goal.targetAmount ? 'active' as const : goal.status };
    })
    : state.goals;

  const debts = shouldReverseAppliedProgress
    ? state.debts.map((debt) => {
      const paid = state.lastPlan?.items
        .filter((item) => item.destinationType === 'debt' && item.destinationName === debt.name)
        .reduce((sum, item) => sum + item.amount, 0) ?? 0;
      const remainingAmount = Math.min(debt.totalAmount, debt.remainingAmount + paid);
      return { ...debt, remainingAmount, status: debt.status === 'paid' && remainingAmount > 0 ? 'active' as const : debt.status };
    })
    : state.debts;

  let removedLinkedIncome = false;
  const incomes = state.lastPlan
    ? state.incomes.filter((income) => {
      const incomeAmountNgn = Math.round(toNgn(income.amount, income.currency, income.exchangeRate || DEFAULT_USD_TO_NGN_RATE));
      const planAmountNgn = Math.round(state.lastPlan?.inputAmountNgn ?? 0);
      if (!removedLinkedIncome && incomeAmountNgn === planAmountNgn) {
        removedLinkedIncome = true;
        return false;
      }
      return true;
    })
    : state.incomes;

  const next = { ...state, goals, debts, incomes };
  delete next.lastPlan;
  delete next.appliedPlanSignature;
  return next;
}

/**
 * Evaluates a planned expense against goals, debt pressure, and work-critical rules.
 */
export function checkExpenseDecision(state: AppState, input: ExpenseDecisionInput): ExpenseDecision {
  const amountNgn = toNgn(input.amount, input.currency, input.exchangeRate || DEFAULT_USD_TO_NGN_RATE);
  const category = input.category.toLowerCase();
  const name = input.name.toLowerCase();
  const reasons: string[] = [];
  const recommendations: string[] = [];
  const activeCriticalGoal = state.goals.find((goal) => goal.status === 'active' && goal.priority === 'critical' && goal.targetAmount > goal.currentAmount);
  const knownExpense = state.expenses.find((expense) => expense.name.toLowerCase() === name || name.includes(expense.name.toLowerCase()) || expense.name.toLowerCase().includes(name));
  if (knownExpense?.workCritical || category.includes('work')) {
    reasons.push('This is work-critical and supports your income engine/Groot operations.');
    recommendations.push('Approve it, but keep it recorded under Work Tools.');
    return { verdict: 'approve', summary: 'Approved as work-critical. This supports earning power and Groot operations.', amountNgn, goalImpactAmount: 0, reasons, recommendations };
  }
  if (category.includes('food') || category.includes('transport') || category.includes('electricity') || category.includes('essential')) {
    reasons.push('This looks like a core living expense.');
    recommendations.push('Approve if it stays inside the monthly cap.');
    return { verdict: 'caution', summary: 'Necessary expense, but keep it inside the planned cap.', amountNgn, goalImpactAmount: activeCriticalGoal ? amountNgn : 0, reasons, recommendations };
  }
  if (activeCriticalGoal && (category.includes('clothing') || category.includes('lifestyle') || category.includes('entertainment'))) {
    reasons.push(`${activeCriticalGoal.name} is still active and critical.`);
    reasons.push(`This spend would reduce goal capacity by ${formatMoney(amountNgn)}.`);
    recommendations.push('Delay, reduce, or fund it only from the controlled lifestyle cap.');
    return { verdict: amountNgn > 50000 ? 'delay' : 'caution', summary: `This expense delays ${activeCriticalGoal.name}. Delay it unless it is truly urgent.`, amountNgn, goalImpactAmount: amountNgn, reasons, recommendations };
  }
  if (amountNgn > 100000 && activeCriticalGoal) {
    reasons.push('Large unplanned expense while a critical goal is active.');
    recommendations.push('Use the 48-hour pause rule before spending.');
    return { verdict: 'delay', summary: `Pause first. This large expense may delay ${activeCriticalGoal.name}.`, amountNgn, goalImpactAmount: amountNgn, reasons, recommendations };
  }
  reasons.push('No major conflict detected.');
  recommendations.push('Record it and make sure savings/investments remain funded.');
  return { verdict: 'approve', summary: 'Safe if it fits the current budget.', amountNgn, goalImpactAmount: activeCriticalGoal ? amountNgn : 0, reasons, recommendations };
}
