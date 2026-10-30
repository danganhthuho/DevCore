import {
  calculateDemandForecast,
  FORECAST_HISTORY_DAYS,
  FORECAST_DAYS,
} from './logic';

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dbError() {
  return { status: 500, body: { error: 'Database error. Please try again.' } };
}

export async function getSalesHistory(supabase, productId, today = new Date()) {
  const end = new Date(today);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (FORECAST_HISTORY_DAYS - 1));

  const { data, error } = await supabase
    .from('sales_records')
    .select('quantity_sold, sale_date')
    .eq('product_id', productId)
    .gte('sale_date', isoDate(start))
    .lte('sale_date', isoDate(end))
    .order('sale_date', { ascending: true });

  if (error) return dbError();
  return { status: 200, body: data ?? [] };
}

export async function getLatestForecast(supabase, productId) {
  const { data, error } = await supabase
    .from('demand_forecasts')
    .select('*')
    .eq('product_id', productId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return dbError();
  return { status: 200, body: data };
}

export async function generateForecast(supabase, productId, today = new Date()) {
  const history = await getSalesHistory(supabase, productId, today);
  if (history.status !== 200) return history;

  const calculation = calculateDemandForecast(history.body);
  const forecastTarget = new Date(today);
  forecastTarget.setUTCDate(forecastTarget.getUTCDate() + FORECAST_DAYS);
  const forecastDate = isoDate(forecastTarget);

  // We still return a calculated result when data is limited, but we clearly
  // mark it so the UI does not present it as a strong AI prediction.
  const { data, error } = await supabase
    .from('demand_forecasts')
    .insert({
      product_id: Number(productId),
      forecast_date: forecastDate,
      predicted_demand: calculation.predictedDemand,
    })
    .select()
    .single();

  if (error) return dbError();

  return {
    status: 201,
    body: {
      ...data,
      ...calculation,
      method: `${FORECAST_HISTORY_DAYS}-day moving average for next ${FORECAST_DAYS} days`,
    },
  };
}
