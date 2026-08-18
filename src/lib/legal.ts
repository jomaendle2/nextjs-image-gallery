/**
 * Who operates this site, and the facts the law wants stated.
 *
 * One file rather than three pages, because the same address has to appear
 * in the Impressum, the privacy policy and the terms, and three copies of a
 * postal address is three chances to update two of them.
 *
 * An Impressum with a plausible-looking invented address is worse than none
 * at all — it is a false statement of identity on a legal notice — so the
 * pages render a visible, unmissable gap until the address is filled in, and
 * `legalIsComplete()` says whether it has been. The address below is the one
 * on the operator's existing Impressum at jomaendle.com/impressum, so the two
 * notices name the same person at the same place.
 *
 * German law (§5 DDG, formerly §5 TMG) requires the operator's name, a
 * postal address that accepts service — a PO box does not — an email
 * address, and a VAT identification number where one has been issued.
 */

/**
 * Widened to `string` rather than left to `as const`. With literal types the
 * emptiness checks in `legalIsComplete()` and the Impressum become comparisons
 * the compiler can prove, so filling the address in turned three guards into
 * TS2367 errors. The guards have to survive the address being edited back out,
 * which is exactly when they matter.
 */
interface Operator {
  readonly name: string;
  readonly street: string;
  readonly city: string;
  readonly country: string;
  readonly email: string;
  readonly vatId: string;
  readonly kleinunternehmer: boolean;
}

export const OPERATOR: Operator = {
  /** Full legal name of the person or company operating the site. */
  name: "Jo Mändle",

  /** Street and number. A postal box is not sufficient under §5 DDG. */
  street: "Im Hirschmorgen 12",

  /** Postal code and town, e.g. "70173 Stuttgart". */
  city: "69181 Leimen",

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
};

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
  /*
   * The only processor a *visitor* never reaches.
   *
   * MapTiler serves the tiles behind the location picker, which lives on one
   * page behind a session. Nothing on a public page contacts it — invariant
   * I14 asserts that exactly one file in the codebase mentions the map
   * library at all, and that nothing under `src/components/gallery` does — so
   * this entry triggers no consent banner and sets no cookie. The site still
   * sets exactly one cookie, and it is still the session.
   *
   * Swiss rather than American, which is a shorter processor story for a
   * German operator than a US provider with the usual transfer paperwork.
   */
  {
    name: "MapTiler AG",
    role: "Map tiles, on the photographer upload page only",
    data: "IP address, when a signed-in photographer opens the map",
    basis:
      "Contract with contributors and legitimate interest (Art. 6(1)(b) and (f) GDPR)",
  },
  /*
   * The second processor a *visitor* never reaches, and the only one that is
   * sent a photograph.
   *
   * One row rather than two, and the name says why: the request goes to
   * Vercel's AI Gateway, which forwards it to whichever of the two model
   * providers is answering — Google first, Anthropic when it is not. Naming
   * only the one that usually answers would be a policy that is true on a
   * good day. Naming the gateway alone would hide the companies that
   * actually see the image.
   *
   * What is sent is the *display copy*: the re-encode the gallery serves,
   * which carries no metadata of any kind. The original upload — the one file
   * on this site that still holds whatever GPS the camera wrote — is never
   * fetched by this feature, and `src/app/api/photos/[id]/suggest/route.ts`
   * reads one column rather than the usual coalesce of two so that it cannot
   * become so by accident.
   *
   * Both providers are on terms that forbid training on what is sent, which
   * is the property that matters when the data is somebody else's
   * photographs. It happens only when a signed-in photographer presses a
   * button on their own draft, so nothing a visitor does reaches it and no
   * consent banner follows from it.
   *
   * The hint is named because it is the one thing here that a photographer
   * *composes* rather than something the file already held. They may type a
   * few words about where the picture was taken, and they may point at a
   * rough area on a map — and a coordinate leaving this server is the
   * category this site is most careful about, so it is disclosed rather than
   * folded into "a photograph". It is blunted to about eleven kilometres
   * before it is sent, it is sent only when somebody pointed at it on
   * purpose, and it is never stored on either side.
   */
  {
    name: "Vercel AI Gateway (Google, Anthropic)",
    role: "Suggested titles, descriptions and places, on the photographer upload page only",
    data: "A photograph, its camera settings, and any hint its photographer typed or pointed at — an approximate area, never an exact point",
    basis: "Contract with contributors (Art. 6(1)(b) GDPR)",
  },
  {
    name: "Plausible Analytics",
    role: "Visitor statistics",
    data: "None that identifies anybody — no cookies, no cross-site tracking",
    basis: "Legitimate interest in knowing what is read (Art. 6(1)(f) GDPR)",
  },
] as const;
