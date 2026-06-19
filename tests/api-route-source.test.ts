import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const routeSource = readFileSync(new URL('../src/app/api/finance-state/route.ts', import.meta.url), 'utf8');

describe('finance-state API persistence contracts', () => {
  it('does not re-add deleted default expenses on server GET or PUT', () => {
    assert.doesNotMatch(routeSource, /ensureDefaultRecurringExpenses/);
    assert.match(routeSource, /await store\.saveAppState\(body\.state\)/);
  });
});
