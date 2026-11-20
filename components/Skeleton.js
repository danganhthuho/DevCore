// Grey placeholders shaped like the content that's loading, so the page
// doesn't jump when data arrives. Purely visual: screen readers get a single
// "Loading" label from the wrapper.

export function Skeleton({ width = '100%', height = 14, radius = 6, style }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

// Table body placeholder: `rows` rows of `cols` cells.
export function SkeletonRows({ rows = 6, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="skeleton-row" aria-hidden="true">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}><Skeleton width={c === 0 ? '70%' : `${40 + ((r + c) * 17) % 45}%`} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// A few lines of text-shaped placeholders (lists, panels).
export function SkeletonLines({ lines = 3 }) {
  return (
    <span className="skeleton-lines" role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={`${90 - ((i * 23) % 40)}%`} />
      ))}
    </span>
  );
}

// A stat tile while its number loads.
export function SkeletonTile() {
  return (
    <div className="stat" role="status" aria-label="Loading">
      <Skeleton width="45%" height={12} />
      <Skeleton width="35%" height={30} style={{ margin: '6px 0' }} />
      <Skeleton width="70%" height={12} />
      <Skeleton width="100%" height={48} style={{ marginTop: 10 }} radius={8} />
    </div>
  );
}
