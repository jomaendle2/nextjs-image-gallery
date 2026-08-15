/**
 * Who operates this site, and the facts the law wants stated.
 *
 * One file rather than three pages, because the same address has to appear
 * in the Impressum, the privacy policy and the terms, and three copies of a
 * postal address is three chances to update two of them.
 *
 * `OPERATOR.street` and friends are deliberately empty. An Impressum with a
 * plausible-looking invented address is worse than none at all — it is a
 * false statement of identity on a legal notice — so the pages render a
 * visible, unmissable gap until these are filled in, and `legalIsComplete()`
 * says whether they have been.
 *
 * German law (§5 DDG, formerly §5 TMG) requires the operator's name, a
 * postal address that accepts service — a PO box does not — an email
 * address, and a VAT identification number where one has been issued.
 */

export const OPERATOR = {
  /** Full legal name of the person or company operating the site. */
  name: "Jo Mändle",

  /** Street and number. A postal box is not sufficient under §5 DDG. */
  street: "",

  /** Postal code and town, e.g. "70173 Stuttgart". */
  city: "",

  country: "Germany",

  /** An address a reader can actually write to. */
  email: "hello@thebeautyof.earth",

  /**
   * USt-IdNr., if one has been issued. Empty is correct for a small
   * business under §19 UStG (Kleinunternehmerregelung), which is the likely
   * case here — but then the terms must say VAT is not charged, and the
   * `KLEINUNTERNEHMER` flag below controls that sentence.
   */
  vatId: "",

  /**
   * Whether the operator is a Kleinunternehmer under §19 UStG and therefore
   * shows no VAT. Set to false once turnover passes the threshold or VAT is
   * charged for any other reason — the price sentence in the terms changes
   * with it.
   */
  kleinunternehmer: true,
} as const;

/**
 * The three notices, in the order they are usually looked for.
 *
 * One list so the footer of every page carries the same set — a legal notice
 * that exists on some pages and not others is the failure mode the
 * "easily findable" requirement is written against.
 */
export const LEGAL_LINKS = [
  { href: "/imprint", label: "Imprint" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

/** What a membership costs, stated once. */
export const MEMBERSHIP = {
  price: "€5",
  interval: "month",
} as const;

/**
 * Whether the operator details are filled in enough to publish.
 *
 * Used by the legal pages to show a loud placeholder rather than quietly
 * rendering an incomplete notice, which would be worse than an obviously
 * unfinished one: a reader cannot tell a missing address from a site that
 * never had one, but the operator can see a warning.
 */
export function legalIsComplete(): boolean {
  return OPERATOR.street !== "" && OPERATOR.city !== "";
}

/** Third parties that receive personal data, and what each is given. */
export const PROCESSORS = [
  {
    name: "Vercel Inc.",
    role: "Hosting and delivery",
    data: "IP address and request metadata, in server logs",
    basis: "Necessary to deliver the site (Art. 6(1)(f) GDPR)",
  },
  {
    name: "Neon Inc.",
    role: "Database",
    data: "Everything stored: addresses, photographs, subscriptions",
    basis: "Necessary to provide the service (Art. 6(1)(b) and (f) GDPR)",
  },
  {
    name: "Stripe Payments Europe Ltd.",
    role: "Payments",
    data: "Email address, payment details, billing country",
    basis: "Necessary to perform the contract (Art. 6(1)(b) GDPR)",
  },
  {
    name: "Resend (Plain Text Inc.)",
    role: "Email delivery",
    data: "Email address and the contents of messages sent to it",
    basis: "Consent for the list (Art. 6(1)(a)); contract for sign-in links",
  },
  {
    name: "Plausible Analytics",
    role: "Visitor statistics",
    data: "None that identifies anybody — no cookies, no cross-site tracking",
    basis: "Legitimate interest in knowing what is read (Art. 6(1)(f) GDPR)",
  },
] as const;
