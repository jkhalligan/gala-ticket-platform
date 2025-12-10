# Revised Frontend Development Strategy
## Production UX/UI Best Practices

## Key Changes from Prototype

### 1. **Modal vs Full-Page Strategy**

**Full-Page (User leaves context for focused task):**
- ✅ **Checkout flow** - Multi-step purchase requires focus, no distractions
- ✅ **Table dashboard** - Primary destination, not contextual action
- ✅ **Tickets dashboard** - Primary destination

**Modal (Quick action without losing context):**
- ✅ **Table setup** - After checkout, configure table before dashboard
- ✅ **Guest editing** - Quick edit from dashboard
- ✅ **Guest claiming** - Quick action to claim a seat
- ✅ **Confirmation dialogs** - Delete, transfer, etc.

**Why this is better:**
- Follows e-commerce best practices (Stripe, Shopify, etc.)
- Clear mental model: full-page = major decision, modal = quick action
- Better mobile experience (modals can be tricky on small screens for complex forms)
- Easier to bookmark/share (e.g., `/checkout` is shareable, modal is not)

### 2. **Color System: Neutral Base + Brand Injection**

**Base Palette (Always Present):**
```css
/* Neutrals - Professional, clean */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-300: #D1D5DB;
--gray-400: #9CA3AF;
--gray-500: #6B7280;
--gray-600: #4B5563;
--gray-700: #374151;
--gray-800: #1F2937;
--gray-900: #111827;

/* Semantic colors */
--success: #10B981;
--warning: #F59E0B;
--error: #EF4444;
--info: #3B82F6;
```

**Brand Colors (Injected from DB at runtime):**
```css
/* These come from BrandColor model */
--brand-primary: #[FROM_DB];    /* Main CTA color */
--brand-secondary: #[FROM_DB];  /* Light backgrounds */
--brand-accent: #[FROM_DB];     /* Dark accents */
--brand-confetti: #[FROM_DB];   /* Array for animations */
```

**Fallback Brand Colors (For initial development):**
```css
/* Use these until brand system is ready */
--brand-primary: #3B82F6;      /* Professional blue */
--brand-secondary: #EFF6FF;    /* Light blue */
--brand-accent: #1E40AF;       /* Dark blue */
```

**Usage:**
```tsx
// CTAs use brand color
<button className="bg-[var(--brand-primary)] text-white">
  Buy Ticket
</button>

// Everything else uses neutrals
<div className="bg-gray-50 border border-gray-200">
  Professional content
</div>
```

### 3. **UX Best Practices Over Prototype Copying**

**Typography:**
- Use system font stack for speed: `font-sans` (Inter, SF Pro, Segoe UI)
- Clear hierarchy: H1 (36px) → H2 (30px) → H3 (24px) → Body (16px)
- Line height: 1.5 for body, 1.2 for headings
- Max width: 65-75 characters per line for readability

**Spacing:**
- Consistent 8px grid system
- Generous whitespace (don't cram)
- Section padding: 64px desktop, 32px mobile
- Component padding: 24px desktop, 16px mobile

**Forms:**
- Labels above inputs (more accessible than floating)
- Clear error messages below fields
- Disabled state visually obvious
- Focus states highly visible (blue ring)
- Required fields marked with *

**Buttons:**
- Primary: Solid background, high contrast
- Secondary: Outlined, lower hierarchy
- Destructive: Red outline (not filled, less scary)
- Minimum touch target: 44x44px (mobile)
- Loading states: Spinner + "Processing..."

**Cards:**
- Subtle shadows: `shadow-sm` by default
- Hover: Lift slightly (`hover:shadow-md`)
- Borders: 1px solid gray-200
- Rounded corners: 8px (not too round)

**Feedback:**
- Success: Green toast, auto-dismiss 3s
- Error: Red toast, manual dismiss
- Loading: Skeleton screens > spinners
- Optimistic UI where safe

---

## Revised Route Structure

```
app/
├── (public)/
│   ├── page.tsx                         # Landing page
│   ├── checkout/
│   │   └── page.tsx                     # Full-page checkout (NOT modal)
│   └── t/[slug]/
│       └── page.tsx                     # Public table view (shareable link)
│
└── (authenticated)/
    └── dashboard/
        ├── table/[slug]/
        │   └── page.tsx                 # Table dashboard (full page)
        └── tickets/
            └── page.tsx                 # Individual tickets (full page)

components/
├── ui/                                   # shadcn/ui base components
├── public/
│   ├── PricingCard.tsx
│   ├── CheckoutSteps.tsx                # Multi-step checkout UI
│   └── modals/
│       ├── TableSetupModal.tsx          # After checkout
│       └── GuestClaimModal.tsx          # From share link
└── dashboard/
    ├── GuestListItem.tsx
    ├── ProgressWidget.tsx
    └── modals/
        ├── GuestEditModal.tsx
        └── ConfirmationDialog.tsx
```

---

## Component Design Standards

### Buttons

```tsx
// Primary CTA
<button className="
  bg-[var(--brand-primary)] text-white
  hover:bg-[var(--brand-accent)]
  px-6 py-3 rounded-lg
  font-semibold text-base
  transition-colors duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
  focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-2
  min-h-[44px]
">
  Continue to Payment
</button>

// Secondary
<button className="
  border-2 border-gray-300 text-gray-700
  hover:border-gray-400 hover:bg-gray-50
  px-6 py-3 rounded-lg
  font-semibold text-base
  transition-colors duration-200
">
  Go Back
</button>

// Destructive
<button className="
  border-2 border-red-500 text-red-600
  hover:bg-red-50
  px-6 py-3 rounded-lg
  font-semibold text-base
  transition-colors duration-200
">
  Cancel Reservation
</button>
```

### Form Inputs

```tsx
// Text input
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Full Name <span className="text-red-500">*</span>
  </label>
  <input
    type="text"
    required
    className="
      w-full px-4 py-3 rounded-lg
      border border-gray-300
      focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20
      transition-all duration-200
      disabled:bg-gray-100 disabled:cursor-not-allowed
      placeholder:text-gray-400
    "
    placeholder="John Smith"
  />
  {/* Error state */}
  <p className="text-sm text-red-600 mt-1">This field is required</p>
</div>
```

### Cards

```tsx
// Standard card
<div className="
  bg-white rounded-lg
  border border-gray-200
  p-6
  hover:shadow-md hover:border-gray-300
  transition-all duration-200
">
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    Card Title
  </h3>
  <p className="text-gray-600">
    Card content with good contrast and readability.
  </p>
</div>

// Highlighted card (uses brand color)
<div className="
  bg-white rounded-lg
  border-2 border-[var(--brand-primary)]
  p-6
  shadow-md
">
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    Recommended Option
  </h3>
</div>
```

### Badges

```tsx
// Status badges (semantic colors, not brand)
<span className="
  inline-flex items-center gap-1
  px-3 py-1 rounded-full
  text-sm font-medium
  bg-green-100 text-green-800
">
  <CheckCircle className="w-4 h-4" />
  Paid
</span>

<span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
  Pending
</span>

<span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
  Not Started
</span>
```

---

## Revised Checkout Flow (Full-Page)

### Route: `/checkout`

**URL Parameters:**
```
/checkout?type=VIP&format=individual
/checkout?type=VVIP&format=table&isHost=true
/checkout?type=Standard&format=table&isCaptain=true
```

**Page Structure:**
```tsx
// app/(public)/checkout/page.tsx

export default function CheckoutPage({ searchParams }) {
  const { type, format, isHost, isCaptain } = searchParams
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Pink Gala
          </Link>
          <div className="text-sm text-gray-600">
            Secure Checkout
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <CheckoutSteps 
          ticketType={type}
          format={format}
          isHost={isHost}
          isCaptain={isCaptain}
        />
      </div>
    </div>
  )
}
```

**Multi-Step Progress (Top of page):**
```tsx
<div className="mb-8">
  <div className="flex items-center justify-between max-w-2xl mx-auto">
    {steps.map((step, i) => (
      <div key={i} className="flex items-center">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center font-semibold",
          i < currentStep 
            ? "bg-green-500 text-white" 
            : i === currentStep
            ? "bg-[var(--brand-primary)] text-white"
            : "bg-gray-200 text-gray-600"
        )}>
          {i < currentStep ? <Check /> : i + 1}
        </div>
        {i < steps.length - 1 && (
          <div className={cn(
            "w-24 h-1 mx-2",
            i < currentStep ? "bg-green-500" : "bg-gray-200"
          )} />
        )}
      </div>
    ))}
  </div>
  <div className="text-center mt-4">
    <h2 className="text-2xl font-bold text-gray-900">
      {steps[currentStep].title}
    </h2>
    <p className="text-gray-600 mt-1">
      {steps[currentStep].description}
    </p>
  </div>
</div>
```

**Steps:**
1. **Buyer Information** (Name, email, phone)
2. **Guest Details** (Fork: Enter now vs Send later)
3. **Payment** (Stripe Elements)
4. **Confirmation** (Success screen)

**Layout:**
```tsx
<div className="grid md:grid-cols-3 gap-8">
  {/* Left: Form (2 columns) */}
  <div className="md:col-span-2">
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Step content here */}
    </div>
    
    {/* Navigation */}
    <div className="flex gap-4 mt-6">
      {currentStep > 0 && (
        <button onClick={prevStep} className="secondary-button">
          Back
        </button>
      )}
      <button onClick={nextStep} className="primary-button flex-1">
        {isLastStep ? 'Complete Purchase' : 'Continue'}
      </button>
    </div>
  </div>
  
  {/* Right: Order Summary (1 column, sticky) */}
  <div className="md:col-span-1">
    <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-4">
      <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">VIP Table (10 seats)</span>
          <span className="font-semibold">$5,000</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Processing fees</span>
          <span>$150</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-bold text-xl">$5,150</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Tax-deductible amount: $3,700 (value of goods: $130/seat)
      </p>
    </div>
  </div>
</div>
```

---

## Table Setup Modal (After Successful Checkout)

**Trigger:** After Stripe payment succeeds for table purchase

**Why Modal?**
- User just completed checkout, still has context
- Quick configuration before entering dashboard
- Can skip and configure later from dashboard

```tsx
<Dialog open={showTableSetup} onOpenChange={setShowTableSetup}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Welcome! Let's Set Up Your Table</DialogTitle>
      <DialogDescription>
        Create a custom page for your guests to view and claim seats.
      </DialogDescription>
    </DialogHeader>
    
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Table Name
          </label>
          <input
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
            placeholder="Scott's 50th Bash"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your table link: gala.org/t/<span className="font-mono">scotts-50th-bash</span>
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Welcome Message (Optional)
          </label>
          <textarea
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
            rows={3}
            placeholder="Join us for an unforgettable evening..."
          />
        </div>
      </div>
      
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={() => setShowTableSetup(false)}
          className="flex-1 border-2 border-gray-300 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-50"
        >
          Skip for Now
        </button>
        <button
          type="submit"
          className="flex-1 bg-[var(--brand-primary)] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[var(--brand-accent)]"
        >
          Create Table
        </button>
      </div>
    </form>
  </DialogContent>
</Dialog>
```

---

## Guest Edit Modal

**Trigger:** Click edit icon on guest list item

```tsx
<Dialog open={editingGuest !== null} onOpenChange={() => setEditingGuest(null)}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Edit Guest Details</DialogTitle>
    </DialogHeader>
    
    <form onSubmit={handleSaveGuest}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={guestForm.name}
            onChange={e => setGuestForm({ ...guestForm, name: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={guestForm.email}
            onChange={e => setGuestForm({ ...guestForm, email: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dietary Restrictions
          </label>
          <div className="flex flex-wrap gap-2">
            {['Gluten Free', 'Vegan', 'Vegetarian', 'Nut Allergy'].map(diet => (
              <button
                key={diet}
                type="button"
                onClick={() => toggleDietary(diet)}
                className={cn(
                  "px-3 py-2 rounded-full text-sm font-medium border-2 transition-colors",
                  guestForm.dietary.includes(diet)
                    ? "border-[var(--brand-primary)] bg-[var(--brand-secondary)] text-[var(--brand-primary)]"
                    : "border-gray-300 text-gray-700 hover:border-gray-400"
                )}
              >
                {diet}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={() => setEditingGuest(null)}
          className="flex-1 border-2 border-gray-300 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 bg-[var(--brand-primary)] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[var(--brand-accent)]"
        >
          Save Changes
        </button>
      </div>
    </form>
  </DialogContent>
</Dialog>
```

---

## Updated Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Semantic colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

**CSS Variables (app/globals.css):**
```css
@layer base {
  :root {
    /* shadcn/ui defaults (neutral) */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%; /* Fallback blue */
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
    
    /* Brand colors (injected at runtime or fallback) */
    --brand-primary: 221.2 83.2% 53.3%; /* Blue fallback */
    --brand-secondary: 214.3 100% 96.9%; /* Light blue */
    --brand-accent: 221.2 83.2% 43.3%; /* Dark blue */
  }
}
```

---

## Summary of Changes

| Aspect | Old (Prototype) | New (Production) |
|--------|----------------|------------------|
| Checkout | Modal | Full-page with steps |
| Table Setup | Separate page | Modal after payment |
| Guest Edit | Modal | Modal (same) |
| Colors | Hot pink + gold | Neutral + brand injection |
| Typography | Custom | System font stack |
| Buttons | Rounded, playful | Professional, accessible |
| Cards | Soft shadows | Subtle borders |
| Forms | Floating labels | Labels above (more accessible) |
| Spacing | Tight | Generous whitespace |

---

## Files Created Summary

You now have:
1. ✅ Revised strategy with UX best practices
2. ✅ Component design standards (copy-paste ready)
3. ✅ Neutral color system + brand injection
4. ✅ Clear modal vs full-page guidelines
5. ✅ Updated Tailwind config
6. ✅ Checkout flow redesigned
7. ✅ Ready for Claude Code implementation

Ready to start building!
