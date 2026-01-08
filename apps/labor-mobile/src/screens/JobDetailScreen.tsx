import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, Image } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { api } from '../api';
import { offlineQueue } from '../services/offlineQueue';
import { SignatureCaptureModal } from '../components/SignatureCaptureModal';

export function JobDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const jobId = route.params?.jobId as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [upchargeNotes, setUpchargeNotes] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [sigOpen, setSigOpen] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await api.getJob(jobId);
      setData(d);
      const defaultAmount = d?.sale?.value;
      if (defaultAmount != null && amountDollars === '') {
        setAmountDollars(String(defaultAmount));
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => void 0);
  }, [jobId]);

  const job = data?.job;
  const sale = data?.sale;
  const property = data?.property;
  const rep = data?.rep;
  const contract = data?.contract;
  const attachments = (data?.attachments || []) as any[];
  const jobPhotos = (data?.job_photos || []) as any[];
  const payments = (data?.payments || []) as any[];

  const beforePhotos = useMemo(() => attachments.filter((a) => String(a.type || '').includes('before')), [attachments]);
  const afterPhotos = useMemo(() => jobPhotos.filter((p) => p.kind === 'after'), [jobPhotos]);
  const signature = useMemo(() => jobPhotos.find((p) => p.kind === 'signature'), [jobPhotos]);

  const canCaptureSignature = job?.status === 'complete';

  const addressLine = property
    ? `${property.address1 || ''}${property.city ? `, ${property.city}` : ''}${property.state ? `, ${property.state}` : ''} ${property.zip || ''}`.trim()
    : '—';

  const safeOpenUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link');
    }
  };

  const startJob = async () => {
    try {
      await api.startJob(jobId);
      await load();
    } catch (e: any) {
      await offlineQueue.enqueue({ id: `q_${Date.now()}`, type: 'job_start', created_at: Date.now(), payload: { job_id: jobId } });
      Alert.alert('Saved offline', 'Will sync when back online.');
    }
  };

  const completeJob = async () => {
    try {
      await api.completeJob(jobId, { completion_notes: completionNotes, upcharge_notes: upchargeNotes });
      setCompletionNotes('');
      setUpchargeNotes('');
      await load();
    } catch (e: any) {
      await offlineQueue.enqueue({
        id: `q_${Date.now()}`,
        type: 'job_complete',
        created_at: Date.now(),
        payload: { job_id: jobId, completion_notes: completionNotes, upcharge_notes: upchargeNotes }
      });
      Alert.alert('Saved offline', 'Completion will sync when back online.');
    }
  };

  const pickAndUpload = async (kind: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission required');
      return;
    }

    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (res.canceled) return;

    const asset = res.assets?.[0];
    if (!asset?.base64) {
      Alert.alert('Upload failed', 'No base64 image data returned.');
      return;
    }

    const mime = asset.mimeType || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : 'jpg';
    const data_url = `data:${mime};base64,${asset.base64}`;

    try {
      await api.uploadJobPhoto(jobId, { kind, filename: `${kind}.${ext}`, data_url });
      await load();
    } catch {
      await offlineQueue.enqueue({
        id: `q_${Date.now()}`,
        type: 'job_photo',
        created_at: Date.now(),
        payload: { job_id: jobId, kind, filename: `${kind}.${ext}`, data_url }
      });
      Alert.alert('Saved offline', 'Photo will upload when you’re back online.');
    }
  };

  const createPaymentLink = async () => {
    const dollars = Number(amountDollars);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      Alert.alert('Enter a valid amount');
      return;
    }

    try {
      await api.createPaymentLink(jobId, Math.round(dollars * 100), 'usd');
      await load();
      Alert.alert('Payment link created');
    } catch (e: any) {
      Alert.alert('Payment link failed', e?.message || 'Error');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ opacity: 0.7 }}>Loading…</Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontWeight: '700' }}>Could not load job</Text>
        <Text style={{ marginTop: 8, color: '#b00020' }}>{err}</Text>
        <Pressable onPress={load} style={{ marginTop: 12, borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 12 }}>
          <Text style={{ fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const latestPayment = payments?.[0];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '800' }}>Job #{jobId.slice(0, 6)}</Text>
      <Text style={{ marginTop: 6, opacity: 0.7 }}>Status: {job?.status || '—'}</Text>

      <View style={{ marginTop: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 16, padding: 12 }}>
        <Text style={{ fontWeight: '800' }}>Address</Text>
        <Text style={{ marginTop: 6, opacity: 0.85 }}>{addressLine}</Text>
        {rep?.name ? <Text style={{ marginTop: 10, opacity: 0.7 }}>Sold by: {rep.name}</Text> : null}
        {sale?.notes ? <Text style={{ marginTop: 10, opacity: 0.8 }}>Notes: {sale.notes}</Text> : null}
      </View>

      <View style={{ marginTop: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 16, padding: 12 }}>
        <Text style={{ fontWeight: '800' }}>Contract</Text>
        {contract?.signed_url ? (
          <Pressable onPress={() => safeOpenUrl(contract.signed_url)} style={{ marginTop: 10 }}>
            <Text style={{ color: '#0b5fff', fontWeight: '700' }}>Open PDF</Text>
          </Pressable>
        ) : (
          <Text style={{ marginTop: 10, opacity: 0.7 }}>No contract file yet.</Text>
        )}
      </View>

      <View style={{ marginTop: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 16, padding: 12 }}>
        <Text style={{ fontWeight: '800' }}>Before photos</Text>
        <ScrollView horizontal style={{ marginTop: 10 }} contentContainerStyle={{ gap: 10 }}>
          {(beforePhotos || []).map((p) => (
            <View key={p.id} style={{ width: 140, height: 100, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f4f4f4' }}>
              {p.signed_url ? <Image source={{ uri: p.signed_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ padding: 10, opacity: 0.7 }}>No preview</Text>}
            </View>
          ))}
          {beforePhotos.length === 0 ? <Text style={{ opacity: 0.7 }}>No before photos</Text> : null}
        </ScrollView>
      </View>

      <View style={{ marginTop: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 16, padding: 12 }}>
        <Text style={{ fontWeight: '800' }}>Work</Text>
        {job?.status === 'scheduled' ? (
          <Pressable onPress={startJob} style={{ marginTop: 10, backgroundColor: '#111', padding: 12, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Start job</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => pickAndUpload('after')}
          style={{ marginTop: 10, borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 14, alignItems: 'center' }}
        >
          <Text style={{ fontWeight: '800' }}>Capture after photo</Text>
        </Pressable>

        <ScrollView horizontal style={{ marginTop: 10 }} contentContainerStyle={{ gap: 10 }}>
          {(afterPhotos || []).map((p) => (
            <View key={p.id} style={{ width: 140, height: 100, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f4f4f4' }}>
              {p.signed_url ? <Image source={{ uri: p.signed_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ padding: 10, opacity: 0.7 }}>No preview</Text>}
            </View>
          ))}
          {afterPhotos.length === 0 ? <Text style={{ opacity: 0.7 }}>No after photos yet</Text> : null}
        </ScrollView>

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Completion notes</Text>
          <TextInput
            value={completionNotes}
            onChangeText={setCompletionNotes}
            placeholder="What did you do? Anything to know?"
            multiline
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 10, minHeight: 70 }}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Upcharge notes</Text>
          <TextInput
            value={upchargeNotes}
            onChangeText={setUpchargeNotes}
            placeholder="Extra services / materials / time"
            multiline
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 10, minHeight: 60 }}
          />
        </View>

        <Pressable
          onPress={completeJob}
          style={{ marginTop: 12, backgroundColor: job?.status === 'complete' ? '#999' : '#111', padding: 12, borderRadius: 14, alignItems: 'center' }}
          disabled={job?.status === 'complete'}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>{job?.status === 'complete' ? 'Completed' : 'Complete job'}</Text>
        </Pressable>

        {canCaptureSignature ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontWeight: '800' }}>Customer signature</Text>
            {signature?.signed_url ? (
              <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 140, height: 90, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f4f4f4' }}>
                  <Image source={{ uri: signature.signed_url }} style={{ width: '100%', height: '100%' }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ opacity: 0.75 }}>Signature captured.</Text>
                  <Pressable onPress={() => setSigOpen(true)} style={{ marginTop: 8 }}>
                    <Text style={{ color: '#0b5fff', fontWeight: '800' }}>Re-capture</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 10 }}>
                <Text style={{ opacity: 0.75 }}>Required for completion. Capture the customer signature to finish.</Text>
                <Pressable
                  onPress={() => setSigOpen(true)}
                  disabled={sigUploading}
                  style={{ marginTop: 10, backgroundColor: '#111', padding: 12, borderRadius: 14, alignItems: 'center', opacity: sigUploading ? 0.6 : 1 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{sigUploading ? 'Uploading…' : 'Capture signature'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <Text style={{ marginTop: 10, opacity: 0.6 }}>Signature capture will appear after the job is completed.</Text>
        )}
      </View>

      <SignatureCaptureModal
        visible={sigOpen}
        onClose={() => setSigOpen(false)}
        onSave={async (dataUrlPng) => {
          setSigUploading(true);
          try {
            await api.uploadJobPhoto(jobId, { kind: 'signature', filename: 'signature.png', data_url: dataUrlPng });
            await load();
          } catch {
            await offlineQueue.enqueue({
              id: `q_${Date.now()}`,
              type: 'job_photo',
              created_at: Date.now(),
              payload: { job_id: jobId, kind: 'signature', filename: 'signature.png', data_url: dataUrlPng }
            });
            Alert.alert('Saved offline', 'Signature will upload when you’re back online.');
          } finally {
            setSigUploading(false);
          }
        }}
      />

      <View style={{ marginTop: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 16, padding: 12 }}>
        <Text style={{ fontWeight: '800' }}>Payment</Text>
        {latestPayment ? (
          <View style={{ marginTop: 10 }}>
            <Text style={{ opacity: 0.8 }}>Status: {latestPayment.status}</Text>
            <Text style={{ opacity: 0.8, marginTop: 4 }}>Amount: ${(latestPayment.amount / 100).toFixed(2)}</Text>
            {latestPayment.checkout_url ? (
              <Pressable onPress={() => safeOpenUrl(latestPayment.checkout_url)} style={{ marginTop: 10 }}>
                <Text style={{ color: '#0b5fff', fontWeight: '800' }}>Open payment link</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={{ marginTop: 10, opacity: 0.7 }}>No payment link yet.</Text>
        )}

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Amount (USD)</Text>
          <TextInput value={amountDollars} onChangeText={setAmountDollars} keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 10 }} />
        </View>

        <Pressable
          onPress={createPaymentLink}
          disabled={job?.status !== 'complete'}
          style={{
            marginTop: 12,
            borderWidth: 1,
            borderColor: '#ddd',
            padding: 12,
            borderRadius: 14,
            alignItems: 'center',
            opacity: job?.status === 'complete' ? 1 : 0.5
          }}
        >
          <Text style={{ fontWeight: '800' }}>Create payment link</Text>
        </Pressable>

        <Text style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>Labor creates and collects payment after completion.</Text>
      </View>

      <Pressable
        onPress={() => {
          nav.goBack();
        }}
        style={{ marginTop: 18, paddingVertical: 10 }}
      >
        <Text style={{ color: '#0b5fff', fontWeight: '800' }}>Back to jobs</Text>
      </Pressable>
    </ScrollView>
  );
}
