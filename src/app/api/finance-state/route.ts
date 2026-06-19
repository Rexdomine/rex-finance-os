import { getFinanceStore } from '@/lib/finance-store';
import { type AppState } from '@/lib/finance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await getFinanceStore();
  const state = await store.getAppState();
  return Response.json({ state, mode: store.mode });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { state?: AppState };

  if (!body.state || !Array.isArray(body.state.goals) || !Array.isArray(body.state.debts) || !Array.isArray(body.state.expenses) || !Array.isArray(body.state.incomes)) {
    return Response.json({ error: 'Invalid finance state payload.' }, { status: 400 });
  }

  const store = await getFinanceStore();
  await store.saveAppState(body.state);
  return Response.json({ ok: true, state: await store.getAppState(), mode: store.mode });
}
