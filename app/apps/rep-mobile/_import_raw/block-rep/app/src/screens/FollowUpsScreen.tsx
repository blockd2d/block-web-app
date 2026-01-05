import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import {useFollowUpStore, useAuthStore} from '../store';
import {supabase} from '../services/supabase';
import {twilioService} from '../services/twilio';
import {FollowUp} from '../types';

const FollowUpsScreen: React.FC = () => {
  const {followUps, setFollowUps, updateFollowUp} = useFollowUpStore();
  const {user} = useAuthStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFollowUps();
  }, []);

  const loadFollowUps = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const {data, error} = await supabase
        .from('followups')
        .select(`*, property:properties(*)`)
        .eq('rep_id', user.id)
        .order('scheduled_for', {ascending: true});

      if (error) throw error;
      setFollowUps(data || []);
    } catch (error) {
      console.error('Error loading follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupFollowUps = (followUps: FollowUp[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const groups = {
      overdue: [] as FollowUp[],
      today: [] as FollowUp[],
      upcoming: [] as FollowUp[],
    };

    followUps.forEach(followUp => {
      const scheduledDate = new Date(followUp.scheduled_for);
      scheduledDate.setHours(0, 0, 0, 0);

      if (scheduledDate < today) {
        groups.overdue.push(followUp);
      } else if (scheduledDate.getTime() === today.getTime()) {
        groups.today.push(followUp);
      } else {
        groups.upcoming.push(followUp);
      }
    });

    return groups;
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleText = (phone: string, followUpId: string) => {
    Alert.prompt(
      'Send Text Message',
      'Enter your message:',
      async (message) => {
        if (message) {
          try {
            await twilioService.sendMessage(followUpId, phone, message);
            Alert.alert('Success', 'Message sent');
          } catch (error) {
            Alert.alert('Error', 'Failed to send message');
          }
        }
      },
      'plain-text'
    );
  };

  const markCompleted = async (followUpId: string) => {
    try {
      const {error} = await supabase
        .from('followups')
        .update({
          completed_at: new Date().toISOString(),
          outcome: 'completed',
        })
        .eq('id', followUpId);

      if (error) throw error;

      updateFollowUp(followUpId, {
        completed_at: new Date().toISOString(),
        outcome: 'completed',
      });

      Alert.alert('Success', 'Follow-up marked as completed');
    } catch (error) {
      console.error('Error completing follow-up:', error);
      Alert.alert('Error', 'Failed to complete follow-up');
    }
  };

  const renderFollowUpItem = ({item}: {item: FollowUp}) => {
    const isOverdue = new Date(item.scheduled_for) < new Date() && !item.completed_at;
    
    return (
      <View style={[styles.followUpItem, isOverdue && styles.overdueItem]}>
        <View style={styles.followUpHeader}>
          <Text style={styles.propertyAddress}>
            {item.property?.address || 'Unknown Address'}
          </Text>
          <Text style={[styles.status, isOverdue && styles.overdueStatus]}>
            {isOverdue ? 'OVERDUE' : 'Scheduled'}
          </Text>
        </View>
        
        <Text style={styles.scheduledDate}>
          {new Date(item.scheduled_for).toLocaleDateString()} at{' '}
          {new Date(item.scheduled_for).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        
        {item.notes && (
          <Text style={styles.notes}>{item.notes}</Text>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCall(item.property?.customer_phone || '')}>
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleText(item.property?.customer_phone || '', item.id)}>
            <Text style={styles.actionButtonText}>Text</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => markCompleted(item.id)}>
            <Text style={[styles.actionButtonText, styles.completeButtonText]}>
              Complete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({section}: {section: any}) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const {overdue, today, upcoming} = groupFollowUps(followUps);

  const sections = [
    {title: 'Overdue', data: overdue, key: 'overdue'},
    {title: 'Today', data: today, key: 'today'},
    {title: 'Upcoming', data: upcoming, key: 'upcoming'},
  ].filter(section => section.data.length > 0);

  return (
    <View style={styles.container}>
      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No follow-ups scheduled</Text>
          <Text style={styles.emptySubtext}>
            Follow-ups will appear here when you schedule them
          </Text>
        </View>
      ) : (
        <FlatList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderFollowUpItem}
          renderSectionHeader={renderSectionHeader}
          onRefresh={loadFollowUps}
          refreshing={loading}
        />
      )}
    </View>
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
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  sectionHeader: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  followUpItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  overdueItem: {
    borderLeftColor: '#FF3B30',
    borderLeftWidth: 4,
  },
  followUpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  propertyAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  overdueStatus: {
    color: '#FF3B30',
  },
  scheduledDate: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  completeButtonText: {
    color: '#FFFFFF',
  },
});

export default FollowUpsScreen;