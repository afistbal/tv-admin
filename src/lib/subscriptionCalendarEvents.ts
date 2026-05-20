import type { EventInput } from "@fullcalendar/core";
import type { AdminUserSubscriptionRow } from "@/types/adminUserSubscription";
import {
  isCalendarEligible,
  pickBillingAt,
  productTypeTone,
  rowStableKey,
  subscriptionKindTone,
} from "@/lib/subscriptionUserDisplay";

export type SubscriptionCalendarEventProps = {
  row: AdminUserSubscriptionRow;
  kindLabel: string;
  productLabel: string;
  dotColor: string;
};

export function rowsToCalendarEvents(rows: AdminUserSubscriptionRow[]): EventInput[] {
  const events: EventInput[] = [];
  for (const row of rows) {
    if (!isCalendarEligible(row)) {
      continue;
    }
    const billing = pickBillingAt(row);
    if (!billing) {
      continue;
    }
    const kind = subscriptionKindTone(row);
    const product = productTypeTone(row);
    events.push({
      id: rowStableKey(row),
      title: String(row.user_id ?? ""),
      start: billing.format("YYYY-MM-DD"),
      allDay: true,
      extendedProps: {
        row,
        kindLabel: kind.label,
        productLabel: product.label,
        dotColor: product.dot,
      } satisfies SubscriptionCalendarEventProps,
    });
  }
  return events;
}
