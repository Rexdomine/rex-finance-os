import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fetchLatestUsdToNgnRate } from '../src/lib/exchange-rates';

describe('USD/NGN exchange rate integration', () => {
  it('normalizes Open Exchange Rates-style USD latest response into app settings', async () => {
    const rate = await fetchLatestUsdToNgnRate(async () => new Response(JSON.stringify({
      result: 'success',
      provider: 'https://www.exchangerate-api.com',
      base_code: 'USD',
      time_last_update_utc: 'Fri, 19 Jun 2026 00:02:32 +0000',
      rates: { NGN: 1360.816743 },
    })) as typeof fetch);

    assert.equal(rate.usdToNgn, 1360.816743);
    assert.equal(rate.source, 'open-er-api');
    assert.equal(rate.provider, 'https://www.exchangerate-api.com');
    assert.equal(rate.updatedAt, 'Fri, 19 Jun 2026 00:02:32 +0000');
  });

  it('fails closed when the provider omits a positive NGN rate', async () => {
    await assert.rejects(
      fetchLatestUsdToNgnRate(async () => new Response(JSON.stringify({ result: 'success', rates: { EUR: 0.9 } })) as typeof fetch),
      /valid USD\/NGN/i,
    );
  });
});
