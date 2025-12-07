"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Eye, RotateCcw, Calendar, Filter, Maximize2 } from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable, DataTableColumnHeader } from "@/components/admin/data-table";
import { OrderQuickView } from "@/components/admin/quick-view";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";

// Order status type
type OrderStatus = "PENDING" | "AWAITING_PAYMENT" | "COMPLETED" | "REFUNDED" | "CANCELLED" | "EXPIRED";

// Order data type matching what we'll fetch from the API
interface OrderData {
  id: string;
  buyerName: string;
  buyerEmail: string;
  productName: string;
  productKind: string;
  amountCents: number;
  status: OrderStatus;
  createdAt: string;
  eventName: string;
}

// Status badge configuration
const statusConfig: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  PENDING: { label: "Pending", variant: "secondary" },
  AWAITING_PAYMENT: { label: "Awaiting Payment", variant: "outline", className: "border-yellow-500 text-yellow-600" },
  COMPLETED: { label: "Completed", variant: "default", className: "bg-green-600 hover:bg-green-600/80" },
  REFUNDED: { label: "Refunded", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline", className: "text-muted-foreground" },
  EXPIRED: { label: "Expired", variant: "outline", className: "text-muted-foreground" },
};

// Helper to format currency
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<OrderData[]>([]);
  const [filteredOrders, setFilteredOrders] = React.useState<OrderData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");

  // Quick View state
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<{ id: string; buyerName: string } | null>(null);

  const handleQuickView = React.useCallback((id: string, buyerName: string) => {
    setSelectedOrder({ id, buyerName });
    setQuickViewOpen(true);
  }, []);

  // Column definitions - inside component to access handleQuickView
  const columns: ColumnDef<OrderData>[] = React.useMemo(
    () => [
      {
        accessorKey: "buyerName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Buyer" />
        ),
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div className="group flex items-center gap-2">
              <div className="flex flex-col">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.getValue("buyerName")}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {order.buyerEmail}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleQuickView(order.id, order.buyerName);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 flex items-center justify-center hover:bg-muted rounded"
                title="Quick view"
              >
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: "productName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        cell: ({ row }) => {
          return (
            <div className="flex flex-col">
              <span>{row.getValue("productName")}</span>
              <span className="text-xs text-muted-foreground">
                {row.original.productKind.replace(/_/g, " ")}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "amountCents",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => {
          const amount = row.getValue("amountCents") as number;
          return <span className="font-medium">{formatCurrency(amount)}</span>;
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
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
          const status = row.getValue("status") as OrderStatus;
          const config = statusConfig[status];

          return (
            <Badge variant={config.variant} className={config.className}>
              {config.label}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value === "all" || row.getValue(id) === value;
        },
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const order = row.original;

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
                  <Link href={`/admin/orders/${order.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View details
                  </Link>
                </DropdownMenuItem>
                {order.status === "COMPLETED" && (
                  <DropdownMenuItem className="text-destructive">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Refund
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [handleQuickView]
  );

  React.useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch("/api/admin/orders");
        if (response.ok) {
          const data = await response.json();
          setOrders(data.orders || []);
          setFilteredOrders(data.orders || []);
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrders();
  }, []);

  // Apply filters
  React.useEffect(() => {
    let result = [...orders];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((order) => order.status === statusFilter);
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter((order) => new Date(order.createdAt) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((order) => new Date(order.createdAt) <= toDate);
    }

    setFilteredOrders(result);
  }, [orders, statusFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = statusFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders Management"
        description="View and manage all orders and transactions"
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="AWAITING_PAYMENT">Awaiting Payment</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-9 w-[160px]"
                />
              </div>
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-9 w-[160px]"
                />
              </div>
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

      <DataTable
        columns={columns}
        data={filteredOrders}
        searchKey="buyerName"
        searchPlaceholder="Search by buyer name..."
        isLoading={isLoading}
        emptyMessage="No orders found."
      />

      <OrderQuickView
        orderId={selectedOrder?.id ?? null}
        buyerName={selectedOrder?.buyerName ?? ""}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />
    </div>
  );
}
