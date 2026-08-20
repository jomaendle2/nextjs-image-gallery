/**
 * Waiting, as a thing that can be substituted.
 *
 * One line of code in its own module, which needs justifying. The nudge cron
 * is a loop that sends mail, and the property worth testing about it is where
 * in the loop it waits — a wait after the last send is a sleep, and a wait
 * before the first delays every run for nothing. Testing that against a
 * real timer means a suite that either sleeps for real or reaches for fake
 * timers around code that is already awaiting four mocked promises per
 * iteration.
 *
 * A module boundary is the cheapest honest seam: the test substitutes this
 * and reads the order of operations, and the production path is a `setTimeout`
 * with nothing clever in it.
 */

/** Resolves after `ms` milliseconds. */
export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
