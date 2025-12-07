"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  CreditCard,
  User,
  Calendar,
  Package,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Receipt,
} from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OrderDetail {
  id: string;
  status: string;
  amountCents: number;
  discountCents: number;
  quantity: number;
  notes: string | null;
  isAdminCreated: boolean;
  invitedEmail: string | null;
  customPriceCents: number | null;
  paymentLinkToken: string | null;
  paymentLinkExpires: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
  product: {
    id: string;
    name: string;
    kind: string;
    tier: string;
    priceCents: number;
  };
  event: {
    id: string;
    name: string;
    eventDate: string;
  };
  table: {
    id: string;
    name: string;
    slug: string;
  } | null;
  promoCode: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
  } | null;
  guestAssignments: Array<{
    id: string;
    displayName: string | null;
    userId: string;
    userEmail: string;
    userFirstName: string | null;
    userLastName: string | null;
    tier: string;
    checkedInAt: string | null;
  }>;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", variant: "secondary" },
  AWAITING_PAYMENT: { label: "Awaiting Payment", variant: "outline" },
  COMPLETED: { label: "Completed", variant: "default" },
  REFUNDED: { label: "Refunded", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  EXPIRED: { label: "Expired", variant: "secondary" },
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = React.useState(false);
  const [isRefunding, setIsRefunding] = React.useState(false);

  React.useEffect(() => {
    async function fetchOrder() {
      try {
        const response = await fetch(`/api/admin/orders/${id}`);
        if (response.ok) {
          const data = await response.json();
          setOrder(data.order);
        } else if (response.status === 404) {
          setError("Order not found");
        } else {
          setError("Failed to load order");
        }
      } catch (err) {
        console.error("Failed to fetch order:", err);
        setError("Failed to load order");
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchOrder();
    }
  }, [id]);

  async function handleRefund() {
    if (!order) return;

    setIsRefunding(true);
    try {
      const response = await fetch(`/api/admin/orders/${id}/refund`, {
        method: "POST",
      });

      if (response.ok) {
        // Refresh order data
        const refreshResponse = await fetch(`/api/admin/orders/${id}`);
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setOrder(data.order);
        }
        setRefundDialogOpen(false);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to process refund");
      }
    } catch (err) {
      console.error("Failed to process refund:", err);
      alert("Failed to process refund");
    } finally {
      setIsRefunding(false);
    }
  }

  function getStripeUrl(paymentIntentId: string): string {
    // Determine if test or live mode based on prefix
    const isTestMode = paymentIntentId.startsWith("pi_") && paymentIntentId.includes("test");
    const baseUrl = isTestMode
      ? "https://dashboard.stripe.com/test/payments"
      : "https://dashboard.stripe.com/payments";
    return `${baseUrl}/${paymentIntentId}`;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{error || "Order not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[order.status] || { label: order.status, variant: "secondary" as const };
  const buyerName = order.user.firstName || order.user.lastName
    ? `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim()
    : order.user.email;
  const netAmount = order.amountCents - order.discountCents;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Order Details"
        description={`Order #${order.id.slice(-8).toUpperCase()}`}
      >
        <div className="flex items-center gap-4">
          <Badge variant={status.variant}>{status.label}</Badge>
          {order.status === "COMPLETED" && (
            <Button
              variant="outline"
              onClick={() => setRefundDialogOpen(true)}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Process Refund
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Order Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amount</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(netAmount / 100).toFixed(2)}
            </div>
            {order.discountCents > 0 && (
              <p className="text-xs text-muted-foreground">
                ${(order.amountCents / 100).toFixed(2)} - ${(order.discountCents / 100).toFixed(2)} discount
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quantity</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{order.quantity}</div>
            <p className="text-xs text-muted-foreground">
              {order.product.kind.replace(/_/g, " ")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Event</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-medium">{order.event.name}</div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(order.event.eventDate), "PPP")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-medium">{format(new Date(order.createdAt), "PP")}</div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(order.createdAt), "p")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Buyer & Product Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Buyer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p>{buyerName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p>{order.user.email}</p>
            </div>
            {order.user.phone && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p>{order.user.phone}</p>
              </div>
            )}
            {order.isAdminCreated && order.invitedEmail && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Invited Email</label>
                <p>{order.invitedEmail}</p>
                <Badge variant="outline" className="mt-1">Admin Created</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Product Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Product</label>
              <p>{order.product.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <p>{order.product.kind.replace(/_/g, " ")}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Tier</label>
              <div>
                <Badge variant={order.product.tier === "VIP" || order.product.tier === "VVIP" ? "default" : "secondary"}>
                  {order.product.tier}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Unit Price</label>
              <p>${(order.product.priceCents / 100).toFixed(2)}</p>
            </div>
            {order.table && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Table</label>
                <p>
                  <Link
                    href={`/admin/tables/${order.table.slug}`}
                    className="hover:underline text-primary"
                  >
                    {order.table.name}
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial Transaction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Financial Transaction
          </CardTitle>
          <CardDescription>
            Payment processing details and Stripe transaction information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
              <p className="font-mono text-sm">{order.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Payment Status</label>
              <div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            </div>
            {order.stripePaymentIntentId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Stripe Payment ID</label>
                <p>
                  <a
                    href={getStripeUrl(order.stripePaymentIntentId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {order.stripePaymentIntentId}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            )}
            {order.stripeChargeId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Stripe Charge ID</label>
                <p className="font-mono text-sm">{order.stripeChargeId}</p>
              </div>
            )}
            {order.promoCode && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Promo Code</label>
                <p>
                  <Badge variant="outline">{order.promoCode.code}</Badge>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({order.promoCode.discountType === "PERCENTAGE"
                      ? `${order.promoCode.discountValue}%`
                      : `$${(order.promoCode.discountValue / 100).toFixed(2)}`} off)
                  </span>
                </p>
              </div>
            )}
            {order.paymentLinkToken && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Payment Link</label>
                <p className="font-mono text-sm">{order.paymentLinkToken}</p>
                {order.paymentLinkExpires && (
                  <p className="text-xs text-muted-foreground">
                    Expires: {format(new Date(order.paymentLinkExpires), "PPp")}
                  </p>
                )}
              </div>
            )}
          </div>
          {order.notes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guest Assignments / Line Items */}
      {order.guestAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Line Items / Guest Assignments</CardTitle>
            <CardDescription>
              {order.guestAssignments.length} guest{order.guestAssignments.length !== 1 ? "s" : ""} assigned from this order
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Check-in Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.guestAssignments.map((guest) => {
                  const guestName = guest.displayName ||
                    (guest.userFirstName || guest.userLastName
                      ? `${guest.userFirstName || ""} ${guest.userLastName || ""}`.trim()
                      : "—");
                  return (
                    <TableRow key={guest.id}>
                      <TableCell>
                        <Link
                          href={`/admin/guests/${guest.id}`}
                          className="hover:underline text-primary"
                        >
                          {guestName}
                        </Link>
                      </TableCell>
                      <TableCell>{guest.userEmail}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{guest.tier}</Badge>
                      </TableCell>
                      <TableCell>
                        {guest.checkedInAt ? (
                          <Badge variant="default">
                            {format(new Date(guest.checkedInAt), "p")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Refund</DialogTitle>
            <DialogDescription>
              Are you sure you want to process a refund for this order? This action will:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 my-4">
            <li>Refund ${(netAmount / 100).toFixed(2)} to the original payment method</li>
            <li>Update the order status to &quot;Refunded&quot;</li>
            <li>This action cannot be undone</li>
          </ul>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              disabled={isRefunding}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={isRefunding}
            >
              {isRefunding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRefunding ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
