// src/app/api/admin/sync/sheets/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { syncEvent, syncAllActiveEvents, getSyncStatus, testSyncConfiguration } from '@/lib/sheets/sync';

/**
 * Admin endpoint for Google Sheets sync
 * 
 * POST /api/admin/sync/sheets
 * - Triggers manual sync for one or all events
 * 
 * GET /api/admin/sync/sheets?eventId=xxx
 * - Get sync status for an event
 * 
 * GET /api/admin/sync/sheets/test
 * - Test sync configuration
 */

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for large syncs

/**
 * POST - Trigger manual sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, direction = 'bidirectional', dryRun = false } = body;

    // Validate required fields
    if (!eventId && eventId !== 'all') {
      return NextResponse.json(
        { error: 'eventId is required (or use "all")' },
        { status: 400 }
      );
    }

    // Sync single event
    if (eventId !== 'all') {
      console.log(`[Admin API] Triggering sync for event ${eventId}`);

      const result = await syncEvent({
        eventId,
        direction,
        dryRun,
      });

      return NextResponse.json({
        success: result.success,
        result,
      }, { status: result.success ? 200 : 500 });
    }

    // Sync all active events
    console.log('[Admin API] Triggering sync for all active events');

    const results = await syncAllActiveEvents();
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: successCount === results.length,
      totalEvents: results.length,
      successfulEvents: successCount,
      results,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Admin API] Sync request failed:', error);

    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get sync status or test configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const test = searchParams.get('test');

    // Test configuration
    if (test === 'true') {
      console.log('[Admin API] Testing sync configuration');

      const testResult = await testSyncConfiguration();

      return NextResponse.json({
        configured: testResult.configured,
        errors: testResult.errors,
      }, { status: testResult.configured ? 200 : 500 });
    }

    // Get sync status for event
    if (eventId) {
      console.log(`[Admin API] Getting sync status for event ${eventId}`);

      const status = await getSyncStatus(eventId);

      return NextResponse.json({
        eventId,
        status,
      }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'eventId or test parameter required' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[Admin API] Status request failed:', error);

    return NextResponse.json(
      {
        error: 'Failed to get sync status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
