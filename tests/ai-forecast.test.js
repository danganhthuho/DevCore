import { describe, it, expect, vi, afterEach } from 'vitest';
import { backtest, dailySeries, forecastDemand, trainModel } from '@/lib/forecast/model';
import { explainForecast, forecastFacts, templateExplanation, EXPLAIN_MODEL } from '@/lib/forecast/explain';

const TODAY = '2026-11-20'; // a Friday

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// 90 days of sales from a rule: (daysAgo, dayOfWeek) -> units
function history(rule) {
  const out = [];
  for (let ago = 89; ago >= 0; ago--) {
    const date = addDays(TODAY, -ago);
    const q = Math.round(rule(ago, new Date(`${date}T00:00:00Z`).getUTCDay()));
    if (q > 0) out.push({ sale_date: date, quantity_sold: q });
  }
  return out;
}

describe('AI forecast model', () => {
  it('learns a rising trend and forecasts above the flat 90-day average', () => {
    const records = history((ago) => 2 + (89 - ago) * 0.1); // 2/day rising to ~11/day
    const f = forecastDemand(records, TODAY);
    expect(f.method).toBe('ai-model');
    expect(f.predictedDemand).toBeGreaterThan(Math.ceil(f.dailyAverage * 30) * 1.4);
    expect(f.trendPct).toBeGreaterThan(10);
    expect(f.accuracy).toBeGreaterThan(0.85);
  });

  it('learns which days are busy', () => {
    const records = history((ago, dow) => (dow === 6 ? 12 : 4)); // Saturdays triple
    const f = forecastDemand(records, TODAY);
    expect(f.method).toBe('ai-model');
    expect(f.busiestDay).toBe('Saturday');
    expect(f.weekdayRatio).toBeGreaterThan(2.5);
    // 30 days ahead hold 4 Saturdays: about 4x12 + 26x4 = 152
    expect(f.predictedDemand).toBeGreaterThan(140);
    expect(f.predictedDemand).toBeLessThan(165);
  });

  it('falls back to the moving average when history is too short to test', () => {
    const records = history((ago) => (ago < 20 ? 3 : 0)); // only 20 days of sales
    const f = forecastDemand(records, TODAY);
    expect(f.method).toBe('moving-average');
    expect(f.predictedDemand).toBe(Math.ceil((60 / 90) * 30));
  });

  it('keeps the SFDS insufficient-data rule (fewer than 7 records)', () => {
    const f = forecastDemand(history((ago) => (ago < 5 ? 2 : 0)), TODAY);
    expect(f.insufficientData).toBe(true);
    expect(f.method).toBe('moving-average');
  });

  it('only uses the model when it beats the moving average on held-out days', () => {
    const series = dailySeries(history((ago, dow) => (dow === 6 ? 12 : 4)), TODAY);
    const result = backtest(series);
    expect(result.modelWins).toBe(true);
    expect(result.modelErr).toBeLessThan(result.baselineErr);
  });

  it('never predicts negative sales', () => {
    const model = trainModel(dailySeries(history((ago) => Math.max(0, ago - 30) / 6 + 0.4), TODAY));
    for (let i = 0; i < 30; i++) expect(model.predict(90 + i, i % 7)).toBeGreaterThanOrEqual(0);
  });
});

describe('Forecast explanations', () => {
  const product = { name: 'Whole Milk', quantity: 4, minimum_quantity: 10 };
  const forecast = forecastDemand(history((ago, dow) => (dow === 6 ? 12 : 4)), TODAY);
  const facts = forecastFacts(product, forecast, 40);

  afterEach(() => { vi.unstubAllEnvs(); });

  function fakeClient(response) {
    const create = vi.fn(async () => (response instanceof Error ? Promise.reject(response) : response));
    return { client: { beta: { messages: { create } } }, create };
  }

  it('builds a template note from the facts alone', () => {
    const text = templateExplanation(facts);
    expect(text).toMatch(/Saturdays sell/);
    expect(text).toContain(`${forecast.predictedDemand} should sell`);
    expect(text).toContain('Order 40');
  });

  it('uses the template when no API key is set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(await explainForecast(facts)).toEqual({ explanation: templateExplanation(facts), explanation_source: 'template' });
  });

  it('asks Claude with the facts and returns its note', async () => {
    const { client, create } = fakeClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Saturdays drive sales. Order 40 by Friday.' }] });
    const result = await explainForecast(facts, { client });
    expect(result).toEqual({ explanation: 'Saturdays drive sales. Order 40 by Friday.', explanation_source: 'claude' });
    const req = create.mock.calls[0][0];
    expect(req.model).toBe(EXPLAIN_MODEL);
    expect(req.fallbacks).toBe('default');
    expect(req.betas).toContain('server-side-fallback-2026-07-01');
    expect(req.messages[0].content).toContain('"recommended_order": 40');
  });

  it('falls back to the template on a refusal, an empty reply or an error', async () => {
    for (const response of [
      { stop_reason: 'refusal', content: [] },
      { stop_reason: 'end_turn', content: [] },
      new Error('network down'),
    ]) {
      const { client } = fakeClient(response);
      expect((await explainForecast(facts, { client })).explanation_source).toBe('template');
    }
  });
});
