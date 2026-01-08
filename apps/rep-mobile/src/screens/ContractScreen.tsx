import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';
import { blockApi } from '../services/blockApi';

type Props = { navigation: any; route: any };

/**
 * Contract signing (Rep).
 *
 * Flow:
 * 1) Rep captures signature (image data_url).
 * 2) App calls Railway API: POST /v1/sales/:id/signature
 * 3) App requests PDF generation: POST /v1/contracts/generate
 * 4) App polls /v1/contracts/by-sale/:saleId to retrieve signed URL.
 */
const ContractScreen: React.FC<Props> = ({ route }) => {
  const saleId = String(route?.params?.saleId || '');
  // Note: This app can still function without an explicit connectivity library.
  // We optimistically attempt the API call and fall back to an error message if offline.
  const isOnline = true;

  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [step, setStep] = useState<'sign' | 'generating' | 'done'>('sign');

  const canSubmit = useMemo(() => !!saleId && isOnline && !busy, [saleId, isOnline, busy]);

  const pollForContract = useCallback(async () => {
    const started = Date.now();
    while (Date.now() - started < 60_000) {
      try {
        const res = await blockApi.get(`/v1/contracts/by-sale/${saleId}`);
        if (res?.url) {
          setPdfUrl(res.url);
          setStep('done');
          return;
        }
      } catch {
        // not ready yet
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    setStep('done');
  }, [saleId]);

  const onSignatureOK = useCallback(
    async (dataUrl: string) => {
      if (!saleId) return Alert.alert('Missing sale', 'This contract is missing a saleId.');
      if (!isOnline) {
        return Alert.alert(
          'Offline',
          'Contract signing requires an internet connection in V7 (signature upload + PDF generation).'
        );
      }

      setBusy(true);
      setStep('generating');
      try {
        await blockApi.post(`/v1/sales/${saleId}/signature`, { data_url: dataUrl });
        await blockApi.post('/v1/contracts/generate', { sale_id: saleId });
        await pollForContract();
      } catch (e: any) {
        setStep('sign');
        Alert.alert('Contract Error', e?.message || 'Failed to generate contract.');
      } finally {
        setBusy(false);
      }
    },
    [saleId, isOnline, pollForContract]
  );

  const openPdf = useCallback(async () => {
    if (!pdfUrl) return;
    try {
      await Linking.openURL(pdfUrl);
    } catch {
      Alert.alert('Unable to open', 'Could not open the contract PDF on this device.');
    }
  }, [pdfUrl]);

  if (!saleId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Contract</Text>
        <Text style={styles.sub}>Missing saleId.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Contract Signature</Text>
      <Text style={styles.sub}>
        Capture the customer&apos;s signature. We&apos;ll upload it and generate a PDF contract.
      </Text>

      {!isOnline ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Offline: connect to the internet to sign and generate a contract.</Text>
        </View>
      ) : null}

      {step === 'sign' ? (
        <View style={styles.sigWrap}>
          <SignatureScreen
            onOK={onSignatureOK}
            onEmpty={() => Alert.alert('Signature required', 'Please sign before submitting.')}
            autoClear={true}
            descriptionText="Sign above"
            clearText="Clear"
            confirmText="Save & Generate"
            webStyle={signaturePadCss}
          />
        </View>
      ) : null}

      {step === 'generating' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 10 }}>Generating contract PDF…</Text>
        </View>
      ) : null}

      {step === 'done' ? (
        <View style={styles.done}>
          <Text style={styles.doneTitle}>{pdfUrl ? 'Contract Ready' : 'Generation Queued'}</Text>
          <Text style={styles.doneSub}>
            {pdfUrl
              ? 'Open the PDF to review/share with the customer.'
              : 'The contract job is queued. Try again in a moment from this screen.'}
          </Text>
          <TouchableOpacity style={[styles.primary, !pdfUrl && styles.disabled]} onPress={openPdf} disabled={!pdfUrl}>
            <Text style={styles.primaryText}>Open PDF</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.footer}>Sale: {saleId}</Text>
      {!canSubmit && step === 'sign' ? (
        <Text style={styles.hint}>Tip: make sure you&apos;re online. Signature upload happens through the API.</Text>
      ) : null}
    </ScrollView>
  );
};

const signaturePadCss = `
  .m-signature-pad--footer {display: flex;}
  .m-signature-pad--footer .button { background-color: #2b7cff; color: #fff; }
  body,html { background-color: #ffffff; }
`;

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 6, color: '#111' },
  sub: { color: '#444', marginBottom: 12 },
  sigWrap: { height: 420, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  banner: { backgroundColor: '#fff7ed', borderColor: '#fdba74', borderWidth: 1, padding: 10, borderRadius: 12, marginBottom: 12 },
  bannerText: { color: '#7c2d12', fontWeight: '600' },
  done: { paddingVertical: 18 },
  doneTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  doneSub: { color: '#444', marginBottom: 12 },
  primary: { backgroundColor: '#2b7cff', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  footer: { marginTop: 18, color: '#666', fontSize: 12 },
  hint: { marginTop: 6, color: '#6b7280', fontSize: 12 }
});

export default ContractScreen;
