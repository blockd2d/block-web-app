export const ISSUE_TYPES = [
  "customer_not_home",
  "access_blocked",
  "weather_delay",
  "damaged_equipment",
  "safety_concern",
  "unexpected_condition",
  "other"
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];
