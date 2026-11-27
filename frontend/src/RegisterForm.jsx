import { useState } from "react";

export default function RegisterForm() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const { name, email, password } = Object.fromEntries(new FormData(form));

    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Could not create your account.");
        return;
      }

      form.reset();
      setMessage("Account created successfully.");
    } catch {
      setMessage("Could not reach the registration service. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create an account</h2>

      <p>
        <label>
          Name
          <input name="name" autoComplete="name" maxLength={100} required />
        </label>
      </p>

      <p>
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
      </p>

      <p>
        <label>
          Password (at least 15 characters)
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={15}
            maxLength={128}
            required
          />
        </label>
      </p>

      <button type="submit" disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </button>

      <p role="status">{message}</p>
    </form>
  );
}
