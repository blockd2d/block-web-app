-- Sample data for Block Rep app
-- This script creates a complete demo organization with reps, clusters, and properties

-- Create organization
INSERT INTO organizations (id, name) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Demo Sales Corp');

-- Create manager profile
INSERT INTO profiles (
    id, organization_id, first_name, last_name, phone, role
) VALUES (
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    'Sarah',
    'Johnson',
    '+15551234567',
    'manager'
);

-- Create rep profiles
INSERT INTO profiles (
    id, organization_id, first_name, last_name, phone, role
) VALUES 
(
    '770e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440000',
    'Mike',
    'Wilson',
    '+15551234568',
    'rep'
),
(
    '880e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440000',
    'Lisa',
    'Davis',
    '+15551234569',
    'rep'
);

-- Create reps
INSERT INTO reps (
    id, home_base_lat, home_base_lng, daily_goal_doors, daily_goal_leads
) VALUES 
(
    '770e8400-e29b-41d4-a716-446655440002',
    37.7749,  -- San Francisco lat
    -122.4194, -- San Francisco lng
    50,
    10
),
(
    '880e8400-e29b-41d4-a716-446655440003',
    37.7849,
    -122.4094,
    60,
    12
);

-- Create clusters (territories)
INSERT INTO clusters (
    id, name, organization_id, assigned_rep_id, polygon_coords, 
    center_lat, center_lng, total_properties, total_doors, color, status
) VALUES 
(
    '990e8400-e29b-41d4-a716-446655440004',
    'Mission District',
    '550e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440002',
    '[
        {"lat": 37.7599, "lng": -122.4148},
        {"lat": 37.7599, "lng": -122.4048},
        {"lat": 37.7699, "lng": -122.4048},
        {"lat": 37.7699, "lng": -122.4148}
    ]'::jsonb,
    37.7649,
    -122.4098,
    8,
    8,
    '#007AFF',
    'assigned'
),
(
    'aa0e8400-e29b-41d4-a716-446655440005',
    'Nob Hill',
    '550e8400-e29b-41d4-a716-446655440000',
    '880e8400-e29b-41d4-a716-446655440003',
    '[
        {"lat": 37.7929, "lng": -122.4248},
        {"lat": 37.7929, "lng": -122.4148},
        {"lat": 37.8029, "lng": -122.4148},
        {"lat": 37.8029, "lng": -122.4248}
    ]'::jsonb,
    37.7979,
    -122.4198,
    6,
    6,
    '#34C759',
    'assigned'
),
(
    'bb0e8400-e29b-41d4-a716-446655440006',
    'Castro District',
    '550e8400-e29b-41d4-a716-446655440000',
    null,
    '[
        {"lat": 37.7609, "lng": -122.4448},
        {"lat": 37.7609, "lng": -122.4348},
        {"lat": 37.7709, "lng": -122.4348},
        {"lat": 37.7709, "lng": -122.4448}
    ]'::jsonb,
    37.7659,
    -122.4398,
    0,
    0,
    '#FF9500',
    'unassigned'
);

-- Create properties for Mission District cluster
INSERT INTO properties (
    id, cluster_id, address, lat, lng, estimated_value, property_type
) VALUES 
(
    'cc0e8400-e29b-41d4-a716-446655440007',
    '990e8400-e29b-41d4-a716-446655440004',
    '1234 Mission St, San Francisco, CA',
    37.7609,
    -122.4148,
    850000,
    'Single Family'
),
(
    'dd0e8400-e29b-41d4-a716-446655440008',
    '990e8400-e29b-41d4-a716-446655440004',
    '1256 Mission St, San Francisco, CA',
    37.7619,
    -122.4138,
    920000,
    'Single Family'
),
(
    'ee0e8400-e29b-41d4-a716-446655440009',
    '990e8400-e29b-41d4-a716-446655440004',
    '1278 Mission St, San Francisco, CA',
    37.7629,
    -122.4128,
    780000,
    'Condo'
),
(
    'ff0e8400-e29b-41d4-a716-446655440010',
    '990e8400-e29b-41d4-a716-446655440004',
    '1290 Mission St, San Francisco, CA',
    37.7639,
    -122.4118,
    1100000,
    'Single Family'
),
(
    '00108400-e29b-41d4-a716-446655440011',
    '990e8400-e29b-41d4-a716-446655440004',
    '1312 Mission St, San Francisco, CA',
    37.7649,
    -122.4108,
    650000,
    'Condo'
),
(
    '01108400-e29b-41d4-a716-446655440012',
    '990e8400-e29b-41d4-a716-446655440004',
    '1334 Mission St, San Francisco, CA',
    37.7659,
    -122.4098,
    950000,
    'Single Family'
),
(
    '02108400-e29b-41d4-a716-446655440013',
    '990e8400-e29b-41d4-a716-446655440004',
    '1356 Mission St, San Francisco, CA',
    37.7669,
    -122.4088,
    1200000,
    'Single Family'
),
(
    '03108400-e29b-41d4-a716-446655440014',
    '990e8400-e29b-41d4-a716-446655440004',
    '1378 Mission St, San Francisco, CA',
    37.7679,
    -122.4078,
    820000,
    'Condo'
);

-- Create properties for Nob Hill cluster
INSERT INTO properties (
    id, cluster_id, address, lat, lng, estimated_value, property_type
) VALUES 
(
    '04108400-e29b-41d4-a716-446655440015',
    'aa0e8400-e29b-41d4-a716-446655440005',
    '2100 California St, San Francisco, CA',
    37.7939,
    -122.4248,
    1500000,
    'Single Family'
),
(
    '05108400-e29b-41d4-a716-446655440016',
    'aa0e8400-e29b-41d4-a716-446655440005',
    '2122 California St, San Francisco, CA',
    37.7949,
    -122.4238,
    1800000,
    'Single Family'
),
(
    '06108400-e29b-41d4-a716-446655440017',
    'aa0e8400-e29b-41d4-a716-446655440005',
    '2144 California St, San Francisco, CA',
    37.7959,
    -122.4228,
    2200000,
    'Single Family'
),
(
    '07108400-e29b-41d4-a716-446655440018',
    'aa0e8400-e29b-41d4-a716-446655440005',
    '2166 California St, San Francisco, CA',
    37.7969,
    -122.4218,
    1600000,
    'Condo'
),
(
    '08108400-e29b-41d4-a716-446655440019',
    'aa0e8400-e29b-41d4-a716-446655440005',
    '2188 California St, San Francisco, CA',
    37.7979,
    -122.4208,
    1950000,
    'Single Family'
),
(
    '09108400-e29b-41d4-a716-446655440020',
    'aa0e8400-e29b-41d4-a716-446655440005',
    '2210 California St, San Francisco, CA',
    37.7989,
    -122.4198,
    1750000,
    'Condo'
);

-- Create sample interactions for Mike Wilson
INSERT INTO interactions (
    id, property_id, rep_id, outcome, notes, price, service_type, customer_phone, duration_minutes
) VALUES 
(
    '10108400-e29b-41d4-a716-446655440021',
    'cc0e8400-e29b-41d4-a716-446655440007',
    '770e8400-e29b-41d4-a716-446655440002',
    'interested',
    'Customer seemed very interested in our services. Asked for a quote.',
    null,
    'Roof Cleaning',
    '+15551234999',
    15
),
(
    '11108400-e29b-41d4-a716-446655440022',
    'dd0e8400-e29b-41d4-a716-446655440008',
    '770e8400-e29b-41d4-a716-446655440002',
    'not_home',
    'No one answered the door. Left a flyer.',
    null,
    null,
    null,
    2
),
(
    '12108400-e29b-41d4-a716-446655440023',
    'ee0e8400-e29b-41d4-a716-446655440009',
    '770e8400-e29b-41d4-a716-446655440002',
    'sold',
    'Customer signed up for annual maintenance plan!',
    2500.00,
    'Annual Maintenance',
    '+15551234998',
    25
);

-- Create sample follow-ups
INSERT INTO followups (
    id, property_id, rep_id, scheduled_for, notes
) VALUES 
(
    '13108400-e29b-41d4-a716-446655440024',
    'ff0e8400-e29b-41d4-a716-446655440010',
    '770e8400-e29b-41d4-a716-446655440002',
    NOW() + INTERVAL '2 days',
    'Call back to discuss quote details'
),
(
    '14108400-e29b-41d4-a716-446655440025',
    '04108400-e29b-41d4-a716-446655440015',
    '880e8400-e29b-41d4-a716-446655440003',
    NOW() + INTERVAL '1 week',
    'Follow up on initial consultation'
);

-- Create sample daily stats
INSERT INTO daily_stats (
    id, rep_id, date, doors_knocked, leads, sales, total_xp, streak_days
) VALUES 
(
    '15108400-e29b-41d4-a716-446655440026',
    '770e8400-e29b-41d4-a716-446655440002',
    CURRENT_DATE - INTERVAL '1 day',
    45,
    8,
    1,
    250,
    5
),
(
    '16108400-e29b-41d4-a716-446655440027',
    '880e8400-e29b-41d4-a716-446655440003',
    CURRENT_DATE - INTERVAL '1 day',
    52,
    12,
    2,
    380,
    7
);

-- Update cluster stats based on interactions
UPDATE clusters 
SET completed_doors = (
    SELECT COUNT(*) 
    FROM properties 
    JOIN interactions ON interactions.property_id = properties.id 
    WHERE properties.cluster_id = clusters.id
),
total_doors = (
    SELECT COUNT(*) 
    FROM properties 
    WHERE properties.cluster_id = clusters.id
),
total_properties = (
    SELECT COUNT(*) 
    FROM properties 
    WHERE properties.cluster_id = clusters.id
);

-- Update property visit counts and last outcomes
UPDATE properties 
SET visit_count = (
    SELECT COUNT(*) 
    FROM interactions 
    WHERE interactions.property_id = properties.id
),
last_outcome = (
    SELECT outcome 
    FROM interactions 
    WHERE interactions.property_id = properties.id 
    ORDER BY created_at DESC 
    LIMIT 1
),
last_visited = (
    SELECT created_at 
    FROM interactions 
    WHERE interactions.property_id = properties.id 
    ORDER BY created_at DESC 
    LIMIT 1
);