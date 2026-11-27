const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "POST /api/bookings/:id/cancel enforces 24h window and sends confirmation notification",
  {
    skip: testDatabaseUrl
      ? false
      : "Set TEST_DATABASE_URL to a separate migrated database",
  },
  async (t) => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const secret = randomUUID() + randomUUID();
    process.env.JWT_SECRET = secret;

    const app = require("../../server");
    const prisma = require("../../db");
    const server = app.listen(0, "127.0.0.1");

    const ownerEmail = "cancel-owner-" + randomUUID() + "@example.com";
    const otherEmail = "cancel-other-" + randomUUID() + "@example.com";
    const suffix = randomUUID().slice(0, 8);

    let owner;
    let otherUser;
    let movie;
    let hall;
    let seat;

    t.after(async () => {
      try {
        await new Promise((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
          server.closeAllConnections();
        });
      } finally {
        try {
          const userIds = [owner?.id, otherUser?.id].filter(Boolean);
          if (userIds.length > 0) {
            await prisma.notification.deleteMany({
              where: { userId: { in: userIds } },
            });
            await prisma.auditLog.deleteMany({
              where: { actorId: { in: userIds } },
            });
            const bookings = await prisma.booking.findMany({
              where: { userId: { in: userIds } },
              select: { id: true },
            });
            const bookingIds = bookings.map((b) => b.id);
            if (bookingIds.length > 0) {
              await prisma.payment.deleteMany({
                where: { bookingId: { in: bookingIds } },
              });
              await prisma.seatAllocation.deleteMany({
                where: { bookingId: { in: bookingIds } },
              });
              await prisma.bookingSeat.deleteMany({
                where: { bookingId: { in: bookingIds } },
              });
              await prisma.booking.deleteMany({
                where: { id: { in: bookingIds } },
              });
            }
          }
          if (seat) await prisma.seat.deleteMany({ where: { id: seat.id } });
          if (hall) await prisma.hall.deleteMany({ where: { id: hall.id } });
          if (movie) await prisma.movie.deleteMany({ where: { id: movie.id } });
          await prisma.user.deleteMany({
            where: { email: { in: [ownerEmail, otherEmail] } },
          });
        } finally {
          await prisma.$disconnect();
        }
      }
    });

    await once(server, "listening");
    const baseUrl = "http://127.0.0.1:" + server.address().port;

    owner = await prisma.user.create({
      data: {
        name: "Booking Owner",
        email: ownerEmail,
        passwordHash: "hash",
        role: "CUSTOMER",
      },
    });
    otherUser = await prisma.user.create({
      data: {
        name: "Other User",
        email: otherEmail,
        passwordHash: "hash",
        role: "CUSTOMER",
      },
    });
    movie = await prisma.movie.create({
      data: {
        title: "Test Film " + suffix,
        durationMin: 120,
        status: "NOW_SHOWING",
      },
    });
    hall = await prisma.hall.create({
      data: {
        name: "Hall-" + suffix,
      },
    });
    seat = await prisma.seat.create({
      data: {
        hallId: hall.id,
        rowLabel: "A",
        seatNumber: 1,
      },
    });

    const ownerToken = jwt.sign({}, secret, {
      algorithm: "HS256",
      subject: owner.id,
      expiresIn: "1h",
    });
    const otherToken = jwt.sign({}, secret, {
      algorithm: "HS256",
      subject: otherUser.id,
      expiresIn: "1h",
    });

    async function cancelBooking(bookingId, token) {
      const res = await fetch(`${baseUrl}/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { status: res.status, data: await res.json() };
    }

    await t.test("rejects cancellation within 24 hours of showtime", async () => {
      const soonShowtime = await prisma.showtime.create({
        data: {
          movieId: movie.id,
          hallId: hall.id,
          startTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
          basePrice: "15.00",
          status: "SCHEDULED",
        },
      });
      const booking = await prisma.booking.create({
        data: {
          userId: owner.id,
          showtimeId: soonShowtime.id,
          status: "CONFIRMED",
          totalAmount: "15.00",
        },
      });

      const res = await cancelBooking(booking.id, ownerToken);
      assert.equal(res.status, 400);

      await prisma.booking.delete({ where: { id: booking.id } });
      await prisma.showtime.delete({ where: { id: soonShowtime.id } });
    });

    await t.test("rejects cancellation by non-owner", async () => {
      const futureShowtime = await prisma.showtime.create({
        data: {
          movieId: movie.id,
          hallId: hall.id,
          startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
          basePrice: "15.00",
          status: "SCHEDULED",
        },
      });
      const booking = await prisma.booking.create({
        data: {
          userId: owner.id,
          showtimeId: futureShowtime.id,
          status: "CONFIRMED",
          totalAmount: "15.00",
        },
      });

      const res = await cancelBooking(booking.id, otherToken);
      assert.equal(res.status, 403);

      await prisma.booking.delete({ where: { id: booking.id } });
      await prisma.showtime.delete({ where: { id: futureShowtime.id } });
    });

    await t.test(
      "cancels booking >= 24h before showtime, frees seat, refunds payment, and creates confirmation notification",
      async () => {
        const futureShowtime = await prisma.showtime.create({
          data: {
            movieId: movie.id,
            hallId: hall.id,
            startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
            basePrice: "15.00",
            status: "SCHEDULED",
          },
        });
        const booking = await prisma.booking.create({
          data: {
            userId: owner.id,
            showtimeId: futureShowtime.id,
            status: "CONFIRMED",
            totalAmount: "15.00",
          },
        });
        await prisma.seatAllocation.create({
          data: {
            showtimeId: futureShowtime.id,
            seatId: seat.id,
            bookingId: booking.id,
            status: "CONFIRMED",
          },
        });
        const payment = await prisma.payment.create({
          data: {
            bookingId: booking.id,
            amount: "15.00",
            method: "SIMULATED_CARD",
            status: "SUCCESS",
            paidAt: new Date(),
          },
        });

        const res = await cancelBooking(booking.id, ownerToken);
        assert.equal(res.status, 200);
        assert.equal(res.data.booking.status, "CANCELLED");
        assert.ok(res.data.booking.cancelledAt);
        assert.equal(res.data.releasedSeatsCount, 1);
        assert.equal(res.data.notification.type, "BOOKING_CANCELLED");
        assert.equal(res.data.notification.userId, owner.id);

        const remainingAlloc = await prisma.seatAllocation.findMany({
          where: { bookingId: booking.id },
        });
        assert.equal(remainingAlloc.length, 0);

        const updatedPayment = await prisma.payment.findUnique({
          where: { id: payment.id },
        });
        assert.equal(updatedPayment.status, "REFUNDED");

        const repeat = await cancelBooking(booking.id, ownerToken);
        assert.equal(repeat.status, 409);

        await prisma.notification.deleteMany({
          where: { userId: owner.id },
        });
        await prisma.auditLog.deleteMany({
          where: { entityId: booking.id },
        });
        await prisma.payment.deleteMany({ where: { id: payment.id } });
        await prisma.booking.delete({ where: { id: booking.id } });
        await prisma.showtime.delete({ where: { id: futureShowtime.id } });
      }
    );
  }
);