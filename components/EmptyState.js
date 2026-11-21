import Link from 'next/link';

// What a list shows when it has nothing in it: an icon, a short message and
// the next step to take. actions: [{ label, href } | { label, onClick }],
// the first one is the main button.
export default function EmptyState({ icon: Icon, title, children, actions = [], compact = false }) {
  return (
    <div className={`empty-state${compact ? ' compact' : ''}`}>
      {Icon && <span className="empty-state-icon"><Icon size={compact ? 18 : 22} /></span>}
      <p className="empty-state-title">{title}</p>
      {children && <p className="empty-state-text">{children}</p>}
      {actions.length > 0 && (
        <div className="empty-state-actions">
          {actions.map((a, i) => {
            const cls = i === 0 ? 'button small' : 'button secondary small';
            return a.href
              ? <Link key={a.label} href={a.href} className={cls}>{a.label}</Link>
              : <button key={a.label} type="button" className={i === 0 ? 'small' : 'secondary small'} onClick={a.onClick}>{a.label}</button>;
          })}
        </div>
      )}
    </div>
  );
}
