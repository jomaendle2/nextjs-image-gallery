import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { hasLiveSubscription, isActive } from "@/lib/members/status";
import { subscriptionFromInvoice, subscriptionPeriodEnd } from "@/lib/stripe";

/** Only the fields the function reads; the real object has ~40 more. */
function subscriptionWith(
  itemPeriodEnds: readonly number[],
  legacy?: number,
): Stripe.Subscription {
  return {
    items: { data: itemPeriodEnds.map((end) => ({ current_period_end: end })) },
    ...(legacy === undefined ? {} : { current_period_end: legacy }),
  } as unknown as Stripe.Subscription;
}

describe("subscriptionPeriodEnd", () => {
  it("reads the period end from the subscription's items", () => {
    // 2030-01-01T00:00:00Z
    expect(subscriptionPeriodEnd(subscriptionWith([1_893_456_000]))).toBe(
      "2030-01-01T00:00:00.000Z",
    );
  });

  /*
   * The regression this function exists for. Stripe moved the field onto
   * items, so reading the top level returned undefined and every member row
   * was written with a null period end — silently, because the status
   * happened to carry the same information in the ordinary case.
   */
  it("does not return null when only the items carry the field", () => {
    expect(subscriptionPeriodEnd(subscriptionWith([1_893_456_000]))).not.toBe(
      null,
    );
  });

  it("takes the latest end when a subscription has several items", () => {
    const end = subscriptionPeriodEnd(
      subscriptionWith([1_893_456_000, 1_896_134_400]),
    );
    expect(end).toBe("2030-02-01T00:00:00.000Z");
  });

  it("falls back to the subscription itself on older API versions", () => {
    expect(subscriptionPeriodEnd(subscriptionWith([], 1_893_456_000))).toBe(
      "2030-01-01T00:00:00.000Z",
    );
  });

  it("is null when Stripe sent no period end at all", () => {
    expect(subscriptionPeriodEnd(subscriptionWith([]))).toBe(null);
  });
});

// biome-ignore lint/security/noSecrets: a function name, not a credential.
describe("hasLiveSubscription", () => {
  const member = (status: string) => ({
    email: "reader@example.test",
    stripe_customer_id: "cus_1",
    status,
    current_period_end: null,
  });

  it("blocks a second checkout while a subscription still bills", () => {
    for (const status of ["active", "trialing", "past_due", "unpaid"]) {
      expect(hasLiveSubscription(member(status))).toBe(true);
    }
  });

  it("allows checkout once the subscription is truly over", () => {
    for (const status of ["canceled", "incomplete_expired"]) {
      expect(hasLiveSubscription(member(status))).toBe(false);
    }
  });

  it("allows checkout for an address that has never subscribed", () => {
    expect(hasLiveSubscription(null)).toBe(false);
  });

  /*
   * The distinction the two predicates exist to draw. A failing card owes
   * money without being owed content, so it must block a second charge
   * while still being refused access.
   */
  it("separates being billed from being entitled", () => {
    expect(hasLiveSubscription(member("past_due"))).toBe(true);
    expect(isActive(member("past_due"))).toBe(false);

    expect(hasLiveSubscription(member("trialing"))).toBe(true);
    expect(isActive(member("trialing"))).toBe(true);
  });
});

describe("isActive", () => {
  it("refuses access once the paid-for period has passed", () => {
    expect(
      isActive({
        email: "reader@example.test",
        stripe_customer_id: "cus_1",
        status: "active",
        current_period_end: "2020-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });
});

describe("subscriptionFromInvoice", () => {
  const invoice = (shape: unknown) => shape as Stripe.Invoice;

  /*
   * The regression. Stripe moved the field onto `parent`, the code kept
   * reading the top level through a cast, and so both invoice handlers were
   * silent no-ops: a card could fail and the member row would never change.
   */
  it("reads the subscription from the invoice's parent", () => {
    expect(
      subscriptionFromInvoice(
        invoice({
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_123" },
          },
        }),
      ),
    ).toBe("sub_123");
  });

  it("falls back to the old top-level field", () => {
    expect(subscriptionFromInvoice(invoice({ subscription: "sub_old" }))).toBe(
      "sub_old",
    );
  });

  it("accepts an expanded subscription object", () => {
    expect(
      subscriptionFromInvoice(
        invoice({
          parent: {
            subscription_details: { subscription: { id: "sub_expanded" } },
          },
        }),
      ),
    ).toBe("sub_expanded");
  });

  it("is null for an invoice with no subscription at all", () => {
    expect(subscriptionFromInvoice(invoice({ parent: null }))).toBe(null);
    expect(subscriptionFromInvoice(invoice({}))).toBe(null);
  });

  /*
   * A one-off invoice has a parent of a different type. Returning its
   * `quote_details` id would send the handler looking up a subscription that
   * does not exist.
   */
  it("is null when the parent is not a subscription", () => {
    expect(
      subscriptionFromInvoice(
        invoice({
          parent: { type: "quote_details", subscription_details: null },
        }),
      ),
    ).toBe(null);
  });
});
