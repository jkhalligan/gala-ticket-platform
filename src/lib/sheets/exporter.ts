// src/lib/sheets/exporter.ts

import { prisma } from '@/lib/prisma';
import { getSheetsClient } from './client';
import { TableType, TableStatus, ProductTier } from '@prisma/client';

/**
 * Export database tables and guests to Google Sheets
 * 
 * This module handles the DB → Sheets direction of the sync.
 * It exports:
 * - Tables Sheet: All tables for an event
 * - Guests Sheet: All guest assignments for an event
 */

const TABLES_SHEET = 'Tables';
const GUESTS_SHEET = 'Guests';

interface ExportOptions {
  eventId: string;
  clearExisting?: boolean;
}

interface ExportResult {
  tablesExported: number;
  guestsExported: number;
  timestamp: Date;
}

/**
 * Export all data for an event to Google Sheets
 */
export async function exportEventToSheets(
  options: ExportOptions
): Promise<ExportResult> {
  const { eventId, clearExisting = true } = options;

  console.log(`[Sheets Export] Starting export for event ${eventId}`);

  // Fetch event data
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      organization: true,
    },
  });

  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.pinkgala.org';

  // Fetch all tables with related data
  const tables = await prisma.table.findMany({
    where: { event_id: eventId },
    include: {
      primary_owner: true,
      guest_assignments: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { reference_code: 'asc' },
  });

  // Fetch all guest assignments with related data
  const guests = await prisma.guestAssignment.findMany({
    where: {
      table: {
        event_id: eventId,
      },
    },
    include: {
      user: true,
      table: true,
    },
    orderBy: { reference_code: 'asc' },
  });

  console.log(`[Sheets Export] Found ${tables.length} tables, ${guests.length} guests`);

  // Prepare tables data
  const tablesData = prepareTablesData(tables, baseUrl);
  const guestsData = prepareGuestsData(guests);

  // Get sheets client
  const client = getSheetsClient();

  // Ensure sheets exist
  await ensureSheetsExist(client);

  // Clear existing data if requested
  if (clearExisting) {
    await client.clearRange(`${TABLES_SHEET}!A2:Z`);
    await client.clearRange(`${GUESTS_SHEET}!A2:Z`);
  }

  // Write data to sheets
  await client.batchUpdate([
    {
      range: `${TABLES_SHEET}!A1:I${tablesData.length}`,
      values: tablesData,
    },
    {
      range: `${GUESTS_SHEET}!A1:H${guestsData.length}`,
      values: guestsData,
    },
  ]);

  console.log(`[Sheets Export] Export complete`);

  return {
    tablesExported: tables.length,
    guestsExported: guests.length,
    timestamp: new Date(),
  };
}

/**
 * Prepare tables data for export
 */
function prepareTablesData(tables: any[], baseUrl: string): any[][] {
  // Header row
  const headers = [
    'Reference Code',
    'Table Name',
    'Link',
    'Table Number',
    'Type',
    'Status',
    'Capacity',
    'Filled',
    'Primary Owner',
  ];

  // Data rows
  const rows = tables.map(table => {
    const filled = table.guest_assignments.length;
    const tableUrl = `${baseUrl}/tables/${table.slug}`;

    return [
      table.reference_code || '',
      table.name || '',
      tableUrl,
      table.table_number || '',
      formatTableType(table.type),
      formatTableStatus(table.status),
      table.capacity || 0,
      filled,
      table.primary_owner?.email || '',
    ];
  });

  return [headers, ...rows];
}

/**
 * Prepare guests data for export
 */
function prepareGuestsData(guests: any[]): any[][] {
  // Header row
  const headers = [
    'Guest Ref',
    'Name',
    'Email',
    'Table Ref',
    'Tier',
    'Checked In',
    'Bidder #',
    'Auction Reg',
  ];

  // Data rows
  const rows = guests.map(guest => {
    const name = guest.display_name || 
      (guest.user ? `${guest.user.first_name || ''} ${guest.user.last_name || ''}`.trim() : '');
    
    const checkedIn = guest.checked_in_at 
      ? new Date(guest.checked_in_at).toLocaleString()
      : '';

    return [
      guest.reference_code || '',
      name,
      guest.user?.email || '',
      guest.table?.reference_code || '',
      formatProductTier(guest.tier),
      checkedIn,
      guest.bidder_number || '',
      guest.auction_registered ? 'Yes' : 'No',
    ];
  });

  return [headers, ...rows];
}

/**
 * Ensure required sheets exist in the spreadsheet
 */
async function ensureSheetsExist(client: any): Promise<void> {
  const tablesExist = await client.sheetExists(TABLES_SHEET);
  const guestsExist = await client.sheetExists(GUESTS_SHEET);

  if (!tablesExist) {
    console.log(`[Sheets Export] Creating ${TABLES_SHEET} sheet`);
    await client.createSheet(TABLES_SHEET);
  }

  if (!guestsExist) {
    console.log(`[Sheets Export] Creating ${GUESTS_SHEET} sheet`);
    await client.createSheet(GUESTS_SHEET);
  }
}

/**
 * Format table type for display
 */
function formatTableType(type: TableType): string {
  switch (type) {
    case 'PREPAID':
      return 'Prepaid';
    case 'CAPTAIN_PAYG':
      return 'Captain';
    default:
      return type;
  }
}

/**
 * Format table status for display
 */
function formatTableStatus(status: TableStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'CLOSED':
      return 'Closed';
    case 'ARCHIVED':
      return 'Archived';
    default:
      return status;
  }
}

/**
 * Format product tier for display
 */
function formatProductTier(tier: ProductTier | null): string {
  if (!tier) return '';
  
  switch (tier) {
    case 'STANDARD':
      return 'Standard';
    case 'VIP':
      return 'VIP';
    case 'VVIP':
      return 'VVIP';
    default:
      return tier;
  }
}

/**
 * Export a single table to sheets (for incremental updates)
 */
export async function exportTableToSheets(tableId: string): Promise<void> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      primary_owner: true,
      guest_assignments: true,
    },
  });

  if (!table) {
    throw new Error(`Table not found: ${tableId}`);
  }

  // For now, we'll do a full export of the event
  // In the future, could optimize to update just this row
  await exportEventToSheets({ eventId: table.event_id });
}

/**
 * Export a single guest to sheets (for incremental updates)
 */
export async function exportGuestToSheets(guestId: string): Promise<void> {
  const guest = await prisma.guestAssignment.findUnique({
    where: { id: guestId },
    include: {
      table: true,
    },
  });

  if (!guest) {
    throw new Error(`Guest not found: ${guestId}`);
  }

  // For now, we'll do a full export of the event
  // In the future, could optimize to update just this row
  await exportEventToSheets({ eventId: guest.table.event_id });
}
