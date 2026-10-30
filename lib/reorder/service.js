import { buildReorderRecommendation } from './logic';

function dbError() {
  return { status: 500, body: { error: 'Database error. Please try again.' } };
}

export async function listReorderRecommendations(supabase, { includeAll = false } = {}) {
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, name, quantity, minimum_quantity, supplier_id, suppliers(id, name)')
    .order('name');

  if (productError) return dbError();

  const { data: forecasts, error: forecastError } = await supabase
    .from('demand_forecasts')
    .select('product_id, predicted_demand, generated_at')
    .order('generated_at', { ascending: false });

  if (forecastError) return dbError();

  const latestByProduct = new Map();
  for (const forecast of forecasts ?? []) {
    if (!latestByProduct.has(forecast.product_id)) {
      latestByProduct.set(forecast.product_id, forecast.predicted_demand);
    }
  }

  const rows = (products ?? []).map((product) =>
    buildReorderRecommendation(product, latestByProduct.get(product.id) ?? 0)
  );

  return {
    status: 200,
    body: includeAll ? rows : rows.filter((row) => row.needs_reorder),
  };
}
