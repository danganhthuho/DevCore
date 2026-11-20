// DevCore logo. Images live in public/brand/:
//   devcore-logo.png        black lettering, for light backgrounds
//   devcore-logo-white.png  white lettering, for dark backgrounds
//   devcore-mark.png        the "D•" square, for tight spaces (phone top bar, collapsed sidebar)
// tone="auto" follows the theme (both images are in the page and CSS shows
// the right one, so the Light/Dark switch on the Account page works too);
// tone="white" is for coloured panels.
export default function Brand({ tone = 'auto', height = 28, compactOnPhone = false }) {
  const width = Math.round(height * (1414 / 361)); // keep the image's proportions

  return (
    <span className={`brand-logo${compactOnPhone ? ' compact-on-phone' : ''}`}>
      <span className="wordmark">
        {tone === 'white' ? (
          <img src="/brand/devcore-logo-white.png" alt="DevCore" width={width} height={height} />
        ) : (
          <>
            <img className="logo-for-light" src="/brand/devcore-logo.png" alt="DevCore" width={width} height={height} />
            <img className="logo-for-dark" src="/brand/devcore-logo-white.png" alt="" aria-hidden="true" width={width} height={height} />
          </>
        )}
      </span>
      {compactOnPhone && <img className="mark" src="/brand/devcore-mark.png" alt="DevCore" width={height + 4} height={height + 4} />}
    </span>
  );
}
