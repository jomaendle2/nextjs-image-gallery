import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allSourceFiles, read, SRC } from "./source-text";

/**
 * The invariants from `docs/architecture/security.md`, as tests.
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
      /await\s+(confirm|unsubscribe|consumeLoginToken|removePhoto|setPublished|muteNudges)\s*\(/;
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
  const feedColumns = repository.slice(
    repository.indexOf("const FEED_COLUMNS"),
    repository.indexOf("const OWN_COLUMNS"),
  );

  it("the feed columns do not select what a membership pays for", () => {
    expect(feedColumns).not.toContain("precise_location");
    expect(feedColumns).not.toContain("technique");
  });

  /*
   * The same rule, for the pin.
   *
   * A pin is stored at two precisions precisely so that a public globe and a
   * member-only coordinate can both exist: the coarse pair is the centre of
   * a ~1 km cell and belongs in every page's payload, the exact pair is
   * the thing somebody paid for. Deriving one from the other at read time
   * would put `precise_lat` in this list, which is the one place it must
   * never be — so `coarsen()` runs at write time instead.
   */
  it("the feed columns carry the coarse point and never the exact one", () => {
    expect(feedColumns).toContain("coarse_lat");
    expect(feedColumns).toContain("coarse_lng");
    expect(feedColumns).not.toContain("precise_lat");
    expect(feedColumns).not.toContain("precise_lng");
  });

  /*
   * The mapper is the other end of the same pipe. `PhotoRow` has no exact
   * columns to read, but a future edit could widen the row type and this
   * function is where that would first become visible in a payload.
   */
  it("the row-to-payload mapper names no exact coordinate", () => {
    expect(read("lib", "photos", "map.ts")).not.toContain("precise_");
  });

  /*
   * `is_specimen` consent was given against a checkbox that says "the two
   * fields above" and names them. Extending it to a ten-metre coordinate
   * would be the quiet widening the comments in that file exist to prevent,
   * so the specimen query is pinned to what it asks for today.
   */
  it("the public specimen does not quietly acquire a coordinate", () => {
    const specimen = repository.slice(
      repository.indexOf("export async function getSpecimenPhoto"),
      repository.indexOf("export async function listUnannouncedPhotos"),
    );
    expect(specimen.length).toBeGreaterThan(0);
    expect(specimen).not.toContain("precise_lat");
    expect(specimen).not.toContain("precise_lng");
    expect(specimen).not.toContain("coarse_lat");
  });

  /*
   * The globe's own query, which must not become the feed's.
   *
   * It exists as a separate statement rather than a reuse of `FEED_COLUMNS`
   * so that a page drawing dots never serialises a base64 blur placeholder
   * per photograph — and, more importantly here, so that widening the feed
   * later cannot widen the globe by accident.
   */
  it("the globe query reads the coarse point and nothing paid for", () => {
    const globe = repository.slice(
      repository.indexOf("export async function listGlobePoints"),
      repository.indexOf("export async function getSpecimenPhoto"),
    );
    expect(globe.length).toBeGreaterThan(0);
    expect(globe).toContain("coarse_lat");
    expect(globe).not.toContain("precise_");
    expect(globe).not.toContain("blur_data_url");
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
      /*
       * Where a photographer types them, and the action that saves them.
       *
       * `MemberFields.tsx` was the second half of `PhotoEditForm.tsx` until
       * that file passed its line limit; the fields moved and the entry moved
       * with them. `members.ts` is new and names two of the columns to count
       * what is already written, because the section they live in is now
       * closed when a row opens and a collapsed box that cannot say whether
       * it holds anything is how writing gets forgotten and overwritten.
       *
       * It counts and never returns their contents, which is the distinction
       * that keeps it a one-line addition here rather than a new surface: a
       * number about paid prose is not paid prose, and it is shown only to
       * the photographer who wrote it.
       */
      join("/app", "contribute", "photos", "MemberFields.tsx"),
      join("/app", "contribute", "photos", "members.ts"),
      join("/app", "contribute", "photos", "actions.ts"),
      // The component that displays them, which reads the gated API
      // response rather than the database. Found by this test on its first
      // run, because the grep I wrote it from covered src/lib and src/app
      // and forgot src/components — a partial-domain mistake made while
      // writing a test about partial-domain mistakes.
      join("/components", "gallery", "carousel", "MemberDetails.tsx"),
      /*
       * The specimen on `/membership`, which is the one place paid columns
       * are deliberately public.
       *
       * `getSpecimenPhoto` takes no arguments and returns exactly one row,
       * chosen by the query. That is the whole gate: a reader cannot steer
       * it toward a photograph they want, only see the one the gallery
       * decided to give away. Every other photograph still goes through the
       * gated route above, and this widening does not touch it.
       *
       * It exists because a page selling two sentences per photograph had
       * described them instead of showing one, which asks a stranger to buy
       * something they have to imagine first.
       *
       * The page itself is deliberately not on this list: it calls
       * `getSpecimenPhoto()` and hands the row to a component, so it never
       * names either column. Only the query and the thing that prints them
       * do, which is the smallest surface this feature can have.
       */
      join("/app", "membership", "MembershipSpecimen.tsx"),
      /*
       * The picker, which submits the exact point as `precise_lat` and
       * `precise_lng` because that is what those two numbers are: the paid
       * half of a pin, on the wire under the name the column has.
       *
       * Being on this list is the feature rather than the cost. A file that
       * handles an exact coordinate belongs among the files allowed to name
       * one, and the `precise_` prefix is what lets the same regex cover the
       * pin without a second mechanism beside this one.
       */
      join("/app", "contribute", "photos", "LocationPicker.tsx"),
      // Shapes and migrations.
      join("/lib", "photos", "types.ts"),
      join("/lib", "schema.ts"),
    ];
    /*
     * Widened from `/precise_location|technique/` when a pin became a paid
     * field too. The `precise_` prefix is what lets one regex cover the new
     * columns rather than needing a second mechanism beside this one — and
     * `coarse_` deliberately cannot match it, because a coarsened point is
     * public and belongs in any file that wants it.
     *
     * An exact coordinate deserves more protection than the prose, not less.
     * Prose is vague and deniable; a coordinate is machine-actionable,
     * republishable in bulk, and names a private place precisely.
     */
    const found = allSourceFiles()
      .filter((file) =>
        /precise_(?:location|lat|lng)\b|\btechnique\b/.test(
          readFileSync(file, "utf8"),
        ),
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
    /*
     * This used to pin `COALESCE(p.display_url, p.blob_url)`, and the
     * fallback half is what changed. A row without a display copy served the
     * *camera original* — the one file here that still carries whatever GPS
     * the camera wrote — and did it silently, because the page looks right
     * either way. `display_url` is now `NOT NULL` in the schema, so the
     * fallback had nothing left to protect against and every reason to go.
     *
     * If this ever selects a URL column again, the guard needs it too.
     */
    expect(repository).toContain("p.display_url AS blob_url");
    expect(repository).not.toContain("COALESCE(p.display_url");

    // The invariant the removal rests on. Without it this is a regression.
    expect(read("lib", "schema.ts")).toContain(
      "ALTER TABLE photos ALTER COLUMN display_url SET NOT NULL;",
    );
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
    /*
     * `mailer.ts` rather than `email.ts` since the transport was split out of
     * it — the templates are the half that grows, and the file holding this
     * behaviour should not grow with them. The rule is unchanged and so is
     * the code it reads; only the file it lives in moved.
     */
    const email = read("lib", "auth", "mailer.ts");
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
   * Not money or mail, but the same shape of problem: an unlimited endpoint
   * that hands out something worth collecting.
   *
   * This route was unlimited for as long as it returned prose, which was
   * defensible — two sentences per photograph are awkward to scrape and
   * close to worthless in bulk. An exact coordinate is neither, and its
   * value goes up with the number of them you can gather, so one member with
   * a loop is a different threat from one member reading.
   */
  it("the member route is limited, now that it returns a coordinate", () => {
    const route = read("app", "api", "photo", "[id]", "details", "route.ts");
    expect(route).toContain("memberDetailsLimiter.check");
    expect(route).toContain("status: 429");
    // Keyed by the member, not the address: a shared connection is not a bucket.
    expect(route).toMatch(/memberDetailsLimiter\.check\(member\.email\)/);
  });

  /*
   * The route that spends money at a third party, which nothing pinned.
   *
   * It has carried `suggestLimiter` since the day it was written, and that
   * is exactly the situation this file exists for: a control that is correct
   * today and unguarded against tomorrow. Every call is a vision-model
   * request paid for per image, so an unlimited one is a way to spend this
   * gallery's budget from a signed-in account — cheaper to abuse than
   * checkout and easier to loop.
   *
   * Keyed by the contributor rather than the address, for the reason the
   * member route gives: a shared connection is not a bucket.
   */
  it("the suggestion route is limited", () => {
    const route = read("app", "api", "photos", "[id]", "suggest", "route.ts");
    expect(route).toContain("suggestLimiter.check");
    expect(route).toContain("status: 429");
    expect(route).toMatch(/suggestLimiter\.check\(contributor\.id\)/);
  });

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
