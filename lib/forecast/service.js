import { FORECAST_HISTORY_DAYS, FORECAST_DAYS, MIN_SALES_RECORDS } from './logic';
import { forecastDemand } from './model';
import { explainForecast, forecastFacts, templateExplanation } from './explain';
import { calculateReorderQuantity } from '@/lib/reorder/logic';
import { log } from '@/lib/log';

// Forecast operations used by /api/forecasts. Each returns { status, body }.
//   SFDS Query 10: read 90 days of sales -> model.js -> write demand_forecasts.

const PAGE = 1000; // Supabase returns at most 1,000 rows per request

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dbError(error, where) {
  if (error) log.error('db.error', { where, code: error.code, message: error.message });
  return { status: 500, body: { error: 'Database error. Please try again.' } };
}

function historyStart(today) {
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (FORECAST_HISTORY_DAYS - 1));
  return isoDate(start);
}

export async function getSalesHistory(supabase, productId, today = new Date()) {
  const { data, error } = await supabase
    .from('sales_records')
    .select('quantity_sold, sale_date')
    .eq('product_id', Number(productId))
    .gte('sale_date', historyStart(today))
    .lte('sale_date', isoDate(today))
    .order('sale_date', { ascending: true });

  if (error) return dbError(error, 'getSalesHistory');
  return { status: 200, body: data ?? [] };
}

export async function getLatestForecast(supabase, productId) {
  const { data, error } = await supabase
    .from('demand_forecasts')
    .select('*')
    .eq('product_id', Number(productId))
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return dbError(error, 'getLatestForecast');
  return { status: 200, body: data };
}

// Saves a forecast. The method/accuracy/explanation columns come from the
// 20261124_ai_forecast migration; before it's run, only the original columns
// are saved and everything else keeps working.
async function saveForecast(supabase, row, extra) {
  let result = await supabase.from('demand_forecasts').insert({ ...row, ...extra }).select().single();
  if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
    result = await supabase.from('demand_forecasts').insert(row).select().single();
  }
  return result;
}

function forecastRow(productId, today, forecast) {
  const target = new Date(today);
  target.setUTCDate(target.getUTCDate() + FORECAST_DAYS);
  return {
    product_id: Number(productId),
    forecast_date: isoDate(target),
    predicted_demand: forecast.predictedDemand,
  };
}

// One product: train the model, check it, explain it (Claude when an API key
// is set) and save it.
export async function generateForecast(supabase, productId, today = new Date(), { explain = explainForecast } = {}) {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, quantity, minimum_quantity')
    .eq('id', Number(productId))
    .maybeSingle();
  if (productError) return dbError(productError, 'generateForecast');
  if (!product) return { status: 404, body: { error: 'Product not found.' } };

  const history = await getSalesHistory(supabase, productId, today);
  if (history.status !== 200) return history;

  const forecast = forecastDemand(history.body, isoDate(today));
  if (forecast.insufficientData) {
    return {
      status: 422,
      body: {
        error: `Not enough sales history. Need at least ${MIN_SALES_RECORDS} sales records, but only ${forecast.recordCount} were found.`,
        ...forecast,
      },
    };
  }

  const recommendedOrder = calculateReorderQuantity(product, forecast.predictedDemand);
  const facts = forecastFacts(product, forecast, recommendedOrder);
  const { explanation, explanation_source } = await explain(facts);

  const { data, error } = await saveForecast(supabase, forecastRow(productId, today, forecast), {
    method: forecast.method,
    accuracy: forecast.accuracy,
    explanation,
    explanation_source,
  });
  if (error) return dbError(error, 'generateForecast');

  log.info('forecast.generated', { productId: product.id, method: forecast.method, accuracy: forecast.accuracy, explanation_source });
  return {
    status: 201,
    body: { ...data, ...forecast, explanation, explanation_source, recommendedOrder },
  };
}

// Every product at once (Alerts & Reorder -> "Refresh all forecasts"). Uses
// the short built-in explanations, not Claude, so it's quick and costs nothing;
// "Generate forecast" on one product asks Claude for its note.
export async function generateAllForecasts(supabase, today = new Date()) {
  const { data: products, error } = await supabase.from('products').select('id, name, quantity, minimum_quantity');
  if (error) return dbError(error, 'generateAllForecasts');

  const sales = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error: salesError } = await supabase
      .from('sales_records')
      .select('product_id, quantity_sold, sale_date')
      .gte('sale_date', historyStart(today))
      .lte('sale_date', isoDate(today))
      .order('id')
      .range(start, start + PAGE - 1);
    if (salesError) return dbError(salesError, 'generateAllForecasts');
    sales.push(...data);
    if (data.length < PAGE) break;
  }
  const byProduct = new Map();
  for (const s of sales) {
    if (!byProduct.has(s.product_id)) byProduct.set(s.product_id, []);
    byProduct.get(s.product_id).push(s);
  }

  const rows = [];
  const extras = [];
  let skipped = 0;
  for (const product of products) {
    const forecast = forecastDemand(byProduct.get(product.id) ?? [], isoDate(today));
    if (forecast.insufficientData) { skipped++; continue; }
    const facts = forecastFacts(product, forecast, calculateReorderQuantity(product, forecast.predictedDemand));
    rows.push(forecastRow(product.id, today, forecast));
    extras.push({ method: forecast.method, accuracy: forecast.accuracy, explanation: templateExplanation(facts), explanation_source: 'template' });
  }

  if (rows.length) {
    let result = await supabase.from('demand_forecasts').insert(rows.map((r, i) => ({ ...r, ...extras[i] })));
    if (result.error && ['42703', 'PGRST204'].includes(result.error.code)) {
      result = await supabase.from('demand_forecasts').insert(rows);
    }
    if (result.error) return dbError(result.error, 'generateAllForecasts');
  }

  const aiModel = extras.filter((e) => e.method === 'ai-model').length;
  log.info('forecast.generated_all', { forecasted: rows.length, aiModel, skipped });
  return {
    status: 200,
    body: { forecasted: rows.length, aiModel, movingAverage: rows.length - aiModel, skipped, productIds: rows.map((r) => r.product_id) },
  };
}
