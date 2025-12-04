import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    db: !!process.env.DATABASE_URL,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    webhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
