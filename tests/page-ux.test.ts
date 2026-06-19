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

  it('shows USD equivalents beside Naira allocation amounts using the active site rate', () => {
    assert.match(pageSource, /getAllocationPlanInputUsdEquivalent\(state\.lastPlan, usdToNgnRate\)/);
    assert.match(pageSource, /getAllocationItemUsdEquivalent\(item, usdToNgnRate\)/);
    assert.match(pageSource, /USD equivalent/i);
  });

  it('exposes a settings section for managed USD to NGN rates instead of hardcoded dashboard copy', () => {
    assert.match(pageSource, /settings/i);
    assert.match(pageSource, /Exchange rate settings/i);
    assert.match(pageSource, /Refresh live USD\/NGN rate/i);
    assert.match(pageSource, /exchangeRateSettings/);
    assert.doesNotMatch(pageSource, /Includes USD tools @ ₦1,600\/\$/);
  });

  it('renders allocation transparency for excluded expenses and rule reasons', () => {
    assert.match(pageSource, /Excluded from this allocation/i);
    assert.match(pageSource, /excludedExpenses/);
    assert.match(pageSource, /Rules\/constraints/i);
    assert.match(pageSource, /reason each expense was excluded/i);
    assert.match(pageSource, /excludedAmountNgn/);
  });

  it('filters allocation cards that would display as zero after currency rounding', () => {
    assert.match(pageSource, /lastPlan\.items\.filter\(\(item\) => Math\.round\(item\.amount\) > 0\)\.map/);
  });

  it('offers CAH as an explicit expense priority in add and edit dropdowns', () => {
    const priorityOptionsConstant = pageSource.match(/const\s+EXPENSE_PRIORITY_OPTIONS[\s\S]*?=\s*\[([\s\S]*?)\];/);
    const prioritySelectsUsingSharedOptions = pageSource.match(/<Select\s+label="Priority"[\s\S]*?options=\{EXPENSE_PRIORITY_OPTIONS\}/g) ?? [];

    assert.ok(priorityOptionsConstant, 'expense priority dropdowns should use a shared options source');
    assert.match(priorityOptionsConstant[1], /'cah'/, 'shared expense priority options should include CAH');
    assert.ok(prioritySelectsUsingSharedOptions.length >= 2, 'add and edit expense priority dropdowns should both use the shared CAH-aware options');
  });

  it('opens an expense edit modal with controls for amount, category, priority, and work-critical status', () => {
    assert.match(pageSource, /expenseToEdit/);
    assert.match(pageSource, /Edit expense/i);
    assert.match(pageSource, /Update this expense/i);
    assert.match(pageSource, /Amount/i);
    assert.match(pageSource, /Category/i);
    assert.match(pageSource, /Priority/i);
    assert.match(pageSource, /Work-critical/i);
  });

  it('keeps the expense edit modal scrollable on small screens so actions remain reachable', () => {
    assert.match(pageSource, /max-h-\[calc\(100dvh-2rem\)\]/);
    assert.match(pageSource, /overflow-y-auto/);
    assert.match(pageSource, /items-start justify-center overflow-y-auto/);
  });

  it('opens goal and debt edit/delete controls with confirmation dialogs', () => {
    assert.match(pageSource, /goalToEdit/);
    assert.match(pageSource, /Edit goal/i);
    assert.match(pageSource, /Update this goal/i);
    assert.match(pageSource, /Delete this goal\?/i);
    assert.match(pageSource, /Cancel, keep goal/i);
    assert.match(pageSource, /Yes, delete goal/i);
    assert.match(pageSource, /debtToEdit/);
    assert.match(pageSource, /Edit debt/i);
    assert.match(pageSource, /Update this debt/i);
    assert.match(pageSource, /Delete this debt\?/i);
    assert.match(pageSource, /Cancel, keep debt/i);
    assert.match(pageSource, /Yes, delete debt/i);
  });

  it('guards debt adds and edits against impossible minimum due amounts', () => {
    const invalidMinimumDueGuards = pageSource.match(/minimumDueAmount\s*>\s*remainingAmount/g) ?? [];

    assert.ok(invalidMinimumDueGuards.length >= 2, 'add and edit debt flows should both reject minimum due amounts above remaining balance');
    assert.match(pageSource, /Enter valid debt amounts before adding/i);
    assert.match(pageSource, /Enter valid debt amounts before updating/i);
    assert.match(pageSource, /minimum due cannot exceed remaining balance/i);
  });
});
