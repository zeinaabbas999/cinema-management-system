import { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

export default function AuthPanel() {
  const [session, setSession] = useState(null);
  const [registering, setRegistering] = useState(false);

  if (session) {
    return (
      <section aria-label="Your account">
        <p role="status">Welcome, {session.user.name}!</p>
        <button type="button" onClick={() => setSession(null)}>Log out</button>
      </section>
    );
  }

  return (
    <section aria-label="Account access">
      {registering ? <RegisterForm /> : <LoginForm onLogin={setSession} />}
      <button type="button" onClick={() => setRegistering(!registering)}>
        {registering ? "Back to log in" : "Create an account"}
      </button>
    </section>
  );
}
