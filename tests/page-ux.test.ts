import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const pageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');

describe('Rex Finance OS page UX contracts', () => {
  it('shows immediate confirmation near the Add expense button after an expense is added', () => {
    assert.match(pageSource, /expenseStatus/);
    assert.match(pageSource, /Expense added/i);
    assert.match(pageSource, /aria-live="polite"/);
  });

  it('requires a custom confirmation dialog before deleting an expense', () => {
    assert.match(pageSource, /expenseToDelete/);
    assert.match(pageSource, /Delete expense/i);
    assert.match(pageSource, /Delete this expense\?/i);
    assert.match(pageSource, /Cancel, keep expense/i);
    assert.match(pageSource, /Yes, delete expense/i);
  });

  it('does not auto-readd deleted default expenses during state migration', () => {
    assert.doesNotMatch(pageSource, /defaultsToEnsure/);
    assert.doesNotMatch(pageSource, /expenses\.splice/);
  });

  it('shows USD equivalents beside Naira allocation amounts', () => {
    assert.match(pageSource, /inputAmountUsd/);
    assert.match(pageSource, /amountUsd/);
    assert.match(pageSource, /USD equivalent/i);
  });
});
