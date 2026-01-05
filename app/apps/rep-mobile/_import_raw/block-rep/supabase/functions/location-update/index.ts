import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders});
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {auth: {persistSession: false}}
    );

    // Get authenticated user from JWT in background geolocation
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new Error('No authorization token provided');
    }

    const {data: {user}, error: userError} = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Parse location data from request body
    const locationData = await req.json();
    
    // Background geolocation sends data in a specific format
    const {
      location: {
        coords: {
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          altitude,
        },
        timestamp,
      },
      device: {
        model,
        platform,
        version,
        manufacturer,
      },
      battery: {
        level,
        is_charging,
      },
    } = locationData;

    if (!latitude || !longitude) {
      throw new Error('Missing required location coordinates');
    }

    // Store location in database
    const {error: dbError} = await supabaseClient
      .from('rep_locations')
      .insert({
        rep_id: user.id,
        lat: latitude,
        lng: longitude,
        accuracy: accuracy || null,
        speed: speed || null,
        heading: heading || null,
        altitude: altitude || null,
        timestamp: new Date(timestamp).toISOString(),
      });

    if (dbError) {
      console.error('Error storing location:', dbError);
      throw dbError;
    }

    // Update rep's last location
    const {error: updateError} = await supabaseClient
      .from('reps')
      .update({
        last_location_lat: latitude,
        last_location_lng: longitude,
        last_location_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating rep location:', updateError);
      // Don't throw here - location was stored successfully
    }

    // Check if rep is currently in a cluster
    const {data: clusters, error: clusterError} = await supabaseClient
      .from('clusters')
      .select('id, polygon_coords')
      .eq('assigned_rep_id', user.id);

    if (!clusterError && clusters && clusters.length > 0) {
      // Check if location is inside any assigned cluster
      let currentClusterId = null;
      
      for (const cluster of clusters) {
        if (isPointInPolygon(latitude, longitude, cluster.polygon_coords)) {
          currentClusterId = cluster.id;
          break;
        }
      }

      // Update current cluster if changed
      if (currentClusterId) {
        const {data: repData, error: repError} = await supabaseClient
          .from('reps')
          .select('current_cluster_id')
          .eq('id', user.id)
          .single();

        if (!repError && repData?.current_cluster_id !== currentClusterId) {
          await supabaseClient
            .from('reps')
            .update({current_cluster_id: currentClusterId})
            .eq('id', user.id);
        }
      }
    }

    // Send real-time update to managers via Supabase Realtime
    const {error: broadcastError} = await supabaseClient
      .channel('rep-locations')
      .send({
        type: 'broadcast',
        event: 'location-update',
        payload: {
          rep_id: user.id,
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString(),
        },
      });

    if (broadcastError) {
      console.error('Error broadcasting location update:', broadcastError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Location updated successfully',
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error processing location update:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
        status: 400,
      }
    );
  }
});

// Helper function to check if point is inside polygon
function isPointInPolygon(lat: number, lng: number, polygon: any[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    
    const intersect = ((yi > lng) !== (yj > lng))
        && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/*
To deploy this function:

1. Deploy: supabase functions deploy location-update

2. Configure background geolocation in your React Native app:
   - Set the url to: https://your-project.supabase.co/functions/v1/location-update
   - Include the JWT token in the Authorization header

3. Required environment variables:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY

This function is designed to work with react-native-background-geolocation
and handles location updates, cluster detection, and real-time broadcasting.
*/