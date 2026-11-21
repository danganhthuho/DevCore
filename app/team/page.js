import { redirect } from 'next/navigation';

// Team moved into Settings (Team tab, Owners only).
export default function TeamPage() {
  redirect('/settings?tab=team');
}
