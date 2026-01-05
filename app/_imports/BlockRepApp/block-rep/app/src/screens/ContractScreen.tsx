import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import Signature from 'react-native-signature-canvas';
import {useAuthStore} from '../store';
import {supabase} from '../services/supabase';
import {offlineSyncService} from '../services/offlineSync';

interface ContractScreenProps {
  route: any;
  navigation: any;
}

const ContractScreen: React.FC<ContractScreenProps> = ({route, navigation}) => {
  const {propertyId, price, serviceType, customerName, address} = route.params;
  const {user} = useAuthStore();
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const signatureRef = useRef<Signature>(null);

  const contractTemplate = `
CONTRACT FOR SERVICES

This Contract for Services ("Agreement") is entered into on ${new Date().toLocaleDateString()} by and between:

CUSTOMER: ${customerName}
ADDRESS: ${address}

and

COMPANY: Block Rep Services
REPRESENTATIVE: ${user?.email || 'Sales Representative'}

1. SCOPE OF WORK
Company agrees to provide the following services to Customer:
${serviceType}

2. COMPENSATION
Total Price: $${price}
Payment Terms: Payment will be collected separately by company laborers

3. TERMS AND CONDITIONS
- Customer agrees to the services described above
- Customer understands that payment will be collected at a later date by company representatives
- Either party may cancel this agreement with written notice

4. SIGNATURES
By signing below, both parties agree to the terms of this contract.

Customer Signature: _________________________ Date: ____________

Company Representative: _____________________ Date: ____________
  `;

  const handleSignature = (sig: string) => {
    setSignature(sig);
    setIsSigning(false);
  };

  const handleClear = () => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
    setSignature(null);
  };

  const generateAndUploadContract = async () => {
    if (!signature) {
      Alert.alert('Error', 'Please provide a signature before submitting');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      // In a real app, you would:
      // 1. Generate a PDF with the contract text and signature
      // 2. Upload it to Supabase Storage
      // 3. Update the sale record with the contract URL
      
      // For this example, we'll simulate the process
      const contractData = {
        property_id: propertyId,
        rep_id: user.id,
        contract_text: contractTemplate,
        signature_data: signature,
        signed_at: new Date().toISOString(),
      };

      // Queue for offline sync
      await offlineSyncService.queueItem('contract', contractData);

      Alert.alert(
        'Contract Signed',
        'The contract has been signed and will be uploaded.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error with contract:', error);
      Alert.alert('Error', 'Failed to process contract');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Service Contract</Text>
        <Text style={styles.subtitle}>
          {customerName} - ${price}
        </Text>
      </View>

      <View style={styles.contractTextContainer}>
        <Text style={styles.contractText}>{contractTemplate}</Text>
      </View>

      <View style={styles.signatureContainer}>
        <Text style={styles.signatureTitle}>Customer Signature</Text>
        
        {isSigning ? (
          <View style={styles.signaturePad}>
            <Signature
              ref={signatureRef}
              onOK={handleSignature}
              onEmpty={() => setSignature(null)}
              descriptionText="Sign here"
              clearText="Clear"
              confirmText="Save"
              webStyle={`
                .m-signature-pad--footer
                  .button {
                    background-color: #007AFF;
                    color: #FFFFFF;
                  }
              `}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.signButton}
            onPress={() => setIsSigning(true)}>
            <Text style={styles.signButtonText}>
              {signature ? 'Sign Again' : 'Tap to Sign'}
            </Text>
          </TouchableOpacity>
        )}

        {signature && (
          <View style={styles.signatureActions}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClear}>
              <Text style={styles.clearButtonText}>Clear Signature</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={generateAndUploadContract}>
          <Text style={styles.submitButtonText}>Submit Contract</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  contractTextContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  contractText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000000',
    fontFamily: 'Courier',
  },
  signatureContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  signatureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  signaturePad: {
    height: 200,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
  },
  signButton: {
    height: 200,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  signButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  signatureActions: {
    marginTop: 16,
  },
  clearButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#8E8E93',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ContractScreen;