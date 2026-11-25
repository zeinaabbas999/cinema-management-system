-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "MovieStatus" AS ENUM ('COMING_SOON', 'NOW_SHOWING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShowtimeStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('STANDARD', 'PREMIUM', 'ACCESSIBLE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('HELD', 'CONFIRMED', 'OFFERED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('SIMULATED_CARD', 'SIMULATED_WALLET');

-- CreateEnum
CREATE TYPE "SnackOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'FULFILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'WAITLIST_OFFER', 'OFFER_EXPIRED', 'SNACK_READY', 'GENERAL');

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "ageRating" TEXT,
ADD COLUMN     "genre" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "posterUrl" TEXT,
ADD COLUMN     "status" "MovieStatus" NOT NULL DEFAULT 'COMING_SOON',
ADD COLUMN     "trailerUrl" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hall" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "rowLabel" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "type" "SeatType" NOT NULL DEFAULT 'STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Showtime" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "status" "ShowtimeStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Showtime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showtimeId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "holdExpiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSeat" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "priceAtBooking" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "BookingSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatAllocation" (
    "id" TEXT NOT NULL,
    "showtimeId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "bookingId" TEXT,
    "waitlistOfferId" TEXT,
    "status" "AllocationStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "bookingSeatId" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Snack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnackOrder" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "SnackOrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SnackOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnackOrderItem" (
    "id" TEXT NOT NULL,
    "snackOrderId" TEXT NOT NULL,
    "snackId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SnackOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showtimeId" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL,
    "preferredSeatType" "SeatType",
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistOffer" (
    "id" TEXT NOT NULL,
    "waitlistEntryId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "WaitlistOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Hall_name_key" ON "Hall"("name");

-- CreateIndex
CREATE INDEX "Seat_hallId_idx" ON "Seat"("hallId");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_hallId_rowLabel_seatNumber_key" ON "Seat"("hallId", "rowLabel", "seatNumber");

-- CreateIndex
CREATE INDEX "Showtime_movieId_startTime_idx" ON "Showtime"("movieId", "startTime");

-- CreateIndex
CREATE INDEX "Showtime_hallId_startTime_idx" ON "Showtime"("hallId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Showtime_hallId_startTime_key" ON "Showtime"("hallId", "startTime");

-- CreateIndex
CREATE INDEX "Booking_userId_createdAt_idx" ON "Booking"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_showtimeId_status_idx" ON "Booking"("showtimeId", "status");

-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "BookingSeat_seatId_idx" ON "BookingSeat"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSeat_bookingId_seatId_key" ON "BookingSeat"("bookingId", "seatId");

-- CreateIndex
CREATE INDEX "SeatAllocation_bookingId_idx" ON "SeatAllocation"("bookingId");

-- CreateIndex
CREATE INDEX "SeatAllocation_waitlistOfferId_idx" ON "SeatAllocation"("waitlistOfferId");

-- CreateIndex
CREATE INDEX "SeatAllocation_status_expiresAt_idx" ON "SeatAllocation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_showtimeId_seatId_key" ON "SeatAllocation"("showtimeId", "seatId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionRef_key" ON "Payment"("transactionRef");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_bookingSeatId_key" ON "Ticket"("bookingSeatId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketCode_key" ON "Ticket"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "SnackOrder_bookingId_key" ON "SnackOrder"("bookingId");

-- CreateIndex
CREATE INDEX "SnackOrder_status_idx" ON "SnackOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SnackOrderItem_snackOrderId_snackId_key" ON "SnackOrderItem"("snackOrderId", "snackId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_showtimeId_status_joinedAt_idx" ON "WaitlistEntry"("showtimeId", "status", "joinedAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_userId_idx" ON "WaitlistEntry"("userId");

-- CreateIndex
CREATE INDEX "WaitlistOffer_waitlistEntryId_status_idx" ON "WaitlistOffer"("waitlistEntryId", "status");

-- CreateIndex
CREATE INDEX "WaitlistOffer_status_expiresAt_idx" ON "WaitlistOffer"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Movie_status_idx" ON "Movie"("status");

-- CreateIndex
CREATE INDEX "Movie_title_idx" ON "Movie"("title");

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "Hall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showtime" ADD CONSTRAINT "Showtime_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showtime" ADD CONSTRAINT "Showtime_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "Hall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_showtimeId_fkey" FOREIGN KEY ("showtimeId") REFERENCES "Showtime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_showtimeId_fkey" FOREIGN KEY ("showtimeId") REFERENCES "Showtime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_waitlistOfferId_fkey" FOREIGN KEY ("waitlistOfferId") REFERENCES "WaitlistOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_bookingSeatId_fkey" FOREIGN KEY ("bookingSeatId") REFERENCES "BookingSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnackOrder" ADD CONSTRAINT "SnackOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnackOrderItem" ADD CONSTRAINT "SnackOrderItem_snackOrderId_fkey" FOREIGN KEY ("snackOrderId") REFERENCES "SnackOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnackOrderItem" ADD CONSTRAINT "SnackOrderItem_snackId_fkey" FOREIGN KEY ("snackId") REFERENCES "Snack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_showtimeId_fkey" FOREIGN KEY ("showtimeId") REFERENCES "Showtime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===================================
-- CINEMA DATABASE VALIDATION RULES
-- ===================================

-- Movie duration must be positive
ALTER TABLE "Movie"
ADD CONSTRAINT "movie_duration_positive"
CHECK ("durationMin" > 0);

-- Showtime must end after it starts
ALTER TABLE "Showtime"
ADD CONSTRAINT "showtime_valid_time"
CHECK ("endTime" > "startTime");

-- Showtime ticket price cannot be negative
ALTER TABLE "Showtime"
ADD CONSTRAINT "showtime_price_nonnegative"
CHECK ("basePrice" >= 0);

-- Booking totals cannot be negative
ALTER TABLE "Booking"
ADD CONSTRAINT "booking_total_nonnegative"
CHECK ("totalAmount" >= 0);

-- Individual seat prices cannot be negative
ALTER TABLE "BookingSeat"
ADD CONSTRAINT "booking_seat_price_nonnegative"
CHECK ("priceAtBooking" >= 0);

-- Payment amounts must be nonnegative
ALTER TABLE "Payment"
ADD CONSTRAINT "payment_amount_nonnegative"
CHECK ("amount" >= 0);

-- Snack prices and inventory
ALTER TABLE "Snack"
ADD CONSTRAINT "snack_price_nonnegative"
CHECK ("price" >= 0);

ALTER TABLE "Snack"
ADD CONSTRAINT "snack_stock_nonnegative"
CHECK ("stockQuantity" >= 0);

-- Snack order totals and quantities
ALTER TABLE "SnackOrder"
ADD CONSTRAINT "snack_order_total_nonnegative"
CHECK ("totalAmount" >= 0);

ALTER TABLE "SnackOrderItem"
ADD CONSTRAINT "snack_item_valid_quantity"
CHECK ("quantity" > 0 AND "unitPrice" >= 0);

-- Seat numbers must be positive
ALTER TABLE "Seat"
ADD CONSTRAINT "seat_number_positive"
CHECK ("seatNumber" > 0);

-- Waitlist entries must request at least one seat
ALTER TABLE "WaitlistEntry"
ADD CONSTRAINT "waitlist_seat_count_positive"
CHECK ("seatCount" > 0);

-- Allocations must belong to exactly one owner
ALTER TABLE "SeatAllocation"
ADD CONSTRAINT "seat_allocation_single_owner"
CHECK (
  ("bookingId" IS NOT NULL AND "waitlistOfferId" IS NULL)
  OR
  ("bookingId" IS NULL AND "waitlistOfferId" IS NOT NULL)
);

-- Enable equality support in GiST indexes
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping scheduled showtimes in one hall
ALTER TABLE "Showtime"
ADD CONSTRAINT "no_overlapping_showtimes"
EXCLUDE USING gist (
  "hallId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
)
WHERE ("status" = 'SCHEDULED');