import { getFinanceStore } from '@/lib/sqlite-store';
import type { AppState } from '@/lib/finance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getFinanceStore();
  return Response.json({ state: store.getAppState() });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { state?: AppState };

  if (!body.state || !Array.isArray(body.state.goals) || !Array.isArray(body.state.debts) || !Array.isArray(body.state.expenses) || !Array.isArray(body.state.incomes)) {
    return Response.json({ error: 'Invalid finance state payload.' }, { status: 400 });
  }

  const store = getFinanceStore();
  store.saveAppState(body.state);
  return Response.json({ ok: true, state: store.getAppState() });
}
