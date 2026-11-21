import { DEFAULT_SETTINGS } from '@/lib/settings';

// The dashboard's "Set up your store" checklist.
// Pure, unit-tested: which setup steps are done.
export function setupSteps({ settings, suppliers, products, users, owner }) {
  const steps = [
    { id: 'store', label: 'Name your store', hint: 'Store name, time zone and currency.',
      href: '/settings?tab=store', done: settings.store_name !== DEFAULT_SETTINGS.store_name },
    { id: 'supplier', label: 'Add a supplier', hint: 'The companies you order from.',
      href: '/suppliers', done: suppliers.length > 0 },
    { id: 'products', label: 'Add your products', hint: 'Import a spreadsheet or add them one by one.',
      href: '/products/import', done: products.length > 0 },
    { id: 'minimums', label: 'Set minimum stock levels', hint: 'So you get low-stock alerts and reorder suggestions.',
      href: '/inventory', done: products.length > 0 && products.every((p) => p.minimum_quantity > 0) },
  ];
  if (owner) {
    steps.push({ id: 'team', label: 'Invite your team', hint: 'Give staff and managers their own sign-in.',
      href: '/settings?tab=team', done: (users?.length ?? 0) > 1 });
  }
  return steps;
}

