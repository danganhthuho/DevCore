// Integration hook agreed with Dev B (see Dev Work Split, "Timeline and
// integration"). Product routes call this after every create, edit or
// quantity change. Dev B fills in the body: checkLowStock(),
// checkExpiration() and alert creation.
export async function onProductChanged(supabase, productId) {}
