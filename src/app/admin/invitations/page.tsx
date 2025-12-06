"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Send, X, Copy, Plus, Mail, DollarSign, Calendar, Check } from "lucide-react";
import { format, addDays } from "date-fns";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable, DataTableColumnHeader } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Invitation status type
type InvitationStatus = "AWAITING_PAYMENT" | "COMPLETED" | "EXPIRED" | "CANCELLED";

// Invitation data type
interface InvitationData {
  id: string;
  email: string;
  amountCents: number;
  status: InvitationStatus;
  paymentLinkToken: string;
  expiresAt: string | null;
  createdAt: string;
  productName: string;
}

// Status badge configuration
const statusConfig: Record<InvitationStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  AWAITING_PAYMENT: { label: "Pending", variant: "outline", className: "border-yellow-500 text-yellow-600" },
  COMPLETED: { label: "Paid", variant: "default", className: "bg-green-600 hover:bg-green-600/80" },
  EXPIRED: { label: "Expired", variant: "outline", className: "text-muted-foreground" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

// Helper to format currency
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// Helper to copy to clipboard
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = React.useState<InvitationData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Form state
  const [email, setEmail] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [expirationDays, setExpirationDays] = React.useState("7");

  // Fetch invitations
  const fetchInvitations = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/invitations");
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !amount) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amountCents: Math.round(parseFloat(amount) * 100),
          expirationDays: parseInt(expirationDays, 10),
        }),
      });

      if (response.ok) {
        // Reset form and refresh list
        setEmail("");
        setAmount("");
        setExpirationDays("7");
        await fetchInvitations();
      } else {
        const error = await response.json();
        console.error("Failed to create invitation:", error);
      }
    } catch (error) {
      console.error("Failed to create invitation:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle copy link
  const handleCopyLink = async (token: string, id: string) => {
    const link = `${window.location.origin}/pay/${token}`;
    const success = await copyToClipboard(link);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Handle resend
  const handleResend = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/invitations/${id}/resend`, {
        method: "POST",
      });
      if (response.ok) {
        // Could show a toast notification here
        console.log("Invitation resent successfully");
      }
    } catch (error) {
      console.error("Failed to resend invitation:", error);
    }
  };

  // Handle cancel
  const handleCancel = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/invitations/${id}/cancel`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchInvitations();
      }
    } catch (error) {
      console.error("Failed to cancel invitation:", error);
    }
  };

  // Column definitions
  const columns: ColumnDef<InvitationData>[] = [
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex flex-col">
            <span className="font-medium">{row.getValue("email")}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.productName}
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
      accessorKey: "expiresAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Expires" />
      ),
      cell: ({ row }) => {
        const expiresAt = row.getValue("expiresAt") as string | null;
        if (!expiresAt) {
          return <span className="text-muted-foreground">No expiration</span>;
        }

        const date = new Date(expiresAt);
        const isExpired = date < new Date();

        return (
          <span className={isExpired ? "text-destructive" : ""}>
            {format(date, "MMM d, yyyy")}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as InvitationStatus;
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
        const invitation = row.original;
        const isPending = invitation.status === "AWAITING_PAYMENT";
        const isCopied = copiedId === invitation.id;

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
              <DropdownMenuItem
                onClick={() => handleCopyLink(invitation.paymentLinkToken, invitation.id)}
              >
                {isCopied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy link
                  </>
                )}
              </DropdownMenuItem>
              {isPending && (
                <>
                  <DropdownMenuItem onClick={() => handleResend(invitation.id)}>
                    <Send className="mr-2 h-4 w-4" />
                    Resend email
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleCancel(invitation.id)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel invitation
                  </DropdownMenuItem>
                </>
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
        title="Ticket Invitations"
        description="Create and manage payment link invitations"
      />

      {/* Creation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Invitation
          </CardTitle>
          <CardDescription>
            Send a payment link to invite someone to purchase a ticket
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Email */}
            <div className="flex-1 space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="recipient@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Amount */}
            <div className="w-full sm:w-40 space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">
                Amount (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Expiration */}
            <div className="w-full sm:w-48 space-y-2">
              <label htmlFor="expiration" className="text-sm font-medium">
                Expires In (Days)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="expiration"
                  type="number"
                  placeholder="7"
                  min="1"
                  max="90"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Submit */}
            <Button type="submit" disabled={isSubmitting || !email || !amount}>
              {isSubmitting ? (
                "Creating..."
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle>Sent Invitations</CardTitle>
          <CardDescription>
            Track and manage all payment link invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={invitations}
            searchKey="email"
            searchPlaceholder="Search by email..."
            isLoading={isLoading}
            emptyMessage="No invitations found. Create one above to get started."
            showColumnVisibility={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
