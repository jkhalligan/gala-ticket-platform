"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Eye, Pencil, ArrowRightLeft, CheckCircle, XCircle, Maximize2, Users } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable, DataTableColumnHeader } from "@/components/admin/data-table";
import { GuestQuickView } from "@/components/admin/quick-view";
import { TableAssignmentCell } from "@/components/admin/table-assignment-cell";
import { BulkAssignGuestsDialog } from "@/components/admin/bulk-assign-guests-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Guest data type matching what we'll fetch from the API
interface GuestData {
  id: string;
  name: string;
  email: string;
  tier: "STANDARD" | "VIP" | "VVIP";
  tableId: string | null;
  tableName: string | null;
  tableSlug: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  eventName: string;
  eventId: string;
  auctionRegistered: boolean;
  bidderNumber: string | null;
  dietaryRestrictions: any;
}

// Helper to get tier badge variant
function getTierVariant(tier: string): "default" | "secondary" | "outline" {
  switch (tier) {
    case "VVIP":
      return "default";
    case "VIP":
      return "secondary";
    default:
      return "outline";
  }
}

const COLUMN_VISIBILITY_KEY = "guests-table-columns";

export default function GuestsPage() {
  const [guests, setGuests] = React.useState<GuestData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Quick View state
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [selectedGuest, setSelectedGuest] = React.useState<{ id: string; name: string } | null>(null);

  // Bulk assignment state
  const [bulkAssignOpen, setBulkAssignOpen] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});

  // Filter state
  const [showUnassignedOnly, setShowUnassignedOnly] = React.useState(false);

  // Column visibility state with localStorage persistence
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});

  // Load column visibility from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (saved) {
      try {
        setColumnVisibility(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse column visibility from localStorage");
      }
    } else {
      // Default hidden columns
      setColumnVisibility({
        dietary_restrictions: false,
        checkedIn: false,
      });
    }
  }, []);

  // Save column visibility to localStorage whenever it changes
  React.useEffect(() => {
    if (Object.keys(columnVisibility).length > 0) {
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  const handleQuickView = React.useCallback((id: string, name: string) => {
    setSelectedGuest({ id, name });
    setQuickViewOpen(true);
  }, []);

  // Fetch guests helper
  const fetchGuests = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/guests");
      if (response.ok) {
        const data = await response.json();
        setGuests(data.guests || []);
      }
    } catch (error) {
      console.error("Failed to fetch guests:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get selected guest info for bulk operations
  const selectedGuestIds = Object.keys(rowSelection).filter(id => rowSelection[id]);
  const selectedGuestData = guests.filter(g => selectedGuestIds.includes(g.id));
  const selectedGuestNames = selectedGuestData.map(g => g.name);

  // Filtered guests for display
  const filteredGuests = React.useMemo(() => {
    if (!showUnassignedOnly) return guests;
    return guests.filter(g => !g.tableName);
  }, [guests, showUnassignedOnly]);

  const unassignedCount = guests.filter(g => !g.tableName).length;

  // Column definitions - inside component to access handleQuickView
  const columns: ColumnDef<GuestData>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <div className="group flex items-center gap-2">
              <div className="flex flex-col min-w-0">
                <Link
                  href={`/admin/guests/${guest.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.getValue("name")}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {guest.eventName}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleQuickView(guest.id, guest.name);
                }}
                className="shrink-0 h-8 w-8 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                title="Quick view"
              >
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => {
          return (
            <span className="text-muted-foreground">{row.getValue("email")}</span>
          );
        },
      },
      {
        accessorKey: "tier",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Ticket Tier" />
        ),
        cell: ({ row }) => {
          const tier = row.getValue("tier") as string;
          return (
            <Badge variant={getTierVariant(tier)}>
              {tier}
            </Badge>
          );
        },
      },
      {
        accessorKey: "tableName",
        id: "table_assignment",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Table Assignment" />
        ),
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <div className="min-w-[200px]">
              <TableAssignmentCell
                guestId={guest.id}
                guestName={guest.name}
                currentTableId={guest.tableId}
                currentTableName={guest.tableName}
                eventId={guest.eventId}
                onAssignmentChange={fetchGuests}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "auctionRegistered",
        id: "auction_registered",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Auction Registration" />
        ),
        cell: ({ row }) => {
          const registered = row.getValue("auctionRegistered") as boolean;
          return (
            <Badge variant={registered ? "default" : "outline"}>
              {registered ? "Registered" : "Not Registered"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "bidderNumber",
        id: "bidder_number",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Bidder #" />
        ),
        cell: ({ row }) => {
          const bidderNumber = row.getValue("bidderNumber") as string | null;
          return (
            <div className="text-right font-mono">
              {bidderNumber || "-"}
            </div>
          );
        },
      },
      {
        accessorKey: "dietaryRestrictions",
        id: "dietary_restrictions",
        header: "Dietary Restrictions",
        cell: ({ row }) => {
          const restrictions = row.getValue("dietaryRestrictions");

          if (!restrictions) {
            return <span className="text-muted-foreground text-sm">None</span>;
          }

          // Handle different JSON formats
          let restrictionsList: string[] = [];
          if (typeof restrictions === 'string') {
            restrictionsList = [restrictions];
          } else if (Array.isArray(restrictions)) {
            restrictionsList = restrictions;
          } else if (typeof restrictions === 'object') {
            restrictionsList = Object.values(restrictions).filter(Boolean) as string[];
          }

          if (restrictionsList.length === 0) {
            return <span className="text-muted-foreground text-sm">None</span>;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {restrictionsList.map((restriction, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {restriction}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: "checkedIn",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Checked In" />
        ),
        cell: ({ row }) => {
          const checkedIn = row.getValue("checkedIn") as boolean;

          return (
            <div className="flex items-center gap-2">
              {checkedIn ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Yes</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">No</span>
                </>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const guest = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/admin/guests/${guest.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/guests/${guest.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Transfer table
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [handleQuickView, fetchGuests]
  );

  React.useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guests Management"
        description="View and manage all guests across all tables"
      />

      {/* Bulk Actions Toolbar */}
      {selectedGuestIds.length > 0 && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">
                {selectedGuestIds.length} guest(s) selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRowSelection({})}
              >
                Clear Selection
              </Button>
              <Button
                size="sm"
                onClick={() => setBulkAssignOpen(true)}
              >
                Assign to Table
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unassigned Filter Toggle */}
      <div className="flex items-center gap-2">
        <Toggle
          pressed={showUnassignedOnly}
          onPressedChange={setShowUnassignedOnly}
          variant="outline"
          size="sm"
        >
          <span className="text-sm">Unassigned only</span>
          {unassignedCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {unassignedCount}
            </Badge>
          )}
        </Toggle>
      </div>

      <DataTable
        columns={columns}
        data={filteredGuests}
        searchKey="name"
        searchPlaceholder="Search guests..."
        isLoading={isLoading}
        emptyMessage={showUnassignedOnly ? "No unassigned guests found." : "No guests found."}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />

      <GuestQuickView
        guestId={selectedGuest?.id ?? null}
        guestName={selectedGuest?.name ?? ""}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />

      <BulkAssignGuestsDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        selectedGuestIds={selectedGuestIds}
        selectedGuestNames={selectedGuestNames}
        eventId={selectedGuestData[0]?.eventId ?? ""}
        onSuccess={() => {
          setRowSelection({});
          fetchGuests();
        }}
      />
    </div>
  );
}
