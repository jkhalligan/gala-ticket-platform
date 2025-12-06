// src/app/api/tables/route.ts
// =============================================================================
// Tables API - List and Create Tables
// =============================================================================
// Phase 5 Update: Added reference_code generation on table creation
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { CreateTableSchema, TableFiltersSchema } from '@/lib/validation/tables';
import { generateTableReferenceCode } from '@/lib/reference-codes';

// =============================================================================
// GET - List Tables
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filters = TableFiltersSchema.parse({
      event_id: searchParams.get('event_id') || undefined,
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
      primary_owner_id: searchParams.get('primary_owner_id') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
    });

    // Build where clause
    const where: any = {};

    if (filters.event_id) {
      where.event_id = filters.event_id;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.primary_owner_id) {
      where.primary_owner_id = filters.primary_owner_id;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { internal_name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // If not admin, only show tables user has access to
    if (!user.isAdmin) {
      where.OR = [
        { primary_owner_id: user.id },
        { user_roles: { some: { user_id: user.id } } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.table.count({ where });

    // Get tables with related data
    const tables = await prisma.table.findMany({
      where,
      include: {
        primary_owner: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            guest_assignments: true,
            orders: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });

    return NextResponse.json({
      tables,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
    console.error('List tables error:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to list tables' }, { status: 500 });
  }
}

// =============================================================================
// POST - Create Table
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = CreateTableSchema.parse(body);

    // Verify event exists and user has access
    const event = await prisma.event.findUnique({
      where: { id: data.event_id },
      select: { id: true, organization_id: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if slug is unique for this event
    const existingTable = await prisma.table.findUnique({
      where: {
        event_id_slug: {
          event_id: data.event_id,
          slug: data.slug,
        },
      },
    });

    if (existingTable) {
      return NextResponse.json(
        { error: 'A table with this slug already exists for this event' },
        { status: 409 }
      );
    }

    // Generate reference code for Sheets sync (Phase 5)
    const referenceCode = await generateTableReferenceCode(data.event_id);

    // Create the table
    const table = await prisma.table.create({
      data: {
        event_id: data.event_id,
        primary_owner_id: user.id,
        name: data.name,
        slug: data.slug,
        welcome_message: data.welcome_message,
        internal_name: data.internal_name,
        type: data.type,
        capacity: data.capacity,
        custom_total_price_cents: data.custom_total_price_cents,
        seat_price_cents: data.seat_price_cents,
        payment_status: data.payment_status || 'NOT_APPLICABLE',
        payment_notes: data.payment_notes,
        reference_code: referenceCode,  // Phase 5: reference code
      },
      include: {
        primary_owner: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Create owner role for the user
    await prisma.tableUserRole.create({
      data: {
        table_id: table.id,
        user_id: user.id,
        role: data.type === 'CAPTAIN_PAYG' ? 'CAPTAIN' : 'OWNER',
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: event.organization_id,
        event_id: event.id,
        actor_id: user.id,
        action: 'TABLE_CREATED',
        entity_type: 'TABLE',
        entity_id: table.id,
        metadata: { 
          table_name: table.name, 
          table_type: table.type,
          reference_code: referenceCode,
        },
      },
    });

    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    console.error('Create table error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
  }
}