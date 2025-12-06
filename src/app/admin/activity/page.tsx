"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
  User,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable, DataTableColumnHeader } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

// Activity action types from schema
const ACTION_TYPES = [
  // Guest actions
  "GUEST_ADDED",
  "GUEST_REMOVED",
  "GUEST_UPDATED",
  "GUEST_REASSIGNED",
  "GUEST_CHECKED_IN",
  "TICKET_TRANSFERRED",
  // Table actions
  "TABLE_CREATED",
  "TABLE_UPDATED",
  "TABLE_DELETED",
  "TABLE_ROLE_ADDED",
  "TABLE_ROLE_REMOVED",
  // Order actions
  "ORDER_CREATED",
  "ORDER_COMPLETED",
  "ORDER_REFUNDED",
  "ORDER_CANCELLED",
  "ORDER_INVITED",
  "ORDER_EXPIRED",
  // User actions
  "USER_CREATED",
  "USER_UPDATED",
  "USER_LOGIN",
  // Admin actions
  "ADMIN_OVERRIDE",
  "SHEETS_SYNC",
  "WAITLIST_CONVERTED",
] as const;

type ActionType = (typeof ACTION_TYPES)[number];

// Activity log entry type
interface ActivityLogEntry {
  id: string;
  actorName: string | null;
  actorEmail: string | null;
  action: ActionType;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  eventName: string | null;
}

// Action category colors
function getActionCategory(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.includes("REMOVED") || action.includes("DELETED") || action.includes("CANCELLED") || action.includes("EXPIRED")) {
    return "destructive";
  }
  if (action.includes("CREATED") || action.includes("ADDED") || action.includes("COMPLETED")) {
    return "default";
  }
  if (action.includes("UPDATED") || action.includes("REASSIGNED") || action.includes("TRANSFERRED")) {
    return "secondary";
  }
  return "outline";
}

// Format action for display
function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Expandable row component
function ExpandableMetadata({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No additional details</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Details:</p>
      <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-w-full">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </div>
  );
}

export default function ActivityPage() {
  const [logs, setLogs] = React.useState<ActivityLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = React.useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  // Filter state
  const [actionFilter, setActionFilter] = React.useState<string>("all");
  const [actorFilter, setActorFilter] = React.useState<string>("");
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");

  // Unique actors for filter dropdown
  const [actors, setActors] = React.useState<{ id: string; name: string; email: string }[]>([]);

  // Toggle row expansion
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Fetch activity logs
  React.useEffect(() => {
    async function fetchLogs() {
      try {
        const response = await fetch("/api/admin/activity");
        if (response.ok) {
          const data = await response.json();
          setLogs(data.logs || []);
          setFilteredLogs(data.logs || []);

          // Extract unique actors
          const actorMap = new Map<string, { id: string; name: string; email: string }>();
          for (const log of data.logs || []) {
            if (log.actorEmail && !actorMap.has(log.actorEmail)) {
              actorMap.set(log.actorEmail, {
                id: log.actorEmail,
                name: log.actorName || log.actorEmail,
                email: log.actorEmail,
              });
            }
          }
          setActors(Array.from(actorMap.values()));
        }
      } catch (error) {
        console.error("Failed to fetch activity logs:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLogs();
  }, []);

  // Apply filters
  React.useEffect(() => {
    let result = [...logs];

    // Action type filter
    if (actionFilter !== "all") {
      result = result.filter((log) => log.action === actionFilter);
    }

    // Actor filter
    if (actorFilter) {
      result = result.filter((log) => log.actorEmail === actorFilter);
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter((log) => new Date(log.createdAt) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((log) => new Date(log.createdAt) <= toDate);
    }

    setFilteredLogs(result);
  }, [logs, actionFilter, actorFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setActionFilter("all");
    setActorFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = actionFilter !== "all" || actorFilter || dateFrom || dateTo;

  // Column definitions
  const columns: ColumnDef<ActivityLogEntry>[] = [
    {
      id: "expander",
      header: () => null,
      cell: ({ row }) => {
        const hasMetadata = row.original.metadata && Object.keys(row.original.metadata).length > 0;
        const isExpanded = expandedRows.has(row.original.id);

        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => toggleRow(row.original.id)}
            disabled={!hasMetadata}
          >
            {hasMetadata ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <span className="h-4 w-4" />
            )}
          </Button>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "actorName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Actor" />
      ),
      cell: ({ row }) => {
        const name = row.original.actorName;
        const email = row.original.actorEmail;

        if (!name && !email) {
          return <span className="text-muted-foreground italic">System</span>;
        }

        return (
          <div className="flex flex-col">
            <span className="font-medium">{name || "Unknown"}</span>
            {email && (
              <span className="text-xs text-muted-foreground">{email}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "action",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Action" />
      ),
      cell: ({ row }) => {
        const action = row.getValue("action") as string;
        return (
          <Badge variant={getActionCategory(action)}>
            {formatAction(action)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "entityType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Entity" />
      ),
      cell: ({ row }) => {
        const entityType = row.getValue("entityType") as string;
        const entityLabel = row.original.entityLabel;
        const entityId = row.original.entityId;

        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {entityType.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {entityLabel || entityId}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Timestamp" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt") as string);
        return (
          <div className="flex flex-col">
            <span>{format(date, "MMM d, yyyy")}</span>
            <span className="text-xs text-muted-foreground">
              {format(date, "h:mm:ss a")}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "eventName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Event" />
      ),
      cell: ({ row }) => {
        const eventName = row.getValue("eventName") as string | null;
        return eventName ? (
          <span className="text-sm">{eventName}</span>
        ) : (
          <span className="text-muted-foreground italic">Organization-wide</span>
        );
      },
    },
  ];

  // Custom row rendering to support expansion
  const tableData = filteredLogs.map((log) => ({
    ...log,
    _isExpanded: expandedRows.has(log.id),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Audit trail of all actions in the system"
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>

            {/* Action Type Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Action Type
              </label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {ACTION_TYPES.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actor Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Actor
              </label>
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All users</SelectItem>
                  {actors.map((actor) => (
                    <SelectItem key={actor.id} value={actor.email}>
                      {actor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                From Date
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                To Date
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <div className="space-y-0">
        <DataTable
          columns={columns}
          data={tableData}
          searchKey="actorName"
          searchPlaceholder="Search by actor..."
          isLoading={isLoading}
          emptyMessage="No activity logs found."
          pageSize={20}
        />

        {/* Expanded row details */}
        {filteredLogs.map((log) =>
          expandedRows.has(log.id) ? (
            <div
              key={`expanded-${log.id}`}
              className="border-x border-b rounded-b-md bg-muted/30 p-4 -mt-px"
            >
              <ExpandableMetadata metadata={log.metadata} />
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
