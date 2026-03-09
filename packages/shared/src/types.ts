export type Role = 'admin' | 'manager' | 'rep' | 'labor';

export type Profile = {
  id: string;
  org_id: string;
  role: Role;
  name: string;
  email: string;
  created_at?: string;
};

export type Org = {
  id: string;
  name: string;
  created_at?: string;
};

export type County = {
  id: string;
  org_id: string;
  name: string;
  fips?: string | null;
  bounds?: any | null;
  created_at?: string;
};

export type ClusterSet = {
  id: string;
  org_id: string;
  county_id: string;
  filters_json: any;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number;
  created_at?: string;
  created_by?: string;
};

export type Cluster = {
  id: string;
  org_id: string;
  cluster_set_id: string;
  center_lat: number;
  center_lng: number;
  hull_geojson: any;
  stats_json: any;
  assigned_rep_id?: string | null;
  color?: string | null;
  created_at?: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
};

export type Rep = {
  id: string;
  org_id: string;
  profile_id?: string | null;
  name: string;
  home_lat: number;
  home_lng: number;
  active: boolean;
};

export type InteractionOutcome =
  | 'not_home'
  | 'talked_not_interested'
  | 'lead'
  | 'quote'
  | 'sold'
  | 'followup'
  | 'do_not_knock';

export type Interaction = {
  id: string;
  org_id: string;
  rep_id: string;
  property_id: string;
  outcome: InteractionOutcome;
  notes?: string | null;
  followup_at?: string | null;
  created_at?: string;
};

export type SaleStatus = 'lead' | 'quote' | 'sold' | 'cancelled';

export type Sale = {
  id: string;
  org_id: string;
  rep_id: string;
  property_id: string;
  price?: number | null;
  service_type?: string | null;
  notes?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  status: SaleStatus;
  created_at?: string;
  updated_at?: string;
};

export type Laborer = {
  id: string;
  org_id: string;
  profile_id?: string | null;
  name: string;
  active: boolean;
};

export type JobStatus = 'scheduled' | 'in_progress' | 'complete' | 'cancelled';

export type Job = {
  id: string;
  org_id: string;
  sale_id: string;
  laborer_id?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status: JobStatus;
  created_at?: string;
};

export type MessageThread = {
  id: string;
  org_id: string;
  rep_id?: string | null;
  customer_phone: string;
  property_id?: string | null;
  last_message_at?: string | null;
};

export type Message = {
  id: string;
  org_id: string;
  thread_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  twilio_sid?: string | null;
  sent_at?: string | null;
  status?: string | null;
};

export type ExportRecord = {
  id: string;
  org_id: string;
  type: 'sales' | 'assignments';
  status: 'queued' | 'running' | 'complete' | 'failed';
  storage_path?: string | null;
  created_at?: string;
};
