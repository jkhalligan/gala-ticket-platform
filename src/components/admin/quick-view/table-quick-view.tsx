"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Users, MapPin, Clock, ExternalLink, CheckCircle, XCircle } from "lucide-react";

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

interface TableQuickViewProps {
  tableSlug: string | null;
  tableName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TableDetails {
  id: string;
  name: string;
  slug: string;
  type: "PREPAID" | "CAPTAIN_PAYG";
  capacity: number;
  tableNumber: string | null;
  location: string | null;
  eventName: string;
  guests: {
    id: string;
    name: string;
    checkedIn: boolean;
    checkedInAt: string | null;
  }[];
}

export function TableQuickView({
  tableSlug,
  tableName,
  open,
  onOpenChange,
}: TableQuickViewProps) {
  const [tableDetails, setTableDetails] = React.useState<TableDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (open && tableSlug) {
      setIsLoading(true);
      fetch(`/api/admin/tables/${tableSlug}`)
        .then((res) => res.json())
        .then((data) => {
          setTableDetails(data.table);
        })
        .catch((error) => {
          console.error("Failed to fetch table details:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, tableSlug]);

  const filledSeats = tableDetails?.guests?.length ?? 0;
  const capacity = tableDetails?.capacity ?? 0;
  const occupancyPercentage = capacity > 0 ? Math.round((filledSeats / capacity) * 100) : 0;

  // Get recent check-ins (last 5 guests who checked in)
  const recentCheckIns = tableDetails?.guests
    ?.filter((g) => g.checkedIn && g.checkedInAt)
    .sort((a, b) => new Date(b.checkedInAt!).getTime() - new Date(a.checkedInAt!).getTime())
    .slice(0, 5) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {tableName}
            <Badge variant={tableDetails?.type === "PREPAID" ? "default" : "secondary"}>
              {tableDetails?.type === "PREPAID" ? "Prepaid" : "Captain PAYG"}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            {tableDetails?.eventName ?? "Loading..."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : tableDetails ? (
            <div className="space-y-6 py-4">
              {/* Table Map / Location */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Table Location
                </h4>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Table Number</span>
                      <p className="font-medium">
                        {tableDetails.tableNumber ?? "Not assigned"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Location</span>
                      <p className="font-medium">
                        {tableDetails.location ?? "Not specified"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Current Occupancy */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Current Occupancy
                </h4>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl font-bold">
                      {filledSeats} / {capacity}
                    </span>
                    <Badge
                      variant={occupancyPercentage >= 100 ? "default" : occupancyPercentage >= 50 ? "secondary" : "outline"}
                    >
                      {occupancyPercentage}% full
                    </Badge>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {capacity - filledSeats} seats available
                  </div>
                </div>
              </div>

              <Separator />

              {/* Recent Check-ins */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Check-ins
                </h4>
                {recentCheckIns.length > 0 ? (
                  <div className="space-y-2">
                    {recentCheckIns.map((guest) => (
                      <div
                        key={guest.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{guest.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {guest.checkedInAt
                            ? format(new Date(guest.checkedInAt), "MMM d, h:mm a")
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                    No check-ins yet
                  </div>
                )}
              </div>

              <Separator />

              {/* Guest List Preview */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">All Guests ({tableDetails.guests?.length ?? 0})</h4>
                {tableDetails.guests && tableDetails.guests.length > 0 ? (
                  <div className="space-y-1">
                    {tableDetails.guests.slice(0, 8).map((guest) => (
                      <div
                        key={guest.id}
                        className="flex items-center justify-between py-1.5 text-sm"
                      >
                        <span>{guest.name}</span>
                        {guest.checkedIn ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                    {tableDetails.guests.length > 8 && (
                      <p className="text-xs text-muted-foreground pt-1">
                        +{tableDetails.guests.length - 8} more guests
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No guests assigned</p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Failed to load table details
            </div>
          )}
        </ScrollArea>

        <div className="pt-4 border-t">
          <Button asChild className="w-full">
            <Link href={`/admin/tables/${tableSlug}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Full Details
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
