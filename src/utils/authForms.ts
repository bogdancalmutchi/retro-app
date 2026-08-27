export const MIN_PASSWORD_LENGTH = 10;

/**
 * Callable errors arrive as `functions/<code>` and their message is one we threw
 * deliberately, so it is safe to show. Transport failures (a blocked request, a
 * cold start timing out) instead surface as a bare code like "internal", which
 * means nothing to a user, so those fall back to a readable sentence.
 */
const OPAQUE_CALLABLE_ERRORS = ['internal', 'unavailable', 'deadline-exceeded', 'cancelled'];

export const callableMessage = (error: unknown, fallback: string) => {
  const message = (error as { message?: string })?.message?.trim();
  if (!message || OPAQUE_CALLABLE_ERRORS.includes(message.toLowerCase())) {
    return fallback;
  }
  return message;
};
