// Roles are derived from a server-configured allowlist, never from profile input.
export function adminEmails(config: string | undefined) {
  return (config || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}
export function isAdministrator(
  ownerId: string | null,
  email: string | null,
  config: string | undefined,
) {
  return (
    !!ownerId?.startsWith("chatgpt:") &&
    !!email &&
    adminEmails(config).includes(email.trim().toLowerCase())
  );
}
