import { fetchLatestUsdToNgnRate } from '@/lib/exchange-rates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serves the latest normalized USD to NGN rate to the client settings panel.
 */
export async function GET() {
  try {
    const rate = await fetchLatestUsdToNgnRate();
    return Response.json({ rate });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to refresh USD/NGN exchange rate.' },
      { status: 502 },
    );
  }
}
