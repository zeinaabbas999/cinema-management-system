const { Router } = require("express");
const { Prisma } = require("./generated/prisma/client.mts");
const prisma = require("./db");
const { requireAuth } = require("./auth");

const snacks = Router({ mergeParams: true });
const snackFields = { id: true, name: true, description: true, price: true, stockQuantity: true };
const orderFields = {
  status: true,
  totalAmount: true,
  items: {
    orderBy: { snackId: "asc" },
    select: { snackId: true, quantity: true, unitPrice: true, snack: { select: { name: true } } },
  },
};

async function readBooking(db, bookingId, userId) {
  return db.booking.findFirst({
    where: { id: bookingId, userId },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      holdExpiresAt: true,
      showtime: { select: { status: true, startTime: true } },
      snackOrder: { select: orderFields },
    },
  });
}

function bookingProblem(booking) {
  const now = new Date();
  if (!booking) return { status: 404, message: "Booking not found." };
  if (
    booking.status !== "PENDING" ||
    !booking.holdExpiresAt || booking.holdExpiresAt <= now ||
    booking.showtime.status !== "SCHEDULED" || booking.showtime.startTime <= now ||
    (booking.snackOrder && booking.snackOrder.status !== "PENDING")
  ) {
    return { status: 409, message: "Snacks can only be edited for an active booking hold." };
  }
  return null;
}

function summary(booking, order) {
  const ticketSubtotal = booking.totalAmount;
  const snackSubtotal = order?.totalAmount ?? new Prisma.Decimal(0);

  return {
    order,
    ticketSubtotal: ticketSubtotal.toFixed(2),
    snackSubtotal: snackSubtotal.toFixed(2),
    estimatedTotal: ticketSubtotal.plus(snackSubtotal).toFixed(2),
  };
}

function handleError(error, res) {
  if (error.code === "P2034" || error.code === "P2002") {
    return res.status(409).json({ message: "The booking changed. Reload it and try again." });
  }
  console.error("Snack pre-order failed:", error.code ?? error.name);
  return res.status(500).json({ message: "Could not process the snack pre-order." });
}

snacks.get("/", requireAuth, async (req, res) => {
  try {
    const booking = await readBooking(prisma, req.params.bookingId, req.user.id);
    const problem = bookingProblem(booking);
    if (problem) return res.status(problem.status).json({ message: problem.message });

    const catalog = await prisma.snack.findMany({
      where: { isAvailable: true, stockQuantity: { gt: 0 } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: snackFields,
    });

    return res.json({ catalog, ...summary(booking, booking.snackOrder) });
  } catch (error) {
    return handleError(error, res);
  }
});

snacks.put("/", requireAuth, async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || !items.every((item) =>
    item && typeof item.snackId === "string" && item.snackId.length > 0 &&
    Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 2_147_483_647
  ) || new Set(items.map(({ snackId }) => snackId)).size !== items.length) {
    return res.status(400).json({ message: "Send unique snack IDs with positive whole-number quantities." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await readBooking(tx, req.params.bookingId, req.user.id);
      const problem = bookingProblem(booking);
      if (problem) return { problem };

      if (items.length === 0) {
        if (booking.snackOrder) await tx.snackOrder.delete({ where: { bookingId: booking.id } });
        return { data: summary(booking, null) };
      }

      const available = await tx.snack.findMany({
        where: { id: { in: items.map(({ snackId }) => snackId) }, isAvailable: true },
        select: snackFields,
      });
      const catalog = new Map(available.map((snack) => [snack.id, snack]));
      const lines = [];
      let totalAmount = new Prisma.Decimal(0);

      for (const { snackId, quantity } of items) {
        const snack = catalog.get(snackId);
        if (!snack || quantity > snack.stockQuantity) {
          return { problem: { status: 409, message: snack
            ? "Only " + snack.stockQuantity + " available for " + snack.name + "."
            : "A selected snack is no longer available." } };
        }
        totalAmount = totalAmount.plus(snack.price.mul(quantity));
        lines.push({ snackId, quantity, unitPrice: snack.price });
      }

      if (totalAmount.gt("99999999.99")) {
        return { problem: { status: 400, message: "The snack total is too large." } };
      }

      // A pending order is a draft. Checkout must recheck and reserve stock atomically.
      const order = await tx.snackOrder.upsert({
        where: { bookingId: booking.id },
        create: { bookingId: booking.id, totalAmount, items: { create: lines } },
        update: { totalAmount, items: { deleteMany: {}, create: lines } },
        select: orderFields,
      });
      return { data: summary(booking, order) };
    }, { isolationLevel: "Serializable" });

    if (result.problem) return res.status(result.problem.status).json({ message: result.problem.message });
    return res.json(result.data);
  } catch (error) {
    return handleError(error, res);
  }
});

module.exports = snacks;
