export interface User {
  id: string;
  email: string;
  role: 'rep' | 'manager';
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Rep {
  id: string;
  user_id: string;
  home_base_lat: number;
  home_base_lng: number;
  current_cluster_id?: string;
  is_clocked_in: boolean;
  clocked_in_at?: string;
  last_location_lat?: number;
  last_location_lng?: number;
  last_location_updated_at?: string;
  daily_goal_doors?: number;
  daily_goal_leads?: number;
  created_at: string;
  updated_at: string;
}

export interface Cluster {
  id: string;
  name: string;
  organization_id: string;
  assigned_rep_id?: string;
  polygon_coords: {lat: number; lng: number}[];
  center_lat: number;
  center_lng: number;
  total_properties: number;
  total_doors: number;
  completed_doors: number;
  color: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'unassigned';
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  cluster_id: string;
  address: string;
  lat: number;
  lng: number;
  estimated_value?: number;
  property_type?: string;
  notes?: string;
  last_visited?: string;
  last_outcome?: InteractionOutcome;
  visit_count: number;
  do_not_knock: boolean;
  created_at: string;
  updated_at: string;
}

export type InteractionOutcome = 
  | 'not_home'
  | 'not_interested'
  | 'interested'
  | 'quote_given'
  | 'sold'
  | 'follow_up'
  | 'do_not_knock';

export interface Interaction {
  id: string;
  property_id: string;
  rep_id: string;
  outcome: InteractionOutcome;
  notes?: string;
  photos?: string[];
  price?: number;
  service_type?: string;
  customer_phone?: string;
  customer_email?: string;
  duration_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  property_id: string;
  rep_id: string;
  price: number;
  service_type: string;
  notes?: string;
  photos?: string[];
  customer_phone: string;
  customer_email: string;
  contract_url?: string;
  payment_status: 'pending' | 'partial' | 'paid';
  payment_amount_received?: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  property_id: string;
  rep_id: string;
  scheduled_for: string;
  completed_at?: string;
  notes?: string;
  outcome?: 'completed' | 'rescheduled' | 'cancelled';
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  property_id: string;
  rep_id: string;
  twilio_sid?: string;
  from_number: string;
  to_number: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'failed' | 'received';
  created_at: string;
  updated_at: string;
}

export interface RepLocation {
  id: string;
  rep_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  timestamp: string;
  created_at: string;
}

export interface Stats {
  rep_id: string;
  date: string;
  doors_knocked: number;
  not_home: number;
  not_interested: number;
  leads: number;
  quotes_given: number;
  sales: number;
  follow_ups_scheduled: number;
  hours_worked: number;
  doors_per_hour: number;
  close_rate: number;
  lead_conversion_rate: number;
  xp_earned: number;
  streak_days: number;
  created_at: string;
  updated_at: string;
}

export interface RouteStop {
  property_id: string;
  address: string;
  lat: number;
  lng: number;
  order_index: number;
  estimated_duration?: number;
  visited: boolean;
  outcome?: InteractionOutcome;
}

export interface Route {
  id: string;
  cluster_id: string;
  rep_id: string;
  stops: RouteStop[];
  total_distance?: number;
  estimated_duration?: number;
  status: 'active' | 'completed' | 'paused';
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface XPRecord {
  id: string;
  rep_id: string;
  action: string;
  xp_value: number;
  description: string;
  created_at: string;
}

export interface LeaderboardEntry {
  rep_id: string;
  name: string;
  total_sales: number;
  total_leads: number;
  total_xp: number;
  doors_per_hour: number;
  close_rate: number;
  rank: number;
}

export interface OfflineQueueItem {
  id: string;
  type: 'interaction' | 'sale' | 'follow_up' | 'location_update';
  data: any;
  timestamp: string;
  synced: boolean;
  retry_count: number;
  last_error?: string;
}