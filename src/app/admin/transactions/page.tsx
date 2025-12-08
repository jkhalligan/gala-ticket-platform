"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, DataTableColumnHeader } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

type Transaction = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: {
    type: string;
    card: {
      brand: string;
      last4: string;
    } | null;
  } | null;
  customer_email: string | null;
  created: number;
  order_id: string | null;
  metadata: Record<string, any>;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [emailSearch, setEmailSearch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Load transactions
  useEffect(() => {
    loadTransactions();
  }, [statusFilter, dateFrom, dateTo]);

  async function loadTransactions() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (dateFrom) {
        params.append("date_from", dateFrom);
      }
      if (dateTo) {
        params.append("date_to", dateTo);
      }
      if (emailSearch) {
        params.append("email", emailSearch);
      }

      const response = await fetch(`/api/admin/transactions?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load transactions");
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }

  // Export to CSV
  function exportToCSV() {
    const headers = [
      "Transaction ID",
      "Date/Time",
      "Amount",
      "Status",
      "Payment Method",
      "Customer Email",
      "Order ID",
    ];

    const rows = transactions.map((t) => [
      t.id,
      format(new Date(t.created * 1000), "yyyy-MM-dd HH:mm:ss"),
      formatCurrency(t.amount, t.currency),
      t.status,
      formatPaymentMethod(t.payment_method),
      t.customer_email || "",
      t.order_id || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Helper functions
  function formatCurrency(cents: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  }

  function formatPaymentMethod(pm: Transaction["payment_method"]): string {
    if (!pm) return "N/A";
    if (pm.card) {
      return `${pm.card.brand.toUpperCase()} ****${pm.card.last4}`;
    }
    return pm.type;
  }

  function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case "succeeded":
        return "default"; // Green
      case "processing":
      case "requires_payment_method":
      case "requires_confirmation":
      case "requires_action":
        return "secondary"; // Yellow
      case "canceled":
      case "requires_capture":
        return "outline"; // Gray
      default:
        return "destructive"; // Red
    }
  }

  // Table columns
  const columns: ColumnDef<Transaction>[] = [
    {
      accessorKey: "created",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date/Time" />,
      cell: ({ row }) => {
        const timestamp = row.getValue("created") as number;
        return (
          <div className="whitespace-nowrap">
            {format(new Date(timestamp * 1000), "MMM d, yyyy")}
            <div className="text-xs text-muted-foreground">
              {format(new Date(timestamp * 1000), "h:mm a")}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ row }) => {
        const amount = row.getValue("amount") as number;
        const currency = row.original.currency;
        return (
          <div className="font-medium">
            {formatCurrency(amount, currency)}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant={getStatusBadgeVariant(status)}>
            {status.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "payment_method",
      header: "Payment Method",
      cell: ({ row }) => {
        const pm = row.getValue("payment_method") as Transaction["payment_method"];
        return <div>{formatPaymentMethod(pm)}</div>;
      },
    },
    {
      accessorKey: "customer_email",
      header: "Customer Email",
      cell: ({ row }) => {
        const email = row.getValue("customer_email") as string | null;
        return <div className="max-w-[200px] truncate">{email || ""}</div>;
      },
    },
    {
      accessorKey: "order_id",
      header: "Order ID",
      cell: ({ row }) => {
        const orderId = row.getValue("order_id") as string | null;
        if (!orderId) return <span className="text-muted-foreground"></span>;
        return (
          <Link
            href={`/admin/orders?id=${orderId}`}
            className="text-primary hover:underline"
          >
            {orderId.substring(0, 8)}...
          </Link>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const transactionId = row.original.id;
        const stripeUrl = `https://dashboard.stripe.com/payments/${transactionId}`;
        return (
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <a href={stripeUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Stripe
            </a>
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="View and manage Stripe payment transactions"
      >
        <Button onClick={exportToCSV} disabled={transactions.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="requires_payment_method">Requires Payment</SelectItem>
                  <SelectItem value="requires_action">Requires Action</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <label htmlFor="date_from" className="text-sm font-medium">
                From Date
              </label>
              <Input
                id="date_from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <label htmlFor="date_to" className="text-sm font-medium">
                To Date
              </label>
              <Input
                id="date_to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Email Search */}
            <div className="space-y-2">
              <label htmlFor="email_search" className="text-sm font-medium">
                Search by Email
              </label>
              <div className="flex gap-2">
                <Input
                  id="email_search"
                  type="email"
                  placeholder="customer@example.com"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                />
                <Button
                  onClick={loadTransactions}
                  disabled={loading}
                  size="icon"
                  variant="secondary"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Go"
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setDateFrom("");
                setDateTo("");
                setEmailSearch("");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Transactions Table */}
      <DataTable
        columns={columns}
        data={transactions}
        isLoading={loading}
        emptyMessage="No transactions found"
        showSearch={false}
        pageSize={20}
        pageSizeOptions={[20, 50, 100]}
      />
    </div>
  );
}
