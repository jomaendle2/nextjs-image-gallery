import {
  block,
  button,
  escapeHtml,
  eyebrow,
  MAIL,
  type MailPhoto,
  paragraph,
  photo,
} from "@/lib/auth/mailer";
import { count } from "@/lib/plural";

/**
 * What each nudge says, stage by stage.
 *
 * Copy without delivery, which is the split `announcement.ts` already makes
 * and for the same reason: the interesting risk here is what the words are,
 * not how they reach anybody, and a function that also talks to a mail
 * provider cannot be tested for its words cheaply. Every string below is a
 * decision somebody should be able to read back without a mail client.
 *
 * The escalation is in specificity, never in volume. Each stage answers a
 * different objection rather than repeating the ask louder, and each carries
 * exactly one call to action — two asks in one message is how a reader ends
 * up doing neither.
 */

/** One rendered nudge, before it is wrapped in the gallery's mail shell. */
export interface NudgeCopy {
  subject: string;
  /** The label above the lead, naming which kind of message this is. */
  kind: string;
  /** The line the inbox shows after the subject, never the wordmark. */
  preheader: string;
  lead: string;
  detail: string[];
  cta: string;
}

/** For taking a first name out of a display name. */
const WHITESPACE = /\s+/;

function firstName(displayName: string): string {
  return displayName.trim().split(WHITESPACE)[0] ?? displayName;
}

/**
 * The empty track's copy, stage by stage.
 *
 * Stages 1 and 2 differ on whether the person ever signed in, because "your
 * link is still good" and "you signed in, and the page is still empty" are
 * different messages to the same empty page, and sending the first to
 * somebody who is already inside reads as a form letter — which is precisely
 * what it would be.
 */
export function uploadCopy(
  displayName: string,
  stage: number,
  hasSignedIn: boolean,
): NudgeCopy {
  const first = firstName(displayName);

  switch (stage) {
    case 1:
      return {
        subject: "Your page is waiting — the beauty of earth.",
        kind: "Your page",
        preheader: "Nobody reviews it. A title, a description, and it is live.",
        lead: hasSignedIn
          ? `${first}, you signed in — and your page is still empty.`
          : `${first}, your page on the gallery is ready, and there is nothing on it yet.`,
        detail: [
          "Nobody reviews what you publish. Give a photograph a title and a description and it is live on your own page the moment you press publish — there is no queue and nothing waiting for us.",
          hasSignedIn
            ? "Everything is where you left it."
            : "The link below is a fresh one. Nothing you were sent has expired in a way that matters — a new link is minted every time.",
        ],
        cta: "Add your first photograph",
      };
    case 2:
      return {
        subject: "Upload the originals — the beauty of earth.",
        kind: "Before you upload",
        preheader: "The gallery never opens the GPS block.",
        lead: "One thing worth knowing before you upload: the gallery never opens the GPS block.",
        detail: [
          "Upload the full-size originals. The file is read for the camera and the exposure, a display copy is made from it, and the location the camera wrote is never read — where you stood stays yours unless you choose to write it down or mark it on the map yourself.",
          "That is the objection this usually runs into, and it is worth answering plainly rather than hoping nobody asks.",
        ],
        cta: "Upload an original",
      };
    case 3:
      return {
        subject: "Three invitations, unspent — the beauty of earth.",
        kind: "Three invitations",
        preheader:
          "New work on the gallery, and three invitations of your own.",
        lead: "There is new work on the gallery since you were invited, and three invitations of your own sitting unused.",
        detail: [
          "Every photographer here can bring in three more, and yours are still unspent. They are the only way anybody new arrives — the gallery has no open sign-up.",
          "Your own page is still empty, which is the one thing worth fixing first.",
        ],
        cta: "Sign in and see",
      };
    case 4:
      return {
        subject: "Still here — the beauty of earth.",
        kind: "Reminder",
        preheader: "One photograph is all it takes.",
        lead: "Your page is still there, and still empty. One photograph is all it takes.",
        detail: [],
        cta: "Publish something",
      };
    case 5:
      return {
        subject: "The link, again — the beauty of earth.",
        kind: "Reminder",
        preheader: "Just the link, in case now is a better moment.",
        lead: "No news — this is only the link, in case now is a better moment than the last one was.",
        detail: [],
        cta: "Sign in",
      };
    default:
      return {
        subject: "The last of these — the beauty of earth.",
        kind: "The last reminder",
        preheader: "The invitation does not expire. The reminders stop here.",
        lead: "This is the last of these you will get from us.",
        detail: [
          "The invitation itself does not expire. Your page is kept, this address stays one that can publish, and you can sign in whenever you like — there simply will not be another reminder.",
        ],
        cta: "Sign in",
      };
  }
}

/**
 * The draft track's copy, stage by stage.
 *
 * Three of these and no more. A stalled draft is a to-do item rather than a
 * re-engagement problem, and this is the person who already did the hard part
 * — so the copy's whole job is to be specific about how little is left.
 */
export function draftCopy(
  displayName: string,
  stage: number,
  drafts: number,
): NudgeCopy {
  const waiting = count(drafts, "photograph");
  const singular = drafts === 1;
  const first = firstName(displayName);

  switch (stage) {
    case 1:
      return {
        subject: `${waiting} waiting for a title — the beauty of earth.`,
        kind: "In drafts",
        preheader: "A title and a description, and it publishes itself.",
        lead: `${first}, you uploaded ${waiting}, and ${singular ? "it is" : "they are"} not live yet.`,
        detail: [
          `A title and a description ${singular ? "is" : "are"} all that stands between the draft and your page. Nobody reviews it — pressing publish is the whole of it.`,
        ],
        cta: singular ? "Publish it" : "Publish them",
      };
    case 2:
      return {
        subject: "Still in drafts — the beauty of earth.",
        kind: "In drafts",
        preheader: "Two sentences, and everything else is optional.",
        lead: `${waiting} of yours ${singular ? "is" : "are"} still sitting in drafts.`,
        detail: [
          "The description is two sentences, not an essay, and everything else is optional — the location, the map pin, all of it. Title, a line about what it is, publish.",
        ],
        cta: "Finish the draft",
      };
    default:
      return {
        subject: "The last reminder — the beauty of earth.",
        kind: "The last reminder",
        preheader: "Nothing is deleted. This is only the last mention of it.",
        /*
         * Names the count even though it is the last one, and especially
         * because it is. A final message that says only "we will stop
         * mentioning it" reads, months later, as a reminder about nothing —
         * the reader has to be told what is still sitting there to decide
         * whether they care.
         */
        lead: `This is the last time we will mention the ${singular ? "photograph" : waiting} you have not published.`,
        detail: [
          "Nothing is deleted and nothing expires: what you uploaded stays where it is, and you can publish it a year from now if that is when it is ready.",
        ],
        cta: "Sign in",
      };
  }
}

/**
 * The footer that makes this legitimate mail rather than a nuisance.
 *
 * Every nudge carries it, including the last one. The header pair below does
 * the same job for a mail client, but a person reading on a phone needs a
 * link — and the two have to agree. An opt-out only a machine can find is the
 * kind of compliance that produces spam reports anyway.
 */
const FOOTER_TEXT = [
  "",
  "Sign-in links and the gallery's own announcements are unaffected.",
];

/**
 * The RFC 8058 pair, for a message somebody did not explicitly ask for.
 *
 * Both headers or neither: `List-Unsubscribe` alone offers a link, and only
 * `List-Unsubscribe-Post` promises that a POST to it is enough — without the
 * second, a mail client shows a confirmation step, or nothing at all. What
 * turns a Gmail "unsubscribe" button into an unsubscribe rather than a spam
 * report is the pair, and a spam report costs the whole domain where an
 * unsubscribe costs one address.
 */
export function oneClickUnsubscribe(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** A nudge as the sender needs it: assembled, escaped, and opted out of. */
export interface NudgeMessage {
  subject: string;
  text: string;
  /** The body rows only. The sender wraps them in the gallery's shell. */
  html: string;
  /** The small print under the rule, which is where the opt-out lives. */
  footnote: string;
  /** The line the inbox shows after the subject, instead of the wordmark. */
  preheader: string;
  headers: Record<string, string>;
}

/**
 * One nudge, rendered.
 *
 * Both sequences share a shape — a lead sentence, a paragraph or two, one
 * button, one way out — so they share a renderer, and what differs between
 * the nine stages is only what each one says.
 *
 * Everything interpolated goes through `escapeHtml`, including the copy this
 * module wrote itself. None of it is attacker-controlled today except the
 * display name, and that is exactly the argument that stops being true the
 * first time somebody interpolates a photograph's title in here.
 */
export function buildNudge(
  copy: NudgeCopy,
  signInUrl: string,
  quietUrl: string,
  /**
   * A photograph, where one argues better than a sentence.
   *
   * The draft track's is the strongest image this software can send
   * anybody: their own unpublished photograph, in their own inbox, above a
   * button that publishes it. The copy could only ever describe that; this
   * is the thing itself, and it is the difference between "you have two
   * drafts" and seeing one.
   *
   * Absent from the short late stages on purpose. A message whose whole
   * point is to be quiet and easy to ignore does not open with a picture.
   */
  image?: MailPhoto,
): NudgeMessage {
  return {
    subject: copy.subject,
    text: [
      copy.lead,
      "",
      ...copy.detail,
      "",
      signInUrl,
      "",
      `No more of these — one click, and only these stop: ${quietUrl}`,
      ...FOOTER_TEXT,
    ].join("\n"),
    html: `${image === undefined ? "" : photo(image)}
      ${block(
        `${eyebrow(copy.kind)}
         <div style="font-size:21px;line-height:1.4;letter-spacing:-0.02em;color:${MAIL.text};margin:0 0 14px">${escapeHtml(copy.lead)}</div>
         ${copy.detail.map((line) => paragraph(line)).join("\n")}
         ${button(signInUrl, copy.cta)}`,
        "24px 28px 28px",
      )}`,
    footnote: `<a href="${escapeHtml(quietUrl)}" style="color:${MAIL.faint}">No more of these</a> — one click, and only these stop. Sign-in links and the gallery's own announcements are unaffected.`,
    preheader: copy.preheader,
    headers: oneClickUnsubscribe(quietUrl),
  };
}
