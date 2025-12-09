"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string;
  guestName: string;
  guestEmail: string;
  dietaryRestrictions?: string;
  onSuccess?: () => void;
}

export function EditGuestDialog({
  open,
  onOpenChange,
  guestId,
  guestName,
  guestEmail,
  dietaryRestrictions,
  onSuccess,
}: EditGuestDialogProps) {
  const [name, setName] = React.useState(guestName);
  const [dietary, setDietary] = React.useState(dietaryRestrictions || "");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setName(guestName);
    setDietary(dietaryRestrictions || "");
  }, [guestName, dietaryRestrictions]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${guestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: name,
          dietary_restrictions: dietary || null,
        }),
      });

      if (response.ok) {
        toast.success("Your details updated");
        onSuccess?.();
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update");
      }
    } catch (error) {
      console.error("Failed to update guest:", error);
      toast.error("Failed to update");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Your Details</DialogTitle>
          <DialogDescription>
            Update your information for this event
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={guestEmail}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dietary">Dietary Restrictions</Label>
            <Textarea
              id="dietary"
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              placeholder="Any dietary restrictions or allergies..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
