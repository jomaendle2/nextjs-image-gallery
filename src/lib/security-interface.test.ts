import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allSourceFiles, read, SRC } from "./source-text";

/**
 * The half of the security model that faces people.
 *
 * `security.test.ts` holds the invariants about the request surface — what a
 * handler accepts, what a query selects, what fails closed. These are the
 * ones about the promises the interface makes: that a control which refuses
 * something also refuses it on the server, that a bulk action carries the
 * same authorization as the single one it was built from, and that what we
 * tell people is true.
 *
 * Split from that file when it passed four hundred lines, along the seam
 * that was already there. `docs/security-architecture.md` remains the index
 * of every invariant; neither file is the complete list, and the doc says so.
 */

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
   * This used to assert that no bulk delete existed, which encoded a
   * judgement call as an invariant and made it permanent. The judgement was
   * wrong — clearing twenty uploads one at a time is sixty clicks — but the
   * concern behind it was not, so the test now guards the concern instead
   * of the conclusion.
   *
   * What must hold: per-row authorization, and a confirmation that shows
   * what is about to go rather than only how much.
   */
  it("bulk delete keeps authorization per row", () => {
    const remove = actions.slice(
      actions.indexOf("export async function bulkRemovePhotos"),
    );
    expect(remove).toContain("deletePhoto(id, actor)");
    expect(remove).not.toMatch(/sql`/);
    expect(remove).not.toMatch(/ANY\(/);
    expect(remove.slice(0, remove.indexOf("for (const id"))).toContain(
      "await requireContributor()",
    );
  });

  /*
   * This test used to read `PhotoList.tsx` and assert that the file
   * contained the string "confirmingDelete". When the confirmation moved
   * into its own component the test kept passing, because the *state* is
   * still declared in the parent — it was matching an incidental name while
   * the behaviour it was named for had left the file entirely.
   *
   * So it now reads the component that actually renders the confirmation
   * and asserts the load-bearing part: that each chosen row is listed by
   * title. A count alone cannot be checked against what somebody meant.
   */
  it("bulk delete names what it is about to delete", () => {
    const bar = read("app", "contribute", "photos", "BulkBar.tsx");
    expect(bar).toContain("photoTitle(photo.title)");
    expect(bar).toMatch(/chosen\.slice\(/);
    /*
     * And the destructive confirm must still be a separate, armed step —
     * checked on the state that arms it rather than on the prop that used
     * to, since the bar now owns that itself.
     */
    expect(bar).toContain("confirmingDelete");
    expect(bar).toContain("armDelete");
  });
});

describe("Honest claims, and errors written for people", () => {
  /*
   * "GPS is stripped from every upload" appeared in four places and was
   * false in all of them: the original is stored exactly as sent,
   * coordinates intact. Each time it was found I fixed that one and did not
   * look for the others, so it took three rounds to clear — which is the
   * argument for this test rather than a fifth correction.
   *
   * What is true, and what the copy must say: the block is never *read*.
   */
  it("no page claims that GPS is stripped or discarded", () => {
    const offenders = allSourceFiles()
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => {
        const source = readFileSync(file, "utf8")
          // Comments explain the history and may quote the old wording.
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/[^\n]*/g, "");
        return /(coordinates|GPS)[^.]{0,60}(stripped|discarded)/i.test(source);
      });
    expect(offenders.map((f) => f.replace(SRC, ""))).toEqual([]);
  });

  /*
   * A photographer with a damaged file was shown "vipspng: libpng read
   * error" beside their own filename. Third-party failures get logged and
   * replaced; only messages we wrote for a person reach one.
   */
  it("the upload route only forwards messages meant for people", () => {
    const route = read("app", "api", "photos", "draft", "route.ts");
    expect(route).toContain("class TellTheUser extends Error");
    expect(route).toMatch(/error instanceof TellTheUser/);
    // The unfiltered form that leaked libvips internals.
    expect(route).not.toMatch(/error instanceof Error\s*\?\s*error\.message/);
  });

  it("the storage client's own errors do not reach the uploader", () => {
    const form = read("app", "contribute", "photos", "UploadForm.tsx");
    const around = form.slice(
      form.indexOf("const uploadOne"),
      form.indexOf("const runOne"),
    );
    expect(around).toMatch(/catch \(cause\)/);
    expect(around).toContain("console.error");
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

describe("I12 — a third door into the gallery, through the same lock", () => {
  /*
   * Contributors can now invite photographers, which makes three ways to
   * become one: the owner invites, somebody applies and is approved, or a
   * contributor spends one of their three. All three must end at the same
   * module, because "who is allowed to publish here" is the question this
   * whole site is arranged around and it should be answerable by reading one
   * file.
   */
  it("only the contributors module creates a contributor", () => {
    const writers = allSourceFiles()
      .filter((file) =>
        /INSERT INTO contributors/.test(readFileSync(file, "utf8")),
      )
      .map((file) => file.replace(SRC, ""));

    expect(writers).toEqual([join("/lib", "auth", "contributors.ts")]);
  });

  /*
   * The quota is the control, and it only works if the check and the spend
   * are the same statement. A read followed by a write lets two tabs both
   * see "1 left" and both spend it — which `scripts/smoke-invite.mts` proves
   * against a real database, and which this catches at the shape level so
   * the refactor that reintroduces it fails here first.
   */
  it("the invite claim spends and inserts in one statement", () => {
    const source = read("lib", "auth", "contributors.ts");
    /*
     * To the next top-level declaration, not to the first `\n}` — the
     * function's own parameter object closes at column zero, so that cut the
     * body off before the statement this test is about and the check passed
     * on an empty string.
     */
    const claim = source.slice(
      source.indexOf("export async function claimInvite"),
    );
    const end = claim.indexOf("\nexport ", 1);
    const body = end === -1 ? claim : claim.slice(0, end);

    // One tagged template, containing both halves.
    expect(body.match(/await sql`/g)?.length).toBe(1);
    expect(body).toContain("SET invites_remaining = a.invites_remaining - 1");
    expect(body).toContain("INSERT INTO contributors");
  });

  it("a contributor's invite is rate limited and needs a session", () => {
    const action = read("app", "contribute", "invite", "actions.ts");
    expect(action).toContain("requireContributor()");
    expect(action).toMatch(/inviteLimiter\.check/);
  });

  /*
   * Who invited whom is recorded and never rendered publicly. The allow-list
   * is what keeps that a rule rather than a current fact — the same shape as
   * the check on the two columns a membership pays for.
   */
  it("invited_by stays out of the public pages", () => {
    const named = allSourceFiles()
      .filter((file) => /\binvited_by\b/.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(SRC, ""))
      .sort((a, b) => a.localeCompare(b));

    expect(named).toEqual([
      join("/lib", "auth", "contributors.ts"),
      join("/lib", "schema.ts"),
    ]);
  });
});

describe("I13 — saving is not publishing", () => {
  /*
   * `publishPhoto` set `published_at` on every save, so a photographer could
   * not write a title without the photograph going live — captioning an
   * evening's uploads meant pushing each one into the feed and the
   * announcement queue and pulling it back. The form now sends an intent and
   * the column only moves when it says publish.
   */
  it("the update only sets published_at when asked", () => {
    const repository = read("lib", "photos", "repository.ts");
    const fn = repository.slice(
      repository.indexOf("export async function publishPhoto"),
    );
    const body = fn.slice(0, fn.indexOf("\nexport ", 1));

    expect(body).toMatch(/CASE WHEN \$\{publish\}/);
    expect(body).toContain("ELSE p.published_at END");
  });

  it("the form offers both, and says which happened", () => {
    const form = read("app", "contribute", "photos", "PhotoEditForm.tsx");
    expect(form).toMatch(/value="save"/);
    expect(form).toMatch(/value="publish"/);

    const actions = read("app", "contribute", "photos", "actions.ts");
    expect(actions).toContain('formData.get("intent") === "publish"');
    expect(actions).toContain("Draft saved. Not published yet.");
  });
});
