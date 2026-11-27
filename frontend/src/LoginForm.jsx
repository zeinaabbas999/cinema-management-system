import { useState } from "react";

export default function LoginForm({ onLogin }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const { email, password } = Object.fromEntries(new FormData(form));

    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Could not log in.");
        return;
      }

      const accountResponse = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const account = await accountResponse.json();

      if (!accountResponse.ok) {
        setMessage(account.message || "Could not load your account.");
        return;
      }

      onLogin({ token: data.token, user: account.user });
    } catch {
      setMessage("Could not reach the login service. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Log in</h2>

      <p>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </p>

      <p>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
      </p>

      <button type="submit" disabled={submitting}>
        {submitting ? "Logging in…" : "Log in"}
      </button>

      <p role="status">{message}</p>
    </form>
  );
}
