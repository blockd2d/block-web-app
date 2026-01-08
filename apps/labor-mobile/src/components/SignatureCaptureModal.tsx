import React, { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

// react-native-signature-canvas wraps a WebView-based signature pad.
// It works in Expo (managed) as long as react-native-webview is installed.
//
// NOTE: This is intentionally lightweight: capture -> returns PNG dataURL.
import SignatureCanvas from 'react-native-signature-canvas';

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onSave: (dataUrlPng: string) => Promise<void> | void;
};

export function SignatureCaptureModal(props: Props) {
  const { visible, onClose, onSave } = props;
  const ref = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webStyle = useMemo(
    () => `
      .m-signature-pad { box-shadow: none; border: 0; }
      .m-signature-pad--body { border: 1px solid #e5e5e5; border-radius: 12px; }
      .m-signature-pad--footer { display: none; }
      body,html { width: 100%; height: 100%; }
    `,
    []
  );

  const onOK = async (dataUrl: string) => {
    setError(null);
    if (!dataUrl || !String(dataUrl).startsWith('data:image')) {
      setError('Signature capture failed. Please try again.');
      return;
    }
    try {
      setSaving(true);
      await onSave(dataUrl);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save signature');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, padding: 16, paddingTop: Platform.OS === 'ios' ? 20 : 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>{props.title || 'Capture signature'}</Text>
          <Pressable onPress={onClose} disabled={saving}>
            <Text style={{ fontWeight: '800', color: '#0b5fff', opacity: saving ? 0.5 : 1 }}>Close</Text>
          </Pressable>
        </View>

        <Text style={{ marginTop: 8, opacity: 0.7 }}>Have the customer sign below, then tap Save.</Text>

        <View style={{ marginTop: 12, flex: 1 }}>
          <SignatureCanvas
            ref={ref}
            onOK={onOK}
            autoClear
            descriptionText=""
            clearText="Clear"
            confirmText="Save"
            webStyle={webStyle}
          />
        </View>

        {error ? <Text style={{ marginTop: 10, color: '#b00020' }}>{error}</Text> : null}

        <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => ref.current?.clearSignature?.()}
            disabled={saving}
            style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 14, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
          >
            <Text style={{ fontWeight: '800' }}>Clear</Text>
          </Pressable>
          <Pressable
            onPress={() => ref.current?.readSignature?.()}
            disabled={saving}
            style={{ flex: 1, backgroundColor: '#111', padding: 12, borderRadius: 14, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>{saving ? 'Saving…' : 'Save signature'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
