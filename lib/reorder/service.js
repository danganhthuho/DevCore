import { buildReorderRecommendation } from './logic';

function dbError() {
  return { status: 500, body: { error: 'Database error. Please try again.' } };
}

export async function listReorderRecommendations(supabase, { includeAll = false } = {}) {
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, name, category, quantity, minimum_quantity, supplier_id, suppliers(id, name, contact_email, phone)')
    .order('name');

  if (productError) return dbError();

  const { data: forecasts, error: forecastError } = await supabase
    .from('demand_forecasts')
    .select('*')
    .order('generated_at', { ascending: false });

  if (forecastError) return dbError();

  const latestByProduct = new Map();
  for (const forecast of forecasts ?? []) {
    if (!latestByProduct.has(forecast.product_id)) {
      latestByProduct.set(forecast.product_id, forecast);
    }
  }

  const rows = (products ?? []).map((product) => {
    const forecast = latestByProduct.get(product.id);
    return {
      ...buildReorderRecommendation(product, forecast?.predicted_demand ?? 0),
      // How the forecast was made (null before the AI forecast migration).
      forecast_method: forecast?.method ?? null,
      forecast_accuracy: forecast?.accuracy == null ? null : Number(forecast.accuracy),
      forecast_explanation: forecast?.explanation ?? null,
      forecast_source: forecast?.explanation_source ?? null,
    };
  });

  return {
    status: 200,
    body: includeAll ? rows : rows.filter((row) => row.needs_reorder),
  };
}
