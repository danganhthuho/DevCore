// Tells a USB/Bluetooth barcode scanner apart from a person typing.
// Scanners "type" every character within a few milliseconds and then press
// Enter; people can't type that fast.
export const SCANNER_MAX_GAP_MS = 50;
export const SCANNER_MIN_LENGTH = 6;

// keys: [{ key, at }] in the order they were pressed (at = milliseconds).
export function isScannerBurst(keys) {
  if (keys.length < SCANNER_MIN_LENGTH) return false;
  for (let i = 1; i < keys.length; i++) {
    if (keys[i].at - keys[i - 1].at > SCANNER_MAX_GAP_MS) return false;
  }
  return true;
}
