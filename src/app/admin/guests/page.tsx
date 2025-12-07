"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Eye, Pencil, ArrowRightLeft, CheckCircle, XCircle, Maximize2 } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable, DataTableColumnHeader } from "@/components/admin/data-table";
import { GuestQuickView } from "@/components/admin/quick-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  tableName: string | null;
  tableSlug: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  eventName: string;
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

export default function GuestsPage() {
  const [guests, setGuests] = React.useState<GuestData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Quick View state
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [selectedGuest, setSelectedGuest] = React.useState<{ id: string; name: string } | null>(null);

  const handleQuickView = React.useCallback((id: string, name: string) => {
    setSelectedGuest({ id, name });
    setQuickViewOpen(true);
  }, []);

  // Column definitions - inside component to access handleQuickView
  const columns: ColumnDef<GuestData>[] = React.useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <div className="flex items-center gap-2">
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Table" />
        ),
        cell: ({ row }) => {
          const tableName = row.getValue("tableName") as string | null;
          const tableSlug = row.original.tableSlug;

          if (!tableName) {
            return <span className="text-muted-foreground italic">Unassigned</span>;
          }

          return (
            <Link
              href={`/admin/tables/${tableSlug}`}
              className="text-primary hover:underline"
            >
              {tableName}
            </Link>
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
    [handleQuickView]
  );

  React.useEffect(() => {
    async function fetchGuests() {
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
    }

    fetchGuests();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guests Management"
        description="View and manage all guests across all tables"
      />

      <DataTable
        columns={columns}
        data={guests}
        searchKey="name"
        searchPlaceholder="Search guests..."
        isLoading={isLoading}
        emptyMessage="No guests found."
      />

      <GuestQuickView
        guestId={selectedGuest?.id ?? null}
        guestName={selectedGuest?.name ?? ""}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />
    </div>
  );
}
