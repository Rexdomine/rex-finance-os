import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildDefaultState, generateAllocation, type Income } from '../src/lib/finance';
import { createFinanceStore } from '../src/lib/finance-store';

describe('libSQL/Turso finance persistence', () => {
  it('uses a local libSQL SQLite file by default and persists full finance state', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rex-finance-os-libsql-'));
    const dbPath = join(dir, 'finance.db');

    try {
      const state = buildDefaultState();
      const income: Income = {
        source: 'Client payment',
        amount: 850000,
        currency: 'NGN',
        exchangeRate: 1600,
        date: '2026-06-14',
        notes: 'libSQL persistence test',
      };
      const plan = generateAllocation(state, income);
      const updatedState = { ...state, incomes: [income], lastPlan: plan };

      const writer = await createFinanceStore({ localDbPath: dbPath });
      assert.equal(writer.mode, 'local-libsql');
      await writer.saveAppState(updatedState);
      await writer.close();

      const reader = await createFinanceStore({ localDbPath: dbPath });
      const loaded = await reader.getAppState();
      const incomes = await reader.listIncomes();
      const plans = await reader.listAllocationPlans();
      await reader.close();

      assert.equal(loaded.incomes.length, 1);
      assert.equal(loaded.incomes[0].source, 'Client payment');
      assert.equal(loaded.lastPlan?.mode, plan.mode);
      assert.equal(incomes.length, 1);
      assert.equal(incomes[0].amount, 850000);
      assert.equal(plans.length, 1);
      assert.equal(plans[0].inputAmountNgn, 850000);
      assert.ok(plans[0].items.some((item) => item.destinationType === 'goal'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses writable /tmp local fallback on Vercel when Turso env vars are missing', async () => {
    const previousVercel = process.env.VERCEL;
    const previousDbPath = process.env.REX_FINANCE_DB_PATH;
    process.env.VERCEL = '1';
    delete process.env.REX_FINANCE_DB_PATH;

    try {
      const store = await createFinanceStore();
      assert.equal(store.mode, 'local-libsql');
      const state = await store.getAppState();
      await store.close();
      assert.equal(state.goals.length, 3);
    } finally {
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
      if (previousDbPath === undefined) delete process.env.REX_FINANCE_DB_PATH;
      else process.env.REX_FINANCE_DB_PATH = previousDbPath;
    }
  });

  it('selects Turso/libSQL cloud mode when Turso URL and auth token are provided', async () => {
    const calls: Array<{ url: string; authToken?: string }> = [];
    const store = await createFinanceStore({
      tursoDatabaseUrl: 'libsql://rex-finance-os.turso.io',
      tursoAuthToken: 'test-token',
      clientFactory: (options) => {
        calls.push(options);
        throw new Error('stop after client selection');
      },
    }).catch((error: Error) => error);

    assert.ok(store instanceof Error);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'libsql://rex-finance-os.turso.io');
    assert.equal(calls[0].authToken, 'test-token');
  });
});
