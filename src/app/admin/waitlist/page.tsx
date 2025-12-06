"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  ArrowRightCircle,
  X,
  Clock,
  Users,
} from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable, DataTableColumnHeader } from "@/components/admin/data-table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/admin/stat-card";

// Waitlist status type
type WaitlistStatus = "WAITING" | "CONVERTED" | "EXPIRED" | "CANCELLED";

// Waitlist entry data type
interface WaitlistEntry {
  id: string;
  email: string;
  quantity: number;
  status: WaitlistStatus;
  notes: string | null;
  tableName: string | null;
  eventName: string;
  createdAt: string;
}

// Status badge configuration
const statusConfig: Record<WaitlistStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  WAITING: { label: "Waiting", variant: "outline", className: "border-yellow-500 text-yellow-600" },
  CONVERTED: { label: "Converted", variant: "default", className: "bg-green-600 hover:bg-green-600/80" },
  EXPIRED: { label: "Expired", variant: "outline", className: "text-muted-foreground" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export default function WaitlistPage() {
  const [entries, setEntries] = React.useState<WaitlistEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = React.useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Stats
  const stats = React.useMemo(() => {
    const waiting = entries.filter((e) => e.status === "WAITING").length;
    const converted = entries.filter((e) => e.status === "CONVERTED").length;
    const totalSeats = entries
      .filter((e) => e.status === "WAITING")
      .reduce((sum, e) => sum + e.quantity, 0);
    return { waiting, converted, totalSeats };
  }, [entries]);

  // Fetch waitlist entries
  const fetchEntries = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/waitlist");
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        setFilteredEntries(data.entries || []);
      }
    } catch (error) {
      console.error("Failed to fetch waitlist entries:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Apply filters
  React.useEffect(() => {
    let result = [...entries];

    if (statusFilter !== "all") {
      result = result.filter((entry) => entry.status === statusFilter);
    }

    setFilteredEntries(result);
  }, [entries, statusFilter]);

  // Handle convert to order
  const handleConvert = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/waitlist/${id}/convert`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchEntries();
      } else {
        const error = await response.json();
        console.error("Failed to convert entry:", error);
      }
    } catch (error) {
      console.error("Failed to convert entry:", error);
    }
  };

  // Handle cancel entry
  const handleCancel = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/waitlist/${id}/cancel`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchEntries();
      } else {
        const error = await response.json();
        console.error("Failed to cancel entry:", error);
      }
    } catch (error) {
      console.error("Failed to cancel entry:", error);
    }
  };

  // Column definitions
  const columns: ColumnDef<WaitlistEntry>[] = [
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex flex-col">
            <span className="font-medium">{row.getValue("email")}</span>
            {row.original.tableName && (
              <span className="text-xs text-muted-foreground">
                For: {row.original.tableName}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Requested Seats" />
      ),
      cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number;
        return (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{quantity} {quantity === 1 ? "seat" : "seats"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date Added" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt") as string);
        return (
          <div className="flex flex-col">
            <span>{format(date, "MMM d, yyyy")}</span>
            <span className="text-xs text-muted-foreground">
              {format(date, "h:mm a")}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as WaitlistStatus;
        const config = statusConfig[status];

        return (
          <Badge variant={config.variant} className={config.className}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const entry = row.original;
        const isWaiting = entry.status === "WAITING";

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
              {isWaiting && (
                <>
                  <DropdownMenuItem onClick={() => handleConvert(entry.id)}>
                    <ArrowRightCircle className="mr-2 h-4 w-4" />
                    Convert to Order
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleCancel(entry.id)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel Entry
                  </DropdownMenuItem>
                </>
              )}
              {!isWaiting && (
                <DropdownMenuItem disabled>
                  No actions available
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waitlist Management"
        description="Manage waitlist entries and convert them to orders"
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Waiting"
          value={stats.waiting}
          icon={Clock}
          description="Entries waiting for seats"
        />
        <StatCard
          title="Total Seats Requested"
          value={stats.totalSeats}
          icon={Users}
          description="Seats needed for waiting entries"
        />
        <StatCard
          title="Converted"
          value={stats.converted}
          icon={ArrowRightCircle}
          description="Successfully converted to orders"
        />
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Filter by Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="WAITING">Waiting</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Waitlist Table */}
      <DataTable
        columns={columns}
        data={filteredEntries}
        searchKey="email"
        searchPlaceholder="Search by email..."
        isLoading={isLoading}
        emptyMessage="No waitlist entries found."
      />
    </div>
  );
}
