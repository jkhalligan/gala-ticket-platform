// src/lib/permissions.ts
// Permission checking utilities for table and guest operations

import { prisma } from './prisma';
import type { TableRole, TableType } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export type TableAction = 
  | 'view'
  | 'edit'
  | 'delete'
  | 'add_guest'
  | 'remove_guest'
  | 'edit_guest'
  | 'reassign_guest'
  | 'manage_roles';

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

export interface TableContext {
  tableId: string;
  tableType: TableType;
  primaryOwnerId: string;
}

// =============================================================================
// ROLE HIERARCHY
// =============================================================================

const ROLE_HIERARCHY: Record<TableRole, number> = {
  OWNER: 100,
  CO_OWNER: 90,
  CAPTAIN: 80,
  MANAGER: 70,
  STAFF: 60,
};

/**
 * Check if role1 is equal to or higher than role2
 */
export function hasRoleOrHigher(userRole: TableRole, requiredRole: TableRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// =============================================================================
// PERMISSION MATRIX
// =============================================================================

/**
 * Permission matrix based on table type and role
 * 
 * | Table Type   | Actor        | Add Guest | Remove Guest    | Edit Guest |
 * |--------------|--------------|-----------|-----------------|------------|
 * | PREPAID      | Owner/Co     | ✅        | ✅              | ✅         |
 * | PREPAID      | Manager      | ✅        | ✅              | ✅         |
 * | CAPTAIN_PAYG | Captain      | ✅        | ⚠️ Own only     | ✅         |
 * | Any          | Admin        | ✅        | ✅              | ✅         |
 */

// =============================================================================
// CORE PERMISSION FUNCTIONS
// =============================================================================

/**
 * Get user's role for a specific table
 */
export async function getUserTableRole(
  userId: string,
  tableId: string
): Promise<TableRole | null> {
  const role = await prisma.tableUserRole.findFirst({
    where: {
      user_id: userId,
      table_id: tableId,
    },
    orderBy: {
      // Get highest role if multiple
      role: 'asc', // OWNER sorts before others
    },
  });

  return role?.role ?? null;
}

/**
 * Check if user is a super admin or organization admin
 */
export async function isUserAdmin(
  userId: string,
  organizationId?: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization_admins: organizationId
        ? { where: { organization_id: organizationId } }
        : true,
    },
  });

  return user?.is_super_admin || (user?.organization_admins.length ?? 0) > 0;
}

/**
 * Get full table context for permission checking
 */
export async function getTableContext(tableId: string): Promise<TableContext | null> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: {
      id: true,
      type: true,
      primary_owner_id: true,
    },
  });

  if (!table) return null;

  return {
    tableId: table.id,
    tableType: table.type,
    primaryOwnerId: table.primary_owner_id,
  };
}

// =============================================================================
// ACTION-SPECIFIC PERMISSIONS
// =============================================================================

/**
 * Check if user can perform an action on a table
 */
export async function checkTablePermission(
  userId: string,
  tableId: string,
  action: TableAction
): Promise<PermissionResult> {
  // First check if user is admin
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      event: {
        select: { organization_id: true },
      },
    },
  });

  if (!table) {
    return { allowed: false, reason: 'Table not found' };
  }

  const isAdmin = await isUserAdmin(userId, table.event.organization_id);
  if (isAdmin) {
    return { allowed: true };
  }

  // Get user's role for this table
  const userRole = await getUserTableRole(userId, tableId);
  
  // Check if user is primary owner (always has full access)
  const isPrimaryOwner = table.primary_owner_id === userId;

  switch (action) {
    case 'view':
      // Anyone with a role can view
      return userRole || isPrimaryOwner
        ? { allowed: true }
        : { allowed: false, reason: 'No access to this table' };

    case 'edit':
      // Owner, Co-owner, or Manager can edit table details
      if (isPrimaryOwner) return { allowed: true };
      if (userRole && hasRoleOrHigher(userRole, 'MANAGER')) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Insufficient permissions to edit table' };

    case 'delete':
      // Only owner can delete
      if (isPrimaryOwner) return { allowed: true };
      if (userRole === 'OWNER') return { allowed: true };
      return { allowed: false, reason: 'Only table owner can delete' };

    case 'add_guest':
      // Owner, Co-owner, Captain, Manager can add guests
      if (isPrimaryOwner) return { allowed: true };
      if (userRole && hasRoleOrHigher(userRole, 'MANAGER')) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Insufficient permissions to add guests' };

    case 'remove_guest':
      // Complex rules - handled separately
      return { allowed: false, reason: 'Use checkRemoveGuestPermission instead' };

    case 'edit_guest':
      // Owner, Co-owner, Captain, Manager can edit guests
      if (isPrimaryOwner) return { allowed: true };
      if (userRole && hasRoleOrHigher(userRole, 'MANAGER')) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Insufficient permissions to edit guests' };

    case 'reassign_guest':
      // Admin only (checked above)
      return { allowed: false, reason: 'Only admins can reassign guests between tables' };

    case 'manage_roles':
      // Only owner can manage roles
      if (isPrimaryOwner) return { allowed: true };
      if (userRole === 'OWNER') return { allowed: true };
      return { allowed: false, reason: 'Only table owner can manage roles' };

    default:
      return { allowed: false, reason: 'Unknown action' };
  }
}

/**
 * Special permission check for removing guests
 * CAPTAIN_PAYG tables: Captain cannot remove self-paying guests
 */
export async function checkRemoveGuestPermission(
  userId: string,
  guestAssignmentId: string
): Promise<PermissionResult> {
  const guest = await prisma.guestAssignment.findUnique({
    where: { id: guestAssignmentId },
    include: {
      table: {
        include: {
          event: { select: { organization_id: true } },
        },
      },
      order: {
        select: { user_id: true },
      },
    },
  });

  if (!guest) {
    return { allowed: false, reason: 'Guest assignment not found' };
  }

  if (!guest.table) {
    return { allowed: false, reason: 'Guest is not assigned to a table' };
  }

  // Admins can always remove
  const isAdmin = await isUserAdmin(userId, guest.table.event.organization_id);
  if (isAdmin) {
    return { allowed: true };
  }

  // Get user's role
  const userRole = await getUserTableRole(userId, guest.table.id);
  const isPrimaryOwner = guest.table.primary_owner_id === userId;

  // PREPAID tables: Owner/Co-owner/Manager can remove anyone
  if (guest.table.type === 'PREPAID') {
    if (isPrimaryOwner || (userRole && hasRoleOrHigher(userRole, 'MANAGER'))) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Insufficient permissions' };
  }

  // CAPTAIN_PAYG tables: More complex rules
  if (guest.table.type === 'CAPTAIN_PAYG') {
    // Check if this guest paid for themselves
    const guestPaidSelf = guest.order.user_id === guest.user_id;

    if (isPrimaryOwner || userRole === 'CAPTAIN') {
      if (guestPaidSelf) {
        // Cannot remove self-paying guests
        return { 
          allowed: false, 
          reason: 'Cannot remove self-paying guests from captain tables' 
        };
      }
      // Can remove guests that were assigned by others
      return { allowed: true };
    }

    // Managers can also remove non-self-paying guests
    if (userRole && hasRoleOrHigher(userRole, 'MANAGER')) {
      if (guestPaidSelf) {
        return { 
          allowed: false, 
          reason: 'Cannot remove self-paying guests from captain tables' 
        };
      }
      return { allowed: true };
    }
  }

  return { allowed: false, reason: 'Insufficient permissions' };
}

/**
 * Check if user can access a guest assignment
 */
export async function checkGuestViewPermission(
  userId: string,
  guestAssignmentId: string
): Promise<PermissionResult> {
  const guest = await prisma.guestAssignment.findUnique({
    where: { id: guestAssignmentId },
    include: {
      table: {
        include: {
          event: { select: { organization_id: true } },
        },
      },
    },
  });

  if (!guest) {
    return { allowed: false, reason: 'Guest assignment not found' };
  }

  // User can always view their own assignment
  if (guest.user_id === userId) {
    return { allowed: true };
  }

  // Admins can view all
  if (guest.table) {
    const isAdmin = await isUserAdmin(userId, guest.table.event.organization_id);
    if (isAdmin) return { allowed: true };
  }

  // Table roles can view
  if (guest.table_id) {
    const userRole = await getUserTableRole(userId, guest.table_id);
    if (userRole) return { allowed: true };
  }

  return { allowed: false, reason: 'No access to this guest' };
}

/**
 * Check if user can edit their own guest info
 */
export async function checkSelfEditPermission(
  userId: string,
  guestAssignmentId: string
): Promise<PermissionResult> {
  const guest = await prisma.guestAssignment.findUnique({
    where: { id: guestAssignmentId },
  });

  if (!guest) {
    return { allowed: false, reason: 'Guest assignment not found' };
  }

  if (guest.user_id === userId) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Can only edit your own information' };
}
