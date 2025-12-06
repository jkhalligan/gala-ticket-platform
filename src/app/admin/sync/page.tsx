"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Play,
  Loader2,
  FileSpreadsheet,
  ArrowUpDown,
} from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Types
interface ConfigStatus {
  configured: boolean;
  errors: string[];
}

interface SyncStatus {
  lastSync: string | null;
  lastSyncSuccess: boolean;
  spreadsheetUrl: string;
}

interface SyncLogEntry {
  id: string;
  action: string;
  createdAt: string;
  metadata: {
    direction?: string;
    tablesAffected?: number;
    guestsAffected?: number;
    success?: boolean;
    duration?: number;
    errors?: string[];
  };
}

interface Event {
  id: string;
  name: string;
}

export default function SyncPage() {
  const [configStatus, setConfigStatus] = React.useState<ConfigStatus | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(null);
  const [syncLogs, setSyncLogs] = React.useState<SyncLogEntry[]>([]);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncDirection, setSyncDirection] = React.useState<string>("bidirectional");

  // Fetch configuration status
  const fetchConfigStatus = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sync/sheets?test=true");
      if (response.ok) {
        const data = await response.json();
        setConfigStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch config status:", error);
      setConfigStatus({ configured: false, errors: ["Failed to test configuration"] });
    }
  }, []);

  // Fetch events
  const fetchEvents = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sync/events");
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        if (data.events?.length > 0 && !selectedEventId) {
          setSelectedEventId(data.events[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  }, [selectedEventId]);

  // Fetch sync status for selected event
  const fetchSyncStatus = React.useCallback(async () => {
    if (!selectedEventId) return;

    try {
      const response = await fetch(`/api/admin/sync/sheets?eventId=${selectedEventId}`);
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data.status);
      }
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
    }
  }, [selectedEventId]);

  // Fetch sync logs
  const fetchSyncLogs = React.useCallback(async () => {
    if (!selectedEventId) return;

    try {
      const response = await fetch(`/api/admin/sync/logs?eventId=${selectedEventId}`);
      if (response.ok) {
        const data = await response.json();
        setSyncLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Failed to fetch sync logs:", error);
    }
  }, [selectedEventId]);

  // Initial load
  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchConfigStatus(), fetchEvents()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchConfigStatus, fetchEvents]);

  // Load event-specific data when event changes
  React.useEffect(() => {
    if (selectedEventId) {
      fetchSyncStatus();
      fetchSyncLogs();
    }
  }, [selectedEventId, fetchSyncStatus, fetchSyncLogs]);

  // Trigger manual sync
  const handleTriggerSync = async () => {
    if (!selectedEventId) return;

    setIsSyncing(true);
    try {
      const response = await fetch("/api/admin/sync/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          direction: syncDirection,
        }),
      });

      if (response.ok) {
        // Refresh status and logs after sync
        await Promise.all([fetchSyncStatus(), fetchSyncLogs()]);
      } else {
        const error = await response.json();
        console.error("Sync failed:", error);
      }
    } catch (error) {
      console.error("Failed to trigger sync:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Google Sheets Sync"
          description="Monitor and manage bidirectional sync with Google Sheets"
        />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Sheets Sync"
        description="Monitor and manage bidirectional sync with Google Sheets"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Configuration Status
            </CardTitle>
            <CardDescription>
              Google Sheets API connection status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {configStatus ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {configStatus.configured ? (
                    <>
                      <CheckCircle className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium text-green-600">Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Google Sheets API is properly configured
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-8 w-8 text-destructive" />
                      <div>
                        <p className="font-medium text-destructive">Not Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Configuration errors detected
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {configStatus.errors.length > 0 && (
                  <div className="rounded-md bg-destructive/10 p-3">
                    <p className="text-sm font-medium text-destructive mb-1">Errors:</p>
                    <ul className="text-sm text-destructive space-y-1">
                      {configStatus.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {configStatus.configured && syncStatus?.spreadsheetUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={syncStatus.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Spreadsheet
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Loading configuration status...</p>
            )}
          </CardContent>
        </Card>

        {/* Last Sync Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Last Sync
            </CardTitle>
            <CardDescription>
              Most recent synchronization status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Event Selector */}
              {events.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Event</label>
                  <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {syncStatus?.lastSync ? (
                <div className="flex items-center gap-3">
                  {syncStatus.lastSyncSuccess ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-yellow-600" />
                  )}
                  <div>
                    <p className="font-medium">
                      {syncStatus.lastSyncSuccess ? "Successful" : "Completed with errors"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(syncStatus.lastSync), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">No sync history</p>
                    <p className="text-sm text-muted-foreground">
                      This event has never been synced
                    </p>
                  </div>
                </div>
              )}

              {/* Sync Controls */}
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Sync Direction</label>
                </div>
                <Select value={syncDirection} onValueChange={setSyncDirection}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bidirectional">Bidirectional (Recommended)</SelectItem>
                    <SelectItem value="export">Export Only (DB → Sheets)</SelectItem>
                    <SelectItem value="import">Import Only (Sheets → DB)</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleTriggerSync}
                  disabled={isSyncing || !configStatus?.configured || !selectedEventId}
                  className="w-full"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Trigger Manual Sync
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync History/Logs Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync History
          </CardTitle>
          <CardDescription>
            Recent synchronization activity logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncLogs.length > 0 ? (
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  {log.metadata?.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {log.metadata?.direction === "export"
                          ? "Export"
                          : log.metadata?.direction === "import"
                          ? "Import"
                          : "Bidirectional"}{" "}
                        Sync
                      </span>
                      <Badge variant={log.metadata?.success ? "default" : "destructive"}>
                        {log.metadata?.success ? "Success" : "Failed"}
                      </Badge>
                      {log.metadata?.duration && (
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(log.metadata.duration)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm:ss a")}
                    </p>
                    {(log.metadata?.tablesAffected !== undefined ||
                      log.metadata?.guestsAffected !== undefined) && (
                      <p className="text-sm text-muted-foreground">
                        {log.metadata.tablesAffected} tables, {log.metadata.guestsAffected} guests
                        affected
                      </p>
                    )}
                    {log.metadata?.errors && log.metadata.errors.length > 0 && (
                      <div className="mt-2 text-sm text-destructive">
                        {log.metadata.errors.map((error, index) => (
                          <p key={index}>• {error}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No sync history available</p>
              <p className="text-sm text-muted-foreground">
                Sync logs will appear here after your first synchronization
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
