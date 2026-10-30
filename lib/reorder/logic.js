
// predictedDemand and this becomes max(0, minimum - current).

export function calculateReorderQuantity(product, predictedDemand = 0) {
  const current = Number(product.quantity || 0);
  const minimum = Number(product.minimum_quantity || 0);
  const forecast = Math.max(0, Number(predictedDemand || 0));
  return Math.max(0, Math.ceil(minimum + forecast - current));
}

export function buildReorderRecommendation(product, predictedDemand = 0) {
  const recommendedQuantity = calculateReorderQuantity(product, predictedDemand);
  return {
    product_id: product.id,
    name: product.name,
    quantity: Number(product.quantity || 0),
    minimum_quantity: Number(product.minimum_quantity || 0),
    predicted_demand: Math.max(0, Number(predictedDemand || 0)),
    recommended_quantity: recommendedQuantity,
    supplier_id: product.supplier_id ?? null,
    supplier_name: product.suppliers?.name ?? null,
    needs_reorder: recommendedQuantity > 0,
  };
}
