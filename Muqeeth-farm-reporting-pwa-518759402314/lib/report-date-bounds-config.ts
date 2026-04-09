/** When true, report date picker allows any date and skips last-submission / today clamping. */
export function isReportDateBoundsRelaxed(): boolean {
  if (process.env.NEXT_PUBLIC_FORCE_STRICT_REPORT_DATES === "true") {
    return false;
  }
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_RELAX_REPORT_DATE_BOUNDS === "true"
  );
}
