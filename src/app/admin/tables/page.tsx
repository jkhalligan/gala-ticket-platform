"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Eye, Pencil, Trash2, Plus } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable, DataTableColumnHeader } from "@/components/admin/data-table";
import { CreateTableDialog } from "@/components/admin/tables/create-table-dialog";
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

// Table data type matching what we'll fetch from the API
interface TableData {
  id: string;
  name: string;
  slug: string;
  type: "PREPAID" | "CAPTAIN_PAYG";
  capacity: number;
  filledSeats: number;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  eventName: string;
}

// Column definitions for the tables DataTable
const columns: ColumnDef<TableData>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("name")}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.eventName}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as string;
      return (
        <Badge variant={type === "PREPAID" ? "default" : "secondary"}>
          {type === "PREPAID" ? "Prepaid" : "Captain PAYG"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "capacity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Capacity" />
    ),
    cell: ({ row }) => {
      return <span>{row.getValue("capacity")}</span>;
    },
  },
  {
    accessorKey: "filledSeats",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Filled Seats" />
    ),
    cell: ({ row }) => {
      const filled = row.original.filledSeats;
      const capacity = row.original.capacity;
      const percentage = capacity > 0 ? Math.round((filled / capacity) * 100) : 0;

      return (
        <div className="flex items-center gap-2">
          <span>
            {filled}/{capacity}
          </span>
          <span className="text-xs text-muted-foreground">({percentage}%)</span>
        </div>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const table = row.original;

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
              <Link href={`/admin/tables/${table.slug}`}>
                <Eye className="mr-2 h-4 w-4" />
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/tables/${table.slug}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function TablesPage() {
  const [tables, setTables] = React.useState<TableData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const fetchTables = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/tables");
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error("Failed to fetch tables:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  function handleTableCreated() {
    // Refresh the tables list after successful creation
    fetchTables();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tables Management"
        description="View and manage all event tables"
      >
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Table
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={tables}
        searchKey="name"
        searchPlaceholder="Search tables..."
        isLoading={isLoading}
        emptyMessage="No tables found."
      />

      <CreateTableDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleTableCreated}
      />
    </div>
  );
}
