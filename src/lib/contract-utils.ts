import { eachMonthOfInterval, format, startOfMonth } from "date-fns";
import { pl } from "date-fns/locale";

export type PaymentMonth = {
  key: string;
  label: string;
  amount: number;
};

/** Inclusive calendar months between contract start and expiry (same rules as payment grid). */
export function billingMonthsCount(startIso: string | null | undefined, endIso: string): number {
  if (!startIso) return 0;
  const start = startOfMonth(new Date(startIso));
  const end = startOfMonth(new Date(endIso));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return eachMonthOfInterval({ start, end }).length;
}

export function formatDurationPl(months: number): string {
  if (months <= 0) return "—";
  if (months === 1) return "1 miesiąc";
  if (months >= 2 && months <= 4) return `${months} miesiące`;
  return `${months} miesięcy`;
}

/** One row per calendar month in range; each month billed at `monthlyAmount`. */
export function buildPaymentSchedule(
  startIso: string | null | undefined,
  endIso: string,
  monthlyAmount: number,
): PaymentMonth[] {
  if (!startIso || monthlyAmount <= 0) return [];
  const start = startOfMonth(new Date(startIso));
  const end = startOfMonth(new Date(endIso));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  return eachMonthOfInterval({ start, end }).map((d) => ({
    key: format(d, "yyyy-MM"),
    label: format(d, "LLLL yyyy", { locale: pl }),
    amount: monthlyAmount,
  }));
}

export function estimatedPeriodValue(
  monthly: number,
  startIso: string | null | undefined,
  endIso: string,
  storedTotal: number | null | undefined,
  expiryEndUnknown?: boolean,
): number {
  if (expiryEndUnknown) {
    if (storedTotal != null && storedTotal > 0) return storedTotal;
    return 0;
  }
  if (storedTotal != null && storedTotal > 0) return storedTotal;
  const n = billingMonthsCount(startIso, endIso);
  return n * monthly;
}
