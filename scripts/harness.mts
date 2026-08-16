/**
 * The counter every smoke script keeps.
 *
 * Five scripts had copied `check`, a `failures` counter and the exit line,
 * in two incompatible argument orders — so a reader moving between them had
 * to notice which one they were in, and a sixth script would have picked
 * whichever it was pasted from.
 */
import process from "node:process";

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

/** How many have failed so far, for scripts that branch on it. */
export function failureCount(): number {
  return failures;
}
