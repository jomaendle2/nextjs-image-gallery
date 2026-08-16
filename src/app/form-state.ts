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
