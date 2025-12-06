"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  Calendar,
  Hash,
  Tag,
  MessageSquare,
  Loader2,
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

interface TableDetail {
  id: string;
  name: string;
  slug: string;
  type: "PREPAID" | "CAPTAIN_PAYG";
  status: "ACTIVE" | "CLOSED" | "ARCHIVED";
  capacity: number;
  tableNumber: string | null;
  internalName: string | null;
  welcomeMessage: string | null;
  referenceCode: string | null;
  createdAt: string;
  updatedAt: string;
  event: {
    id: string;
    name: string;
    eventDate: string;
  };
  primaryOwner: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  guests: Array<{
    id: string;
    userId: string;
    displayName: string | null;
    userEmail: string;
    userFirstName: string | null;
    userLastName: string | null;
    checkedInAt: string | null;
    tier: string;
  }>;
}

export default function TableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [table, setTable] = React.useState<TableDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    async function fetchTable() {
      try {
        const response = await fetch(`/api/admin/tables/${slug}`);
        if (response.ok) {
          const data = await response.json();
          setTable(data.table);
        } else if (response.status === 404) {
          setError("Table not found");
        } else {
          setError("Failed to load table");
        }
      } catch (err) {
        console.error("Failed to fetch table:", err);
        setError("Failed to load table");
      } finally {
        setIsLoading(false);
      }
    }

    if (slug) {
      fetchTable();
    }
  }, [slug]);

  async function handleDelete() {
    if (!table) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${table.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/tables/${slug}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/admin/tables");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete table");
      }
    } catch (err) {
      console.error("Failed to delete table:", err);
      alert("Failed to delete table");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !table) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/tables">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tables
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{error || "Table not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filledSeats = table.guests.length;
  const fillPercentage = table.capacity > 0 ? Math.round((filledSeats / table.capacity) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/tables">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tables
          </Link>
        </Button>
      </div>

      <PageHeader
        title={table.name}
        description={table.internalName || `Table for ${table.event.name}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/tables/${slug}/edit`}>
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
            Delete
          </Button>
        </div>
      </PageHeader>

      {/* Table Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Type</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={table.type === "PREPAID" ? "default" : "secondary"}>
              {table.type === "PREPAID" ? "Prepaid" : "Captain PAYG"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filledSeats}/{table.capacity}
            </div>
            <p className="text-xs text-muted-foreground">
              {fillPercentage}% filled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Event</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-medium">{table.event.name}</div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(table.event.eventDate), "PPP")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                table.status === "ACTIVE"
                  ? "default"
                  : table.status === "CLOSED"
                  ? "secondary"
                  : "outline"
              }
            >
              {table.status}
            </Badge>
            {table.referenceCode && (
              <p className="text-xs text-muted-foreground mt-1">
                Ref: {table.referenceCode}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Slug</label>
              <p className="font-mono text-sm">{table.slug}</p>
            </div>
            {table.tableNumber && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Table Number</label>
                <p>{table.tableNumber}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Primary Owner</label>
              <p>
                {table.primaryOwner.firstName || table.primaryOwner.lastName
                  ? `${table.primaryOwner.firstName || ""} ${table.primaryOwner.lastName || ""}`.trim()
                  : table.primaryOwner.email}
              </p>
              <p className="text-xs text-muted-foreground">{table.primaryOwner.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm">{format(new Date(table.createdAt), "PPp")}</p>
            </div>
          </CardContent>
        </Card>

        {table.welcomeMessage && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Welcome Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{table.welcomeMessage}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Guests List */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Guests</CardTitle>
          <CardDescription>
            {filledSeats} of {table.capacity} seats filled
          </CardDescription>
        </CardHeader>
        <CardContent>
          {table.guests.length === 0 ? (
            <p className="text-muted-foreground text-sm">No guests assigned to this table yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Checked In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.guests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell>
                      {guest.displayName ||
                        (guest.userFirstName || guest.userLastName
                          ? `${guest.userFirstName || ""} ${guest.userLastName || ""}`.trim()
                          : "—")}
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
