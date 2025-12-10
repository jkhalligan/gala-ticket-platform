"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface BuyerInfo {
  email: string
  firstName: string
  lastName: string
  phone: string
}

interface Step1Props {
  initialData: BuyerInfo
  onNext: (data: BuyerInfo) => void
}

export function Step1_BuyerInfo({ initialData, onNext }: Step1Props) {
  const [formData, setFormData] = useState<BuyerInfo>(initialData)
  const [errors, setErrors] = useState<Partial<Record<keyof BuyerInfo, string>>>({})

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof BuyerInfo, string>> = {}

    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!formData.firstName) {
      newErrors.firstName = "First name is required"
    }

    if (!formData.lastName) {
      newErrors.lastName = "Last name is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onNext(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Your Information
        </h2>
        <p className="text-sm text-gray-500">
          Enter your details for the ticket purchase
        </p>
      </div>

      <div className="space-y-4">
        {/* Email */}
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            className={errors.email ? "border-red-500" : ""}
            autoComplete="email"
          />
          {errors.email && (
            <p className="text-sm text-red-500 mt-1">{errors.email}</p>
          )}
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              type="text"
              placeholder="Jane"
              value={formData.firstName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, firstName: e.target.value }))
              }
              className={errors.firstName ? "border-red-500" : ""}
              autoComplete="given-name"
            />
            {errors.firstName && (
              <p className="text-sm text-red-500 mt-1">{errors.firstName}</p>
            )}
          </div>
          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="Smith"
              value={formData.lastName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, lastName: e.target.value }))
              }
              className={errors.lastName ? "border-red-500" : ""}
              autoComplete="family-name"
            />
            {errors.lastName && (
              <p className="text-sm text-red-500 mt-1">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div>
          <Label htmlFor="phone">
            Phone Number <span className="text-gray-400">(optional)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={formData.phone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
            autoComplete="tel"
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-brand-primary hover:bg-brand-accent text-white py-3"
        size="lg"
      >
        Continue
      </Button>
    </form>
  )
}
