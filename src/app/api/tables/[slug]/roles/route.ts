// =============================================================================
// Table Roles API Route
// =============================================================================
// GET    /api/tables/[slug]/roles  - List roles for this table
// POST   /api/tables/[slug]/roles  - Add a role
// DELETE /api/tables/[slug]/roles  - Remove a role
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkTablePermission } from "@/lib/permissions";
import { z } from "zod";

// =============================================================================
// Schemas
// =============================================================================

const AddRoleSchema = z.object({
  user_id: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["CO_OWNER", "CAPTAIN", "MANAGER", "STAFF"]),
  // Optional user details if creating new user
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
}).refine(
  (data) => data.user_id || data.email,
  { message: "Either user_id or email must be provided" }
);

const RemoveRoleSchema = z.object({
  user_id: z.string(),
  role: z.enum(["CO_OWNER", "CAPTAIN", "MANAGER", "STAFF"]).optional(),
});

// =============================================================================
// GET /api/tables/[slug]/roles
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Find table
    const table = await prisma.table.findFirst({
      where: { slug },
      include: {
        primary_owner: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        user_roles: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // 3. Check view permission
    const permission = await checkTablePermission(user.id, table.id, "view");
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 4. Build roles list
    const roles = [
      // Primary owner (always OWNER)
      {
        user_id: table.primary_owner_id,
        role: "OWNER" as const,
        is_primary: true,
        user: {
          id: table.primary_owner.id,
          email: table.primary_owner.email,
          first_name: table.primary_owner.first_name,
          last_name: table.primary_owner.last_name,
          full_name: [table.primary_owner.first_name, table.primary_owner.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
        created_at: table.created_at.toISOString(),
      },
      // Additional roles
      ...table.user_roles.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        is_primary: false,
        user: {
          id: r.user.id,
          email: r.user.email,
          first_name: r.user.first_name,
          last_name: r.user.last_name,
          full_name: [r.user.first_name, r.user.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
        created_at: r.created_at.toISOString(),
      })),
    ];

    return NextResponse.json({
      table_id: table.id,
      table_name: table.name,
      roles,
    });

  } catch (error) {
    console.error("Error listing table roles:", error);
    return NextResponse.json(
      { error: "Failed to list roles" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/tables/[slug]/roles
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Find table
    const table = await prisma.table.findFirst({
      where: { slug },
      include: { event: true },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // 3. Check manage_roles permission
    const permission = await checkTablePermission(user.id, table.id, "manage_roles");
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 4. Parse request body
    const body = await req.json();
    const parseResult = AddRoleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // 5. Find or create user
    let targetUser;
    if (data.user_id) {
      targetUser = await prisma.user.findUnique({
        where: { id: data.user_id },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    } else if (data.email) {
      targetUser = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (!targetUser) {
        targetUser = await prisma.user.create({
          data: {
            email: data.email.toLowerCase(),
            first_name: data.first_name,
            last_name: data.last_name,
          },
        });
      }
    }

    if (!targetUser) {
      return NextResponse.json({ error: "Could not identify user" }, { status: 400 });
    }

    // 6. Check if user already has this role
    const existingRole = await prisma.tableUserRole.findUnique({
      where: {
        table_id_user_id_role: {
          table_id: table.id,
          user_id: targetUser.id,
          role: data.role,
        },
      },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: "User already has this role" },
        { status: 409 }
      );
    }

    // 7. Create role
    const tableRole = await prisma.tableUserRole.create({
      data: {
        table_id: table.id,
        user_id: targetUser.id,
        role: data.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    // 8. Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: table.event.organization_id,
        event_id: table.event_id,
        actor_id: user.id,
        action: "TABLE_ROLE_ADDED",
        entity_type: "TABLE",
        entity_id: table.id,
        metadata: {
          target_user_id: targetUser.id,
          target_user_email: targetUser.email,
          role: data.role,
        },
      },
    });

    return NextResponse.json({
      success: true,
      role: {
        id: tableRole.id,
        user_id: tableRole.user_id,
        role: tableRole.role,
        user: {
          ...tableRole.user,
          full_name: [tableRole.user.first_name, tableRole.user.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
        created_at: tableRole.created_at.toISOString(),
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Error adding table role:", error);
    return NextResponse.json(
      { error: "Failed to add role" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/tables/[slug]/roles
// =============================================================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Find table
    const table = await prisma.table.findFirst({
      where: { slug },
      include: { event: true },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // 3. Check manage_roles permission
    const permission = await checkTablePermission(user.id, table.id, "manage_roles");
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 4. Parse request body
    const body = await req.json();
    const parseResult = RemoveRoleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // 5. Cannot remove primary owner
    if (data.user_id === table.primary_owner_id) {
      return NextResponse.json(
        { error: "Cannot remove the primary owner" },
        { status: 400 }
      );
    }

    // 6. Find and delete role(s)
    const where: any = {
      table_id: table.id,
      user_id: data.user_id,
    };

    if (data.role) {
      where.role = data.role;
    }

    const deletedRoles = await prisma.tableUserRole.findMany({ where });

    if (deletedRoles.length === 0) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    await prisma.tableUserRole.deleteMany({ where });

    // 7. Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: table.event.organization_id,
        event_id: table.event_id,
        actor_id: user.id,
        action: "TABLE_ROLE_REMOVED",
        entity_type: "TABLE",
        entity_id: table.id,
        metadata: {
          target_user_id: data.user_id,
          roles_removed: deletedRoles.map((r) => r.role),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Removed ${deletedRoles.length} role(s)`,
      removed: deletedRoles.map((r) => r.role),
    });

  } catch (error) {
    console.error("Error removing table role:", error);
    return NextResponse.json(
      { error: "Failed to remove role" },
      { status: 500 }
    );
  }
}