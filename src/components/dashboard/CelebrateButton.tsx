// Component: CelebrateButton
// Button that triggers confetti animation

"use client"

import { Button } from "@/components/ui/button"
import confetti from "canvas-confetti"

export function CelebrateButton() {
  function handleCelebrate() {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    })
  }

  return (
    <Button
      variant="outline"
      onClick={handleCelebrate}
      className="w-full"
    >
      🎉 Celebrate
    </Button>
  )
}
