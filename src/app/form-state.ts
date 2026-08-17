/**
 * What a form gets back from a server action.
 *
 * There were five declarations of this across the app for three actual
 * shapes — `SignInState` and `PhotoFormState` identical, `SubscribeState` and
 * `ApplyState` identical, `InviteState` differing only in carrying a tone —
 * and `tone` and `status` encoded overlapping information in different
 * vocabularies. One shape, so a reader who has understood one form has
 * understood all of them.
 *
 * Its own module with no directive, because a `"use server"` file may export
 * only async functions and every one of these lives beside its actions.
 *
 * `tone` drives how the message is shown, and its names are `Notice`'s so a
 * form can hand one straight over. `sent` is the terminal success a form
 * uses to swap itself for a confirmation panel; `success` leaves the form in
 * place.
 */
export interface FormState {
  message: string | null;
  tone: "idle" | "success" | "sent" | "error";
}

export const IDLE: FormState = { message: null, tone: "idle" };

export function failed(message: string): FormState {
  return { message, tone: "error" };
}

export function succeeded(message: string): FormState {
  return { message, tone: "success" };
}

/**
 * The terminal success: there is nothing left to fill in.
 *
 * Distinct from `succeeded` because the form does something different with
 * it — a form that has been *answered* should be replaced by the answer,
 * while one that merely reported something stays where it is. Three files
 * were constructing `{ tone: "sent" }` by hand because this did not exist,
 * and the sign-in form was using `succeeded` for an outcome that is plainly
 * terminal, which is why it had no confirmation state at all.
 */
export function sent(message: string | null = null): FormState {
  return { message, tone: "sent" };
}

/**
 * One field off a form: trimmed, bounded, and never `undefined`.
 *
 * The same five lines were written four times under four names — `text` in
 * the photo actions, `field` in the application validator, and inline
 * `String(form.get(…) ?? "").trim()` chains in the invite reader and the
 * subscribe validator, the last of which bounded nothing at all. That is the
 * problem: a length limit that has to be remembered at each call site is a
 * limit that will be forgotten at the next one, and these are forms an
 * unauthenticated stranger can post to.
 *
 * Returns `""` rather than `null` for a missing or non-string entry, so a
 * caller checks emptiness once instead of absence and emptiness separately —
 * a `File` in a text field and an omitted field are the same nothing as far
 * as any of these forms are concerned.
 *
 * Beside `FormState` for the same reason it is: every caller lives beside a
 * `"use server"` module, which may export only async functions.
 */
export function formText(form: FormData, name: string, max: number): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
