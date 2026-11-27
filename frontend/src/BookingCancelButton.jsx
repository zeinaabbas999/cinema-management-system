import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export default function BookingCancelButton({ booking, token, onCancelled }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  if (!booking) return null;

  const showtimeMs = booking.showtime?.startTime
    ? new Date(booking.showtime.startTime).getTime()
    : null;
  const withinCutoff =
    showtimeMs !== null && showtimeMs - Date.now() < TWENTY_FOUR_HOURS_MS;
  const alreadyTerminal =
    booking.status === "CANCELLED" || booking.status === "EXPIRED";

  async function handleCancel() {
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/bookings/${encodeURIComponent(booking.id)}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Could not cancel booking.");
        return;
      }

      setConfirmation(data.notification);
      if (typeof onCancelled === "function") {
        onCancelled(data);
      }
    } catch {
      setError("Network error while cancelling booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {!alreadyTerminal && !confirmation && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting || withinCutoff}
          title={
            withinCutoff
              ? "Cancellation closes 24 hours before showtime"
              : "Cancel booking"
          }
        >
          {submitting ? "Cancelling..." : "Cancel Booking"}
        </button>
      )}

      {withinCutoff && !alreadyTerminal && !confirmation && (
        <p role="note">
          Cancellation is only available up to 24 hours before showtime.
        </p>
      )}

      {error && <p role="alert">{error}</p>}

      {confirmation && (
        <div role="status">
          <strong>{confirmation.title}</strong>
          <p>{confirmation.message}</p>
        </div>
      )}
    </div>
  );
}