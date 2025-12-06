// src/lib/sheets/importer.ts

import { prisma } from '@/lib/prisma';
import { getSheetsClient } from './client';

/**
 * Import data from Google Sheets back to database
 * 
 * This module handles the Sheets → DB direction of the sync.
 * It only updates specific editable fields:
 * - Tables: table_number
 * - Guests: bidder_number, auction_registered
 * 
 * All other fields are read-only and managed by the database.
 */

const TABLES_SHEET = 'Tables';
const GUESTS_SHEET = 'Guests';

interface ImportResult {
  tablesUpdated: number;
  guestsUpdated: number;
  errors: string[];
  timestamp: Date;
}

interface TableUpdate {
  referenceCode: string;
  tableNumber: string | null;
}

interface GuestUpdate {
  referenceCode: string;
  bidderNumber: string | null;
  auctionRegistered: boolean;
}

/**
 * Import updates from Google Sheets back to the database
 */
export async function importSheetsToDatabase(eventId: string): Promise<ImportResult> {
  console.log(`[Sheets Import] Starting import for event ${eventId}`);

  const errors: string[] = [];
  let tablesUpdated = 0;
  let guestsUpdated = 0;

  try {
    // Get sheets client
    const client = getSheetsClient();

    // Read data from sheets
    const tablesData = await client.readRange(`${TABLES_SHEET}!A2:I`);
    const guestsData = await client.readRange(`${GUESTS_SHEET}!A2:H`);

    console.log(`[Sheets Import] Read ${tablesData.length} table rows, ${guestsData.length} guest rows`);

    // Parse and update tables
    const tableUpdates = parseTableUpdates(tablesData);
    tablesUpdated = await updateTables(eventId, tableUpdates, errors);

    // Parse and update guests
    const guestUpdates = parseGuestUpdates(guestsData);
    guestsUpdated = await updateGuests(eventId, guestUpdates, errors);

    console.log(`[Sheets Import] Import complete: ${tablesUpdated} tables, ${guestsUpdated} guests`);

    return {
      tablesUpdated,
      guestsUpdated,
      errors,
      timestamp: new Date(),
    };
  } catch (error: any) {
    console.error('[Sheets Import] Import failed:', error);
    errors.push(`Import failed: ${error.message}`);
    
    return {
      tablesUpdated,
      guestsUpdated,
      errors,
      timestamp: new Date(),
    };
  }
}

/**
 * Parse table updates from sheet rows
 */
function parseTableUpdates(rows: any[][]): TableUpdate[] {
  const updates: TableUpdate[] = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    // Column indices (0-based):
    // 0: Reference Code
    // 1: Table Name
    // 2: Link
    // 3: Table Number (EDITABLE)
    // 4: Type
    // 5: Status
    // 6: Capacity
    // 7: Filled
    // 8: Primary Owner

    const referenceCode = row[0]?.toString().trim();
    const tableNumber = row[3]?.toString().trim() || null;

    if (referenceCode) {
      updates.push({
        referenceCode,
        tableNumber,
      });
    }
  }

  return updates;
}

/**
 * Parse guest updates from sheet rows
 */
function parseGuestUpdates(rows: any[][]): GuestUpdate[] {
  const updates: GuestUpdate[] = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    // Column indices (0-based):
    // 0: Guest Ref
    // 1: Name
    // 2: Email
    // 3: Table Ref
    // 4: Tier
    // 5: Checked In
    // 6: Bidder # (EDITABLE)
    // 7: Auction Reg (EDITABLE)

    const referenceCode = row[0]?.toString().trim();
    const bidderNumber = row[6]?.toString().trim() || null;
    const auctionRegStr = row[7]?.toString().trim().toLowerCase();
    const auctionRegistered = auctionRegStr === 'yes' || auctionRegStr === 'true';

    if (referenceCode) {
      updates.push({
        referenceCode,
        bidderNumber,
        auctionRegistered,
      });
    }
  }

  return updates;
}

/**
 * Update tables in the database
 */
async function updateTables(
  eventId: string,
  updates: TableUpdate[],
  errors: string[]
): Promise<number> {
  let updated = 0;

  for (const update of updates) {
    try {
      // Find table by reference code
      const table = await prisma.table.findFirst({
        where: {
          event_id: eventId,
          reference_code: update.referenceCode,
        },
      });

      if (!table) {
        errors.push(`Table not found: ${update.referenceCode}`);
        continue;
      }

      // Only update if table_number has changed
      if (table.table_number !== update.tableNumber) {
        await prisma.table.update({
          where: { id: table.id },
          data: {
            table_number: update.tableNumber,
          },
        });

        console.log(`[Sheets Import] Updated table ${update.referenceCode}: table_number = ${update.tableNumber}`);
        updated++;
      }
    } catch (error: any) {
      errors.push(`Failed to update table ${update.referenceCode}: ${error.message}`);
    }
  }

  return updated;
}

/**
 * Update guests in the database
 */
async function updateGuests(
  eventId: string,
  updates: GuestUpdate[],
  errors: string[]
): Promise<number> {
  let updated = 0;

  for (const update of updates) {
    try {
      // Find guest by reference code
      // Note: reference_code is unique per organization, not per event
      // So we need to join through table to filter by event
      const guest = await prisma.guestAssignment.findFirst({
        where: {
          reference_code: update.referenceCode,
          table: {
            event_id: eventId,
          },
        },
      });

      if (!guest) {
        errors.push(`Guest not found: ${update.referenceCode}`);
        continue;
      }

      // Check if any fields have changed
      const needsUpdate =
        guest.bidder_number !== update.bidderNumber ||
        guest.auction_registered !== update.auctionRegistered;

      if (needsUpdate) {
        await prisma.guestAssignment.update({
          where: { id: guest.id },
          data: {
            bidder_number: update.bidderNumber,
            auction_registered: update.auctionRegistered,
          },
        });

        console.log(`[Sheets Import] Updated guest ${update.referenceCode}: bidder=${update.bidderNumber}, auction=${update.auctionRegistered}`);
        updated++;
      }
    } catch (error: any) {
      errors.push(`Failed to update guest ${update.referenceCode}: ${error.message}`);
    }
  }

  return updated;
}

/**
 * Validate that sheets have the expected structure
 */
export async function validateSheetStructure(): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const client = getSheetsClient();

    // Check if sheets exist
    const tablesExist = await client.sheetExists(TABLES_SHEET);
    const guestsExist = await client.sheetExists(GUESTS_SHEET);

    if (!tablesExist) {
      errors.push(`Sheet "${TABLES_SHEET}" not found`);
    }

    if (!guestsExist) {
      errors.push(`Sheet "${GUESTS_SHEET}" not found`);
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Validate headers
    const tablesHeaders = await client.readRange(`${TABLES_SHEET}!A1:I1`);
    const guestsHeaders = await client.readRange(`${GUESTS_SHEET}!A1:H1`);

    const expectedTablesHeaders = [
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

    const expectedGuestsHeaders = [
      'Guest Ref',
      'Name',
      'Email',
      'Table Ref',
      'Tier',
      'Checked In',
      'Bidder #',
      'Auction Reg',
    ];

    if (JSON.stringify(tablesHeaders[0]) !== JSON.stringify(expectedTablesHeaders)) {
      errors.push('Tables sheet headers do not match expected format');
    }

    if (JSON.stringify(guestsHeaders[0]) !== JSON.stringify(expectedGuestsHeaders)) {
      errors.push('Guests sheet headers do not match expected format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [`Validation failed: ${error.message}`],
    };
  }
}
