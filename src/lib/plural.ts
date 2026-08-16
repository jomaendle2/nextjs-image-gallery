/**
 * Counted nouns, written the way a person would say them.
 *
 * Small, and here rather than inline because the alternative was the same
 * ternary six times across two components, each free to drift. "1
 * photographs" is the kind of thing nobody notices in review and everybody
 * notices in an email that just went to the whole list.
 *
 * English only, deliberately: the site is English, and a real
 * internationalisation layer would be a much larger commitment than this
 * function is pretending to make.
 */
export function counted(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** As above, for nouns whose plural is just an `s`. */
export function count(n: number, singular: string): string {
  return counted(n, singular, `${singular}s`);
}
