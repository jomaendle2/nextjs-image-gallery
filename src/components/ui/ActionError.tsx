/**
 * Why the last action on this row failed.
 *
 * Deliberately small and in place rather than a toast: the operator is
 * looking at the row they just acted on, and a message that appears anywhere
 * else makes them work out which of twenty rows it belongs to.
 */
export function ActionError({ message }: { message: string | null }) {
  if (message === null) {
    return null;
  }

  return (
    <p className="mt-1.5 text-[0.75rem] text-white/70" role="alert">
      {message}
    </p>
  );
}
