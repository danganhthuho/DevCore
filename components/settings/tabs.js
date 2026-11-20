import { GearIcon, MonitorIcon, ShieldIcon, UserIcon, UsersIcon } from '@/components/Icons';

// One place for everything about you and the store. The profile menu in the
// sidebar links straight to each tab (/settings?tab=security, …).
//   Profile, Security, Appearance: everyone
//   Store: Manager and Owner      Team: Owner
export const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile', Icon: UserIcon, role: 'Staff', title: 'Profile', blurb: 'Your account details and how your name is shown.' },
  { id: 'security', label: 'Security', Icon: ShieldIcon, role: 'Staff', title: 'Security', blurb: 'Protect your sign-in.' },
  { id: 'appearance', label: 'Appearance', Icon: MonitorIcon, role: 'Staff', title: 'Appearance', blurb: 'How the app looks on this device.' },
  { id: 'store', label: 'Store', Icon: GearIcon, role: 'Manager', title: 'Store', blurb: 'Name, time zone, expiry warnings and currency for the whole store.' },
  { id: 'team', label: 'Team', Icon: UsersIcon, role: 'Owner', title: 'Team', blurb: 'Who has an account and what they can do.' },
];
