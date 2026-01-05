import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaView, Text, View, Button, TextInput, FlatList, TouchableOpacity, Image } from "react-native";
import { supabase } from "./lib/supabase";
import { posthog } from "./lib/posthog";
import { PosthogEvents } from "@block/shared";
import * as ImagePicker from "expo-image-picker";
import { authedPost } from "./lib/api";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";
import { env } from "./env";

type Job = any;

function useSession() {
  const [session, setSession] = React.useState<any>(null);
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

function LoginScreen() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>Block Labor</Text>
      <Text style={{ opacity: 0.7 }}>Invite-only. Login with your org email.</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ borderWidth: 1, padding: 10, borderRadius: 10 }} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, padding: 10, borderRadius: 10 }} />
      <Button title="Sign in" onPress={async () => {
        setErr(null);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setErr(error.message);
        if (data.session) posthog.capture(PosthogEvents.org_login_success);
      }} />
      {err ? <Text style={{ color: "crimson" }}>{err}</Text> : null}
    </SafeAreaView>
  );
}

function JobsScreen({ navigation }: any) {
  const [filter, setFilter] = React.useState<"today"|"upcoming"|"completed">("today");
  const [jobs, setJobs] = React.useState<Job[]>([]);

  const load = async () => {
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) return;
    const q = supabase.from("jobs").select("*").eq("assigned_labor_user_id", me.user.id).order("scheduled_start", { ascending: true });
    const { data } = await q;
    setJobs(data || []);
  };

  React.useEffect(() => { load(); }, [filter]);

  const filtered = jobs.filter(j => {
    if (filter === "completed") return j.status === "paid" || j.status === "completed";
    if (filter === "today") {
      const d = new Date();
      const s = j.scheduled_start ? new Date(j.scheduled_start) : null;
      return s && s.toDateString() === d.toDateString() && j.status !== "paid";
    }
    return j.status !== "paid";
  });

  return (
    <SafeAreaView style={{ flex: 1, padding: 12 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Button title="Today" onPress={() => setFilter("today")} />
        <Button title="Upcoming" onPress={() => setFilter("upcoming")} />
        <Button title="Completed" onPress={() => setFilter("completed")} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate("JobDetail", { job: item })} style={{ padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 10 }}>
            <Text style={{ fontWeight: "700" }}>{item.status.toUpperCase()}</Text>
            <Text>{item.id}</Text>
            <Text style={{ opacity: 0.7 }}>{item.scheduled_start ? new Date(item.scheduled_start).toLocaleString() : "No schedule"}</Text>
            <Text style={{ opacity: 0.7 }}>Balance due: {item.balance_due ?? item.price_final ?? "—"}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function ClockScreen() {
  const [clockedIn, setClockedIn] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const refresh = async () => {
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) return;
    const { data } = await supabase.from("time_clock").select("*").eq("user_id", me.user.id).is("clock_out_at", null).order("clock_in_at", { ascending: false }).limit(1);
    if (data && data.length) { setClockedIn(true); setActiveId(data[0].id); } else { setClockedIn(false); setActiveId(null); }
  };

  React.useEffect(() => { refresh(); }, []);

  const clockIn = async () => {
    const { data: me } = await supabase.auth.getUser();
    const { data: mem } = await supabase.from("v_my_membership").select("*").maybeSingle();
    if (!me.user || !mem?.org_id) return;
    const { error, data } = await supabase.from("time_clock").insert({
      org_id: mem.org_id,
      user_id: me.user.id,
      role: "labor",
      clock_in_at: new Date().toISOString(),
    }).select("*").single();
    if (!error) {
      posthog.capture(PosthogEvents.labor_clock_in);
      setClockedIn(true);
      setActiveId(data.id);
    }
  };

  const clockOut = async () => {
    if (!activeId) return;
    await supabase.from("time_clock").update({ clock_out_at: new Date().toISOString() }).eq("id", activeId);
    posthog.capture(PosthogEvents.labor_clock_out);
    setClockedIn(false);
    setActiveId(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Clock</Text>
      <Text>Status: {clockedIn ? "Clocked in" : "Clocked out"}</Text>
      {clockedIn ? <Button title="Clock out" onPress={clockOut} /> : <Button title="Clock in" onPress={clockIn} />}
      <Button title="Refresh" onPress={refresh} />
    </SafeAreaView>
  );
}

function ProfileScreen() {
  const [blocks, setBlocks] = React.useState<any[]>([]);
  const [day, setDay] = React.useState("1");
  const [start, setStart] = React.useState("08:00");
  const [end, setEnd] = React.useState("17:00");

  const load = async () => {
    const { data: me } = await supabase.auth.getUser();
    const { data: mem } = await supabase.from("v_my_membership").select("*").maybeSingle();
    if (!me.user || !mem) return;
    const { data } = await supabase.from("availability").select("*").eq("org_id", mem.org_id).eq("labor_user_id", me.user.id);
    setBlocks(data || []);
  };

  React.useEffect(()=>{ load(); }, []);

  const add = async () => {
    const { data: me } = await supabase.auth.getUser();
    const { data: mem } = await supabase.from("v_my_membership").select("*").maybeSingle();
    if (!me.user || !mem) return;
    await supabase.from("availability").insert({
      org_id: mem.org_id,
      labor_user_id: me.user.id,
      day_of_week: Number(day),
      start_time: start,
      end_time: end,
      timezone: "America/Indiana/Indianapolis",
    });
    posthog.capture(PosthogEvents.availability_updated, { day_of_week: Number(day) });
    load();
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Profile</Text>
      <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
      <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 12 }}>Availability</Text>
      <View style={{ gap: 8 }}>
        <TextInput value={day} onChangeText={setDay} placeholder="Day 0-6" style={{ borderWidth: 1, padding: 10, borderRadius: 10 }} />
        <TextInput value={start} onChangeText={setStart} placeholder="Start HH:MM" style={{ borderWidth: 1, padding: 10, borderRadius: 10 }} />
        <TextInput value={end} onChangeText={setEnd} placeholder="End HH:MM" style={{ borderWidth: 1, padding: 10, borderRadius: 10 }} />
        <Button title="Add block" onPress={add} />
      </View>
      <FlatList data={blocks} keyExtractor={b=>b.id} renderItem={({item})=>(
        <View style={{ padding: 10, borderWidth: 1, borderRadius: 10, marginTop: 8 }}>
          <Text>Day {item.day_of_week}: {item.start_time}–{item.end_time}</Text>
        </View>
      )}/>
    </SafeAreaView>
  );
}

function MapScreen() {
  return (
    <SafeAreaView style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
      <Text style={{ fontSize: 18, fontWeight:"700" }}>Map (placeholder)</Text>
      <Text style={{ opacity:0.7, marginTop:8 }}>Mapbox RN integration planned.</Text>
    </SafeAreaView>
  );
}

function JobDetailScreen({ route, navigation }: any) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [job, setJob] = React.useState<Job>(route.params.job);
  const [photos, setPhotos] = React.useState<{uri:string; type:"before"|"after"}[]>([]);

  const refresh = async () => {
    const { data } = await supabase.from("jobs").select("*").eq("id", job.id).maybeSingle();
    if (data) setJob(data);
  };

  const updateStatus = async (status: string) => {
    await supabase.from("jobs").update({ status }).eq("id", job.id);
    posthog.capture(PosthogEvents.job_status_changed, { status });
    refresh();
  };

  const pickPhoto = async (media_type: "before"|"after") => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled) return;
    const uri = res.assets[0].uri;
    setPhotos(prev => [...prev, { uri, type: media_type }]);
    posthog.capture(media_type === "before" ? PosthogEvents.before_photo_added : PosthogEvents.after_photo_added);
    // upload to storage (job-media bucket)
    const fileName = `${job.id}/${media_type}_${Date.now()}.jpg`;
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const { data: mem } = await supabase.from("v_my_membership").select("*").maybeSingle();
    await supabase.storage.from("job-media").upload(`${mem?.org_id}/${fileName}`, blob, { contentType: "image/jpeg", upsert: true });
    await supabase.from("job_media").insert({
      org_id: mem?.org_id,
      job_id: job.id,
      media_type,
      storage_path: `${mem?.org_id}/${fileName}`,
    });
  };

  const collectPayment = async () => {
    const amount = job.balance_due ?? job.price_final;
    if (!amount) return alert("No amount set");
    posthog.capture(PosthogEvents.payment_intent_created, { amount });

    const out = await authedPost("/v1/payments/create_intent", { job_id: job.id, amount });
    if (!out?.client_secret) return alert("Payment intent failed");

    const init = await initPaymentSheet({ paymentIntentClientSecret: out.client_secret, merchantDisplayName: "Block" });
    if (init.error) return alert(init.error.message);

    const pres = await presentPaymentSheet();
    if (pres.error) return alert(pres.error.message);

    posthog.capture(PosthogEvents.payment_completed, { job_id: job.id });
    await refresh();
    alert("Payment submitted. Status will update when Stripe confirms.");
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 12, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Job</Text>
      <Text style={{ opacity:0.7 }}>{job.id}</Text>
      <Text>Status: {job.status}</Text>

      <View style={{ flexDirection:"row", gap:8 }}>
        <Button title="En route" onPress={()=>updateStatus("en_route")} />
        <Button title="Start" onPress={()=>updateStatus("started")} />
        <Button title="Complete" onPress={()=>updateStatus("completed")} />
      </View>

      <View style={{ flexDirection:"row", gap:8 }}>
        <Button title="Add before photo" onPress={()=>pickPhoto("before")} />
        <Button title="Add after photo" onPress={()=>pickPhoto("after")} />
      </View>

      <Button title="Collect payment" onPress={collectPayment} />

      <Button title="Refresh" onPress={refresh} />
      <Button title="Back" onPress={()=>navigation.goBack()} />

      <FlatList
        data={photos}
        keyExtractor={(p)=>p.uri}
        horizontal
        renderItem={({item})=>(
          <View style={{ marginRight: 10 }}>
            <Image source={{ uri: item.uri }} style={{ width: 96, height: 96, borderRadius: 12 }} />
            <Text style={{ fontSize: 12, opacity:0.7 }}>{item.type}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const Tab = createBottomTabNavigator();

export default function App() {
  const session = useSession();
  if (!session) return <LoginScreen />;

  return (
    <StripeProvider publishableKey={env.STRIPE_PUBLISHABLE_KEY}>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerShown: false }}>
          <Tab.Screen name="Jobs" component={JobsScreen} />
          <Tab.Screen name="Map" component={MapScreen} />
          <Tab.Screen name="Clock" component={ClockScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
          <Tab.Screen name="JobDetail" component={JobDetailScreen} options={{ tabBarButton: () => null }} />
        </Tab.Navigator>
      </NavigationContainer>
    </StripeProvider>
  );
}
