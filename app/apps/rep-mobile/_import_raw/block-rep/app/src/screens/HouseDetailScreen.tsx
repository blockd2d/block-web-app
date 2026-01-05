import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useRouteStore, useMapStore, useAuthStore} from '../store';
import {supabase} from '../services/supabase';
import {offlineSyncService} from '../services/offlineSync';
import {twilioService} from '../services/twilio';
import {Interaction, Sale, FollowUp} from '../types';

interface HouseDetailScreenProps {
  route: any;
  navigation: any;
}

const HouseDetailScreen: React.FC<HouseDetailScreenProps> = ({route, navigation}) => {
  const {propertyId} = route.params;
  const {properties, updateProperty} = useMapStore();
  const {activeRoute, markStopVisited} = useRouteStore();
  const {user} = useAuthStore();
  
  const [property, setProperty] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [price, setPrice] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    loadPropertyData();
    loadMessages();
  }, [propertyId]);

  const loadPropertyData = async () => {
    const prop = properties.find(p => p.id === propertyId);
    if (prop) {
      setProperty(prop);
      // Load previous interaction data if exists
      loadPreviousInteraction(prop.id);
    }
  };

  const loadPreviousInteraction = async (propId: string) => {
    try {
      const {data} = await supabase
        .from('interactions')
        .select('*')
        .eq('property_id', propId)
        .order('created_at', {ascending: false})
        .limit(1);

      if (data && data.length > 0) {
        const interaction = data[0];
        setNotes(interaction.notes || '');
        setCustomerPhone(interaction.customer_phone || '');
        setCustomerEmail(interaction.customer_email || '');
        setPhotos(interaction.photos || []);
      }
    } catch (error) {
      console.error('Error loading previous interaction:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const msgs = await twilioService.getMessages(propertyId);
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleTakePhoto = () => {
    launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: false,
    }, (response) => {
      if (response.assets && response.assets.length > 0) {
        const uri = response.assets[0].uri;
        if (uri) {
          setPhotos([...photos, uri]);
        }
      }
    });
  };

  const handleOutcome = async (outcome: string) => {
    if (!user || !property) return;

    setIsLoading(true);
    try {
      const interaction: Omit<Interaction, 'id' | 'created_at' | 'updated_at'> = {
        property_id: propertyId,
        rep_id: user.id,
        outcome: outcome as any,
        notes,
        photos,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        duration_minutes: 5, // This would be calculated from actual visit time
      };

      // Add price and service type for sold/quote outcomes
      if (outcome === 'sold' || outcome === 'quote_given') {
        interaction.price = parseFloat(price);
        interaction.service_type = serviceType;
      }

      // Queue for offline sync
      await offlineSyncService.queueItem('interaction', interaction);

      // Update property
      updateProperty(propertyId, {
        last_outcome: outcome as any,
        last_visited: new Date().toISOString(),
        visit_count: (property.visit_count || 0) + 1,
      });

      // Mark route stop as visited
      if (activeRoute) {
        markStopVisited(propertyId, outcome);
      }

      // Handle special outcomes
      if (outcome === 'sold') {
        await handleSale();
      } else if (outcome === 'follow_up') {
        await handleFollowUp();
      }

      Alert.alert('Success', 'Interaction logged successfully');
      navigation.goBack();

    } catch (error) {
      console.error('Error logging interaction:', error);
      Alert.alert('Error', 'Failed to log interaction');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSale = async () => {
    if (!user || !price || !serviceType) return;

    const sale: Omit<Sale, 'id' | 'created_at' | 'updated_at'> = {
      property_id: propertyId,
      rep_id: user.id,
      price: parseFloat(price),
      service_type: serviceType,
      notes,
      photos,
      customer_phone,
      customer_email,
      payment_status: 'pending',
      status: 'pending',
    };

    await offlineSyncService.queueItem('sale', sale);
  };

  const handleFollowUp = async () => {
    if (!user || !followUpDate) return;

    const followUp: Omit<FollowUp, 'id' | 'created_at' | 'updated_at'> = {
      property_id: propertyId,
      rep_id: user.id,
      scheduled_for: new Date(followUpDate).toISOString(),
      notes,
      reminder_sent: false,
    };

    await offlineSyncService.queueItem('follow_up', followUp);
  };

  const sendMessage = async () => {
    if (!messageText || !customerPhone) {
      Alert.alert('Error', 'Please enter a message and customer phone number');
      return;
    }

    try {
      await twilioService.sendMessage(propertyId, customerPhone, messageText);
      setMessageText('');
      loadMessages(); // Refresh messages
      Alert.alert('Success', 'Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  if (!property) {
    return (
      <View style={styles.emptyContainer}>
        <Text>Property not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scrollView}>
        {/* Property Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{property.address}</Text>
          <Text style={styles.sectionSubtitle}>
            {property.property_type || 'Residential'}
          </Text>
        </View>

        {/* Outcome Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Outcome</Text>
          <View style={styles.outcomeButtons}>
            {[
              {label: 'Not Home', value: 'not_home'},
              {label: 'Not Interested', value: 'not_interested'},
              {label: 'Interested', value: 'interested'},
              {label: 'Quote Given', value: 'quote_given'},
              {label: 'Sold', value: 'sold'},
              {label: 'Follow-up', value: 'follow_up'},
              {label: 'Do Not Knock', value: 'do_not_knock'},
            ].map(outcome => (
              <TouchableOpacity
                key={outcome.value}
                style={styles.outcomeButton}
                onPress={() => handleOutcome(outcome.value)}
                disabled={isLoading}>
                <Text style={styles.outcomeButtonText}>{outcome.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Info</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            value={customerEmail}
            onChangeText={setCustomerEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Sale Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sale Details</Text>
          <TextInput
            style={styles.input}
            placeholder="Price"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Service Type"
            value={serviceType}
            onChangeText={setServiceType}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Add notes about this visit..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
            <Text style={styles.photoButtonText}>Add Photo</Text>
          </TouchableOpacity>
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <Image key={index} source={{uri: photo}} style={styles.photo} />
            ))}
          </View>
        </View>

        {/* Messages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Messages</Text>
          <View style={styles.messagesContainer}>
            {messages.map(msg => (
              <View key={msg.id} style={[
                styles.message,
                msg.direction === 'outbound' ? styles.outboundMessage : styles.inboundMessage
              ]}>
                <Text style={styles.messageText}>{msg.body}</Text>
                <Text style={styles.messageTime}>
                  {new Date(msg.created_at).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Send a message..."
              value={messageText}
              onChangeText={setMessageText}
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  outcomeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  outcomeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    margin: 4,
  },
  outcomeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    height: 48,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  photoButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  photoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  messagesContainer: {
    marginBottom: 12,
  },
  message: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  outboundMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  inboundMessage: {
    backgroundColor: '#F2F2F7',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    color: '#000000',
  },
  messageTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  messageInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  messageInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HouseDetailScreen;