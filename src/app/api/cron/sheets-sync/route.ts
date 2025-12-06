// src/app/api/cron/sheets-sync/route.ts

import { NextResponse } from 'next/server';
import { syncAllActiveEvents } from '@/lib/sheets/sync';

/**
 * Cron endpoint for scheduled Google Sheets sync
 * 
 * This endpoint should be configured in vercel.json to run on a schedule.
 * 
 * Example vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sheets-sync",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 * 
 * The schedule "0 * * * *" means every hour at minute 0.
 * Adjust as needed:
 * - "*/15 * * * *" = every 15 minutes
 * - "0 */2 * * *" = every 2 hours
 * - "0 9-17 * * *" = every hour from 9am-5pm
 */

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds

export async function GET() {
  try {
    console.log('[Cron] Starting scheduled sheets sync');

    // Sync all active events
    const results = await syncAllActiveEvents();

    const successCount = results.filter(r => r.success).length;
    const totalTables = results.reduce((sum, r) => sum + r.tablesAffected, 0);
    const totalGuests = results.reduce((sum, r) => sum + r.guestsAffected, 0);

    console.log(`[Cron] Sync complete: ${successCount}/${results.length} events successful`);
    console.log(`[Cron] Total: ${totalTables} tables, ${totalGuests} guests`);

    return NextResponse.json({
      success: successCount === results.length,
      timestamp: new Date().toISOString(),
      summary: {
        totalEvents: results.length,
        successfulEvents: successCount,
        failedEvents: results.length - successCount,
        totalTables,
        totalGuests,
      },
      results,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Cron] Scheduled sync failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Scheduled sync failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// POST handler for manual testing
export async function POST() {
  return GET();
}
