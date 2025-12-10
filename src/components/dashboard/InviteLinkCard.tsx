"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, Check, Share2 } from "lucide-react"

interface InviteLinkCardProps {
  tableSlug: string
  tableName: string
}

export function InviteLinkCard({ tableSlug, tableName }: InviteLinkCardProps) {
  const [copied, setCopied] = useState(false)

  // Generate the shareable link
  const shareLink = typeof window !== "undefined"
    ? `${window.location.origin}/dashboard/table/${tableSlug}`
    : `/dashboard/table/${tableSlug}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${tableName}`,
          text: `You're invited to join ${tableName} for the gala!`,
          url: shareLink,
        })
      } catch (err) {
        // User cancelled or share failed
        console.log("Share cancelled or failed:", err)
      }
    } else {
      // Fallback to copy
      handleCopy()
    }
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-gray-900 mb-2">Share This Table</h3>
      <p className="text-sm text-gray-500 mb-4">
        Invite guests by sharing this link
      </p>

      <div className="flex gap-2">
        <Input
          value={shareLink}
          readOnly
          className="text-sm bg-gray-50"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          title="Copy link"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Native share button (mobile) */}
      {typeof navigator !== "undefined" && "share" in navigator && (
        <Button
          variant="outline"
          className="w-full mt-3"
          onClick={handleShare}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share Link
        </Button>
      )}

      {copied && (
        <p className="text-sm text-green-600 mt-2">Link copied to clipboard!</p>
      )}
    </Card>
  )
}
