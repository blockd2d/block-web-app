export {
  MOCK_JOBS_TODAY,
  MOCK_JOBS_UPCOMING,
  MOCK_JOBS_COMPLETED,
  MOCK_JOB_DETAILS,
  MOCK_CHECKLIST_TEMPLATE,
  MOCK_NOTIFICATIONS
} from "./mockData";
export type { MockNotification } from "./mockData";
export {
  getMockChecklistResponses,
  setMockChecklistResponse,
  getMockClockState,
  setMockClockIn,
  setMockClockOut,
  getMockJobStatusOverride,
  setMockJobStatusOverride,
  getMockJobNotes,
  addMockJobNote,
  addMockJobIssue,
  resetMockState
} from "./mockState";
