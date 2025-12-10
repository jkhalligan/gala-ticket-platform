"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

interface GuestInfo {
  name: string
  email: string
  dietaryRestrictions: string[]
}

interface Step3Props {
  initialGuests: GuestInfo[]
  quantity: number
  buyerInfo: { firstName: string; lastName: string; email: string }
  onNext: (guests: GuestInfo[]) => void
  onBack: () => void
}

const DIETARY_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "gluten-free", label: "Gluten-Free" },
  { id: "kosher", label: "Kosher" },
  { id: "halal", label: "Halal" },
  { id: "nut-allergy", label: "Nut Allergy" },
]

export function Step3_GuestDetails({
  initialGuests,
  quantity,
  buyerInfo,
  onNext,
  onBack,
}: Step3Props) {
  // Initialize with buyer as first guest if no initial guests
  const defaultGuests: GuestInfo[] =
    initialGuests.length > 0
      ? initialGuests
      : [
          {
            name: `${buyerInfo.firstName} ${buyerInfo.lastName}`,
            email: buyerInfo.email,
            dietaryRestrictions: [],
          },
          ...Array(Math.max(0, quantity - 1))
            .fill(null)
            .map(() => ({ name: "", email: "", dietaryRestrictions: [] })),
        ]

  const [guests, setGuests] = useState<GuestInfo[]>(defaultGuests)
  const [errors, setErrors] = useState<Record<number, { name?: string; email?: string }>>({})

  const updateGuest = (index: number, field: keyof GuestInfo, value: string | string[]) => {
    setGuests((prev) =>
      prev.map((guest, i) =>
        i === index ? { ...guest, [field]: value } : guest
      )
    )
    // Clear error on change
    if (errors[index]?.[field as keyof typeof errors[number]]) {
      setErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: undefined },
      }))
    }
  }

  const toggleDietary = (guestIndex: number, dietaryId: string) => {
    setGuests((prev) =>
      prev.map((guest, i) => {
        if (i !== guestIndex) return guest
        const current = guest.dietaryRestrictions
        const updated = current.includes(dietaryId)
          ? current.filter((d) => d !== dietaryId)
          : [...current, dietaryId]
        return { ...guest, dietaryRestrictions: updated }
      })
    )
  }

  const validate = (): boolean => {
    const newErrors: Record<number, { name?: string; email?: string }> = {}

    guests.forEach((guest, index) => {
      const guestErrors: { name?: string; email?: string } = {}

      // Only first guest (buyer) is required
      if (index === 0) {
        if (!guest.name.trim()) {
          guestErrors.name = "Name is required"
        }
        if (!guest.email.trim()) {
          guestErrors.email = "Email is required"
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) {
          guestErrors.email = "Invalid email format"
        }
      } else {
        // For other guests, validate email format if provided
        if (guest.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) {
          guestErrors.email = "Invalid email format"
        }
      }

      if (Object.keys(guestErrors).length > 0) {
        newErrors[index] = guestErrors
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onNext(guests)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Guest Details
        </h2>
        <p className="text-sm text-gray-500">
          {quantity === 1
            ? "Add your details for check-in"
            : `Enter details for your ${quantity} guests`}
        </p>
      </div>

      <div className="space-y-6">
        {guests.map((guest, index) => (
          <div
            key={index}
            className="p-4 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">
                {index === 0 ? "You (Primary Guest)" : `Guest ${index + 1}`}
              </h3>
              {index > 0 && guest.name === "" && guest.email === "" && (
                <span className="text-xs text-gray-400">Optional</span>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`guest-${index}-name`}>
                    Full Name {index === 0 && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id={`guest-${index}-name`}
                    value={guest.name}
                    onChange={(e) => updateGuest(index, "name", e.target.value)}
                    placeholder="Jane Smith"
                    className={errors[index]?.name ? "border-red-500" : ""}
                    disabled={index === 0} // Buyer name from step 1
                  />
                  {errors[index]?.name && (
                    <p className="text-sm text-red-500 mt-1">{errors[index].name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`guest-${index}-email`}>
                    Email {index === 0 && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id={`guest-${index}-email`}
                    type="email"
                    value={guest.email}
                    onChange={(e) => updateGuest(index, "email", e.target.value)}
                    placeholder="jane@example.com"
                    className={errors[index]?.email ? "border-red-500" : ""}
                    disabled={index === 0} // Buyer email from step 1
                  />
                  {errors[index]?.email && (
                    <p className="text-sm text-red-500 mt-1">{errors[index].email}</p>
                  )}
                </div>
              </div>

              {/* Dietary Restrictions */}
              <div>
                <Label className="mb-2 block">
                  Dietary Restrictions{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <div className="flex flex-wrap gap-3">
                  {DIETARY_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={guest.dietaryRestrictions.includes(option.id)}
                        onCheckedChange={() => toggleDietary(index, option.id)}
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
          size="lg"
        >
          Back
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-brand-primary hover:bg-brand-accent text-white"
          size="lg"
        >
          Continue to Payment
        </Button>
      </div>
    </form>
  )
}
