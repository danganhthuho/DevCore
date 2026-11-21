import Brand from '@/components/Brand';

// The two-column layout shared by Sign in and Set a new password:
// brand panel on the left, the form on the right (stacked on phones).
export default function AuthLayout({ children }) {
  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="brand">
          <Brand tone="white" height={34} />
          <span className="brand-name">Inventory Tracker</span>
        </div>

        <div>
          <h2>Less waste. No empty shelves.</h2>
          <p>Track stock and expiration dates, get alerts before items run out or spoil, and reorder with AI demand forecasts.</p>
        </div>

        {/* A look at the real dashboard (decorative; hidden on phones). */}
        <div className="login-preview" aria-hidden="true">
          <img src="/brand/dashboard-preview.webp" alt="" width={1800} height={812} />
        </div>

        <footer>CMPE 131 · Section 05</footer>
      </section>

      <main className="login-form-wrap">{children}</main>
    </div>
  );
}
