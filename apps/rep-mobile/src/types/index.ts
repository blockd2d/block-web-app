export type Role = 'admin' | 'manager' | 'rep' | 'labor';

export interface User {
  id: string;
  org_id: string;
  role: Role;
  name: string | null;
  email: string;
}

export interface Rep {
  id: string;
  org_id: string;
  profile_id: string | null;
  name: string;
  home_lat: number | null;
  home_lng: number | null;
  active: boolean;
}

export interface Cluster {
  id: string;
  org_id: string;
  cluster_set_id: string;
  center_lat: number;
  center_lng: number;
  hull_geojson: any; // GeoJSON Polygon
  stats_json: any;
  assigned_rep_id: string | null;
  color: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  lat: number;
  lng: number;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  value_estimate: number | null;
  tags: any;
  county_id: string | null;
  created_at: string;

  // Local UI fields (not authoritative DB columns)
  last_outcome?: InteractionOutcome;
  last_visited?: string;
  visit_count?: number;
}

export type InteractionOutcome =
  | 'not_home'
  | 'talked_not_interested'
  | 'lead'
  | 'quote_given'
  | 'sold'
  | 'followup_scheduled'
  | 'do_not_knock';

export interface Interaction {
  id: string;
  org_id: string;
  rep_id: string | null;
  property_id: string;
  outcome: InteractionOutcome;
  notes: string | null;
  followup_at: string | null;
  created_at: string;
}

export interface FollowUp {
  id: string;
  org_id: string;
  rep_id: string;
  property_id: string;
  due_at: string;
  status: 'open' | 'done' | 'snoozed';
  notes: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  org_id: string;
  rep_id: string | null;
  property_id: string;
  price: number | null;
  service_type: string | null;
  notes: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  status: 'lead' | 'quote' | 'sold' | 'cancelled';
  created_at: string;
}

export interface Route {
  id: string;
  cluster_id: string;
  stops: Array<{ property_id: string; order_index: number; visited?: boolean; outcome?: InteractionOutcome }>;
}

export interface RepLocation {
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  recorded_at: string;
  clocked_in?: boolean;
}

export interface MessageThread {
  id: string;
  org_id: string;
  rep_id: string | null;
  customer_phone: string;
  property_id: string | null;
  last_message_at: string | null;
}

export interface Message {
  id: string;
  org_id: string;
  thread_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string | null;
  created_at: string;
  sent_at: string | null;
  twilio_sid?: string | null;
}

export type OfflineQueueItem = {
  id: string;
  type: 'interaction' | 'sale' | 'follow_up' | 'location_update';
  data: any;
  timestamp: string;
  synced: boolean;
  retry_count: number;
  last_error?: string;
};
