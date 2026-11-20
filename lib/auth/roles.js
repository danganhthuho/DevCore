// Roles from lowest to highest (PRD 2.2 #3: employees, managers, owners).
// A higher role can do everything a lower one can.
export const ROLES = ['Staff', 'Manager', 'Owner'];

export function hasRole(role, minimum) {
  return ROLES.indexOf(role) >= ROLES.indexOf(minimum);
}

export const isManager = (role) => hasRole(role, 'Manager');
export const isOwner = (role) => hasRole(role, 'Owner');
