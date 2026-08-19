import { describe, expect, it } from "vitest";
import { alternates, contributorAlternates, ogCard } from "./metadata";

/**
 * The share card's URL, which nobody ever looks at.
 *
 * That is the whole argument for testing it. A link preview is rendered by
 * somebody else's server, in somebody else's app, days after the link was
 * sent — so a card that breaks does so silently and stays broken, and the
 * person least likely to notice is the one who shared it. These are cheap
 * assertions about a string, standing in for a feedback loop that does not
 * exist.
 */

describe("ogCard", () => {
  it("escapes a title that would otherwise truncate the card", () => {
    /*
     * The failure this prevents. An unescaped `&` ends the parameter, so
     * "Jo & Anna" arrives at the route as "Jo " and the card silently prints
     * a name that is not anybody's.
     */
    const url = ogCard({ title: "Jo & Anna" });
    expect(url).not.toMatch(/title=Jo & Anna/);
    expect(new URL(url, "https://x.test").searchParams.get("title")).toBe(
      "Jo & Anna",
    );
  });

  it("survives the characters a display name really contains", () => {
    for (const name of ["Jo Mändle", "N'Dour", "文子", "A/B", "50% Grey"]) {
      const parsed = new URL(ogCard({ title: name }), "https://x.test");
      expect(parsed.searchParams.get("title")).toBe(name);
    }
  });

  it("omits the subtitle rather than sending an empty one", () => {
    // The route lays out a card with no subtitle differently from one with a
    // blank line where a subtitle should be.
    expect(ogCard({ title: "x" })).not.toContain("subtitle");
    expect(ogCard({ title: "x", subtitle: "" })).not.toContain("subtitle");
    expect(ogCard({ title: "x", subtitle: "y" })).toContain("subtitle=y");
  });

  it("joins previews with commas, the shape the route parses", () => {
    const url = ogCard({
      title: "x",
      previews: ["https://blob.test/1.jpg", "https://blob.test/2.jpg"],
    });
    expect(new URL(url, "https://x.test").searchParams.get("previews")).toBe(
      "https://blob.test/1.jpg,https://blob.test/2.jpg",
    );
  });

  it("drops anything the card could not fetch", () => {
    /*
     * A relative path or a data URL costs a round trip to be refused, and a
     * strip that silently renders empty is worse than no strip: the card
     * still claims the space for photographs and shows none.
     */
    const url = ogCard({
      title: "x",
      previews: ["/local.jpg", "data:image/png;base64,AAA", "https://ok/1.jpg"],
    });
    expect(new URL(url, "https://x.test").searchParams.get("previews")).toBe(
      "https://ok/1.jpg",
    );
  });

  it("omits the parameter entirely when nothing usable is left", () => {
    expect(ogCard({ title: "x", previews: [] })).not.toContain("previews");
    expect(ogCard({ title: "x", previews: ["/nope.jpg"] })).not.toContain(
      "previews",
    );
  });

  it("stays relative, so the origin comes from metadataBase", () => {
    // Reading the origin here would put configuration in a formatting helper
    // — and an absolute URL built from the wrong origin is how a preview ends
    // up fetching a card from a domain nobody advertises.
    expect(ogCard({ title: "x" }).startsWith("/api/og?")).toBe(true);
  });
});

describe("alternates", () => {
  it("keeps the feed attached to every canonical", () => {
    /*
     * `alternates` is replaced rather than merged by Next, so a page that
     * sets a canonical by hand drops the RSS autodiscovery link with it —
     * which happened to `/photo/[id]`, the page people actually land on.
     */
    const value = alternates("/globe");
    expect(value?.canonical).toBe("/globe");
    expect(value?.types?.["application/rss+xml"]).toBeDefined();
  });

  it("offers a photographer's own feed first, then the site's", () => {
    const feeds = contributorAlternates("/by/anna", "anna", "Anna")?.types?.[
      "application/rss+xml"
    ] as { url: string }[];
    expect(feeds[0]?.url).toBe("/by/anna/feed.xml");
    expect(feeds[1]?.url).toBe("/feed.xml");
  });
});
