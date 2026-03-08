import type { JobListItem, JobDetail } from "../../types/job";
import type { ChecklistItem } from "../../types/checklist";

const today = new Date();
const TODAY = today.toISOString().slice(0, 10);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const TOMORROW = tomorrow.toISOString().slice(0, 10);

/** Static mock jobs: today (mixed statuses), upcoming, completed. */
export const MOCK_JOBS_TODAY: JobListItem[] = [
  {
    id: "mock-job-1",
    address_short: "124 Oak Lane",
    address_full: "124 Oak Lane, Riverside",
    service_name: "Lawn care",
    status: "scheduled",
    customer_name: "Green Valley HOA",
    scheduled_start: `${TODAY}T08:00:00`,
    scheduled_end: `${TODAY}T10:00:00`,
    completed_at: null,
    crew_label: "Nova Crew A",
    has_unsynced: false,
    has_issue: false
  },
  {
    id: "mock-job-2",
    address_short: "501 Maple Dr",
    address_full: "501 Maple Dr, Riverside",
    service_name: "Landscaping",
    status: "in_progress",
    customer_name: "Sarah Chen",
    scheduled_start: `${TODAY}T10:30:00`,
    scheduled_end: `${TODAY}T12:30:00`,
    completed_at: null,
    crew_label: "Nova Crew A",
    has_unsynced: false,
    has_issue: false
  },
  {
    id: "mock-job-3",
    address_short: "88 Pine St",
    address_full: "88 Pine St, Riverside",
    service_name: "Mulching",
    status: "complete",
    customer_name: "Davis Family",
    scheduled_start: `${TODAY}T07:00:00`,
    scheduled_end: `${TODAY}T09:00:00`,
    completed_at: `${TODAY}T08:45:00`,
    crew_label: "Nova Crew A",
    has_unsynced: false,
    has_issue: false
  }
];

export const MOCK_JOBS_UPCOMING: JobListItem[] = [
  {
    id: "mock-job-4",
    address_short: "200 Cedar Ave",
    address_full: "200 Cedar Ave, Riverside",
    service_name: "Seasonal cleanup",
    status: "scheduled",
    customer_name: "Westfield Properties",
    scheduled_start: `${TOMORROW}T14:00:00`,
    scheduled_end: `${TOMORROW}T16:00:00`,
    completed_at: null,
    crew_label: "Nova Crew A",
    has_unsynced: false,
    has_issue: false
  },
  {
    id: "mock-job-5",
    address_short: "15 Birch Rd",
    address_full: "15 Birch Rd, Riverside",
    service_name: "Lawn care",
    status: "scheduled",
    customer_name: "Thompson Residence",
    scheduled_start: `${TOMORROW}T09:00:00`,
    scheduled_end: `${TOMORROW}T11:00:00`,
    completed_at: null,
    crew_label: "Nova Crew A",
    has_unsynced: false,
    has_issue: false
  }
];

export const MOCK_JOBS_COMPLETED: JobListItem[] = [
  {
    id: "mock-job-6",
    address_short: "42 Elm St",
    address_full: "42 Elm St, Riverside",
    service_name: "Hedge trim",
    status: "complete",
    customer_name: "River View Apartments",
    scheduled_start: `${TODAY}T06:00:00`,
    scheduled_end: `${TODAY}T08:00:00`,
    completed_at: `${TODAY}T07:50:00`,
    crew_label: "Nova Crew A",
    has_unsynced: false,
    has_issue: false
  }
];

const MOCK_JOB_IDS = [
  "mock-job-1",
  "mock-job-2",
  "mock-job-3",
  "mock-job-4",
  "mock-job-5",
  "mock-job-6"
];

/** Job detail records keyed by job id. */
export const MOCK_JOB_DETAILS: Record<string, JobDetail> = Object.fromEntries(
  MOCK_JOB_IDS.map((id) => {
    const list =
      [...MOCK_JOBS_TODAY, ...MOCK_JOBS_UPCOMING, ...MOCK_JOBS_COMPLETED].find((j) => j.id === id) ??
      MOCK_JOBS_TODAY[0];
    return [
      id,
      {
        id: list.id,
        address_short: list.address_short ?? null,
        address_full: list.address_full ?? null,
        service_name: list.service_name ?? null,
        service_type: list.service_name ?? null,
        status: list.status,
        customer_name: list.customer_name ?? null,
        customer_phone: "+1 (555) 123-4567",
        scheduled_start: list.scheduled_start ?? null,
        scheduled_end: list.scheduled_end ?? null,
        completed_at: list.completed_at ?? null,
        notes: "Gate code 4521. Dog in backyard.",
        quote_summary: null,
        crew_label: list.crew_label ?? null,
        latitude: 33.95,
        longitude: -117.4
      } as JobDetail
    ];
  })
);

/** Checklist template for mock mode. */
export const MOCK_CHECKLIST_TEMPLATE: ChecklistItem[] = [
  { id: "mock-chk-1", template_item_id: "mock-chk-1", label: "Site prepped", sort_order: 0, is_required: true, is_checked: false, checked_at: null, note: null },
  { id: "mock-chk-2", template_item_id: "mock-chk-2", label: "Materials verified", sort_order: 1, is_required: true, is_checked: false, checked_at: null, note: null },
  { id: "mock-chk-3", template_item_id: "mock-chk-3", label: "Customer notified", sort_order: 2, is_required: false, is_checked: false, checked_at: null, note: null }
];

export type MockNotification = {
  id: string;
  title: string;
  body: string;
  date: string;
};

/** Fake notifications for Notifications screen in mock mode. */
export const MOCK_NOTIFICATIONS: MockNotification[] = [
  { id: "mock-notif-1", title: "Assignment update", body: "Job at 501 Maple Dr has been moved to 10:30 AM.", date: new Date(Date.now() - 3600000).toISOString() },
  { id: "mock-notif-2", title: "Start time change", body: "124 Oak Lane is now scheduled for 8:00 AM.", date: new Date(Date.now() - 7200000).toISOString() },
  { id: "mock-notif-3", title: "Manager note", body: "Please complete site photos before leaving each job.", date: new Date(Date.now() - 86400000).toISOString() }
];
