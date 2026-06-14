import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildDefaultState, generateAllocation, type Income } from '../src/lib/finance';
import { createFinanceStore } from '../src/lib/sqlite-store';

describe('SQLite finance persistence', () => {
  it('persists income history, allocation plans, and related finance state across store instances', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rex-finance-os-'));
    const dbPath = join(dir, 'finance.db');

    try {
      const state = buildDefaultState();
      const income: Income = {
        source: 'Client payment',
        amount: 850000,
        currency: 'NGN',
        exchangeRate: 1600,
        date: '2026-06-14',
        notes: 'SQLite persistence test',
      };
      const plan = generateAllocation(state, income);
      const updatedState = { ...state, incomes: [income], lastPlan: plan };

      const writer = createFinanceStore(dbPath);
      writer.saveAppState(updatedState);
      writer.close();

      const reader = createFinanceStore(dbPath);
      const loaded = reader.getAppState();
      const incomes = reader.listIncomes();
      const plans = reader.listAllocationPlans();
      reader.close();

      assert.equal(loaded.incomes.length, 1);
      assert.equal(loaded.incomes[0].source, 'Client payment');
      assert.equal(loaded.lastPlan?.mode, plan.mode);
      assert.equal(loaded.goals.find((goal) => goal.id === 'move-out')?.targetAmount, 6000000);
      assert.equal(loaded.debts.find((debt) => debt.id === 'bank-debt')?.remainingAmount, 359000);
      assert.equal(incomes.length, 1);
      assert.equal(incomes[0].amount, 850000);
      assert.equal(plans.length, 1);
      assert.equal(plans[0].inputAmountNgn, 850000);
      assert.ok(plans[0].items.some((item) => item.destinationType === 'goal'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
