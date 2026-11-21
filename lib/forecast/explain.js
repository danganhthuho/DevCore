import Anthropic from '@anthropic-ai/sdk';
import { log } from '@/lib/log';

// Plain-English "why" for a forecast. The numbers always come from the model
// in model.js; Claude only explains them. Without ANTHROPIC_API_KEY (or if the
// call fails), a short sentence built from the same facts is used instead, so
// forecasting never depends on the API being reachable.

export const EXPLAIN_MODEL = 'claude-opus-5-5';
const MAX_CHARS = 400;

const SYSTEM = `You write one short note for grocery store staff explaining a demand forecast for one product.

Rules:
- Two sentences at most, under 45 words, plain language, no jargon like "regression" or "WAPE".
- Use only the numbers in the facts you are given. Never invent or recalculate numbers.
- Say why the forecast is what it is (trend, busy days) and what to do (order quantity, or that no order is needed).
- If the method is "moving-average", say it is based on the average of recent sales.
- Output only the note: no heading, no quotes, no markdown.`;

export function forecastFacts(product, forecast, recommendedOrder) {
  return {
    product: product.name,
    on_hand: product.quantity,
    minimum: product.minimum_quantity,
    predicted_units_next_30_days: forecast.predictedDemand,
    average_sold_per_day_last_90_days: Math.round(forecast.dailyAverage * 10) / 10,
    method: forecast.method,
    trend_percent_per_4_weeks: forecast.trendPct,
    busiest_day: forecast.busiestDay,
    slowest_day: forecast.slowestDay,
    busiest_vs_slowest_day: forecast.weekdayRatio,
    backtest_accuracy_percent: forecast.accuracy == null ? null : Math.round(forecast.accuracy * 100),
    recommended_order: recommendedOrder,
  };
}

// Used without an API key, after an error, and for bulk refreshes.
export function templateExplanation(facts) {
  const parts = [];
  if (facts.method === 'ai-model') {
    if (facts.trend_percent_per_4_weeks != null && Math.abs(facts.trend_percent_per_4_weeks) >= 5) {
      parts.push(`Sales are ${facts.trend_percent_per_4_weeks > 0 ? 'up' : 'down'} about ${Math.abs(facts.trend_percent_per_4_weeks)}% per 4 weeks`);
    } else {
      parts.push('Sales are steady');
    }
    if (facts.busiest_vs_slowest_day >= 1.3) {
      parts.push(`${facts.busiest_day}s sell ${facts.busiest_vs_slowest_day}× a ${facts.slowest_day}`);
    }
  } else {
    parts.push(`Based on the 90-day average of ${facts.average_sold_per_day_last_90_days} sold per day`);
  }
  const why = `${parts.join('; ')}, so about ${facts.predicted_units_next_30_days} should sell in the next 30 days.`;
  const action = facts.recommended_order > 0 ? ` Order ${facts.recommended_order} to stay above the minimum.` : ' No order needed yet.';
  return why + action;
}

export async function explainForecast(facts, { client } = {}) {
  const fallback = { explanation: templateExplanation(facts), explanation_source: 'template' };
  if (!client && !process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const anthropic = client ?? new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const response = await anthropic.beta.messages.create({
      model: EXPLAIN_MODEL,
      max_tokens: 2000,
      // If Claude declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' }, // a two-sentence note doesn't need deep thinking
      system: SYSTEM,
      messages: [{ role: 'user', content: `Facts (JSON):\n${JSON.stringify(facts, null, 2)}` }],
    });
    if (response.stop_reason === 'refusal') return fallback;

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return fallback;
    return { explanation: text.slice(0, MAX_CHARS), explanation_source: 'claude' };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      log.warn('forecast.explain_auth_failed', {});
    } else if (error instanceof Anthropic.RateLimitError) {
      log.warn('forecast.explain_rate_limited', {});
    } else if (error instanceof Anthropic.APIError) {
      log.warn('forecast.explain_failed', { status: error.status });
    } else {
      log.warn('forecast.explain_failed', { message: String(error?.message ?? error) });
    }
    return fallback;
  }
}
