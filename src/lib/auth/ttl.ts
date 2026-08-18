/**
 * How long a mailed link stays good — the numbers, and nothing else.
 *
 * These live apart from `tokens.ts` because they are policy, not mechanism.
 * How long a link is good for is a decision about people — how long somebody
 * takes to reach their inbox — and it is read by the two mails and the
 * privacy policy far more often than by the code that mints a token. A
 * number three pieces of copy quote belongs somewhere copy can reach without
 * pulling in a query.
 *
 * There is also a defect that makes the split load-bearing rather than
 * merely tidy: `database.ts` throws at module scope when `DATABASE_URL` is
 * unset, so importing `tokens.ts` anywhere makes that file unloadable in a
 * unit test and ties a statically rendered legal page to a connection string
 * it never uses. That is worth fixing at the source — a lazy `sql` would
 * move the failure from import to first query — and this file is not that
 * fix. Do not read it as precedent for dodging the throw again; the next
 * value that needs to escape `tokens.ts` should make the connection lazy
 * instead.
 *
 * The split exists because the copy was wrong for months: six sentences said
 * fifteen minutes while the constant said sixty. Interpolating is the fix,
 * and interpolating is only possible if the constant is importable from
 * anywhere that speaks to a person.
 */

/**
 * Long enough to walk to the inbox, short enough to be worthless if leaked.
 *
 * The default, and the right one for "email me a link": the person is at the
 * keyboard, waiting, and the link is worth a session the moment it arrives.
 */
export const LOGIN_TTL_MINUTES = 60;

/**
 * How long a link mailed to somebody who is not expecting it stays good.
 *
 * An invitation is not a magic link. Nobody is waiting at a keyboard for it —
 * it arrives in the middle of somebody's week and gets opened the next
 * morning, or after lunch, or on the train. A quarter of an hour was the
 * reason the invitation could not carry a token at all, and the argument
 * recorded against doing so was precisely this: *a token mailed today would
 * sit in an inbox for days.*
 *
 * That argument is about expiry, not about tokens. Seven days is the answer to
 * it. The link is still single-use, still 256 bits, still hashed at rest, and
 * still only worth what the address behind it is worth — which for a fresh
 * invitation is one contributor account with nothing in it yet.
 */
export const INVITE_TTL_MINUTES = 7 * 24 * 60;
