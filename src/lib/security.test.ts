import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allSourceFiles, read, SRC } from "./source-text";

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

  /*
   * The gap that let a third instance through.
   *
   * The check above only reads `route.ts`, so it never looked at pages — and
   * a page render *is* a GET. `/subscribe/confirm` confirmed a subscription
   * while rendering for months after the identical bug was fixed in
   * `/subscribe/unsubscribe`, two directories away, because the test that
   * was supposed to prevent exactly this could not see it.
   *
   * A page may call these only inside a server action, which is a POST. The
   * marker is a bare `await` on one at render time.
   */
  it("no page mutates while rendering", () => {
    const mutators =
      /await\s+(confirm|unsubscribe|consumeLoginToken|removePhoto|setPublished)\s*\(/;
    const offenders = allSourceFiles()
      .filter((file) => file.endsWith("page.tsx"))
      .filter((file) => mutators.test(readFileSync(file, "utf8")));
    expect(offenders.map((f) => f.replace(SRC, ""))).toEqual([]);
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

  /*
   * The check above reads one constant, which protects the queries that use
   * it and nothing else — a *new* public query selecting these columns would
   * pass it without comment. Same partial-domain shape that let a page
   * mutate on render and let an unlimited mail sender through.
   *
   * So this pins the whole set of files allowed to name them. Adding one is
   * fine; doing it without noticing is not, and the failure message is where
   * the next person finds out these two columns are the product.
   */
  it("only known files name the paid columns at all", () => {
    const allowed = [
      // The gated reader, and the route that calls it.
      join("/lib", "photos", "repository.ts"),
      join("/app", "api", "photo", "[id]", "details", "route.ts"),
      // Where a photographer types them, and the action that saves them.
      join("/app", "contribute", "photos", "PhotoEditForm.tsx"),
      join("/app", "contribute", "photos", "actions.ts"),
      // The component that displays them, which reads the gated API
      // response rather than the database. Found by this test on its first
      // run, because the grep I wrote it from covered src/lib and src/app
      // and forgot src/components — a partial-domain mistake made while
      // writing a test about partial-domain mistakes.
      join("/components", "gallery", "carousel", "MemberDetails.tsx"),
      // Shapes and migrations.
      join("/lib", "photos", "types.ts"),
      join("/lib", "schema.ts"),
    ];
    const found = allSourceFiles()
      .filter((file) =>
        /precise_location|technique/.test(readFileSync(file, "utf8")),
      )
      .map((f) => f.replace(SRC, ""))
      .sort((a, b) => a.localeCompare(b));
    expect(found).toEqual([...allowed].sort((a, b) => a.localeCompare(b)));
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

describe("I11 — endpoints that spend money or send mail are limited", () => {
  it.each([["checkout"], ["portal"]])(
    "/api/stripe/%s is limited",
    (route: string) => {
      const source = read("app", "api", "stripe", route, "route.ts");
      expect(source).toContain("stripeLimiter.check");
      expect(source).toContain("status: 429");
    },
  );

  /*
   * The other half of the same rule, which this test used to leave out.
   *
   * Naming only the two Stripe routes made I11 look enforced while the
   * mail-sending half of its own sentence went unchecked — the identical
   * shape of gap that let a page keep mutating on render because the check
   * only read route handlers. An unlimited endpoint that sends mail is a
   * way to flood somebody else's inbox using this domain's reputation.
   *
   * Two ways to satisfy it: a limiter for anything the public can reach, or
   * `requireOwner` for anything only one person can. The admin actions take
   * the second route, which is why they carry no limiter.
   */
  it("every action that sends mail is either limited or owner-only", () => {
    const senders = allSourceFiles()
      .filter((file) => file.endsWith("actions.ts"))
      .filter((file) => /\bsend[A-Z]\w*\s*\(/.test(readFileSync(file, "utf8")));

    // If this ever finds nothing, the detection has broken, not the code.
    expect(senders.length).toBeGreaterThan(0);

    const unguarded = senders.filter((file) => {
      const source = readFileSync(file, "utf8");
      return !(
        /Limiter\.check/.test(source) || /requireOwner\(\)/.test(source)
      );
    });
    expect(unguarded.map((f) => f.replace(SRC, ""))).toEqual([]);
  });
});
