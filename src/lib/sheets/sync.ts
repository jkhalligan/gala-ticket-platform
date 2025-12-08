// src/lib/sheets/sync.ts

import { prisma } from '@/lib/prisma';
import { exportEventToSheets } from './exporter';
import { importSheetsToDatabase, validateSheetStructure } from './importer';
import { getSheetsClient } from './client';

/**
 * Sync orchestrator for Google Sheets integration
 * 
 * Coordinates bidirectional sync:
 * 1. DB → Sheets (export): Fresh data from database
 * 2. Sheets → DB (import): Editorial changes from event staff
 * 
 * Sync is atomic per event and includes activity logging.
 */

export interface SyncResult {
  success: boolean;
  eventId: string;
  direction: 'export' | 'import' | 'bidirectional';
  tablesAffected: number;
  guestsAffected: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

export interface SyncOptions {
  eventId: string;
  direction?: 'export' | 'import' | 'bidirectional';
  dryRun?: boolean;
}

/**
 * Main sync function - performs bidirectional sync for an event
 */
export async function syncEvent(options: SyncOptions): Promise<SyncResult> {
  const {
    eventId,
    direction = 'bidirectional',
    dryRun = false,
  } = options;

  const startTime = Date.now();
  const errors: string[] = [];
  let tablesAffected = 0;
  let guestsAffected = 0;

  console.log(`[Sheets Sync] Starting ${direction} sync for event ${eventId}${dryRun ? ' (DRY RUN)' : ''}`);

  try {
    // Validate event exists and is active
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { organization: true },
    });

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    // Check if event is active
    if (!event.is_active) {
      throw new Error(`Event is not active`);
    }

    // Check if Google Sheets is configured
    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      throw new Error('Google Sheets not configured - missing environment variables');
    }

    // Validate sheet structure (only if not doing a fresh export)
    // On first export, sheets may not exist yet and will be created
    const validation = await validateSheetStructure();
    if (!validation.valid) {
      const sheetsNotFound = validation.errors.some(e => 
        e.includes('not found') || e.includes('headers do not match')
      );
      
      // If sheets don't exist and we're exporting, that's OK - export will create them
      if (sheetsNotFound && direction === 'export') {
        console.log('[Sheets Sync] Sheets not found or invalid headers - will be created during export');
      } else {
        errors.push(...validation.errors);
        throw new Error('Sheet structure validation failed');
      }
    }

    // Perform sync based on direction
    if (direction === 'export' || direction === 'bidirectional') {
      console.log('[Sheets Sync] Exporting DB → Sheets...');
      
      if (!dryRun) {
        const exportResult = await exportEventToSheets({
          eventId,
          clearExisting: true,
        });

        tablesAffected = exportResult.tablesExported;
        guestsAffected = exportResult.guestsExported;
      } else {
        console.log('[Sheets Sync] Skipping export (dry run)');
      }
    }

    if (direction === 'import' || direction === 'bidirectional') {
      console.log('[Sheets Sync] Importing Sheets → DB...');
      
      if (!dryRun) {
        const importResult = await importSheetsToDatabase(eventId);

        // If bidirectional, add to existing counts
        if (direction === 'bidirectional') {
          tablesAffected += importResult.tablesUpdated;
          guestsAffected += importResult.guestsUpdated;
        } else {
          tablesAffected = importResult.tablesUpdated;
          guestsAffected = importResult.guestsUpdated;
        }

        errors.push(...importResult.errors);
      } else {
        console.log('[Sheets Sync] Skipping import (dry run)');
      }
    }

    const duration = Date.now() - startTime;

    // Log activity
    if (!dryRun) {
      await logSyncActivity({
        eventId,
        direction,
        tablesAffected,
        guestsAffected,
        errors,
        duration,
      });
    }

    console.log(`[Sheets Sync] Sync complete in ${duration}ms`);

    return {
      success: errors.length === 0,
      eventId,
      direction,
      tablesAffected,
      guestsAffected,
      errors,
      duration,
      timestamp: new Date(),
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[Sheets Sync] Sync failed:', error);
    
    errors.push(`Sync failed: ${error.message}`);

    // Log failure
    if (!dryRun) {
      await logSyncActivity({
        eventId,
        direction,
        tablesAffected: 0,
        guestsAffected: 0,
        errors,
        duration,
      });
    }

    return {
      success: false,
      eventId,
      direction,
      tablesAffected: 0,
      guestsAffected: 0,
      errors,
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Sync all active events
 */
export async function syncAllActiveEvents(): Promise<SyncResult[]> {
  console.log('[Sheets Sync] Syncing all active events');

  // Find all active events
  const events = await prisma.event.findMany({
    where: { is_active: true },
    select: { id: true, name: true },
  });

  console.log(`[Sheets Sync] Found ${events.length} active events`);

  const results: SyncResult[] = [];

  for (const event of events) {
    console.log(`[Sheets Sync] Processing event: ${event.name}`);
    
    try {
      const result = await syncEvent({
        eventId: event.id,
        direction: 'bidirectional',
      });
      results.push(result);
    } catch (error: any) {
      console.error(`[Sheets Sync] Failed to sync event ${event.id}:`, error);
      results.push({
        success: false,
        eventId: event.id,
        direction: 'bidirectional',
        tablesAffected: 0,
        guestsAffected: 0,
        errors: [error.message],
        duration: 0,
        timestamp: new Date(),
      });
    }
  }

  const totalSuccess = results.filter(r => r.success).length;
  console.log(`[Sheets Sync] Completed: ${totalSuccess}/${results.length} successful`);

  return results;
}

/**
 * Log sync activity to ActivityLog
 */
async function logSyncActivity(params: {
  eventId: string;
  direction: string;
  tablesAffected: number;
  guestsAffected: number;
  errors: string[];
  duration: number;
}): Promise<void> {
  const { eventId, direction, tablesAffected, guestsAffected, errors, duration } = params;

  try {
    const organizationId = await getOrganizationIdFromEvent(eventId);
    
    console.log('[Sheets Sync] Creating activity log:', {
      organizationId,
      eventId,
      action: 'SHEETS_SYNC',
      direction,
    });

    await prisma.activityLog.create({
      data: {
        organization_id: organizationId,
        event_id: eventId,
        action: 'SHEETS_SYNC',
        entity_type: 'EVENT',
        entity_id: eventId,
        metadata: {
          direction,
          tablesAffected,
          guestsAffected,
          errors: errors.length > 0 ? errors : undefined,
          duration,
          success: errors.length === 0,
        },
      },
    });
    
    console.log('[Sheets Sync] Activity log created successfully');
  } catch (error: any) {
    console.error('[Sheets Sync] Failed to log activity:', error);
    console.error('[Sheets Sync] Error details:', error.message);
  }
}

/**
 * Get organization ID from event
 */
async function getOrganizationIdFromEvent(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organization_id: true },
  });

  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  return event.organization_id;
}

/**
 * Get sync status for an event
 */
export async function getSyncStatus(eventId: string): Promise<{
  lastSync: Date | null;
  lastSyncSuccess: boolean;
  spreadsheetUrl: string;
}> {
  // Get last sync activity
  const lastActivity = await prisma.activityLog.findFirst({
    where: {
      event_id: eventId,
      action: 'SHEETS_SYNC',
    },
    orderBy: { created_at: 'desc' },
  });

  const client = getSheetsClient();

  const metadata = lastActivity?.metadata as { success?: boolean } | null;

  return {
    lastSync: lastActivity?.created_at || null,
    lastSyncSuccess: metadata?.success === true,
    spreadsheetUrl: client.getSpreadsheetUrl(),
  };
}

/**
 * Test sync configuration without performing actual sync
 */
export async function testSyncConfiguration(): Promise<{
  configured: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    // Check environment variables
    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      errors.push('Missing GOOGLE_SHEETS_CLIENT_EMAIL');
    }
    if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      errors.push('Missing GOOGLE_SHEETS_PRIVATE_KEY');
    }
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      errors.push('Missing GOOGLE_SHEETS_SPREADSHEET_ID');
    }

    if (errors.length > 0) {
      return { configured: false, errors };
    }

    // Try to initialize client
    const client = getSheetsClient();
    
    // Try to read metadata
    await client.getSheetMetadata();

    console.log('[Sheets Sync] Configuration test passed');

    return { configured: true, errors: [] };
  } catch (error: any) {
    console.error('[Sheets Sync] Configuration test failed:', error);
    errors.push(`Configuration test failed: ${error.message}`);
    return { configured: false, errors };
  }
}