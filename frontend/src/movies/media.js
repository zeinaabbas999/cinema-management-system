export function safeMediaUrl(value) {
  if (typeof value !== "string" || /\s/.test(value)) return undefined;

  try {
    if (/^https?:\/\//i.test(value)) return new URL(value).href;
    if (value.startsWith("/")) {
      const base = "https://cinema.invalid";
      if (new URL(value, base).origin === base) return value;
    }
  } catch {
    return undefined;
  }

  return undefined;
}
