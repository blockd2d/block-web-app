-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    role TEXT CHECK (role IN ('rep', 'manager')) DEFAULT 'rep',
    avatar_url TEXT,
    push_token TEXT,
    push_token_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reps table (extends profiles for sales reps)
CREATE TABLE reps (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    home_base_lat DOUBLE PRECISION,
    home_base_lng DOUBLE PRECISION,
    current_cluster_id UUID,
    is_clocked_in BOOLEAN DEFAULT FALSE,
    clocked_in_at TIMESTAMP WITH TIME ZONE,
    last_location_lat DOUBLE PRECISION,
    last_location_lng DOUBLE PRECISION,
    last_location_updated_at TIMESTAMP WITH TIME ZONE,
    daily_goal_doors INTEGER DEFAULT 50,
    daily_goal_leads INTEGER DEFAULT 10,
    total_xp INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clusters (territories assigned to reps)
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    assigned_rep_id UUID REFERENCES reps(id),
    polygon_coords JSONB NOT NULL, -- Array of {lat, lng} objects
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    total_properties INTEGER DEFAULT 0,
    total_doors INTEGER DEFAULT 0,
    completed_doors INTEGER DEFAULT 0,
    color TEXT DEFAULT '#007AFF',
    status TEXT CHECK (status IN ('assigned', 'in_progress', 'completed', 'unassigned')) DEFAULT 'unassigned',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Properties (houses/buildings to visit)
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    estimated_value INTEGER,
    property_type TEXT,
    notes TEXT,
    last_visited TIMESTAMP WITH TIME ZONE,
    last_outcome TEXT,
    visit_count INTEGER DEFAULT 0,
    do_not_knock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interactions (door knocking outcomes)
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    rep_id UUID REFERENCES reps(id) ON DELETE CASCADE,
    outcome TEXT CHECK (outcome IN ('not_home', 'not_interested', 'interested', 'quote_given', 'sold', 'follow_up', 'do_not_knock')) NOT NULL,
    notes TEXT,
    photos TEXT[], -- Array of URLs to photos in storage
    price DECIMAL(10, 2),
    service_type TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales (completed sales)
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    rep_id UUID REFERENCES reps(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    service_type TEXT NOT NULL,
    notes TEXT,
    photos TEXT[], -- Array of URLs to photos in storage
    customer_phone TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    contract_url TEXT,
    payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
    payment_amount_received DECIMAL(10, 2) DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follow-ups
CREATE TABLE followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    rep_id UUID REFERENCES reps(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    outcome TEXT CHECK (outcome IN ('completed', 'rescheduled', 'cancelled')),
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages (SMS conversations)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    rep_id UUID REFERENCES reps(id) ON DELETE CASCADE,
    twilio_sid TEXT,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    body TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')) NOT NULL,
    status TEXT CHECK (status IN ('sent', 'delivered', 'failed', 'received')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rep location tracking
CREATE TABLE rep_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rep_id UUID REFERENCES reps(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Routes (optimized walking paths)
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    rep_id UUID REFERENCES reps(id) ON DELETE CASCADE,
    stops JSONB NOT NULL, -- Array of route stops
    total_distance DOUBLE PRECISION,
    estimated_duration INTEGER,
    status TEXT CHECK (status IN ('active', 'completed', 'paused')) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily stats for gamification
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rep_id UUID REFERENCES reps(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    doors_knocked INTEGER DEFAULT 0,
    not_home INTEGER DEFAULT 0,
    not_interested INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    quotes_given INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    follow_ups_scheduled INTEGER DEFAULT 0,
    hours_worked DECIMAL(4, 2) DEFAULT 0,
    doors_per_hour DECIMAL(5, 2) DEFAULT 0,
    close_rate DECIMAL(5, 4) DEFAULT 0,
    lead_conversion_rate DECIMAL(5, 4) DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(rep_id, date)
);

-- XP records for gamification
CREATE TABLE xp_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rep_id UUID REFERENCES reps(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    xp_value INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_properties_cluster_id ON properties(cluster_id);
CREATE INDEX idx_properties_lat_lng ON properties(lat, lng);
CREATE INDEX idx_interactions_property_id ON interactions(property_id);
CREATE INDEX idx_interactions_rep_id ON interactions(rep_id);
CREATE INDEX idx_interactions_created_at ON interactions(created_at);
CREATE INDEX idx_sales_property_id ON sales(property_id);
CREATE INDEX idx_sales_rep_id ON sales(rep_id);
CREATE INDEX idx_followups_property_id ON followups(property_id);
CREATE INDEX idx_followups_rep_id ON followups(rep_id);
CREATE INDEX idx_followups_scheduled_for ON followups(scheduled_for);
CREATE INDEX idx_messages_property_id ON messages(property_id);
CREATE INDEX idx_messages_rep_id ON messages(rep_id);
CREATE INDEX idx_rep_locations_rep_id ON rep_locations(rep_id);
CREATE INDEX idx_rep_locations_timestamp ON rep_locations(timestamp);
CREATE INDEX idx_daily_stats_rep_id_date ON daily_stats(rep_id, date);
CREATE INDEX idx_clusters_assigned_rep_id ON clusters(assigned_rep_id);
CREATE INDEX idx_clusters_organization_id ON clusters(organization_id);

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to all tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reps_updated_at BEFORE UPDATE ON reps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clusters_updated_at BEFORE UPDATE ON clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_followups_updated_at BEFORE UPDATE ON followups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();