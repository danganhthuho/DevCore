// Nicknames: shown instead of the login email (greeting, sidebar, Team page).

export const MAX_DISPLAY_NAME = 40;

// The name to show: the nickname if set, otherwise the part of the email
// before the @ ("islandcity57@gmail.com" -> "islandcity57").
export function displayNameFor(displayName, email) {
  return displayName?.trim() || String(email ?? '').split('@')[0];
}

export function validateDisplayName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (name.length > MAX_DISPLAY_NAME) {
    return { error: `Keep it to ${MAX_DISPLAY_NAME} characters or fewer.` };
  }
  if (/[<>]/.test(name)) return { error: 'Use letters, numbers and simple punctuation.' };
  return { value: name }; // empty string clears the nickname
}
