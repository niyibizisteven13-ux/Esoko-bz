export function resolveVerificationDestination(
  destination: string | undefined,
  user: { email?: string | null; phone?: string | null } | null | undefined,
  channel: 'email' | 'whatsapp'
) {
  const trimmedDestination = String(destination || '').trim();
  if (trimmedDestination) return trimmedDestination;

  if (channel === 'whatsapp') {
    return String(user?.phone || '').trim();
  }

  return String(user?.email || '').trim();
}
