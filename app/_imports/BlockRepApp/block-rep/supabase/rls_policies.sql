-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_records ENABLE ROW LEVEL SECURITY;

-- Create helper function to get current user's organization
CREATE OR REPLACE FUNCTION get_user_org()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id 
        FROM profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check if user is manager
CREATE OR REPLACE FUNCTION is_user_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'manager' 
        FROM profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations RLS Policies
CREATE POLICY "Organizations are viewable by members" ON organizations
    FOR SELECT USING (
        id = get_user_org()
    );

-- Profiles RLS Policies
CREATE POLICY "Profiles are viewable by org members" ON profiles
    FOR SELECT USING (
        organization_id = get_user_org()
    );

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (
        id = auth.uid()
    );

CREATE POLICY "Managers can update profiles" ON profiles
    FOR UPDATE USING (
        is_user_manager() AND organization_id = get_user_org()
    );

-- Reps RLS Policies
CREATE POLICY "Reps are viewable by org members" ON reps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = reps.id 
            AND profiles.organization_id = get_user_org()
        )
    );

CREATE POLICY "Reps can update own record" ON reps
    FOR UPDATE USING (
        id = auth.uid()
    );

CREATE POLICY "Managers can update all reps" ON reps
    FOR UPDATE USING (
        is_user_manager() AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = reps.id 
            AND profiles.organization_id = get_user_org()
        )
    );

CREATE POLICY "Reps can insert own location" ON rep_locations
    FOR INSERT WITH CHECK (
        rep_id = auth.uid()
    );

CREATE POLICY "Rep locations viewable by managers" ON rep_locations
    FOR SELECT USING (
        is_user_manager() AND EXISTS (
            SELECT 1 FROM reps 
            JOIN profiles ON profiles.id = reps.id 
            WHERE reps.id = rep_locations.rep_id 
            AND profiles.organization_id = get_user_org()
        )
    );

-- Clusters RLS Policies
CREATE POLICY "Clusters are viewable by assigned rep or managers" ON clusters
    FOR SELECT USING (
        assigned_rep_id = auth.uid() OR 
        status = 'unassigned' OR
        is_user_manager()
    );

CREATE POLICY "Managers can update clusters" ON clusters
    FOR UPDATE USING (
        is_user_manager() AND organization_id = get_user_org()
    );

-- Properties RLS Policies
CREATE POLICY "Properties are viewable by assigned rep or managers" ON properties
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clusters 
            WHERE clusters.id = properties.cluster_id 
            AND (clusters.assigned_rep_id = auth.uid() OR is_user_manager())
        )
    );

CREATE POLICY "Reps can update properties in assigned clusters" ON properties
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM clusters 
            WHERE clusters.id = properties.cluster_id 
            AND clusters.assigned_rep_id = auth.uid()
        )
    );

-- Interactions RLS Policies
CREATE POLICY "Reps can view own interactions" ON interactions
    FOR SELECT USING (
        rep_id = auth.uid()
    );

CREATE POLICY "Reps can create own interactions" ON interactions
    FOR INSERT WITH CHECK (
        rep_id = auth.uid()
    );

CREATE POLICY "Managers can view all interactions" ON interactions
    FOR SELECT USING (
        is_user_manager() AND EXISTS (
            SELECT 1 FROM reps 
            JOIN profiles ON profiles.id = reps.id 
            WHERE reps.id = interactions.rep_id 
            AND profiles.organization_id = get_user_org()
        )
    );

-- Sales RLS Policies
CREATE POLICY "Reps can view own sales" ON sales
    FOR SELECT USING (
        rep_id = auth.uid()
    );

CREATE POLICY "Reps can create own sales" ON sales
    FOR INSERT WITH CHECK (
        rep_id = auth.uid()
    );

CREATE POLICY "Managers can view all sales" ON sales
    FOR SELECT USING (
        is_user_manager() AND EXISTS (
            SELECT 1 FROM reps 
            JOIN profiles ON profiles.id = reps.id 
            WHERE reps.id = sales.rep_id 
            AND profiles.organization_id = get_user_org()
        )
    );

CREATE POLICY "Managers can update all sales" ON sales
    FOR UPDATE USING (
        is_user_manager() AND EXISTS (
            SELECT 1 FROM reps 
            JOIN profiles ON profiles.id = reps.id 
            WHERE reps.id = sales.rep_id 
            AND profiles.organization_id = get_user_org()
        )
    );

-- Followups RLS Policies
CREATE POLICY "Reps can view own followups" ON followups
    FOR SELECT USING (
        rep_id = auth.uid()
    );

CREATE POLICY "Reps can create own followups" ON followups
    FOR INSERT WITH CHECK (
        rep_id = auth.uid()
    );

CREATE POLICY "Reps can update own followups" ON followups
    FOR UPDATE USING (
        rep_id = auth.uid()
    );

CREATE POLICY "Managers can view all followups" ON followups
    FOR SELECT USING (
        is_user_manager() AND EXISTS (
            SELECT 1 FROM reps 
            JOIN profiles ON profiles.id = reps.id 
            WHERE reps.id = followups.rep_id 
            AND profiles.organization_id = get_user_org()
        )
    );

-- Messages RLS Policies
CREATE POLICY "Reps can view own messages" ON messages
    FOR SELECT USING (
        rep_id = auth.uid()
    );

CREATE POLICY "Reps can create own messages" ON messages
    FOR INSERT WITH CHECK (
        rep_id = auth.uid()
    );

CREATE POLICY "Managers can view all messages" ON messages
    FOR SELECT USING (
        is_user_manager() AND EXISTS (
            SELECT 1 FROM reps 
            JOIN profiles ON profiles.id = reps.id 
            WHERE reps.id = messages.rep_id 
            AND profiles.organization_id = get_user_org()
        )
    );

-- Routes RLS Policies
CREATE POLICY "Reps can view own routes" ON routes
    FOR SELECT USING (
        rep_id = auth.uid()
    );

CREATE POLICY "Reps can create own routes" ON routes
    FOR INSERT WITH CHECK (
        rep_id = auth.uid()
    );

CREATE POLICY "Reps can update own routes" ON routes
    FOR UPDATE USING (
        rep_id = auth.uid()
    );

-- Daily Stats RLS Policies
CREATE POLICY "Reps can view own daily stats" ON daily_stats
    FOR SELECT USING (
        rep_id = auth.uid()
    );

CREATE POLICY "Managers can view all daily stats" ON daily_stats
    FOR SELECT USING (
        is_user_manager() AND EXISTS (
            SELECT 1 FROM reps 
            JOIN profiles ON profiles.id = reps.id 
            WHERE reps.id = daily_stats.rep_id 
            AND profiles.organization_id = get_user_org()
        )
    );

-- XP Records RLS Policies
CREATE POLICY "Reps can view own XP records" ON xp_records
    FOR SELECT USING (
        rep_id = auth.uid()
    );

CREATE POLICY "Reps can create own XP records" ON xp_records
    FOR INSERT WITH CHECK (
        rep_id = auth.uid()
    );

CREATE POLICY "Managers can view all XP records" ON xp_records
    FOR SELECT USING (
        is_user_manager() AND EXISTS (
            SELECT 1 FROM reps 
            JOIN profiles ON profiles.id = reps.id 
            WHERE reps.id = xp_records.rep_id 
            AND profiles.organization_id = get_user_org()
        )
    );