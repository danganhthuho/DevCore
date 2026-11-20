// DevCore logo. Images live in public/brand/:
//   devcore-logo.png        black lettering, for light backgrounds
//   devcore-logo-white.png  white lettering, for dark backgrounds
//   devcore-mark.png        the "D•" square, for tight spaces (phone top bar)
// tone="auto" follows the light/dark setting; tone="white" is for coloured panels.
export default function Brand({ tone = 'auto', height = 28, compactOnPhone = false }) {
  const width = Math.round(height * (1414 / 361)); // keep the image's proportions

  return (
    <span className={`brand-logo${compactOnPhone ? ' compact-on-phone' : ''}`}>
      <picture className="wordmark">
        {tone === 'auto' && <source srcSet="/brand/devcore-logo-white.png" media="(prefers-color-scheme: dark)" />}
        <img
          src={tone === 'white' ? '/brand/devcore-logo-white.png' : '/brand/devcore-logo.png'}
          alt="DevCore" width={width} height={height} />
      </picture>
      {compactOnPhone && <img className="mark" src="/brand/devcore-mark.png" alt="DevCore" width={height + 4} height={height + 4} />}
    </span>
  );
}
