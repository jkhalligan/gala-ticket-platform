# Phase 2: Checkout Flow
## Full-Page Multi-Step Checkout with Stripe Integration

## 📋 Phase Context

**Previous Phase:** Phase 1 - Landing Page ([PHASE-1-COMPLETION-REPORT.md](./PHASE-1-COMPLETION-REPORT.md))
**Prerequisites:** 
- Landing page deployed and working
- Auth bypass configured for development
- Branch `frontend-v1.1` exists

**Estimated Time:** 6-8 hours
**Git Branch:** Continue on `frontend-v1.1`

---

## 🎯 Objectives

**What we're building:**
- [ ] Full-page checkout route (`/checkout`)
- [ ] Multi-step progress indicator
- [ ] Buyer information form (Step 1)
- [ ] Guest details choice (Step 2) - "Fork in the road"
- [ ] Stripe payment integration (Step 3)
- [ ] Success screen (Step 4)
- [ ] Order summary sidebar (sticky)
- [ ] API route for creating Stripe session
- [ ] Webhook handler for payment confirmation (basic)

**Success Criteria:**
- ✅ User can complete checkout for any ticket type
- ✅ Stripe test payment processes successfully
- ✅ Order is created in database
- ✅ User redirected to appropriate dashboard
- ✅ Mobile responsive throughout flow
- ✅ Loading and error states handled

---

## 📚 Required Reading

**Before starting this phase, read:**
1. [TECH-STACK-VERSIONS.md](../TECH-STACK-VERSIONS.md) - Stripe version, Next.js patterns
2. [revised-frontend-strategy.md](../revised-frontend-strategy.md) - Checkout design system
3. [PHASE-1-COMPLETION-REPORT.md](./PHASE-1-COMPLETION-REPORT.md) - What was built last

**Design system references:**
- Form components: Section "Form Inputs" in design system
- Button styles: Section "Buttons"
- Multi-step patterns: Section "Checkout Flow (Full-Page)"

---

## 🏗️ Technical Architecture

### File Structure
```
app/
├── (public)/
│   ├── checkout/
│   │   └── page.tsx                 # Main checkout page
│   └── api/
│       └── checkout/
│           └── session/
│               └── route.ts         # Create Stripe session
components/
├── public/
│   └── checkout/
│       ├── CheckoutSteps.tsx        # Multi-step container
│       ├── Step1_BuyerInfo.tsx      # Buyer form
│       ├── Step2_GuestChoice.tsx    # Fork in the road
│       ├── Step3_GuestDetails.tsx   # Optional guest details
│       ├── Step4_Payment.tsx        # Stripe Elements
│       ├── SuccessScreen.tsx        # After payment
│       └── OrderSummary.tsx         # Sidebar component
lib/
└── stripe.ts                         # Stripe client utilities
```

### Component Hierarchy
```
CheckoutPage (Server Component)
└─ CheckoutSteps (Client Component - manages state)
    ├─ ProgressIndicator
    ├─ StepContent (dynamic)
    │   ├─ Step1_BuyerInfo
    │   ├─ Step2_GuestChoice
    │   ├─ Step3_GuestDetails (conditional)
    │   ├─ Step4_Payment
    │   └─ SuccessScreen
    └─ OrderSummary (sticky sidebar)
```

### Data Flow
```
Landing Page
    ↓ (Click "Buy")
/checkout?type=VIP&format=individual
    ↓ (Load page)
CheckoutSteps initialized with URL params
    ↓ (Step 1: Submit buyer info)
State updated, move to Step 2
    ↓ (Step 2: Choose "Enter now" or "Send later")
State updated, fork decision made
    ↓ (If "Enter now": Step 3, else: Skip to Step 4)
Step 3: Guest details form (optional)
    ↓
Step 4: Payment
    ↓ (Submit)
POST /api/checkout/session
    ↓ (Receive client secret)
Stripe Elements → confirmPayment()
    ↓ (Payment succeeds)
Stripe webhook → Create Order
    ↓
Redirect to dashboard or table setup
```

---

## 📝 Implementation Steps

### Step 1: Create Stripe Client Utility

**Goal:** Set up Stripe for client and server use

**Files:**
- Create: `lib/stripe.ts`

**Code:**
```typescript
// lib/stripe.ts
import { loadStripe } from '@stripe/stripe-js';
import Stripe from 'stripe';

// Client-side Stripe
export const getStripePromise = () => {
  return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
};

// Server-side Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia', // Latest version
});
```

**Environment Variables Needed:**
```bash
# .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

**Testing:**
- [ ] Import works in API route
- [ ] Import works in client component

---

### Step 2: Create API Route for Stripe Session

**Goal:** Create PaymentIntent on server

**Files:**
- Create: `app/(public)/api/checkout/session/route.ts`

**Code:**
```typescript
// app/(public)/api/checkout/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';

const CheckoutSessionSchema = z.object({
  eventId: z.string(),
  ticketType: z.enum(['STANDARD', 'VIP', 'VVIP']),
  quantity: z.number().min(1).max(10),
  format: z.enum(['individual', 'table']),
  isHost: z.boolean().optional(),
  isCaptain: z.boolean().optional(),
  buyerEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = CheckoutSessionSchema.parse(body);
    
    // Calculate amount (replace with DB lookup in production)
    const priceMap = { STANDARD: 250, VIP: 500, VVIP: 750 };
    const unitPrice = priceMap[data.ticketType];
    const totalAmount = unitPrice * data.quantity * 100; // Cents
    
    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      metadata: {
        eventId: data.eventId,
        ticketType: data.ticketType,
        quantity: data.quantity.toString(),
        format: data.format,
        isHost: data.isHost?.toString() || 'false',
        isCaptain: data.isCaptain?.toString() || 'false',
        buyerEmail: data.buyerEmail,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

**Testing:**
- [ ] POST request succeeds
- [ ] Returns client secret
- [ ] Validation rejects bad data
- [ ] Error handling works

---

### Step 3: Create Multi-Step State Container

**Goal:** Manage checkout flow state

**Files:**
- Create: `components/public/checkout/CheckoutSteps.tsx`

**Code:**
```typescript
'use client'

import { useState } from 'react';

type CheckoutStep = 1 | 2 | 3 | 4 | 'success';

interface CheckoutData {
  ticketType: 'STANDARD' | 'VIP' | 'VVIP';
  format: 'individual' | 'table';
  isHost: boolean;
  isCaptain: boolean;
  buyer: {
    name: string;
    email: string;
    phone: string;
  };
  guestChoice: 'enter-now' | 'send-later' | null;
  guests: Array<{
    name: string;
    email: string;
    dietary: string[];
  }>;
  payment: {
    amount: number;
    coverFees: boolean;
  };
}

export function CheckoutSteps({ 
  ticketType, 
  format,
  isHost,
  isCaptain 
}: {
  ticketType: string;
  format: string;
  isHost?: boolean;
  isCaptain?: boolean;
}) {
  const [step, setStep] = useState<CheckoutStep>(1);
  const [data, setData] = useState<CheckoutData>({
    ticketType: ticketType as any,
    format: format as any,
    isHost: isHost || false,
    isCaptain: isCaptain || false,
    buyer: { name: '', email: '', phone: '' },
    guestChoice: null,
    guests: [],
    payment: { amount: 0, coverFees: false }
  });
  
  const updateData = (partial: Partial<CheckoutData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };
  
  const nextStep = () => {
    if (step === 2 && data.guestChoice === 'send-later') {
      setStep(4); // Skip guest details
    } else if (typeof step === 'number') {
      setStep((step + 1) as CheckoutStep);
    }
  };
  
  const prevStep = () => {
    if (typeof step === 'number' && step > 1) {
      if (step === 4 && data.guestChoice === 'send-later') {
        setStep(2); // Skip back over step 3
      } else {
        setStep((step - 1) as CheckoutStep);
      }
    }
  };
  
  return (
    <div className="grid md:grid-cols-3 gap-8">
      {/* Main content - left side */}
      <div className="md:col-span-2">
        {/* Progress indicator */}
        <ProgressIndicator currentStep={step} />
        
        {/* Step content */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          {step === 1 && (
            <Step1_BuyerInfo 
              data={data}
              onNext={nextStep}
              onUpdate={updateData}
            />
          )}
          {step === 2 && (
            <Step2_GuestChoice
              data={data}
              onNext={nextStep}
              onBack={prevStep}
              onUpdate={updateData}
            />
          )}
          {step === 3 && (
            <Step3_GuestDetails
              data={data}
              onNext={nextStep}
              onBack={prevStep}
              onUpdate={updateData}
            />
          )}
          {step === 4 && (
            <Step4_Payment
              data={data}
              onSuccess={() => setStep('success')}
              onBack={prevStep}
            />
          )}
          {step === 'success' && (
            <SuccessScreen data={data} />
          )}
        </div>
      </div>
      
      {/* Order summary - right sidebar */}
      <div className="md:col-span-1">
        <OrderSummary data={data} />
      </div>
    </div>
  );
}
```

**Testing:**
- [ ] Steps advance correctly
- [ ] Fork logic works (skip step 3 if "send later")
- [ ] Back button works
- [ ] State persists across steps

---

### Step 4: Build Each Step Component

**Goal:** Individual step UI

**Files:**
- Create: `components/public/checkout/Step1_BuyerInfo.tsx`
- Create: `components/public/checkout/Step2_GuestChoice.tsx`
- Create: `components/public/checkout/Step3_GuestDetails.tsx`
- Create: `components/public/checkout/Step4_Payment.tsx`
- Create: `components/public/checkout/SuccessScreen.tsx`

**See revised-frontend-strategy.md for detailed component code**

**Testing:**
- [ ] Step 1: Form validation works
- [ ] Step 2: Both choices work
- [ ] Step 3: Guest forms work
- [ ] Step 4: Stripe Elements load
- [ ] Success: Shows correct info

---

### Step 5: Stripe Payment Integration

**Goal:** Process payment with Stripe Elements

**Files:**
- Update: `components/public/checkout/Step4_Payment.tsx`

**Key Code:**
```typescript
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripePromise } from '@/lib/stripe';

export function Step4_Payment({ data, onSuccess, onBack }) {
  const [clientSecret, setClientSecret] = useState('');
  
  useEffect(() => {
    // Create payment intent
    fetch('/api/checkout/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: 'event-id',
        ticketType: data.ticketType,
        quantity: 1,
        format: data.format,
        buyerEmail: data.buyer.email,
      })
    })
    .then(res => res.json())
    .then(({ clientSecret }) => setClientSecret(clientSecret));
  }, []);
  
  if (!clientSecret) {
    return <div>Loading payment form...</div>;
  }
  
  return (
    <Elements stripe={getStripePromise()} options={{ clientSecret }}>
      <PaymentForm onSuccess={onSuccess} />
    </Elements>
  );
}

function PaymentForm({ onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    
    setLoading(true);
    
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required'
    });
    
    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      onSuccess();
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button 
        type="submit" 
        disabled={!stripe || loading}
        className="w-full mt-6 bg-[hsl(var(--brand-primary))] text-white py-4 rounded-lg font-semibold"
      >
        {loading ? 'Processing...' : 'Complete Purchase'}
      </button>
    </form>
  );
}
```

**Testing:**
- [ ] Payment form loads
- [ ] Test card works (4242 4242 4242 4242)
- [ ] Error handling works
- [ ] Success callback fires

---

### Step 6: Create Main Checkout Page

**Goal:** Server component that wraps everything

**Files:**
- Create: `app/(public)/checkout/page.tsx`

**Code:**
```typescript
// app/(public)/checkout/page.tsx
import { CheckoutSteps } from '@/components/public/checkout/CheckoutSteps';

export default function CheckoutPage({
  searchParams
}: {
  searchParams: { type: string; format: string; isHost?: string; isCaptain?: string }
}) {
  const { type, format, isHost, isCaptain } = searchParams;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Secure Checkout</h1>
        </div>
      </header>
      
      {/* Main content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <CheckoutSteps
          ticketType={type}
          format={format}
          isHost={isHost === 'true'}
          isCaptain={isCaptain === 'true'}
        />
      </div>
    </div>
  );
}
```

**Testing:**
- [ ] Page loads with query params
- [ ] Header shows correctly
- [ ] CheckoutSteps receives correct props
- [ ] Layout is responsive

---

## 🧪 Testing Checklist

**Manual Testing:**
- [ ] Desktop (1920px) - All steps look good
- [ ] Tablet (768px) - Sidebar stacks properly
- [ ] Mobile (375px) - Forms are usable
- [ ] Stripe test card: 4242 4242 4242 4242
- [ ] Stripe decline card: 4000 0000 0000 0002
- [ ] Form validation catches errors
- [ ] Back button navigation works
- [ ] Fork logic (send later) skips step 3
- [ ] Success screen shows

**Browser Testing:**
- [ ] Chrome
- [ ] Safari
- [ ] Firefox (optional)

**Accessibility:**
- [ ] Keyboard navigation through forms
- [ ] Tab order makes sense
- [ ] Focus indicators visible
- [ ] Error messages announced
- [ ] ARIA labels on form fields

**Payment Flows:**
- [ ] Individual ticket purchase
- [ ] Full table purchase (isHost=true)
- [ ] Captain table (isCaptain=true)
- [ ] All three ticket types (Standard, VIP, VVIP)

---

## 🔍 Code Review Checklist

Before marking phase complete:
- [ ] All TypeScript errors resolved
- [ ] No console.log statements (except intentional)
- [ ] Proper error handling on API route
- [ ] Loading states in Payment step
- [ ] Stripe keys are in env variables (not hardcoded)
- [ ] Comments for Stripe integration
- [ ] Git commit: "Phase 2: Complete checkout flow"

---

## 🚀 Deployment

### Preview Deployment
```bash
git add .
git commit -m "Phase 2: Checkout flow with Stripe integration"
git push origin frontend-v1.1
```

Vercel will auto-deploy to preview URL

### Testing on Preview
- [ ] Visit preview URL
- [ ] Test with dev auth bypass: `?devAuth=test@example.com`
- [ ] Complete checkout with Stripe test card
- [ ] Verify redirect after payment
- [ ] Check mobile responsive

**Note:** Stripe webhooks won't work on preview yet (need to configure in Phase 3)

---

## 📄 Completion Report Template

After finishing, create `PHASE-2-COMPLETION-REPORT.md` with:

- ✅ All objectives met
- 📦 Files created/modified
- 🧪 Testing completed
- 🔍 Code quality verified
- 📸 Screenshots included
- 🤔 Key decisions documented
- 🐛 Known issues listed
- 🎁 Handoff notes for Phase 3

---

## 🤔 Expected Decisions

### Decision 1: Stripe PaymentIntent vs Checkout Session
**Options:**
- PaymentIntent: More control, embedded in page
- Checkout Session: Hosted by Stripe, less control

**Recommendation:** PaymentIntent (better UX)

### Decision 2: Guest Details Collection
**Options:**
- Required immediately
- Optional, send magic link later
- Fork in the road (let user choose)

**Recommendation:** Fork in the road (matches v1.0 UX)

### Decision 3: Order Creation Timing
**Options:**
- Immediately on form submit
- After payment succeeds (webhook)

**Recommendation:** After payment (more reliable)

---

## 🔗 Related Documents

- Previous phase: [PHASE-1-LANDING-PAGE.md](./PHASE-1-LANDING-PAGE.md)
- Next phase: [PHASE-3-TABLE-SETUP.md](./PHASE-3-TABLE-SETUP.md)
- Design system: [revised-frontend-strategy.md](../revised-frontend-strategy.md)
- Tech stack: [TECH-STACK-VERSIONS.md](../TECH-STACK-VERSIONS.md)
- Stripe docs: https://stripe.com/docs/payments/payment-intents

---

## 📝 Notes

- Keep Stripe test keys separate from production
- Don't commit `.env.local` to git
- Webhook setup comes in Phase 3 (not this phase)
- Mobile testing is critical for forms
- Loading states prevent double submissions
