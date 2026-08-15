import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The invariants from `docs/security-architecture.md`, as tests.
 *
 * Every one of these is here because something violated it, and in two cases
 * violated it twice — the second time in code written days after the first
 * was fixed, because a fix is not a rule. A document describing a control is
 * not the control; this file is the difference.
 *
 * These read source text rather than behaviour, which is unusual and
 * deliberate. It is the same technique `schema.test.ts` already uses to keep
 * migrations idempotent, and it suits properties that are about *shape* —
 * "this column is never selected here", "this handler is not a GET". A
 * behavioural test would need a database, a Stripe account and a mail
 * provider, and would therefore not run.
 *
 * They are necessarily approximate. A determined rewrite can slip past any
 * of them. That is fine: they exist to catch the next person doing the
 * obvious thing without knowing why it is wrong, and the failure message is
 * where they find out.
 */

const SRC = join(import.meta.dirname, "..");

function read(...parts: string[]): string {
  return readFileSync(join(SRC, ...parts), "utf8");
}

/** Every `.ts`/`.tsx` file under `src`, so a new violation cannot hide. */
function allSourceFiles(dir: string = SRC): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...allSourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) {
      found.push(full);
    }
  }
  return found;
}

describe("I1 — state changes on POST, never on GET", () => {
  /*
   * Corporate mail gateways fetch every URL in an inbound message. A
   * single-use token spent by a GET is spent before its recipient sees it,
   * which silently unsubscribed people and made magic links unusable behind
   * a mail gateway. Both are now pages with a button; neither may go back.
   */
  it("the unsubscribe link opens a page, not a mutating handler", () => {
    const page = read("app", "subscribe", "unsubscribe", "page.tsx");
    expect(page).toContain("<form");
    // The deletion itself must live behind a server action, not the render.
    expect(page).not.toMatch(/await\s+unsubscribe\(/);
  });

  it("the magic link opens a page, not a mutating handler", () => {
    const page = read("app", "contribute", "verify", "page.tsx");
    expect(page).toContain("<form");
    expect(page).not.toMatch(/await\s+consumeLoginToken\(/);
  });

  it("no GET route handler consumes a single-use token", () => {
    const offenders = allSourceFiles()
      .filter((file) => file.endsWith("route.ts"))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return (
          /export\s+(async\s+)?function\s+GET/.test(source) &&
          /(consumeLoginToken|unsubscribe|confirmSubscription)\s*\(/.test(
            source,
          )
        );
      });
    expect(offenders).toEqual([]);
  });
});

describe("I6 — paid content is never in a cacheable payload", () => {
  const repository = read("lib", "photos", "repository.ts");

  /*
   * The load-bearing decision of the membership. These two columns are not
   * in any page's payload, so they cannot leak by being rendered
   * conditionally — deleting the component that displays them would expose
   * nothing.
   */
  it("the feed columns do not select what a membership pays for", () => {
    const feedColumns = repository.slice(
      repository.indexOf("const FEED_COLUMNS"),
      repository.indexOf("const FEED_ORDER"),
    );
    expect(feedColumns).not.toContain("precise_location");
    expect(feedColumns).not.toContain("technique");
  });

  it("only the member-gated route reads them", () => {
    const readers = allSourceFiles().filter((file) => {
      if (file.endsWith(join("photos", "repository.ts"))) {
        return false;
      }
      return /getMemberDetails\s*\(/.test(readFileSync(file, "utf8"));
    });
    expect(readers.map((f) => f.replace(SRC, ""))).toEqual([
      join("/app", "api", "photo", "[id]", "details", "route.ts"),
    ]);
  });

  it("the member route forbids shared caching", () => {
    const route = read("app", "api", "photo", "[id]", "details", "route.ts");
    expect(route).toContain("private, no-store");
  });
});

describe("I7 — a guard checks the value an attacker can actually obtain", () => {
  /*
   * `blobIsClaimed` matched only `blob_pathname` — the original upload,
   * whose URL is never rendered — while every page renders the display
   * copy. The one URL obtainable from view-source was the one URL the guard
   * could not recognise, and a correct comment sat above it for months.
   */
  it("the ownership guard checks both stored pathnames", () => {
    const repository = read("lib", "photos", "repository.ts");
    const guard = repository.slice(
      repository.indexOf("export async function blobIsClaimed"),
      repository.indexOf("export async function insertDraftPhoto"),
    );
    expect(guard).toContain("blob_pathname");
    expect(guard).toContain("display_pathname");
  });

  it("the public URL comes from a column the guard knows about", () => {
    const repository = read("lib", "photos", "repository.ts");
    // If this ever selects a third URL column, the guard needs it too.
    expect(repository).toContain("COALESCE(p.display_url, p.blob_url)");
  });
});

describe("I5 and I10 — a record's owner cannot change, and writes are ordered", () => {
  const repository = read("lib", "members", "repository.ts");

  it("the upsert refuses a different Stripe customer", () => {
    expect(repository).toContain(
      "WHERE members.stripe_customer_id = EXCLUDED.stripe_customer_id",
    );
  });

  it("the upsert refuses an event older than the one already applied", () => {
    expect(repository).toMatch(
      /members\.last_event_at\s*<=\s*EXCLUDED\.last_event_at/,
    );
  });

  it("the customer-matched update is ordered too", () => {
    const update = repository.slice(
      repository.indexOf("export async function updateMemberByCustomer"),
      repository.indexOf("export async function recordMemberView"),
    );
    expect(update).toMatch(/last_event_at\s*<=/);
  });
});

describe("I8 — third-party shape changes fail loudly", () => {
  it("the Stripe API version is pinned", () => {
    const stripe = read("lib", "stripe.ts");
    expect(stripe).toMatch(/apiVersion:\s*API_VERSION/);
    expect(stripe).toMatch(/const API_VERSION = "\d{4}-\d{2}-\d{2}/);
  });

  /*
   * Two silent failures came from casts reading fields Stripe had moved.
   * Casts are still necessary — the payload's shape varies by the account's
   * API version — but they belong in `stripe.ts`, where they are unit-tested
   * against both shapes, rather than inline in a handler where they are not.
   */
  it("no route handler casts its way into a Stripe object", () => {
    const offenders = allSourceFiles()
      .filter((file) => file.includes(join("api", "stripe")))
      .filter((file) => /as unknown as/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("I9 — missing security config fails closed", () => {
  /*
   * With no mail provider, `send` used to print the message and report
   * success — writing magic-link tokens, each a valid credential, into the
   * platform log while telling the person to check an empty inbox.
   */
  it("email refuses to fail silently in production", () => {
    const email = read("lib", "auth", "email.ts");
    const fallback = email.slice(
      email.indexOf("if (apiKey === undefined"),
      email.indexOf("const response = await fetch"),
    );
    expect(fallback).toContain('process.env["NODE_ENV"] === "production"');
    expect(fallback).toMatch(/throw new Error/);
  });

  it("the webhook refuses events when its secret is unset", () => {
    const route = read("app", "api", "stripe", "webhook", "route.ts");
    expect(route).toMatch(/STRIPE_WEBHOOK_SECRET[\s\S]{0,200}status: 500/);
  });
});

describe("I11 — endpoints that spend money are rate limited", () => {
  it.each([["checkout"], ["portal"]])(
    "/api/stripe/%s is limited",
    (route: string) => {
      const source = read("app", "api", "stripe", route, "route.ts");
      expect(source).toContain("stripeLimiter.check");
      expect(source).toContain("status: 429");
    },
  );
});

describe("I2 — bulk writes carry the same authorization as single ones", () => {
  const actions = read("app", "contribute", "photos", "actions.ts");
  const bulk = actions.slice(
    actions.indexOf("export async function bulkSetPublished"),
  );

  /*
   * A bulk endpoint is where per-row authorization quietly gets lost: it is
   * tempting to write one `UPDATE ... WHERE id = ANY($1)` and be done, which
   * would publish any id in the list regardless of who owns it. Going
   * through `setPublished` per row keeps `AND author_id = ...` inside the
   * statement, so a forged id updates nothing rather than somebody else's
   * photograph.
   */
  it("delegates to the row-level helper rather than writing its own SQL", () => {
    expect(bulk).toContain("setPublished(id, published, actor)");
    expect(bulk).not.toMatch(/sql`/);
    expect(bulk).not.toMatch(/ANY\(/);
  });

  it("establishes the actor before touching anything", () => {
    const beforeLoop = bulk.slice(0, bulk.indexOf("for (const id"));
    expect(beforeLoop).toContain("await requireContributor()");
  });

  /*
   * Deleting is irreversible and takes the stored file with it. A checkbox
   * is exactly the control that makes a misclick easy, so there is no bulk
   * form of it — and that absence is load-bearing rather than an oversight.
   */
  it("offers no bulk delete", () => {
    expect(actions).not.toMatch(
      /export async function (bulkRemove|bulkDelete)/,
    );
  });
});

describe("I3 — anything the interface refuses, the server refuses", () => {
  /*
   * Revoking an owner was prevented only by hiding the button. Doing it
   * anyway 404s the admin page for everybody and needs database access to
   * undo. A server action is a public endpoint.
   */
  it("revocation checks the target's role on the server", () => {
    const actions = read("app", "contribute", "admin", "actions.ts");
    const setRevoked = actions.slice(
      actions.indexOf("export async function setRevoked"),
    );
    expect(setRevoked).toContain("isOwnerContributor");
  });

  it("every admin action requires the owner", () => {
    const actions = read("app", "contribute", "admin", "actions.ts");
    const exported = actions.match(/export async function \w+/g) ?? [];
    expect(exported.length).toBeGreaterThan(3);
    // Each exported action's body must reach requireOwner before anything else.
    for (const signature of exported) {
      const body = actions.slice(
        actions.indexOf(signature),
        actions.indexOf(signature) + 400,
      );
      expect(body, `${signature} must call requireOwner`).toContain(
        "requireOwner()",
      );
    }
  });
});
