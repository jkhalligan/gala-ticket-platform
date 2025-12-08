"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  User,
  Mail,
  Phone,
  Calendar,
  Tag,
  Table2,
  CheckCircle,
  XCircle,
  Loader2,
  History,
} from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GuestDetail {
  id: string;
  userId: string;
  displayName: string | null;
  tier: string;
  checkedInAt: string | null;
  referenceCode: string | null;
  bidderNumber: string | null;
  dietaryRestrictions: string[] | null;
  auctionRegistered: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
  table: {
    id: string;
    name: string;
    slug: string;
    type: string;
  } | null;
  event: {
    id: string;
    name: string;
    eventDate: string;
  };
  order: {
    id: string;
    status: string;
    amountCents: number;
    createdAt: string;
  };
}

interface ActivityLogEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export default function GuestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [guest, setGuest] = React.useState<GuestDetail | null>(null);
  const [activityLog, setActivityLog] = React.useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    async function fetchGuest() {
      try {
        const response = await fetch(`/api/admin/guests/${id}`);
        if (response.ok) {
          const data = await response.json();
          setGuest(data.guest);
          setActivityLog(data.activityLog || []);
        } else if (response.status === 404) {
          setError("Guest not found");
        } else {
          setError("Failed to load guest");
        }
      } catch (err) {
        console.error("Failed to fetch guest:", err);
        setError("Failed to load guest");
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchGuest();
    }
  }, [id]);

  async function handleDelete() {
    if (!guest) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove this guest assignment? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/guests/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/admin/guests");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete guest");
      }
    } catch (err) {
      console.error("Failed to delete guest:", err);
      alert("Failed to delete guest");
    } finally {
      setIsDeleting(false);
    }
  }

  function getActivityDescription(action: string, metadata: Record<string, unknown> | null): string {
    switch (action) {
      case "GUEST_ADDED":
        return "Guest was added to the event";
      case "GUEST_UPDATED":
        return metadata?.changes
          ? `Guest details updated: ${Object.keys(metadata.changes as object).join(", ")}`
          : "Guest details were updated";
      case "GUEST_REMOVED":
        return "Guest was removed from the event";
      case "GUEST_REASSIGNED":
        return metadata?.fromTable && metadata?.toTable
          ? `Reassigned from "${metadata.fromTable}" to "${metadata.toTable}"`
          : "Guest was reassigned to a different table";
      case "GUEST_CHECKED_IN":
        return "Guest checked in to the event";
      case "TICKET_TRANSFERRED":
        return metadata?.toEmail
          ? `Ticket transferred to ${metadata.toEmail}`
          : "Ticket was transferred";
      default:
        return action.replace(/_/g, " ").toLowerCase();
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !guest) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/guests">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Guests
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{error || "Guest not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const guestName = guest.displayName ||
    (guest.user.firstName || guest.user.lastName
      ? `${guest.user.firstName || ""} ${guest.user.lastName || ""}`.trim()
      : guest.user.email);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/guests">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Guests
          </Link>
        </Button>
      </div>

      <PageHeader
        title={guestName}
        description={`Guest for ${guest.event.name}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/guests/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Remove
          </Button>
        </div>
      </PageHeader>

      {/* Guest Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Tier</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={guest.tier === "VIP" || guest.tier === "VVIP" ? "default" : "secondary"}>
              {guest.tier}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Table</CardTitle>
            <Table2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {guest.table ? (
              <div>
                <Link
                  href={`/admin/tables/${guest.table.slug}`}
                  className="font-medium hover:underline"
                >
                  {guest.table.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {guest.table.type === "PREPAID" ? "Prepaid" : "Captain PAYG"}
                </p>
              </div>
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Check-in Status</CardTitle>
            {guest.checkedInAt ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            {guest.checkedInAt ? (
              <div>
                <Badge variant="default">Checked In</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(guest.checkedInAt), "PPp")}
                </p>
              </div>
            ) : (
              <Badge variant="outline">Not Checked In</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Event</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-medium">{guest.event.name}</div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(guest.event.eventDate), "PPP")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Guest Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p>{guest.user.email}</p>
              </div>
            </div>
            {guest.user.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p>{guest.user.phone}</p>
                </div>
              </div>
            )}
            {guest.displayName && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                <p>{guest.displayName}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ticket & Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {guest.referenceCode && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Reference Code</label>
                <p className="font-mono">{guest.referenceCode}</p>
              </div>
            )}
            {guest.bidderNumber && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Bidder Number</label>
                <p className="font-mono">{guest.bidderNumber}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Order Status</label>
              <div>
                <Badge variant={guest.order.status === "COMPLETED" ? "default" : "secondary"}>
                  {guest.order.status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Order Amount</label>
              <p>${(guest.order.amountCents / 100).toFixed(2)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Auction Registered</label>
              <p>{guest.auctionRegistered ? "Yes" : "No"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dietary Restrictions */}
      {guest.dietaryRestrictions && guest.dietaryRestrictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dietary Restrictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {guest.dietaryRestrictions.map((restriction, index) => (
                <Badge key={index} variant="outline">
                  {restriction}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Activity Log
          </CardTitle>
          <CardDescription>
            History of changes and actions for this guest
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityLog.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      {format(new Date(entry.createdAt), "PPp")}
                    </TableCell>
                    <TableCell>
                      {getActivityDescription(entry.action, entry.metadata)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.actorEmail || "System"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
