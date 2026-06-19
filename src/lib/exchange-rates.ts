import { DEFAULT_USD_TO_NGN_RATE, type ExchangeRateSettings } from './finance';

const OPEN_ER_API_URL = 'https://open.er-api.com/v6/latest/USD';

type OpenExchangeRateResponse = {
  result?: string;
  provider?: string;
  base_code?: string;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
};

export type LatestUsdToNgnRate = Pick<ExchangeRateSettings, 'usdToNgn' | 'source' | 'provider' | 'updatedAt'>;

/**
 * Fetches and validates the latest USD to NGN rate from the free open ExchangeRate-API endpoint.
 */
export async function fetchLatestUsdToNgnRate(fetcher: typeof fetch = fetch): Promise<LatestUsdToNgnRate> {
  const response = await fetcher(OPEN_ER_API_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Exchange-rate provider failed with HTTP ${response.status}`);
  }

  const data = await response.json() as OpenExchangeRateResponse;
  const usdToNgn = Number(data.rates?.NGN);

  if (data.result && data.result !== 'success') {
    throw new Error(`Exchange-rate provider returned ${data.result}`);
  }

  if (!Number.isFinite(usdToNgn) || usdToNgn <= 0) {
    throw new Error('Exchange-rate provider did not return a valid USD/NGN rate.');
  }

  return {
    usdToNgn,
    source: 'open-er-api',
    provider: data.provider ?? 'https://www.exchangerate-api.com',
    updatedAt: data.time_last_update_utc ?? new Date().toISOString(),
  };
}

/**
 * Converts a normalized provider rate into persisted app exchange-rate settings.
 */
export function buildRateSettingsUpdate(rate: LatestUsdToNgnRate): ExchangeRateSettings {
  return {
    usdToNgn: rate.usdToNgn || DEFAULT_USD_TO_NGN_RATE,
    source: rate.source,
    provider: rate.provider,
    updatedAt: rate.updatedAt ?? new Date().toISOString(),
    autoRefresh: true,
  };
}
