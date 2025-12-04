-- CreateEnum
CREATE TYPE "TableType" AS ENUM ('PREPAID', 'CAPTAIN_PAYG');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TablePaymentStatus" AS ENUM ('NOT_APPLICABLE', 'UNPAID', 'PAID_OFFLINE', 'COMPED');

-- CreateEnum
CREATE TYPE "TableRole" AS ENUM ('OWNER', 'CO_OWNER', 'CAPTAIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('INDIVIDUAL_TICKET', 'FULL_TABLE', 'CAPTAIN_COMMITMENT', 'DONATION', 'FEE_UPSELL');

-- CreateEnum
CREATE TYPE "ProductTier" AS ENUM ('STANDARD', 'VIP', 'VVIP');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'COMPLETED', 'REFUNDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'CONVERTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('GUEST_ADDED', 'GUEST_REMOVED', 'GUEST_UPDATED', 'GUEST_REASSIGNED', 'GUEST_CHECKED_IN', 'TICKET_TRANSFERRED', 'TABLE_CREATED', 'TABLE_UPDATED', 'TABLE_DELETED', 'TABLE_ROLE_ADDED', 'TABLE_ROLE_REMOVED', 'ORDER_CREATED', 'ORDER_COMPLETED', 'ORDER_REFUNDED', 'ORDER_CANCELLED', 'ORDER_INVITED', 'ORDER_EXPIRED', 'USER_CREATED', 'USER_UPDATED', 'USER_LOGIN', 'ADMIN_OVERRIDE', 'SHEETS_SYNC', 'WAITLIST_CONVERTED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USER', 'TABLE', 'GUEST_ASSIGNMENT', 'ORDER', 'EVENT', 'ORGANIZATION', 'WAITLIST_ENTRY');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "stripe_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAdmin" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "supabase_auth_id" TEXT,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "event_date" TIMESTAMP(3) NOT NULL,
    "venue_name" TEXT,
    "venue_address" TEXT,
    "google_sheets_id" TEXT,
    "google_sheet_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "tickets_on_sale" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "primary_owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "welcome_message" TEXT,
    "internal_name" TEXT,
    "table_number" TEXT,
    "type" "TableType" NOT NULL DEFAULT 'CAPTAIN_PAYG',
    "status" "TableStatus" NOT NULL DEFAULT 'ACTIVE',
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "custom_total_price_cents" INTEGER,
    "seat_price_cents" INTEGER,
    "payment_status" "TablePaymentStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "payment_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableUserRole" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TableRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ProductKind" NOT NULL,
    "tier" "ProductTier" NOT NULL DEFAULT 'STANDARD',
    "price_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stripe_price_id" TEXT,
    "stripe_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "table_id" TEXT,
    "promo_code_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "stripe_payment_intent_id" TEXT,
    "stripe_charge_id" TEXT,
    "is_admin_created" BOOLEAN NOT NULL DEFAULT false,
    "invited_email" TEXT,
    "custom_price_cents" INTEGER,
    "payment_link_token" TEXT,
    "payment_link_expires" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestAssignment" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "table_id" TEXT,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "display_name" TEXT,
    "dietary_restrictions" JSONB,
    "bidder_number" TEXT,
    "checked_in_at" TIMESTAMP(3),
    "qr_code_token" TEXT,
    "auction_registered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableTag" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestTag" (
    "id" TEXT NOT NULL,
    "guest_assignment_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" "PromoDiscountType" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "max_uses" INTEGER,
    "current_uses" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "table_id" TEXT,
    "user_id" TEXT,
    "email" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "notes" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "converted_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEventLog" (
    "id" TEXT NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetRowMapping" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "sheet_name" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "sync_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetRowMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT,
    "actor_id" TEXT,
    "action" "ActivityAction" NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationAdmin_organization_id_idx" ON "OrganizationAdmin"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAdmin_user_id_organization_id_key" ON "OrganizationAdmin"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabase_auth_id_key" ON "User"("supabase_auth_id");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_supabase_auth_id_idx" ON "User"("supabase_auth_id");

-- CreateIndex
CREATE INDEX "Event_organization_id_idx" ON "Event"("organization_id");

-- CreateIndex
CREATE INDEX "Event_event_date_idx" ON "Event"("event_date");

-- CreateIndex
CREATE UNIQUE INDEX "Event_organization_id_slug_key" ON "Event"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "Table_event_id_idx" ON "Table"("event_id");

-- CreateIndex
CREATE INDEX "Table_primary_owner_id_idx" ON "Table"("primary_owner_id");

-- CreateIndex
CREATE INDEX "Table_slug_idx" ON "Table"("slug");

-- CreateIndex
CREATE INDEX "Table_status_idx" ON "Table"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Table_event_id_slug_key" ON "Table"("event_id", "slug");

-- CreateIndex
CREATE INDEX "TableUserRole_table_id_idx" ON "TableUserRole"("table_id");

-- CreateIndex
CREATE INDEX "TableUserRole_user_id_idx" ON "TableUserRole"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "TableUserRole_table_id_user_id_role_key" ON "TableUserRole"("table_id", "user_id", "role");

-- CreateIndex
CREATE INDEX "Product_event_id_idx" ON "Product"("event_id");

-- CreateIndex
CREATE INDEX "Product_event_id_kind_tier_idx" ON "Product"("event_id", "kind", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripe_payment_intent_id_key" ON "Order"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_payment_link_token_key" ON "Order"("payment_link_token");

-- CreateIndex
CREATE INDEX "Order_event_id_idx" ON "Order"("event_id");

-- CreateIndex
CREATE INDEX "Order_user_id_idx" ON "Order"("user_id");

-- CreateIndex
CREATE INDEX "Order_table_id_idx" ON "Order"("table_id");

-- CreateIndex
CREATE INDEX "Order_stripe_payment_intent_id_idx" ON "Order"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "Order_payment_link_token_idx" ON "Order"("payment_link_token");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuestAssignment_qr_code_token_key" ON "GuestAssignment"("qr_code_token");

-- CreateIndex
CREATE INDEX "GuestAssignment_event_id_idx" ON "GuestAssignment"("event_id");

-- CreateIndex
CREATE INDEX "GuestAssignment_table_id_idx" ON "GuestAssignment"("table_id");

-- CreateIndex
CREATE INDEX "GuestAssignment_user_id_idx" ON "GuestAssignment"("user_id");

-- CreateIndex
CREATE INDEX "GuestAssignment_order_id_idx" ON "GuestAssignment"("order_id");

-- CreateIndex
CREATE INDEX "GuestAssignment_qr_code_token_idx" ON "GuestAssignment"("qr_code_token");

-- CreateIndex
CREATE INDEX "GuestAssignment_event_id_table_id_idx" ON "GuestAssignment"("event_id", "table_id");

-- CreateIndex
CREATE INDEX "Tag_organization_id_idx" ON "Tag"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_organization_id_slug_key" ON "Tag"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "TableTag_table_id_idx" ON "TableTag"("table_id");

-- CreateIndex
CREATE INDEX "TableTag_tag_id_idx" ON "TableTag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "TableTag_table_id_tag_id_key" ON "TableTag"("table_id", "tag_id");

-- CreateIndex
CREATE INDEX "GuestTag_guest_assignment_id_idx" ON "GuestTag"("guest_assignment_id");

-- CreateIndex
CREATE INDEX "GuestTag_tag_id_idx" ON "GuestTag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "GuestTag_guest_assignment_id_tag_id_key" ON "GuestTag"("guest_assignment_id", "tag_id");

-- CreateIndex
CREATE INDEX "PromoCode_event_id_idx" ON "PromoCode"("event_id");

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_event_id_code_key" ON "PromoCode"("event_id", "code");

-- CreateIndex
CREATE INDEX "WaitlistEntry_event_id_idx" ON "WaitlistEntry"("event_id");

-- CreateIndex
CREATE INDEX "WaitlistEntry_table_id_idx" ON "WaitlistEntry"("table_id");

-- CreateIndex
CREATE INDEX "WaitlistEntry_user_id_idx" ON "WaitlistEntry"("user_id");

-- CreateIndex
CREATE INDEX "WaitlistEntry_email_idx" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_idx" ON "WaitlistEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StripeEventLog_stripe_event_id_key" ON "StripeEventLog"("stripe_event_id");

-- CreateIndex
CREATE INDEX "StripeEventLog_stripe_event_id_idx" ON "StripeEventLog"("stripe_event_id");

-- CreateIndex
CREATE INDEX "StripeEventLog_event_type_idx" ON "StripeEventLog"("event_type");

-- CreateIndex
CREATE INDEX "StripeEventLog_processed_idx" ON "StripeEventLog"("processed");

-- CreateIndex
CREATE INDEX "SheetRowMapping_event_id_idx" ON "SheetRowMapping"("event_id");

-- CreateIndex
CREATE INDEX "SheetRowMapping_entity_type_entity_id_idx" ON "SheetRowMapping"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "SheetRowMapping_event_id_entity_type_entity_id_key" ON "SheetRowMapping"("event_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "ActivityLog_organization_id_idx" ON "ActivityLog"("organization_id");

-- CreateIndex
CREATE INDEX "ActivityLog_event_id_idx" ON "ActivityLog"("event_id");

-- CreateIndex
CREATE INDEX "ActivityLog_actor_id_idx" ON "ActivityLog"("actor_id");

-- CreateIndex
CREATE INDEX "ActivityLog_entity_type_entity_id_idx" ON "ActivityLog"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "ActivityLog_created_at_idx" ON "ActivityLog"("created_at");

-- AddForeignKey
ALTER TABLE "OrganizationAdmin" ADD CONSTRAINT "OrganizationAdmin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAdmin" ADD CONSTRAINT "OrganizationAdmin_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_primary_owner_id_fkey" FOREIGN KEY ("primary_owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableUserRole" ADD CONSTRAINT "TableUserRole_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableUserRole" ADD CONSTRAINT "TableUserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestAssignment" ADD CONSTRAINT "GuestAssignment_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestAssignment" ADD CONSTRAINT "GuestAssignment_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestAssignment" ADD CONSTRAINT "GuestAssignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestAssignment" ADD CONSTRAINT "GuestAssignment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableTag" ADD CONSTRAINT "TableTag_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableTag" ADD CONSTRAINT "TableTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestTag" ADD CONSTRAINT "GuestTag_guest_assignment_id_fkey" FOREIGN KEY ("guest_assignment_id") REFERENCES "GuestAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestTag" ADD CONSTRAINT "GuestTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetRowMapping" ADD CONSTRAINT "SheetRowMapping_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
