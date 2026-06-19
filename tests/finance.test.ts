import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyAllocationPlanToProgress,
  buildDefaultState,
  deleteAllocationPlan,
  generateAllocation,
  getMonthlyExpenseAmount,
  getUsdToNgnRate,
  migrateAppState,
  checkExpenseDecision,
  updateDebt,
  updateGoal,
  updateRecurringExpense,
} from '../src/lib/finance';

describe('Rex Finance OS finance rules', () => {

  it('stores managed exchange-rate settings and migrates legacy state to the default fallback', () => {
    const state = buildDefaultState();

    assert.equal(state.exchangeRateSettings.usdToNgn, 1600);
    assert.equal(getUsdToNgnRate(state), 1600);

    const legacyState = { ...state } as Partial<typeof state>;
    delete legacyState.exchangeRateSettings;

    const migrated = migrateAppState(legacyState);
    assert.equal(migrated.exchangeRateSettings.usdToNgn, 1600);
    assert.equal(migrated.exchangeRateSettings.source, 'manual');
  });

  it('uses the managed exchange rate for USD expense monthly planning', () => {
    const state = {
      ...buildDefaultState(),
      exchangeRateSettings: {
        usdToNgn: 1400,
        source: 'open-er-api' as const,
        provider: 'https://www.exchangerate-api.com',
        updatedAt: 'Fri, 19 Jun 2026 00:02:32 +0000',
        autoRefresh: true,
      },
    };
    const openAi = state.expenses.find((expense) => expense.id === 'openai');

    assert.ok(openAi);
    assert.equal(getMonthlyExpenseAmount(openAi, getUsdToNgnRate(state)), 140000);
  });

  it('normalizes yearly VPS hosting paid at $8/month into annual and monthly NGN cost', () => {
    const state = buildDefaultState();
    const vps = state.expenses.find((expense) => expense.id === 'vps-hosting');

    assert.ok(vps, 'VPS hosting should be seeded as a recurring expense');
    assert.equal(vps.frequency, 'yearly');
    assert.equal(vps.amount, 96);
    assert.equal(vps.currency, 'USD');
    assert.equal(getMonthlyExpenseAmount(vps, 1600), 12800);
  });

  it('updates an existing recurring expense without changing its identity or other expenses', () => {
    const state = buildDefaultState();
    const updated = updateRecurringExpense(state, 'food', {
      amount: 180000,
      category: 'Essentials - inflation adjusted',
      priority: 'important',
      workCritical: true,
    });

    const originalFood = state.expenses.find((expense) => expense.id === 'food');
    const updatedFood = updated.expenses.find((expense) => expense.id === 'food');

    assert.ok(originalFood && updatedFood);
    assert.equal(updated.expenses.length, state.expenses.length);
    assert.equal(updatedFood.id, 'food');
    assert.equal(updatedFood.name, originalFood.name);
    assert.equal(updatedFood.amount, 180000);
    assert.equal(updatedFood.category, 'Essentials - inflation adjusted');
    assert.equal(updatedFood.priority, 'important');
    assert.equal(updatedFood.workCritical, true);
    assert.equal(state.expenses.find((expense) => expense.id === 'food')?.amount, 120000, 'original state should remain immutable');
    assert.deepEqual(updated.expenses.filter((expense) => expense.id !== 'food'), state.expenses.filter((expense) => expense.id !== 'food'));
  });

  it('updates an existing goal without changing its identity or other goals', () => {
    const state = buildDefaultState();
    const updated = updateGoal(state, 'move-out', {
      targetAmount: 6500000,
      currentAmount: 1500000,
      deadline: '2026-09-30',
      priority: 'high',
      status: 'paused',
    });

    const originalGoal = state.goals.find((goal) => goal.id === 'move-out');
    const updatedGoal = updated.goals.find((goal) => goal.id === 'move-out');

    assert.ok(originalGoal && updatedGoal);
    assert.equal(updated.goals.length, state.goals.length);
    assert.equal(updatedGoal.id, 'move-out');
    assert.equal(updatedGoal.name, originalGoal.name);
    assert.equal(updatedGoal.targetAmount, 6500000);
    assert.equal(updatedGoal.currentAmount, 1500000);
    assert.equal(updatedGoal.deadline, '2026-09-30');
    assert.equal(updatedGoal.priority, 'high');
    assert.equal(updatedGoal.status, 'paused');
    assert.equal(state.goals.find((goal) => goal.id === 'move-out')?.targetAmount, 6000000, 'original state should remain immutable');
    assert.deepEqual(updated.goals.filter((goal) => goal.id !== 'move-out'), state.goals.filter((goal) => goal.id !== 'move-out'));
  });

  it('updates an existing debt without changing its identity or other debts', () => {
    const state = buildDefaultState();
    const updated = updateDebt(state, 'bank-debt', {
      totalAmount: 400000,
      remainingAmount: 220000,
      minimumDueAmount: 75000,
      dueDate: '2026-07-31',
      urgency: 'normal',
      status: 'paid',
    });

    const originalDebt = state.debts.find((debt) => debt.id === 'bank-debt');
    const updatedDebt = updated.debts.find((debt) => debt.id === 'bank-debt');

    assert.ok(originalDebt && updatedDebt);
    assert.equal(updated.debts.length, state.debts.length);
    assert.equal(updatedDebt.id, 'bank-debt');
    assert.equal(updatedDebt.name, originalDebt.name);
    assert.equal(updatedDebt.totalAmount, 400000);
    assert.equal(updatedDebt.remainingAmount, 220000);
    assert.equal(updatedDebt.minimumDueAmount, 75000);
    assert.equal(updatedDebt.dueDate, '2026-07-31');
    assert.equal(updatedDebt.urgency, 'normal');
    assert.equal(updatedDebt.status, 'paid');
    assert.equal(state.debts.find((debt) => debt.id === 'bank-debt')?.remainingAmount, 359000, 'original state should remain immutable');
    assert.deepEqual(updated.debts.filter((debt) => debt.id !== 'bank-debt'), state.debts.filter((debt) => debt.id !== 'bank-debt'));
  });

  it('keeps savings and investment line items in income allocation', () => {
    const state = buildDefaultState();
    const plan = generateAllocation(state, {
      source: 'Client payment',
      amount: 850000,
      currency: 'NGN',
      exchangeRate: 1600,
      date: '2026-06-14',
    });

    assert.ok(plan.items.some((item) => item.destinationType === 'savings' && item.amount > 0));
    assert.ok(plan.items.some((item) => item.destinationType === 'investment' && item.amount > 0));
  });

  it('keeps Naira as the main allocation amount and includes dollar equivalents for transfers', () => {
    const state = buildDefaultState();
    const plan = generateAllocation(state, {
      source: 'Remote client USD payment',
      amount: 1000,
      currency: 'USD',
      exchangeRate: 1600,
      date: '2026-06-14',
    });

    assert.equal(plan.inputAmountNgn, 1600000);
    assert.equal(plan.inputAmountUsd, 1000);
    assert.equal(plan.exchangeRate, 1600);
    assert.ok(plan.items.length > 0);
    assert.ok(plan.items.every((item) => item.currency === 'NGN'), 'allocation should remain Naira-first');
    assert.ok(plan.items.every((item) => typeof item.amountUsd === 'number' && item.amountUsd > 0), 'each line should expose a USD equivalent');

    const openAi = plan.items.find((item) => item.destinationName === 'OpenAI Max');
    assert.ok(openAi, 'OpenAI Max should be part of the split');
    assert.equal(openAi.amount, 160000);
    assert.equal(openAi.amountUsd, 100);
  });

  it('includes honest lifestyle and clothing buckets before the move-out push on larger income', () => {
    const state = buildDefaultState();
    const plan = generateAllocation(state, {
      source: 'Test income',
      amount: 2043536,
      currency: 'NGN',
      exchangeRate: 1600,
      date: '2026-06-14',
    });

    assert.ok(plan.items.some((item) => item.destinationName === 'Lifestyle Cap' && item.amount > 0), 'Lifestyle Cap should be funded');
    assert.ok(plan.items.some((item) => item.destinationName === 'Clothing Cap' && item.amount > 0), 'Clothing Cap should be funded');
  });

  it('partially funds cash-at-hand when the expense priority is explicitly CAH', () => {
    const state = {
      ...buildDefaultState(),
      expenses: [
        ...buildDefaultState().expenses,
        { id: 'cash-at-hand', name: 'Sunday cash envelope', amount: 100000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Household', priority: 'cah' as const, workCritical: false },
        { id: 'self-care', name: 'Self Care', amount: 80000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Wellbeing', priority: 'flexible' as const, workCritical: false },
      ],
    };

    const plan = generateAllocation(state, {
      source: 'Client payment',
      amount: 850000,
      currency: 'NGN',
      exchangeRate: 1600,
      date: '2026-06-14',
    });

    const cashItem = plan.items.find((item) => item.destinationName === 'Sunday cash envelope');
    assert.ok(cashItem, 'Explicit CAH priority should receive a realistic partial allocation');
    assert.equal(cashItem.amount, 50000);
    assert.match(cashItem.reason, /cash at hand/i);
    assert.ok(!plan.items.some((item) => item.destinationName === 'Self Care'));

    const cashExclusion = plan.excludedExpenses.find((expense) => expense.expenseName === 'Sunday cash envelope');
    const selfCareExclusion = plan.excludedExpenses.find((expense) => expense.expenseName === 'Self Care');

    assert.ok(cashExclusion);
    assert.ok(selfCareExclusion);
    assert.match(cashExclusion.reason, /partially funded/i);
    assert.ok(
      cashExclusion.rules.some((rule) => /cash at hand receives up to 50%.*stability mode/i.test(rule)),
      'cash-at-hand cap rule should explicitly mention 50% in Stability Mode',
    );
    assert.equal(cashExclusion.monthlyAmountNgn, 100000);
    assert.equal(cashExclusion.excludedAmountNgn, 50000);
    assert.equal(selfCareExclusion.category, 'Wellbeing');
  });

  it('scales cash-at-hand funding by allocation mode', () => {
    const state = {
      ...buildDefaultState(),
      expenses: [
        ...buildDefaultState().expenses,
        { id: 'cash-at-hand', name: 'Weekly cash envelope', amount: 100000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Pocket cash', priority: 'cah' as const, workCritical: false },
      ],
    };

    const survivalPlan = generateAllocation(state, { source: 'Small client payment', amount: 400000, currency: 'NGN', exchangeRate: 1600, date: '2026-06-14' });
    const attackPlan = generateAllocation(state, { source: 'Large client payment', amount: 2000000, currency: 'NGN', exchangeRate: 1600, date: '2026-06-14' });

    assert.equal(survivalPlan.items.find((item) => item.destinationName === 'Weekly cash envelope')?.amount, 25000);
    assert.equal(attackPlan.items.find((item) => item.destinationName === 'Weekly cash envelope')?.amount, 75000);
  });

  it('caps oversized CAH so it cannot starve the critical goal push', () => {
    const state = {
      ...buildDefaultState(),
      expenses: [
        ...buildDefaultState().expenses,
        { id: 'cash-at-hand', name: 'Weekly cash envelope', amount: 10000000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Pocket cash', priority: 'cah' as const, workCritical: false },
      ],
    };

    const plan = generateAllocation(state, { source: 'Large client payment', amount: 2000000, currency: 'NGN', exchangeRate: 1600, date: '2026-06-14' });
    const cahItem = plan.items.find((item) => item.destinationName === 'Weekly cash envelope');
    const goalTotal = plan.items
      .filter((item) => item.destinationName === 'Move-Out Fund' && item.destinationType === 'goal')
      .reduce((sum, item) => sum + item.amount, 0);

    assert.equal(cahItem?.amount, 160000);
    assert.ok(goalTotal > 0, 'Critical goal should still receive funding even when requested CAH is oversized');
  });

  it('does not treat legacy name or category phrases as cash-at-hand without explicit CAH priority', () => {
    const state = {
      ...buildDefaultState(),
      expenses: [
        ...buildDefaultState().expenses,
        { id: 'c-typo', name: 'C', amount: 100000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Pocket cash', priority: 'flexible' as const, workCritical: false },
        { id: 'cash-phrase', name: 'Cash at Hand', amount: 100000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Liquidity', priority: 'flexible' as const, workCritical: false },
      ],
    };

    const plan = generateAllocation(state, { source: 'Client payment', amount: 850000, currency: 'NGN', exchangeRate: 1600, date: '2026-06-14' });

    assert.ok(!plan.items.some((item) => item.destinationName === 'C'));
    assert.ok(!plan.items.some((item) => item.destinationName === 'Cash at Hand'));
    assert.ok(plan.excludedExpenses.some((expense) => expense.expenseName === 'Cash at Hand'));
  });

  it('enforces the CAH income cap cumulatively across multiple matching expenses', () => {
    const state = {
      ...buildDefaultState(),
      expenses: [
        ...buildDefaultState().expenses,
        { id: 'cash-at-hand', name: 'Weekly cash envelope', amount: 100000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Pocket cash', priority: 'cah' as const, workCritical: false },
        { id: 'cash-at-hand-church', name: 'Church cash envelope', amount: 100000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Pocket cash', priority: 'cah' as const, workCritical: false },
      ],
    };

    const plan = generateAllocation(state, { source: 'Client payment', amount: 850000, currency: 'NGN', exchangeRate: 1600, date: '2026-06-14' });
    const cashTotal = plan.items
      .filter((item) => item.priority === 'cash-at-hand cap')
      .reduce((sum, item) => sum + item.amount, 0);

    assert.equal(cashTotal, 68000);
  });

  it('does not duplicate-fund must-pay expenses that happen to be named CAH', () => {
    const state = {
      ...buildDefaultState(),
      expenses: [
        { id: 'cah-must-pay', name: 'CAH', amount: 100000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Pocket cash', priority: 'must-pay' as const, workCritical: false },
      ],
    };

    const plan = generateAllocation(state, { source: 'Client payment', amount: 850000, currency: 'NGN', exchangeRate: 1600, date: '2026-06-14' });
    const cahItems = plan.items.filter((item) => item.destinationName === 'CAH');

    assert.equal(cahItems.length, 1);
    assert.equal(cahItems[0].destinationType, 'expense');
    assert.equal(cahItems[0].priority, 'must-pay');
  });

  it('places CAH after the critical goal allocation in priority order', () => {
    const state = {
      ...buildDefaultState(),
      expenses: [
        ...buildDefaultState().expenses,
        { id: 'cash-at-hand', name: 'Weekly cash envelope', amount: 100000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Pocket cash', priority: 'cah' as const, workCritical: false },
      ],
    };

    const plan = generateAllocation(state, { source: 'Large client payment', amount: 2000000, currency: 'NGN', exchangeRate: 1600, date: '2026-06-14' });
    const goalIndex = plan.items.findIndex((item) => item.destinationName === 'Move-Out Fund' && item.destinationType === 'goal');
    const cahIndex = plan.items.findIndex((item) => item.destinationName === 'Weekly cash envelope');

    assert.ok(goalIndex >= 0);
    assert.ok(cahIndex > goalIndex, 'CAH should be allocated after the active critical goal');
  });

  it('never renders zero-naira allocation items; unfunded expenses stay in exclusions only', () => {
    const plan = generateAllocation(buildDefaultState(), {
      source: 'Tiny client payment',
      amount: 250000,
      currency: 'NGN',
      exchangeRate: 1600,
      date: '2026-06-14',
    });

    assert.ok(plan.items.length > 0);
    assert.ok(plan.items.every((item) => item.amount > 0), 'visible breakdown items should always have funded amounts');
    assert.ok(plan.items.every((item) => Math.round(item.amount) > 0), 'visible breakdown items should never display as ₦0 after currency rounding');
    assert.ok(plan.excludedExpenses.length > 0, 'unfunded amounts should be tracked in exclusions');
    assert.ok(plan.excludedExpenses.every((expense) => expense.excludedAmountNgn > 0), 'exclusions should represent positive unfunded amounts');
  });

  it('keeps sub-naira allocation leftovers out of visible items because they display as zero', () => {
    const plan = generateAllocation({ ...buildDefaultState(), goals: [], debts: [], expenses: [] }, {
      source: 'Fractional test payment',
      amount: 0.4,
      currency: 'NGN',
      exchangeRate: 1600,
      date: '2026-06-14',
    });

    assert.equal(plan.items.length, 0);
  });

  it('applies an allocation plan to goal and debt progress only once', () => {
    const state = buildDefaultState();
    const plan = generateAllocation(state, {
      source: 'Client payment',
      amount: 2043536,
      currency: 'NGN',
      exchangeRate: 1600,
      date: '2026-06-14',
    });

    const withPlan = { ...state, lastPlan: plan };
    const applied = applyAllocationPlanToProgress(withPlan);
    const moveOutBefore = state.goals.find((goal) => goal.id === 'move-out');
    const moveOutAfter = applied.goals.find((goal) => goal.id === 'move-out');
    const bankDebtBefore = state.debts.find((debt) => debt.id === 'bank-debt');
    const bankDebtAfter = applied.debts.find((debt) => debt.id === 'bank-debt');

    assert.ok(moveOutBefore && moveOutAfter);
    assert.ok(bankDebtBefore && bankDebtAfter);
    assert.ok(moveOutAfter.currentAmount > moveOutBefore.currentAmount, 'Move-Out Fund should increase');
    assert.ok(bankDebtAfter.remainingAmount < bankDebtBefore.remainingAmount, 'Bank debt should decrease');

    const appliedAgain = applyAllocationPlanToProgress(applied);
    assert.equal(appliedAgain.goals.find((goal) => goal.id === 'move-out')?.currentAmount, moveOutAfter.currentAmount);
    assert.equal(appliedAgain.debts.find((debt) => debt.id === 'bank-debt')?.remainingAmount, bankDebtAfter.remainingAmount);
  });

  it('deletes an applied allocation plan and reverses the goal/debt progress from that plan', () => {
    const state = buildDefaultState();
    const income = {
      source: 'Client payment',
      amount: 2043536,
      currency: 'NGN' as const,
      exchangeRate: 1600,
      date: '2026-06-14',
    };
    const plan = generateAllocation(state, income);
    const applied = applyAllocationPlanToProgress({ ...state, incomes: [income], lastPlan: plan });

    const withoutPlan = deleteAllocationPlan(applied);

    assert.equal(withoutPlan.lastPlan, undefined);
    assert.equal(withoutPlan.appliedPlanSignature, undefined);
    assert.equal(withoutPlan.incomes.length, 0);
    assert.equal(withoutPlan.goals.find((goal) => goal.id === 'move-out')?.currentAmount, state.goals.find((goal) => goal.id === 'move-out')?.currentAmount);
    assert.equal(withoutPlan.debts.find((debt) => debt.id === 'bank-debt')?.remainingAmount, state.debts.find((debt) => debt.id === 'bank-debt')?.remainingAmount);
  });

  it('deletes an unapplied allocation plan without changing goal/debt progress', () => {
    const state = buildDefaultState();
    const plan = generateAllocation(state, {
      source: 'Client payment',
      amount: 2043536,
      currency: 'NGN',
      exchangeRate: 1600,
      date: '2026-06-14',
    });
    const withPlan = { ...state, lastPlan: plan };

    const withoutPlan = deleteAllocationPlan(withPlan);

    assert.equal(withoutPlan.lastPlan, undefined);
    assert.equal(withoutPlan.appliedPlanSignature, undefined);
    assert.deepEqual(withoutPlan.goals, state.goals);
    assert.deepEqual(withoutPlan.debts, state.debts);
  });

  it('flags non-essential clothing while critical move-out goal is behind target', () => {
    const state = buildDefaultState();
    const decision = checkExpenseDecision(state, {
      name: 'Sneakers',
      amount: 120000,
      currency: 'NGN',
      category: 'Clothing',
      exchangeRate: 1600,
      date: '2026-06-14',
    });

    assert.equal(decision.verdict, 'delay');
    assert.match(decision.summary, /delays/i);
    assert.ok(decision.goalImpactAmount > 0);
  });

  it('approves work-critical expenses like OpenAI Max', () => {
    const state = buildDefaultState();
    const decision = checkExpenseDecision(state, {
      name: 'OpenAI Max',
      amount: 100,
      currency: 'USD',
      category: 'Work tools',
      exchangeRate: 1600,
      date: '2026-06-14',
    });

    assert.equal(decision.verdict, 'approve');
    assert.match(decision.summary, /work-critical/i);
  });
});
