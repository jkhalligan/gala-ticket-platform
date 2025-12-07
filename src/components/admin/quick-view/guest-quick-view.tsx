"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  User,
  Ticket,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Mail,
  Phone,
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

interface GuestQuickViewProps {
  guestId: string | null;
  guestName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GuestDetails {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  tier: "STANDARD" | "VIP" | "VVIP";
  checkedIn: boolean;
  checkedInAt: string | null;
  dietaryRestrictions: string | null;
  specialRequests: string | null;
  table: {
    id: string;
    name: string;
    slug: string;
    tableNumber: string | null;
    location: string | null;
  } | null;
  event: {
    id: string;
    name: string;
    date: string;
  };
}

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

export function GuestQuickView({
  guestId,
  guestName,
  open,
  onOpenChange,
}: GuestQuickViewProps) {
  const [guestDetails, setGuestDetails] = React.useState<GuestDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (open && guestId) {
      setIsLoading(true);
      fetch(`/api/admin/guests/${guestId}`)
        .then((res) => res.json())
        .then((data) => {
          setGuestDetails(data.guest);
        })
        .catch((error) => {
          console.error("Failed to fetch guest details:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, guestId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {guestName}
            {guestDetails && (
              <Badge variant={getTierVariant(guestDetails.tier)}>
                {guestDetails.tier}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {guestDetails?.event?.name ?? "Loading..."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : guestDetails ? (
            <div className="space-y-6 py-4">
              {/* Check-in Status */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Check-in Status
                </h4>
                <div
                  className={`rounded-lg border p-4 ${
                    guestDetails.checkedIn
                      ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {guestDetails.checkedIn ? (
                      <>
                        <CheckCircle className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="font-medium text-green-700 dark:text-green-400">
                            Checked In
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-500">
                            {guestDetails.checkedInAt
                              ? format(new Date(guestDetails.checkedInAt), "MMMM d, yyyy 'at' h:mm a")
                              : ""}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Not Checked In</p>
                          <p className="text-sm text-muted-foreground">
                            Awaiting arrival
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Table Assignment */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Table Assignment
                </h4>
                {guestDetails.table ? (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Table Name</span>
                        <p className="font-medium">
                          <Link
                            href={`/admin/tables/${guestDetails.table.slug}`}
                            className="text-primary hover:underline"
                          >
                            {guestDetails.table.name}
                          </Link>
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Table Number</span>
                        <p className="font-medium">
                          {guestDetails.table.tableNumber ?? "Not assigned"}
                        </p>
                      </div>
                      {guestDetails.table.location && (
                        <div className="col-span-2">
                          <span className="text-xs text-muted-foreground">Location</span>
                          <p className="font-medium">{guestDetails.table.location}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                    No table assigned
                  </div>
                )}
              </div>

              <Separator />

              {/* Ticket Type */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  Ticket Information
                </h4>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">Ticket Tier</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={getTierVariant(guestDetails.tier)} className="text-base px-3 py-1">
                          {guestDetails.tier}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Event Date</span>
                      <p className="font-medium">
                        {guestDetails.event?.date
                          ? format(new Date(guestDetails.event.date), "MMM d, yyyy")
                          : "TBD"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Contact Information
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${guestDetails.email}`}
                      className="text-primary hover:underline"
                    >
                      {guestDetails.email}
                    </a>
                  </div>
                  {guestDetails.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`tel:${guestDetails.phone}`}
                        className="text-primary hover:underline"
                      >
                        {guestDetails.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Requirements */}
              {(guestDetails.dietaryRestrictions || guestDetails.specialRequests) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Special Requirements</h4>
                    {guestDetails.dietaryRestrictions && (
                      <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-3">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          Dietary Restrictions
                        </span>
                        <p className="text-sm mt-1">{guestDetails.dietaryRestrictions}</p>
                      </div>
                    )}
                    {guestDetails.specialRequests && (
                      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-3">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          Special Requests
                        </span>
                        <p className="text-sm mt-1">{guestDetails.specialRequests}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Failed to load guest details
            </div>
          )}
        </ScrollArea>

        <div className="pt-4 border-t">
          <Button asChild className="w-full">
            <Link href={`/admin/guests/${guestId}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Full Details
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
