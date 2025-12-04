# Pink Gala Platform – Getting Started Guide

## 1. Clone the Repository
```bash
git clone <repo-url>
cd pink-gala-portal
```

## 2. Install Dependencies
```bash
npm install
```

## 3. Environment Variables
Create `.env.local` with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_ANON_KEY"

SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
SUPABASE_DB_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"

# Prisma
DATABASE_URL="${SUPABASE_DB_URL}"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# App
NEXT_PUBLIC_APP_URL="https://thepinkgala.org"
```

## 4. Initialize Prisma
```bash
npx prisma migrate dev
```

## 5. Run the Dev Server
```bash
npm run dev
```

## 6. Supabase Setup
1. Create a Supabase project  
2. Enable:
   - **Auth → Email Magic Links**
   - **Database → SQL Editor** (paste migrations when needed)
3. Retrieve:
   - Project URL  
   - Anon key  
   - Service role key  
   - Database connection string  

## 7. Stripe Setup
1. Create products and prices  
2. Configure a webhook endpoint:
```
https://your-deployment-url/api/webhooks/stripe
```
3. Add webhook secret to `.env.local`

## 8. Project Structure
```
src/
  app/
    api/
      tables/
      orders/
      guests/
      webhooks/stripe/
    login/
    dashboard/
  lib/
    prisma.ts
    supabaseServer.ts
    supabaseClient.ts
    validation/
  server/
    auth/
    services/
```

## 9. Supabase Auth – Login Test
Visit:
```
/login
```
Enter an email.  
Check inbox for magic link.

## 10. Troubleshooting
### Prisma cannot connect?
Check:
- DATABASE_URL format
- Supabase IP restrictions (should be open or configured)

### Magic links not working?
Ensure email provider is enabled in Supabase Auth settings.

### Stripe errors?
Verify webhook signature and correct API version.

---

You're ready to begin implementing routes, seats logic, and the event workflows.
