"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface TableSetupModalProps {
  tableSlug: string
  onComplete: (newSlug?: string) => void
  onSkip: () => void
}

export function TableSetupModal({
  tableSlug,
  onComplete,
  onSkip,
}: TableSetupModalProps) {
  const [tableName, setTableName] = useState("")
  const [customSlug, setCustomSlug] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/tables/${tableSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tableName || undefined,
          slug: customSlug || undefined,
          welcome_message: welcomeMessage || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save table settings")
      }

      // Pass new slug if it changed
      onComplete(data.new_slug || tableSlug)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  // Generate preview URL
  const previewSlug = customSlug || tableSlug

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Your Table</DialogTitle>
          <DialogDescription>
            Personalize your table settings. You can always change these later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Table Name */}
          <div className="space-y-2">
            <Label htmlFor="tableName">Table Name</Label>
            <Input
              id="tableName"
              placeholder="Smith Family Table"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              This will be displayed to your guests
            </p>
          </div>

          {/* Custom Slug */}
          <div className="space-y-2">
            <Label htmlFor="customSlug">Custom URL (optional)</Label>
            <Input
              id="customSlug"
              placeholder="smith-family"
              value={customSlug}
              onChange={(e) =>
                setCustomSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/--+/g, "-")
                )
              }
            />
            <p className="text-sm text-muted-foreground">
              Your table URL:{" "}
              <span className="font-mono text-xs">
                /dashboard/table/{previewSlug}
              </span>
            </p>
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Welcome Message (optional)</Label>
            <Textarea
              id="welcomeMessage"
              placeholder="Welcome to our table! We're excited to celebrate with you."
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onSkip} disabled={loading}>
              Skip for Now
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save & Continue"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
