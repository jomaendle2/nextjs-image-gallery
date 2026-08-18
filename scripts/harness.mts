/**
 * The counter every smoke script keeps.
 *
 * Six scripts had copied `check`, a `failures` counter and the exit line,
 * in two incompatible argument orders — so a reader moving between them had
 * to notice which one they were in, and a seventh script would have picked
 * whichever it was pasted from.
 */
import process from "node:process";

/*
 * A client address unique to this run.
 *
 * The Stripe routes are rate limited by `x-forwarded-for`, and a local
 * request carries none — so every run shared the one "unknown" bucket and
 * the *second* run of the day started failing with 429s that looked like
 * broken checkout code. A suite that only passes once an hour is a suite
 * people learn to re-run until it is green, which is worse than not having
 * it. Production always supplies this header; supplying it here is the
 * honest local equivalent, not a bypass.
 *
 * Here rather than in each script for the same reason `check` is: it was
 * written out twice, verbatim, and two copies of a rate-limit workaround
 * drift into two different buckets.
 */
export const RUN_IP = `10.0.${Math.floor(process.pid / 256) % 256}.${process.pid % 256}`;

let failures = 0;

/** Records one assertion and prints it. `detail` explains a failure. */
export function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) {
    failures += 1;
  }
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
}

/** A heading between groups of checks. */
export function section(name: string): void {
  console.log(name);
}

/**
 * Prints the tally and exits non-zero if anything failed.
 *
 * Call it last. Every script ended with its own copy of this line, and the
 * exit code is the only part CI reads.
 */
export function finish(): never {
  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
