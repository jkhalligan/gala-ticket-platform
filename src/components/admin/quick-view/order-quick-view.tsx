"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  CreditCard,
  Package,
  ExternalLink,
  Receipt,
  User,
  Calendar,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface OrderQuickViewProps {
  orderId: string | null;
  buyerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OrderStatus = "PENDING" | "AWAITING_PAYMENT" | "COMPLETED" | "REFUNDED" | "CANCELLED" | "EXPIRED";

interface OrderDetails {
  id: string;
  buyerName: string;
  buyerEmail: string;
  status: OrderStatus;
  amountCents: number;
  createdAt: string;
  completedAt: string | null;
  product: {
    id: string;
    name: string;
    kind: string;
    priceCents: number;
  };
  event: {
    id: string;
    name: string;
  };
  transaction: {
    id: string;
    stripePaymentIntentId: string | null;
    stripeChargeId: string | null;
    amountCents: number;
    status: string;
  } | null;
  lineItems?: {
    id: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
  }[];
}

const statusConfig: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  PENDING: { label: "Pending", variant: "secondary" },
  AWAITING_PAYMENT: { label: "Awaiting Payment", variant: "outline", className: "border-yellow-500 text-yellow-600" },
  COMPLETED: { label: "Completed", variant: "default", className: "bg-green-600 hover:bg-green-600/80" },
  REFUNDED: { label: "Refunded", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline", className: "text-muted-foreground" },
  EXPIRED: { label: "Expired", variant: "outline", className: "text-muted-foreground" },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function OrderQuickView({
  orderId,
  buyerName,
  open,
  onOpenChange,
}: OrderQuickViewProps) {
  const [orderDetails, setOrderDetails] = React.useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (open && orderId) {
      setIsLoading(true);
      fetch(`/api/admin/orders/${orderId}`)
        .then((res) => res.json())
        .then((data) => {
          setOrderDetails(data.order);
        })
        .catch((error) => {
          console.error("Failed to fetch order details:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, orderId]);

  const stripePaymentId = orderDetails?.transaction?.stripePaymentIntentId
    ?? orderDetails?.transaction?.stripeChargeId;

  const stripeUrl = stripePaymentId
    ? `https://dashboard.stripe.com/payments/${stripePaymentId}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Order Details
            {orderDetails && (
              <Badge
                variant={statusConfig[orderDetails.status].variant}
                className={statusConfig[orderDetails.status].className}
              >
                {statusConfig[orderDetails.status].label}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {buyerName} • {orderDetails?.event?.name ?? "Loading..."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : orderDetails ? (
            <div className="space-y-6 py-4">
              {/* Stripe Transaction */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Stripe Transaction
                </h4>
                <div className="rounded-lg border bg-muted/50 p-4">
                  {stripePaymentId ? (
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Payment ID</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-sm bg-background px-2 py-1 rounded border font-mono">
                            {stripePaymentId}
                          </code>
                          {stripeUrl && (
                            <a
                              href={stripeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                      {orderDetails.transaction && (
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                          <div>
                            <span className="text-xs text-muted-foreground">Transaction Amount</span>
                            <p className="font-medium">
                              {formatCurrency(orderDetails.transaction.amountCents)}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Transaction Status</span>
                            <p className="font-medium capitalize">
                              {orderDetails.transaction.status.toLowerCase()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-2">
                      No payment transaction recorded
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Items Purchased */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Items Purchased
                </h4>
                <div className="rounded-lg border overflow-hidden">
                  {/* Main Product */}
                  <div className="p-4 bg-muted/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{orderDetails.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {orderDetails.product.kind.replace(/_/g, " ")}
                        </p>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(orderDetails.product.priceCents)}
                      </span>
                    </div>
                  </div>

                  {/* Line Items if any */}
                  {orderDetails.lineItems && orderDetails.lineItems.length > 0 && (
                    <div className="divide-y">
                      {orderDetails.lineItems.map((item) => (
                        <div key={item.id} className="p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm">{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Qty: {item.quantity}
                            </p>
                          </div>
                          <span className="text-sm">
                            {formatCurrency(item.unitPriceCents * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total */}
                  <div className="p-4 border-t bg-background">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(orderDetails.amountCents)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Buyer Information */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Buyer Information
                </h4>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Name</span>
                      <p className="font-medium">{orderDetails.buyerName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Email</span>
                      <p className="font-medium truncate">
                        <a
                          href={`mailto:${orderDetails.buyerEmail}`}
                          className="text-primary hover:underline"
                        >
                          {orderDetails.buyerEmail}
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Order Timeline */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Order Timeline
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span>
                      {format(new Date(orderDetails.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  {orderDetails.completedAt && (
                    <div className="flex items-center gap-3 text-sm">
                      <CreditCard className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">Completed:</span>
                      <span>
                        {format(new Date(orderDetails.completedAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Failed to load order details
            </div>
          )}
        </ScrollArea>

        <div className="pt-4 border-t">
          <Button asChild className="w-full">
            <Link href={`/admin/orders/${orderId}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Full Details
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
