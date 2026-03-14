export type Role = "admin" | "manager" | "rep" | "labor" | "unknown";

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Org = {
  id: string;
  name: string;
};

export type Me = {
  user: { id: string; email: string };
  org: Org;
  role: Role;
  fullName?: string | null;
};

export type ClusterStatus = "assigned" | "active" | "completed" | "archived";

export type Cluster = {
  id: string;
  name: string;
  status: ClusterStatus;
  stopCount: number;
  completedCount: number;
  walkingDistanceMiles?: number | null;
  estDurationMins?: number | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  // Map preview
  startLat?: number | null;
  startLng?: number | null;
};

export type ClusterMapData = {
  // Optional boundary polygon coordinates.
  boundary?: LatLng[] | null;
  // Optional route polyline coordinates.
  route?: LatLng[] | null;
};

export type Stop = {
  id: string;
  clusterId: string;
  sequence: number;
  address1: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  leadName?: string | null;
  propertyNotes?: string | null;
  completed?: boolean;
};

export type KnockOutcome =
  | "no_answer"
  | "not_interested"
  | "interested"
  | "estimated"
  | "booked";

export type KnockLog = {
  id: string; // server id or client id
  clientEventId: string;
  stopId: string;
  clusterId: string;
  outcome: KnockOutcome;
  notes?: string | null;
  createdAt: string; // ISO
};

export type SyncState = "pending" | "syncing" | "failed" | "synced";

export type QuoteStatus = "draft" | "estimated" | "booked";

export type QuoteLineItem = {
  id: string;
  label: string;
  amountCents: number;
};

export type Quote = {
  id: string; // server id or client id
  clientWriteId: string;
  stopId: string;
  clusterId: string;
  status: QuoteStatus;
  basePriceCents: number;
  lineItems: QuoteLineItem[];
  notes?: string | null;
  totalCents: number;
  updatedAt: string; // ISO
};

