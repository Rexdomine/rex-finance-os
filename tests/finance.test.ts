import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyAllocationPlanToProgress,
  buildDefaultState,
  generateAllocation,
  getMonthlyExpenseAmount,
  checkExpenseDecision,
} from '../src/lib/finance';

describe('Rex Finance OS finance rules', () => {
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
