import type { AdminRole, User } from './types'

export function hasAdminAccess(user: User | null, roles: AdminRole[] = []): boolean {
  if (user?.role !== 'admin') return false
  const role = user.adminRole ?? 'super_admin'
  return role === 'super_admin' || roles.includes(role)
}

export function adminLandingPath(user: User): string {
  if (user.role !== 'admin') return '/'
  switch (user.adminRole ?? 'super_admin') {
    case 'support': return '/admin/support'
    case 'content': return '/admin/blog'
    case 'finance': return '/admin/payouts'
    default: return '/admin'
  }
}
