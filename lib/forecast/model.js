import { calculateDemandForecast, FORECAST_DAYS, FORECAST_HISTORY_DAYS } from './logic';

// AI demand forecast: a machine-learning model trained on each product's own
// sales history (SFDS Query 10: the last 90 days).
//
// Model: weighted ridge regression on daily sales with
//   - a trend term            (is the product selling more or less over time?)
//   - day-of-week terms       (Saturdays vs. Tuesdays)
//   - recency weighting       (a day 30 days ago counts half as much as today)
// The weights are learned from the data by least squares, not hand-set.
//
// Every forecast is checked before it is trusted: the model is trained on all
// but the last 14 days, asked to predict those 14 days, and scored against
// what really sold. If it doesn't beat the plain 90-day moving average on that
// test, the moving average is used instead, so the model can't make reorders
// worse. The test score is reported as the forecast's accuracy.

export const BACKTEST_DAYS = 14;
export const MIN_DAYS_FOR_MODEL = 28; // four of each weekday before learning weekly patterns
const HALF_LIFE_DAYS = 30;
const RIDGE = 1; // regularisation: keeps weights small when data is noisy
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dayOfWeek = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

// One row per day from the first sale in the window to today (missing days = 0 sold).
export function dailySeries(records, today, historyDays = FORECAST_HISTORY_DAYS) {
  const start = addDays(today, -(historyDays - 1));
  const sold = new Map();
  for (const r of records) {
    if (r.sale_date >= start && r.sale_date <= today) {
      sold.set(r.sale_date, (sold.get(r.sale_date) ?? 0) + Number(r.quantity_sold || 0));
    }
  }
  const first = [...sold.keys()].sort()[0];
  if (!first) return [];
  const days = [];
  for (let d = first; d <= today; d = addDays(d, 1)) days.push({ date: d, dow: dayOfWeek(d), qty: sold.get(d) ?? 0 });
  return days;
}

// Features for day t of n: [intercept, trend, Mon..Sat] (Sunday is the baseline).
function features(t, dow, n) {
  const x = [1, t / n];
  for (let d = 1; d <= 6; d++) x.push(dow === d ? 1 : 0);
  return x;
}

// Solves A x = b (Gaussian elimination with partial pivoting).
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// Trains the model: minimises sum(w_i * (y_i - x_i·beta)^2) + RIDGE * |beta|^2
// (the intercept isn't penalised).
export function trainModel(series) {
  const n = series.length;
  const k = 8;
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const b = new Array(k).fill(0);
  series.forEach((day, t) => {
    const w = 0.5 ** ((n - 1 - t) / HALF_LIFE_DAYS);
    const x = features(t, day.dow, n);
    for (let i = 0; i < k; i++) {
      b[i] += w * x[i] * day.qty;
      for (let j = 0; j < k; j++) A[i][j] += w * x[i] * x[j];
    }
  });
  for (let i = 1; i < k; i++) A[i][i] += RIDGE;
  const beta = solve(A, b);
  if (!beta) return null;
  const cap = 3 * Math.max(1, ...series.map((d) => d.qty)); // never predict wildly beyond what's been seen
  return {
    n,
    beta,
    predict(t, dow) {
      const y = features(t, dow, n).reduce((s, xi, i) => s + xi * beta[i], 0);
      return Math.min(cap, Math.max(0, y));
    },
  };
}

// Weighted absolute percentage error: total miss / total actually sold.
function wape(actual, predicted) {
  const total = actual.reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  return actual.reduce((s, v, i) => s + Math.abs(v - predicted[i]), 0) / total;
}
const toAccuracy = (err) => (err == null ? null : Math.max(0, Math.round((1 - err) * 100)) / 100);

// Hold out the last 14 days: does the model beat the moving average on them?
export function backtest(series) {
  if (series.length < MIN_DAYS_FOR_MODEL + BACKTEST_DAYS) return null;
  const train = series.slice(0, -BACKTEST_DAYS);
  const test = series.slice(-BACKTEST_DAYS);
  const model = trainModel(train);
  if (!model) return null;
  const actual = test.map((d) => d.qty);
  const modelPred = test.map((d, i) => model.predict(train.length + i, d.dow));
  const average = train.reduce((s, d) => s + d.qty, 0) / train.length;
  const modelErr = wape(actual, modelPred);
  const baselineErr = wape(actual, actual.map(() => average));
  if (modelErr == null || baselineErr == null) return null;
  return { modelErr, baselineErr, modelWins: modelErr <= baselineErr };
}

// The full forecast. Keeps the fields calculateDemandForecast returns (the API
// and the reorder formula use them) and adds what the model learned.
export function forecastDemand(records, today, { forecastDays = FORECAST_DAYS } = {}) {
  const baseline = calculateDemandForecast(records, { forecastDays });
  const result = {
    ...baseline,
    method: 'moving-average',
    accuracy: null,
    baselineAccuracy: null,
    trendPct: null,
    busiestDay: null,
    slowestDay: null,
    weekdayRatio: null,
  };
  if (baseline.insufficientData) return result;

  const series = dailySeries(records, today);
  const test = series.length >= MIN_DAYS_FOR_MODEL ? backtest(series) : null;
  result.baselineAccuracy = toAccuracy(test?.baselineErr);
  result.accuracy = result.baselineAccuracy;
  if (!test?.modelWins) return result;

  const model = trainModel(series);
  if (!model) return result;
  const n = series.length;
  let total = 0;
  for (let i = 0; i < forecastDays; i++) total += model.predict(n + i, dayOfWeek(addDays(today, i + 1)));

  // What the model learned, in plain terms.
  const perDay = DAY_NAMES.map((_, dow) => model.predict(n, dow));
  const level = perDay.reduce((sum, v) => sum + v, 0) / 7; // an average day right now
  const busiest = perDay.indexOf(Math.max(...perDay));
  const slowest = perDay.indexOf(Math.min(...perDay));
  const trendPerDay = model.beta[1] / n;

  return {
    ...result,
    predictedDemand: Math.max(0, Math.ceil(total)),
    method: 'ai-model',
    accuracy: toAccuracy(test.modelErr),
    trendPct: level > 0 ? Math.round(((trendPerDay * 28) / level) * 100) : null,
    busiestDay: DAY_NAMES[busiest],
    slowestDay: DAY_NAMES[slowest],
    weekdayRatio: perDay[slowest] > 0 ? Math.round((perDay[busiest] / perDay[slowest]) * 10) / 10 : null,
  };
}

