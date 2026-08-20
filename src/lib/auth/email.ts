import {
  block,
  button,
  escapeHtml,
  eyebrow,
  lead,
  MAIL,
  type MailPhoto,
  page,
  paragraph,
  photo,
  send,
} from "@/lib/auth/mailer";
import { buildNudge, draftCopy, uploadCopy } from "@/lib/auth/nudge-copy";
import { LOGIN_TTL_MINUTES } from "@/lib/auth/ttl";
import { count } from "@/lib/plural";
import { siteOrigin } from "@/lib/site-url";

/**
 * Every message this site can send, and what each one says.
 *
 * The transport lives in `mailer.ts`: this file is templates, and each of
 * them is a decision about tone as much as content. They are the only part of
 * the product that reaches somebody outside the browser, which makes them the
 * part where a mistake is least recoverable — a broken link in an
 * announcement goes to the whole list at once and cannot be edited afterwards.
 */

export async function sendLoginEmail(to: string, url: string): Promise<void> {
  await send({
    to,
    subject: "Your sign-in link",
    text: [
      "Sign in to the beauty of earth.",
      "",
      url,
      "",
      `This link works once and expires in ${LOGIN_TTL_MINUTES} minutes.`,
      "If you did not ask for it, you can ignore this email.",
    ].join("\n"),
    /*
     * No photograph, and that is the rule rather than an omission: this
     * message is a credential. It should render in the time it takes to draw
     * text, on a train, on a phone with one bar — and a picture on it would
     * be decoration on a door key.
     */
    html: page(
      block(
        `${eyebrow("Sign-in link")}
         ${lead("Here is your link back in.")}
         ${paragraph(`It works once and expires in ${LOGIN_TTL_MINUTES} minutes.`)}
         ${button(url, "Sign in")}`,
        "24px 28px 28px",
      ),
      {
        preheader: `Works once, expires in ${LOGIN_TTL_MINUTES} minutes.`,
        footnote: "If you did not ask for this, you can ignore it.",
      },
    ),
  });
}

/**
 * Tells somebody they have been invited.
 *
 * Approving an application sent mail; inviting somebody directly did not, so
 * the owner had to message each person separately to say the thing the site
 * could have said itself. With five photographers that is five out-of-band
 * conversations and five chances for somebody never to arrive.
 *
 * Separate from `sendApplicationApproved` because the two are not the same
 * event. "Your work is a fit" answers a submission; an invitation arrives
 * unasked, and should say what it is rather than congratulate somebody on an
 * application they never sent.
 */
export async function sendInvitation(
  to: string,
  options: {
    displayName: string;
    /** The photographer who spent an invitation, when one did. */
    invitedByName?: string;
    /** The minted sign-in link, when the caller could mint one. */
    signInUrl?: string;
    /**
     * One published photograph, when the caller could find one.
     *
     * The invitation is the message with the hardest job on this site: it
     * arrives unasked, tells a stranger they have been chosen, and asks them to
     * follow a link — which is a description of a phishing attempt as much as
     * of an invitation. Every sentence in it was doing that work alone.
     *
     * A photograph from the gallery is the argument the words were making, made
     * instead by the thing itself. Optional because early on there may be
     * nothing published, and a message with a broken image would undo exactly
     * the trust this exists to build.
     */
    showcase?: MailPhoto;
  },
): Promise<void> {
  const { displayName, invitedByName, signInUrl, showcase } = options;

  /*
   * The invitation carries a sign-in link when the caller could mint one.
   *
   * It used to point at `/contribute` — the form — so a button reading "sign
   * in and add your work" actually meant "go and ask us for a second email".
   * Six actions and two emails before a photographer saw anything of their
   * own. Now the link is the sign-in, on a seven-day token
   * (`INVITE_TTL_MINUTES`), which is the answer to the objection that stopped
   * this being done before: a token mailed today would sit in an inbox for
   * days, and now it is allowed to.
   *
   * Optional, and falling back to the form, because minting can return null —
   * an address that is somehow no longer invited by the time the mail is built
   * must still get a usable email rather than none.
   */
  const url = signInUrl ?? `${siteOrigin()}/contribute`;
  const name = escapeHtml(displayName);

  /*
   * Who sent it, when a photographer rather than the owner did.
   *
   * An invitation from a peer that does not name the peer reads as spam: an
   * unsolicited message telling a stranger they have been chosen, by nobody
   * in particular. Naming the person makes it the thing it actually is, and
   * it is the whole reason a peer invite is worth more than a form. Optional,
   * so the owner's own invite is unchanged and still speaks for the gallery.
   */
  const from = invitedByName?.trim() ?? "";
  const opening =
    from === ""
      ? `${displayName}, you have been invited to publish on the beauty of earth.`
      : `${displayName}, ${from} has invited you to publish on the beauty of earth.`;
  const openingHtml =
    from === ""
      ? `${name}, you have been invited to publish on the beauty of earth.`
      : `${name}, ${escapeHtml(from)} has invited you to publish on the beauty of earth.`;

  await send({
    to,
    subject: "An invitation — the beauty of earth.",
    text: [
      opening,
      "",
      `Open this to sign in — there is no password and nothing to accept: ${url}`,
      "",
      "You publish your own work. Nobody reviews it, and nothing waits for",
      "us: give a photograph a title and a description and it is live.",
      "",
      "Upload the full-size originals. The gallery reads the camera and",
      "exposure from the file and never opens the GPS block, so where you",
      "stood stays yours unless you choose to write it down or mark it.",
      "",
      "The link works once and lasts a week. If you were not expecting this,",
      "ignore it — nothing happens until you sign in.",
    ].join("\n"),
    html: page(
      /*
       * The photograph before the words, which is the whole change. A
       * gallery's invitation that opens with a paragraph is asking somebody
       * to take its word for something it could simply show them.
       */
      `${showcase === undefined ? "" : photo(showcase)}
       ${block(
         `${eyebrow(from === "" ? "Invitation" : `Invitation from ${from}`)}
          <div style="font-size:21px;line-height:1.4;letter-spacing:-0.02em;color:#e8eaed;margin:0 0 14px">${openingHtml}</div>
          ${paragraph("You publish your own work. Nobody reviews it and nothing waits for us — give a photograph a title and a description and it is live.")}
          ${paragraph("Upload the full-size originals: the gallery reads the camera and the exposure from the file and never opens the GPS block, so where you stood stays yours unless you write it down or mark it.")}
          ${button(url, "Sign in and add your work")}`,
         "24px 28px 28px",
       )}`,
      {
        preheader:
          from === ""
            ? "Publish your photographs on the beauty of earth."
            : `${from} thinks your work belongs here.`,
        footnote:
          "The link works once and lasts a week. If you were not expecting this, ignore it — nothing happens until you sign in.",
      },
    ),
  });
}

export async function sendApplicationApproved(
  to: string,
  displayName: string,
): Promise<void> {
  const url = `${siteOrigin()}/contribute`;
  const name = escapeHtml(displayName);

  await send({
    to,
    subject: "You're in — the beauty of earth.",
    text: [
      `${displayName}, your work is a fit. Welcome.`,
      "",
      `Sign in with this address to publish your first photograph: ${url}`,
      "",
      "Upload the full-size original; the gallery handles the rest.",
    ].join("\n"),
    html: page(
      block(
        `${eyebrow("Application")}
         <div style="font-size:21px;line-height:1.4;letter-spacing:-0.02em;color:#e8eaed;margin:0 0 14px">${name}, your work is a fit. Welcome.</div>
         ${paragraph("Sign in with this address and upload the full-size original — the gallery handles the rest.")}
         ${button(url, "Publish your first photograph")}`,
        "24px 28px 28px",
      ),
      { preheader: "Your work is a fit. Here is the way in." },
    ),
  });
}

/**
 * What somebody gets for their five euros, in writing.
 *
 * There was no membership email at all. The only instruction lived on the
 * page Stripe redirects to, so anybody who closed the tab — or paid on a
 * phone and opened the site on a laptop — had paid and had nothing, anywhere,
 * telling them what they had bought or how to reach it. Checkout would then
 * refuse them a second time with "that address already has a membership",
 * which is true and useless.
 *
 * It carries a working sign-in link rather than instructions to request one,
 * because the moment after paying is exactly when a person should not be
 * asked to do more admin. The link is single-use and expires like any other;
 * the text says so, and says what to do when it has.
 */
export async function sendMembershipWelcome(
  to: string,
  signInUrl: string,
): Promise<void> {
  const origin = siteOrigin();

  await send({
    to,
    subject: "Your membership — the beauty of earth.",
    text: [
      "Thank you — your membership is active.",
      "",
      `Open this to sign in: ${signInUrl}`,
      "",
      `The link works once and lasts ${LOGIN_TTL_MINUTES} minutes. If it expires,`,
      `ask for a fresh one at ${origin}/contribute using this same address.`,
      "",
      "Signed in, every photograph shows where it was taken and how, wherever",
      "the photographer has written it down.",
      "",
      `Cancel any time from ${origin}/membership. No notice period.`,
    ].join("\n"),
    html: page(
      block(
        `${eyebrow("Membership")}
         ${lead("Thank you — your membership is active.")}
         ${paragraph("Signed in, every photograph shows where it was taken and how, wherever the photographer has written it down.")}
         ${button(signInUrl, "Sign in")}
         ${paragraph(`The link works once and lasts ${LOGIN_TTL_MINUTES} minutes. If it expires, ask for a fresh one at ${origin}/contribute using this same address.`)}`,
        "24px 28px 28px",
      ),
      {
        preheader: "Every photograph now shows where it was taken, and how.",
        footnote: `Cancel any time from <a href="${escapeHtml(`${origin}/membership`)}" style="color:${MAIL.faint}">${escapeHtml(`${origin}/membership`)}</a>. No notice period.`,
      },
    ),
  });
}

/**
 * The answer nobody was getting.
 *
 * `/contribute/apply` says a reply "takes a few days rather than a few
 * minutes", and declining sent nothing at all — so an applicant who was not
 * a fit waited indefinitely for a message that had been promised and would
 * never arrive. A short no is a better thing to receive than silence, and it
 * is the only version of this that makes the form's promise true.
 *
 * Deliberately brief, and deliberately not a critique. The gallery is small
 * on purpose; that is a fact about the gallery rather than about their
 * photographs, and it is the honest reason in nearly every case.
 */
export async function sendApplicationDeclined(
  to: string,
  displayName: string,
): Promise<void> {
  const name = escapeHtml(displayName);

  await send({
    to,
    subject: "About your application — the beauty of earth.",
    text: [
      `${displayName}, thank you for showing us your work.`,
      "",
      "We are not able to add you to the gallery at the moment. It stays",
      "deliberately small, which means saying no to photographs we like.",
      "",
      "You are welcome to apply again later.",
    ].join("\n"),
    /*
     * No button, and no photograph. This is the one message with nothing to
     * ask of the reader, and a picture of the gallery they are not joining
     * would read as a boast. Type and space carry it alone.
     */
    html: page(
      block(
        `${eyebrow("Application")}
         <div style="font-size:21px;line-height:1.4;letter-spacing:-0.02em;color:#e8eaed;margin:0 0 14px">${name}, thank you for showing us your work.</div>
         ${paragraph("We are not able to add you to the gallery at the moment. It stays deliberately small, which means saying no to photographs we like.")}`,
        "24px 28px 28px",
      ),
      {
        preheader: "Not this time — the gallery stays deliberately small.",
        footnote: "You are welcome to apply again later.",
      },
    ),
  });
}

/**
 * Tells the owner there is something worth announcing.
 *
 * Sent by the weekly cron, and deliberately not to the list: the cron
 * prompts, a person decides. Nothing reaches a subscriber without somebody
 * pressing a button.
 */
export async function sendAnnouncementReminder(
  to: string,
  waiting: number,
): Promise<void> {
  const url = `${siteOrigin()}/contribute/admin`;
  const phrase = count(waiting, "photograph");

  await send({
    to,
    subject: `${phrase} waiting to be announced`,
    text: [
      `${phrase} have been published since the last announcement.`,
      "",
      `Send it, or leave it for next week: ${url}`,
    ].join("\n"),
    html: page(
      block(
        `${eyebrow("Waiting to be announced")}
         ${lead(`${phrase} have been published since the last announcement.`)}
         ${button(url, "Review and send")}`,
        "24px 28px 28px",
      ),
      {
        preheader: `${phrase}, and the list has not been told.`,
        footnote: "Nothing goes out until you press send.",
      },
    ),
  });
}

/**
 * Nudges somebody who was invited and has uploaded nothing.
 *
 * Six of these over about three months, and then silence for good. The tail
 * ends because it has to: mailing an address that has ignored five messages
 * is the fastest way to be filtered, and the filter would apply to the
 * announcement list — the mail that actually matters — rather than only here.
 *
 * The words are `nudge-copy.ts`, which also attaches the RFC 8058 one-click
 * headers to what it builds. Both senders therefore reach the provider with a
 * machine-readable opt-out, and neither can be written without one.
 */
export async function sendUploadNudge(
  to: string,
  options: {
    displayName: string;
    stage: number;
    signInUrl: string;
    quietUrl: string;
    hasSignedIn: boolean;
    /**
     * Somebody else's photograph, on the one stage that argues from the
     * gallery rather than from the reader's own page.
     *
     * Stage 3 is where the copy says there is new work here and three
     * invitations of theirs unspent; the photograph is that sentence's
     * evidence. The other five stay text — four and five are deliberately
     * quiet, and a picture on them would be a nudge pretending to be news.
     */
    showcase?: MailPhoto;
  },
): Promise<void> {
  const message = buildNudge(
    uploadCopy(options.displayName, options.stage, options.hasSignedIn),
    options.signInUrl,
    options.quietUrl,
    options.stage === 3 ? options.showcase : undefined,
  );
  await send({
    to,
    ...message,
    html: page(message.html, {
      preheader: message.preheader,
      footnote: message.footnote,
    }),
  });
}

/**
 * Nudges somebody whose photographs are uploaded and unpublished.
 *
 * Three of these and no more. A stalled draft is a to-do item rather than a
 * re-engagement problem, and this is the person who already did the hard part
 * — so the copy's whole job is to be specific about how little is left.
 */
export async function sendDraftNudge(
  to: string,
  options: {
    displayName: string;
    stage: number;
    drafts: number;
    signInUrl: string;
    quietUrl: string;
    /**
     * Their own draft — the strongest image this software can send anybody.
     *
     * Their unpublished photograph, in their own inbox, above a button that
     * publishes it. Every stage of this track carries it, because every stage
     * of this track is about that photograph.
     */
    draft?: MailPhoto;
  },
): Promise<void> {
  const message = buildNudge(
    draftCopy(options.displayName, options.stage, options.drafts),
    options.signInUrl,
    options.quietUrl,
    options.draft,
  );
  await send({
    to,
    ...message,
    html: page(message.html, {
      preheader: message.preheader,
      footnote: message.footnote,
    }),
  });
}
