// =============================================================================
// Permissions Library - Phase 4 Enhanced Version
// =============================================================================
// Comprehensive permission checking for table and guest operations
// Implements the permission matrix from the design docs
// =============================================================================

import { prisma } from "./prisma";

// =============================================================================
// Types
// =============================================================================

export type TableAction =
  | "view"
  | "edit"
  | "add_guest"
  | "remove_guest"
  | "edit_guest"
  | "manage_roles"
  | "delete";

export type TableRole = "OWNER" | "CO_OWNER" | "CAPTAIN" | "MANAGER" | "STAFF";

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  role?: TableRole | "ADMIN" | null;
}

export interface TablePermissionContext {
  tableId: string;
  tableType: "PREPAID" | "CAPTAIN_PAYG";
  primaryOwnerId: string;
}

export interface GuestRemovalContext {
  guestAssignmentId: string;
  guestUserId: string;
  guestOrderId: string;
  tableId: string;
  tableType: "PREPAID" | "CAPTAIN_PAYG";
}

// =============================================================================
// Permission Matrix
// =============================================================================
// 
// | Table Type    | Actor        | View | Edit | Add Guest | Remove Guest | Edit Guest | Manage Roles |
// |---------------|--------------|------|------|-----------|--------------|------------|--------------|
// | PREPAID       | Owner        | ✅   | ✅   | ✅        | ✅           | ✅         | ✅           |
// | PREPAID       | Co-owner     | ✅   | ✅   | ✅        | ✅           | ✅         | ❌           |
// | PREPAID       | Manager      | ✅   | ✅   | ✅        | ✅           | ✅         | ❌           |
// | PREPAID       | Staff        | ✅   | ❌   | ❌        | ❌           | ✅         | ❌           |
// | CAPTAIN_PAYG  | Captain      | ✅   | ✅   | ✅        | ⚠️ Own only  | ✅         | ❌           |
// | CAPTAIN_PAYG  | Co-owner     | ✅   | ✅   | ✅        | ⚠️ Own only  | ✅         | ❌           |
// | Any           | Admin        | ✅   | ✅   | ✅        | ✅           | ✅         | ✅           |
// | Any           | Guest (self) | ✅   | ❌   | ❌        | ❌           | ✅ (self)  | ❌           |
//
// =============================================================================

const ROLE_PERMISSIONS: Record<TableRole, Record<TableAction, boolean>> = {
  OWNER: {
    view: true,
    edit: true,
    add_guest: true,
    remove_guest: true,
    edit_guest: true,
    manage_roles: true,
    delete: true,
  },
  CO_OWNER: {
    view: true,
    edit: true,
    add_guest: true,
    remove_guest: true,
    edit_guest: true,
    manage_roles: false,
    delete: false,
  },
  CAPTAIN: {
    view: true,
    edit: true,
    add_guest: true,
    remove_guest: true, // Special handling for CAPTAIN_PAYG
    edit_guest: true,
    manage_roles: false,
    delete: false,
  },
  MANAGER: {
    view: true,
    edit: true,
    add_guest: true,
    remove_guest: true,
    edit_guest: true,
    manage_roles: false,
    delete: false,
  },
  STAFF: {
    view: true,
    edit: false,
    add_guest: false,
    remove_guest: false,
    edit_guest: true,
    manage_roles: false,
    delete: false,
  },
};

// =============================================================================
// Core Permission Functions
// =============================================================================

/**
 * Get user's role for a specific table
 */
export async function getUserTableRole(
  userId: string,
  tableId: string
): Promise<TableRole | null> {
  // Check if user is the primary owner
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { primary_owner_id: true },
  });

  if (table?.primary_owner_id === userId) {
    return "OWNER";
  }

  // Check TableUserRole
  const tableRole = await prisma.tableUserRole.findFirst({
    where: { table_id: tableId, user_id: userId },
    select: { role: true },
  });

  return (tableRole?.role as TableRole) || null;
}

/**
 * Check if user is an organization admin
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
 * Check if user has permission to perform action on table
 */
export async function checkTablePermission(
  userId: string,
  tableId: string,
  action: TableAction
): Promise<PermissionResult> {
  // 1. Get table details
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      event: { select: { organization_id: true } },
    },
  });

  if (!table) {
    return { allowed: false, reason: "Table not found" };
  }

  // 2. Check if user is admin
  const isAdmin = await isUserAdmin(userId, table.event.organization_id);
  if (isAdmin) {
    return { allowed: true, role: "ADMIN" };
  }

  // 3. Get user's table role
  const role = await getUserTableRole(userId, tableId);

  if (!role) {
    // Check if user is a guest at this table (can view only)
    const isGuest = await prisma.guestAssignment.findFirst({
      where: { table_id: tableId, user_id: userId },
    });

    if (isGuest && action === "view") {
      return { allowed: true, role: null };
    }

    return { allowed: false, reason: "No permission for this table" };
  }

  // 4. Check role permissions
  const hasPermission = ROLE_PERMISSIONS[role]?.[action] ?? false;

  if (!hasPermission) {
    return { allowed: false, reason: `${role} cannot ${action.replace("_", " ")}`, role };
  }

  return { allowed: true, role };
}

/**
 * Special permission check for removing a guest
 * Handles CAPTAIN_PAYG rule: captains cannot remove self-paying guests
 */
export async function checkRemoveGuestPermission(
  userId: string,
  guestAssignmentId: string
): Promise<PermissionResult> {
  // 1. Get guest assignment with related data
  const guest = await prisma.guestAssignment.findUnique({
    where: { id: guestAssignmentId },
    include: {
      table: {
        include: {
          event: { select: { organization_id: true } },
        },
      },
      order: { select: { user_id: true } },
    },
  });

  if (!guest) {
    return { allowed: false, reason: "Guest not found" };
  }

  if (!guest.table) {
    return { allowed: false, reason: "Guest is not assigned to a table" };
  }

  // 2. Check if user is admin
  const isAdmin = await isUserAdmin(userId, guest.table.event.organization_id);
  if (isAdmin) {
    return { allowed: true, role: "ADMIN" };
  }

  // 3. Get user's table role
  const role = await getUserTableRole(userId, guest.table_id!);

  if (!role) {
    return { allowed: false, reason: "No permission for this table" };
  }

  // 4. PREPAID tables: role-based permission only
  if (guest.table.type === "PREPAID") {
    const hasPermission = ROLE_PERMISSIONS[role]?.remove_guest ?? false;
    if (!hasPermission) {
      return { allowed: false, reason: `${role} cannot remove guests`, role };
    }
    return { allowed: true, role };
  }

  // 5. CAPTAIN_PAYG tables: special rules
  if (guest.table.type === "CAPTAIN_PAYG") {
    // Check if this guest paid for themselves
    const guestPaidForSelf = guest.order.user_id === guest.user_id;

    if (guestPaidForSelf) {
      // Self-paying guests can only be removed by:
      // - The guest themselves
      // - Admin
      if (guest.user_id === userId) {
        return { allowed: true, role };
      }
      return {
        allowed: false,
        reason: "Cannot remove self-paying guests from captain tables",
        role,
      };
    }

    // Non-self-paying guests can be removed by captain/managers
    const hasPermission = ROLE_PERMISSIONS[role]?.remove_guest ?? false;
    if (!hasPermission) {
      return { allowed: false, reason: `${role} cannot remove guests`, role };
    }
    return { allowed: true, role };
  }

  return { allowed: false, reason: "Unknown table type" };
}

/**
 * Check if user can edit a specific guest
 */
export async function checkEditGuestPermission(
  userId: string,
  guestAssignmentId: string
): Promise<PermissionResult> {
  // 1. Get guest assignment
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
    return { allowed: false, reason: "Guest not found" };
  }

  // 2. User can always edit their own guest assignment
  if (guest.user_id === userId) {
    return { allowed: true, role: null };
  }

  // 3. Check if user is admin
  if (guest.table) {
    const isAdmin = await isUserAdmin(userId, guest.table.event.organization_id);
    if (isAdmin) {
      return { allowed: true, role: "ADMIN" };
    }

    // 4. Check table role permission
    const role = await getUserTableRole(userId, guest.table_id!);
    if (role && ROLE_PERMISSIONS[role]?.edit_guest) {
      return { allowed: true, role };
    }
  }

  return { allowed: false, reason: "No permission to edit this guest" };
}

/**
 * Check if user can view a specific guest
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
    return { allowed: false, reason: "Guest not found" };
  }

  // User can view their own assignment
  if (guest.user_id === userId) {
    return { allowed: true, role: null };
  }

  // Check admin
  if (guest.table) {
    const isAdmin = await isUserAdmin(userId, guest.table.event.organization_id);
    if (isAdmin) {
      return { allowed: true, role: "ADMIN" };
    }

    // Check table role
    const role = await getUserTableRole(userId, guest.table_id!);
    if (role) {
      return { allowed: true, role };
    }

    // Check if viewer is also a guest at the same table
    const isTableGuest = await prisma.guestAssignment.findFirst({
      where: { table_id: guest.table_id, user_id: userId },
    });
    if (isTableGuest) {
      return { allowed: true, role: null };
    }
  }

  return { allowed: false, reason: "No permission to view this guest" };
}

/**
 * Check if user can transfer a ticket
 */
export async function checkTicketTransferPermission(
  userId: string,
  guestAssignmentId: string
): Promise<PermissionResult> {
  const guest = await prisma.guestAssignment.findUnique({
    where: { id: guestAssignmentId },
    include: {
      order: { select: { user_id: true } },
      table: {
        include: {
          event: { select: { organization_id: true } },
        },
      },
    },
  });

  if (!guest) {
    return { allowed: false, reason: "Guest not found" };
  }

  // Check if user is admin
  if (guest.table) {
    const isAdmin = await isUserAdmin(userId, guest.table.event.organization_id);
    if (isAdmin) {
      return { allowed: true, role: "ADMIN" };
    }
  }

  // User can transfer if they are the one assigned to the seat
  if (guest.user_id === userId) {
    return { allowed: true, role: null };
  }

  // Order owner can transfer seats from their order
  if (guest.order.user_id === userId) {
    return { allowed: true, role: null };
  }

  // Table owner/co-owner can transfer for PREPAID tables
  if (guest.table && guest.table.type === "PREPAID") {
    const role = await getUserTableRole(userId, guest.table_id!);
    if (role === "OWNER" || role === "CO_OWNER") {
      return { allowed: true, role };
    }
  }

  return { allowed: false, reason: "No permission to transfer this ticket" };
}

// =============================================================================
// Bulk Permission Checks
// =============================================================================

/**
 * Get all permissions for a user on a table
 */
export async function getTablePermissions(
  userId: string,
  tableId: string
): Promise<{
  role: TableRole | "ADMIN" | null;
  permissions: Record<TableAction, boolean>;
}> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      event: { select: { organization_id: true } },
    },
  });

  if (!table) {
    return {
      role: null,
      permissions: {
        view: false,
        edit: false,
        add_guest: false,
        remove_guest: false,
        edit_guest: false,
        manage_roles: false,
        delete: false,
      },
    };
  }

  // Check admin
  const isAdmin = await isUserAdmin(userId, table.event.organization_id);
  if (isAdmin) {
    return {
      role: "ADMIN",
      permissions: {
        view: true,
        edit: true,
        add_guest: true,
        remove_guest: true,
        edit_guest: true,
        manage_roles: true,
        delete: true,
      },
    };
  }

  // Get role
  const role = await getUserTableRole(userId, tableId);

  if (!role) {
    // Check if guest
    const isGuest = await prisma.guestAssignment.findFirst({
      where: { table_id: tableId, user_id: userId },
    });

    return {
      role: null,
      permissions: {
        view: !!isGuest,
        edit: false,
        add_guest: false,
        remove_guest: false,
        edit_guest: !!isGuest, // Can edit own info
        manage_roles: false,
        delete: false,
      },
    };
  }

  return {
    role,
    permissions: ROLE_PERMISSIONS[role],
  };
}