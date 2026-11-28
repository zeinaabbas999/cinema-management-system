import { useEffect, useId, useRef, useState } from "react";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP" });

async function requestSnacks(bookingId, token, options) {
  const response = await fetch("/api/bookings/" + encodeURIComponent(bookingId) + "/snacks", {
    ...options,
    headers: { Authorization: "Bearer " + token, ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Could not load the snack pre-order.");
  return data;
}

function savedQuantities(order) {
  return Object.fromEntries((order?.items ?? []).map(({ snackId, quantity }) => [snackId, quantity]));
}

export default function SnackPreOrder({ bookingId, token, onOrderSaved }) {
  const headingId = useId();
  const saveRequest = useRef(null);
  const [result, setResult] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!bookingId || !token) return;
    const controller = new AbortController();
    requestSnacks(bookingId, token, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setSaving(false);
        setMessage(null);
        setQuantities(savedQuantities(data.order));
        setResult({ bookingId, token, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ bookingId, token, error: error.message });
      });
    return () => {
      controller.abort();
      saveRequest.current?.abort();
    };
  }, [bookingId, token]);

  if (!bookingId || !token) return <p>Sign in and select seats before adding snacks.</p>;
  if (result?.bookingId !== bookingId || result.token !== token) return <p role="status">Loading snacks…</p>;
  if (result.error) return <p role="alert">{result.error}</p>;

  const { catalog, order, ticketSubtotal } = result.data;
  const availableIds = new Set(catalog.map(({ id }) => id));
  const menu = [
    ...catalog,
    ...(order?.items ?? []).filter(({ snackId }) => !availableIds.has(snackId)).map((item) => ({
      id: item.snackId,
      name: item.snack.name,
      price: item.unitPrice,
      stockQuantity: 0,
    })),
  ];
  const saved = savedQuantities(order);
  const edited = menu.some(({ id }) => Number(quantities[id] || 0) !== (saved[id] ?? 0));
  const estimate = menu.reduce((total, snack) =>
    total + Math.round(Number(snack.price) * 100) * Number(quantities[snack.id] || 0), 0) / 100;

  const subtotal = edited ? estimate : Number(result.data.snackSubtotal);
  const total = edited ? Number(ticketSubtotal) + subtotal : Number(result.data.estimatedTotal);

  async function save(event) {
    event.preventDefault();
    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);
    setMessage(null);

    let saved;
    try {
      saved = await requestSnacks(bookingId, token, {
        method: "PUT",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: menu.filter(({ id }) => Number(quantities[id]) > 0).map(({ id }) => ({
            snackId: id, quantity: Number(quantities[id]),
          })),
        }),
      });
      if (controller.signal.aborted) return;
      setQuantities(savedQuantities(saved.order));
      setResult({ bookingId, token, data: { ...saved, catalog } });
      setMessage({ text: "Snack selection saved." });
    } catch (error) {
      if (!controller.signal.aborted) setMessage({ error: true, text: error.message });
    } finally {
      setSaving(false);
    }

    if (saved) onOrderSaved?.(saved);
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>Add snacks and drinks</h2>
      <p>Optional. Stock is confirmed at checkout.</p>
      {menu.length === 0 ? <p>No snacks are available right now.</p> : (
        <form onSubmit={save}>
          <fieldset disabled={saving}>
            <legend>Snack menu</legend>
            {menu.map((snack) => (
              <div key={snack.id}>
                <h3>{snack.name}</h3>
                {snack.description && <p>{snack.description}</p>}
                <p>{currency.format(Number(snack.price))}</p>
                <label>
                  Quantity for {snack.name}
                  <input
                    type="number"
                    min="0"
                    max={snack.stockQuantity}
                    step="1"
                    value={quantities[snack.id] ?? 0}
                    onChange={(event) =>
                      setQuantities({ ...quantities, [snack.id]: event.target.value })}
                  />
                </label>
                {Number(quantities[snack.id]) > 0 && (
                  <button type="button" onClick={() => setQuantities({ ...quantities, [snack.id]: 0 })}>
                    Remove {snack.name}
                  </button>
                )}
                {snack.stockQuantity === 0 && <p>Unavailable. Remove this item before saving.</p>}
              </div>
            ))}
            <button type="submit">{saving ? "Saving…" : "Save snacks"}</button>
          </fieldset>
        </form>
      )}
      <p>Snack subtotal: {currency.format(subtotal)}</p>
      <p>Estimated booking total: {currency.format(total)}</p>
      {message && <p role={message.error ? "alert" : "status"}>{message.text}</p>}
    </section>
  );
}
