import { redirect } from 'next/navigation';

// Account moved into Settings (Profile / Security / Appearance tabs).
export default function AccountPage() {
  redirect('/settings?tab=profile');
}
