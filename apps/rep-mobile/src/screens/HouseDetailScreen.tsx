import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useMapStore } from '../store';
import { InteractionOutcome } from '../types';
import { offlineSyncService } from '../services/offlineSync';
import { twilioService } from '../services/twilio';
import { blockApi } from '../services/blockApi';

const OUTCOMES: Array<{ key: InteractionOutcome; label: string }> = [
  { key: 'not_home', label: 'Not home' },
  { key: 'talked_not_interested', label: 'Talked / Not interested' },
  { key: 'lead', label: 'Interested (Lead)' },
  { key: 'quote_given', label: 'Quote given' },
  { key: 'sold', label: 'Sold' },
  { key: 'followup_scheduled', label: 'Schedule follow-up' },
  { key: 'do_not_knock', label: 'Do not knock' }
];

const HouseDetailScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { propertyId } = route.params as { propertyId: string };
  const { properties, updateProperty } = useMapStore();

  const property = useMemo(() => properties.find(p => p.id === propertyId), [properties, propertyId]);

  const [outcome, setOutcome] = useState<InteractionOutcome>('not_home');
  const [notes, setNotes] = useState('');
  const [followupAt, setFollowupAt] = useState(''); // ISO string e.g. 2026-01-07T14:00:00Z

  const [customerPhone, setCustomerPhone] = useState('');
  const [messageBody, setMessageBody] = useState('');

  const [serviceType, setServiceType] = useState('Pressure washing');
  const [price, setPrice] = useState('');

  if (!property) {
    return (
      <View style={styles.center}>
        <Text>Property not found.</Text>
      </View>
    );
  }

  const address = [property.address1, property.city, property.state, property.zip].filter(Boolean).join(', ');

  const saveInteraction = async () => {
    const nowIso = new Date().toISOString();

    // optimistic local update
    updateProperty(property.id, {
      last_outcome: outcome,
      last_visited: nowIso,
      visit_count: (property.visit_count || 0) + 1
    });

    const interactionPayload = {
      property_id: property.id,
      outcome,
      notes: notes || null,
      followup_at: outcome === 'followup_scheduled' ? followupAt || null : followupAt || null
    };

    const followupPayload = outcome === 'followup_scheduled' && followupAt
      ? {
          property_id: property.id,
          due_at: followupAt,
          notes: notes || null
        }
      : null;

    const salePayload = (outcome === 'quote_given' || outcome === 'sold') && (price || customerPhone)
      ? {
          property_id: property.id,
          status: outcome === 'sold' ? 'sold' : 'quote',
          price: price ? Number(price) : null,
          service_type: serviceType || null,
          notes: notes || null,
          customer_phone: customerPhone || null,
          customer_email: null
        }
      : null;

    // Online-fast-path (required for immediate contract signing)
    try {
      await blockApi.post('/v1/interactions', interactionPayload);
      if (followupPayload) await blockApi.post('/v1/followups', followupPayload);
      let saleId: string | null = null;
      if (salePayload) {
        const res = await blockApi.post('/v1/sales', salePayload);
        saleId = res?.sale?.id || null;
      }

      if (outcome === 'sold' && saleId) {
        Alert.alert('Saved', 'Sale saved. Capture signature to generate the contract PDF.', [
          { text: 'Later', style: 'cancel', onPress: () => navigation.goBack() },
          { text: 'Sign Contract', onPress: () => navigation.navigate('Contract', { saleId }) }
        ]);
        return;
      }

      Alert.alert('Saved', 'Outcome saved.');
      navigation.goBack();
      return;
    } catch (eOnline) {
      // fall back to offline queue
    }

    try {
      await offlineSyncService.queueItem('interaction', interactionPayload);
      if (followupPayload) await offlineSyncService.queueItem('follow_up', followupPayload);
      if (salePayload) await offlineSyncService.queueItem('sale', salePayload);

      Alert.alert('Saved', 'Outcome queued and will sync automatically.');
      navigation.goBack();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message || 'Failed to save outcome');
    }
  };

  const sendMessage = async () => {
    if (!customerPhone.trim()) return Alert.alert('Missing phone', 'Enter a customer phone number first.');
    if (!messageBody.trim()) return Alert.alert('Empty message', 'Type a message.');

    try {
      await twilioService.sendMessage(property.id, customerPhone.trim(), messageBody.trim());
      setMessageBody('');
      Alert.alert('Sent', 'Message sent from company number.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Send failed', e?.message || 'Could not send message');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>House</Text>
      <Text style={styles.address}>{address || 'Unknown address'}</Text>
      {property.value_estimate ? <Text style={styles.meta}>Est. value: ${Math.round(property.value_estimate).toLocaleString()}</Text> : null}

      <Text style={styles.sectionTitle}>Outcome</Text>
      <View style={styles.outcomesWrap}>
        {OUTCOMES.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[styles.outcomeBtn, outcome === o.key && styles.outcomeBtnActive]}
            onPress={() => setOutcome(o.key)}
          >
            <Text style={[styles.outcomeText, outcome === o.key && styles.outcomeTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {outcome === 'followup_scheduled' ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>Follow-up at (ISO)</Text>
          <TextInput
            value={followupAt}
            onChangeText={setFollowupAt}
            placeholder="2026-01-07T14:00:00Z"
            autoCapitalize="none"
            style={styles.input}
          />
        </View>
      ) : null}

      {(outcome === 'quote_given' || outcome === 'sold') ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Quote / Sale</Text>
          <Text style={styles.label}>Service type</Text>
          <TextInput value={serviceType} onChangeText={setServiceType} style={styles.input} />

          <Text style={styles.label}>Price</Text>
          <TextInput value={price} onChangeText={setPrice} placeholder="280" keyboardType="numeric" style={styles.input} />

          <Text style={styles.label}>Customer phone</Text>
          <TextInput value={customerPhone} onChangeText={setCustomerPhone} placeholder="+13175551234" autoCapitalize="none" style={styles.input} />
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Message customer</Text>
          <Text style={styles.label}>Customer phone</Text>
          <TextInput value={customerPhone} onChangeText={setCustomerPhone} placeholder="+13175551234" autoCapitalize="none" style={styles.input} />

          <Text style={styles.label}>Message</Text>
          <TextInput value={messageBody} onChangeText={setMessageBody} placeholder="Hi — just following up..." style={[styles.input, { height: 80 }]} multiline />

          <TouchableOpacity style={styles.secondaryBtn} onPress={sendMessage}>
            <Text style={styles.secondaryBtnText}>Send text</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Quick notes..."
        style={[styles.input, { height: 110 }]}
        multiline
      />

      <TouchableOpacity style={styles.primaryBtn} onPress={saveInteraction}>
        <Text style={styles.primaryBtnText}>Save</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: 12 }} onPress={() => navigation.goBack()}>
        <Text style={{ textAlign: 'center', color: '#666' }}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  address: { marginTop: 6, fontSize: 16, color: '#111' },
  meta: { marginTop: 4, color: '#444' },
  sectionTitle: { marginTop: 18, fontSize: 16, fontWeight: '700' },
  outcomesWrap: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outcomeBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', marginRight: 8, marginBottom: 8 },
  outcomeBtnActive: { borderColor: '#111', backgroundColor: '#111' },
  outcomeText: { color: '#111', fontSize: 13 },
  outcomeTextActive: { color: '#fff' },
  label: { marginTop: 10, fontSize: 12, color: '#666' },
  input: { marginTop: 6, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, fontSize: 14, backgroundColor: '#fafafa' },
  primaryBtn: { marginTop: 18, backgroundColor: '#111', borderRadius: 14, paddingVertical: 14 },
  primaryBtnText: { textAlign: 'center', color: '#fff', fontWeight: '700' },
  secondaryBtn: { marginTop: 10, borderWidth: 1, borderColor: '#111', borderRadius: 14, paddingVertical: 12 },
  secondaryBtnText: { textAlign: 'center', color: '#111', fontWeight: '700' }
});

export default HouseDetailScreen;
