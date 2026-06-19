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

  it('explains newly added expenses that were excluded from an allocation run', () => {
    const state = {
      ...buildDefaultState(),
      expenses: [
        ...buildDefaultState().expenses,
        { id: 'cash-at-hand', name: 'Cash at Hand', amount: 100000, currency: 'NGN' as const, frequency: 'monthly' as const, category: 'Liquidity', priority: 'flexible' as const, workCritical: false },
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

    assert.ok(!plan.items.some((item) => item.destinationName === 'Cash at Hand'));
    assert.ok(!plan.items.some((item) => item.destinationName === 'Self Care'));

    const cashExclusion = plan.excludedExpenses.find((expense) => expense.expenseName === 'Cash at Hand');
    const selfCareExclusion = plan.excludedExpenses.find((expense) => expense.expenseName === 'Self Care');

    assert.ok(cashExclusion);
    assert.ok(selfCareExclusion);
    assert.match(cashExclusion.reason, /flexible/i);
    assert.ok(cashExclusion.rules.some((rule) => /Survival Mode|must-pay|explicit lifestyle/i.test(rule)));
    assert.equal(cashExclusion.monthlyAmountNgn, 100000);
    assert.equal(cashExclusion.excludedAmountNgn, 100000);
    assert.equal(selfCareExclusion.category, 'Wellbeing');
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
