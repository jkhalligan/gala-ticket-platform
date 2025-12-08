"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GuestDetail {
  id: string;
  userId: string;
  displayName: string | null;
  tier: string;
  checkedInAt: string | null;
  bidderNumber: string | null;
  dietaryRestrictions: string[] | null;
  auctionRegistered: boolean;
  tableId: string | null;
  eventId: string;
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface TableOption {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  filledSeats: number;
}

export default function GuestEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tables, setTables] = React.useState<TableOption[]>([]);
  const [tablesLoading, setTablesLoading] = React.useState(false);

  // Form state
  const [displayName, setDisplayName] = React.useState("");
  const [tier, setTier] = React.useState<string>("STANDARD");
  const [tableId, setTableId] = React.useState<string>("unassigned");
  const [bidderNumber, setBidderNumber] = React.useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = React.useState("");
  const [auctionRegistered, setAuctionRegistered] = React.useState(false);
  const [eventId, setEventId] = React.useState("");
  const [userEmail, setUserEmail] = React.useState("");

  // Fetch guest data
  React.useEffect(() => {
    async function fetchGuest() {
      try {
        const response = await fetch(`/api/admin/guests/${id}`);
        if (response.ok) {
          const data = await response.json();
          const guest = data.guest as GuestDetail;

          setDisplayName(guest.displayName || "");
          setTier(guest.tier);
          setTableId(guest.tableId || "unassigned");
          setBidderNumber(guest.bidderNumber || "");
          setDietaryRestrictions(
            guest.dietaryRestrictions ? guest.dietaryRestrictions.join(", ") : ""
          );
          setAuctionRegistered(guest.auctionRegistered);
          setEventId(guest.eventId);
          setUserEmail(guest.user.email);

          // Fetch tables for this event
          fetchTables(guest.eventId);
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

  async function fetchTables(eventId: string) {
    setTablesLoading(true);
    try {
      const response = await fetch(`/api/admin/tables?eventId=${eventId}`);
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (err) {
      console.error("Failed to fetch tables:", err);
    } finally {
      setTablesLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // Parse dietary restrictions
      const parsedDietary = dietaryRestrictions
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const response = await fetch(`/api/admin/guests/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          tier,
          tableId: tableId === "unassigned" ? null : tableId,
          bidderNumber: bidderNumber.trim() || null,
          dietaryRestrictions: parsedDietary.length > 0 ? parsedDietary : null,
          auctionRegistered,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update guest");
      }

      router.push(`/admin/guests/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update guest");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !userEmail) {
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
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/guests/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Guest
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Edit Guest"
        description={`Editing: ${userEmail}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Guest Details</CardTitle>
          <CardDescription>
            Update the guest information below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Display Name */}
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium">
                  Display Name
                </label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Name shown on guest list"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Override name displayed on guest lists and seating charts
                </p>
              </div>

              {/* Ticket Tier */}
              <div className="space-y-2">
                <label htmlFor="tier" className="text-sm font-medium">
                  Ticket Tier
                </label>
                <Select
                  value={tier}
                  onValueChange={setTier}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="VVIP">VVIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table Assignment */}
              <div className="space-y-2">
                <label htmlFor="tableId" className="text-sm font-medium">
                  Table Assignment
                </label>
                <Select
                  value={tableId}
                  onValueChange={setTableId}
                  disabled={isSaving || tablesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tablesLoading ? "Loading tables..." : "Select a table"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {tables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name} ({table.filledSeats}/{table.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bidder Number */}
              <div className="space-y-2">
                <label htmlFor="bidderNumber" className="text-sm font-medium">
                  Bidder Number
                </label>
                <Input
                  id="bidderNumber"
                  value={bidderNumber}
                  onChange={(e) => setBidderNumber(e.target.value)}
                  placeholder="e.g., 001"
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Dietary Restrictions - Full width */}
            <div className="space-y-2">
              <label htmlFor="dietaryRestrictions" className="text-sm font-medium">
                Dietary Restrictions
              </label>
              <Input
                id="dietaryRestrictions"
                value={dietaryRestrictions}
                onChange={(e) => setDietaryRestrictions(e.target.value)}
                placeholder="e.g., Vegetarian, Gluten-free, Nut allergy"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple restrictions with commas
              </p>
            </div>

            {/* Auction Registered */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auctionRegistered"
                checked={auctionRegistered}
                onChange={(e) => setAuctionRegistered(e.target.checked)}
                disabled={isSaving}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="auctionRegistered" className="text-sm font-medium">
                Registered for Auction
              </label>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/admin/guests/${id}`)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
