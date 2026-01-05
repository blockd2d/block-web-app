import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import {useStatsStore, useAuthStore, useRepStore} from '../store';
import {supabase} from '../services/supabase';
import {LinearGradient} from 'react-native-linear-gradient';

const StatsScreen: React.FC = () => {
  const {todayStats, xp, streak, leaderboard, setTodayStats, setXP, setStreak, setLeaderboard} = useStatsStore();
  const {user} = useAuthStore();
  const {rep} = useRepStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
    loadLeaderboard();
  }, []);

  const loadStats = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's stats
      const {data: statsData, error: statsError} = await supabase
        .from('daily_stats')
        .select('*')
        .eq('rep_id', user.id)
        .eq('date', today)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        throw statsError;
      }

      if (statsData) {
        setTodayStats(statsData);
        setXP(statsData.total_xp || 0);
        setStreak(statsData.streak_days || 0);
      }

      // Get XP and streak from reps table
      const {data: repData, error: repError} = await supabase
        .from('reps')
        .select('total_xp, streak_days')
        .eq('id', user.id)
        .single();

      if (repError) throw repError;

      if (repData) {
        setXP(repData.total_xp || 0);
        setStreak(repData.streak_days || 0);
      }

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const {data, error} = await supabase
        .from('daily_stats')
        .select(`
          rep_id,
          reps!inner(first_name, last_name),
          total_sales,
          total_leads,
          total_xp,
          doors_per_hour,
          close_rate
        `)
        .order('total_xp', {ascending: false})
        .limit(10);

      if (error) throw error;

      const formattedLeaderboard = data?.map((item, index) => ({
        ...item,
        name: `${item.reps?.first_name} ${item.reps?.last_name}`,
        rank: index + 1,
      })) || [];

      setLeaderboard(formattedLeaderboard);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const renderStatCard = (title: string, value: string | number, subtitle?: string) => (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderLeaderboardItem = ({item, index}: {item: any; index: number}) => {
    const isCurrentUser = item.rep_id === user?.id;
    
    return (
      <View style={[styles.leaderboardItem, isCurrentUser && styles.currentUserItem]}>
        <View style={styles.rankContainer}>
          <Text style={styles.rank}>{item.rank}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isCurrentUser && styles.currentUserName]}>
            {item.name}
          </Text>
          <Text style={styles.userStats}>
            {item.total_sales} sales • {item.total_leads} leads
          </Text>
        </View>
        <View style={styles.xpContainer}>
          <Text style={styles.xp}>{item.total_xp} XP</Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* XP and Streak Header */}
      <LinearGradient
        colors={['#007AFF', '#0056CC']}
        style={styles.headerGradient}>
        <View style={styles.xpContainer}>
          <Text style={styles.xpValue}>{xp.toLocaleString()}</Text>
          <Text style={styles.xpLabel}>Total XP</Text>
        </View>
        <View style={styles.streakContainer}>
          <Text style={styles.streakValue}>{streak}</Text>
          <Text style={styles.streakLabel}>Day Streak</Text>
        </View>
      </LinearGradient>

      {/* Today's Performance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Performance</Text>
        <View style={styles.statsGrid}>
          {renderStatCard(
            'Doors Knocked',
            todayStats?.doors_knocked || 0,
            `Goal: ${rep?.daily_goal_doors || 50}`
          )}
          {renderStatCard(
            'Leads Generated',
            todayStats?.leads || 0,
            `Goal: ${rep?.daily_goal_leads || 10}`
          )}
          {renderStatCard(
            'Sales Closed',
            todayStats?.sales || 0
          )}
          {renderStatCard(
            'Close Rate',
            todayStats?.close_rate 
              ? `${Math.round(todayStats.close_rate * 100)}%` 
              : '0%'
          )}
        </View>
      </View>

      {/* Efficiency Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Efficiency</Text>
        <View style={styles.statsGrid}>
          {renderStatCard(
            'Doors/Hour',
            todayStats?.doors_per_hour 
              ? todayStats.doors_per_hour.toFixed(1) 
              : '0.0'
          )}
          {renderStatCard(
            'Hours Worked',
            todayStats?.hours_worked 
              ? todayStats.hours_worked.toFixed(1) 
              : '0.0'
          )}
          {renderStatCard(
            'Lead Conversion',
            todayStats?.lead_conversion_rate 
              ? `${Math.round(todayStats.lead_conversion_rate * 100)}%` 
              : '0%'
          )}
        </View>
      </View>

      {/* Leaderboard */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Leaderboard</Text>
        <FlatList
          data={leaderboard}
          renderItem={renderLeaderboardItem}
          keyExtractor={(item) => item.rep_id}
          scrollEnabled={false}
        />
      </View>

      {/* Achievements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Achievements</Text>
        <View style={styles.achievementsList}>
          {streak >= 7 && (
            <View style={styles.achievementItem}>
              <Text style={styles.achievementIcon}>🔥</Text>
              <View style={styles.achievementText}>
                <Text style={styles.achievementTitle}>Week Warrior</Text>
                <Text style={styles.achievementDesc}>7 day streak</Text>
              </View>
            </View>
          )}
          {todayStats?.sales >= 5 && (
            <View style={styles.achievementItem}>
              <Text style={styles.achievementIcon}>💰</Text>
              <View style={styles.achievementText}>
                <Text style={styles.achievementTitle}>Sales Master</Text>
                <Text style={styles.achievementDesc}>5+ sales in a day</Text>
              </View>
            </View>
          )}
          {todayStats?.doors_knocked >= 100 && (
            <View style={styles.achievementItem}>
              <Text style={styles.achievementIcon}>🚪</Text>
              <View style={styles.achievementText}>
                <Text style={styles.achievementTitle}>Door Crusher</Text>
                <Text style={styles.achievementDesc}>100+ doors in a day</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  headerGradient: {
    padding: 32,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  xpContainer: {
    alignItems: 'center',
  },
  xpValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  xpLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  streakContainer: {
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  streakLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
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
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statCard: {
    width: '45%',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
  },
  statTitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginBottom: 8,
  },
  currentUserItem: {
    backgroundColor: '#E6F2FF',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  currentUserName: {
    color: '#007AFF',
  },
  userStats: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  xpContainer: {
    alignItems: 'flex-end',
  },
  xp: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  achievementsList: {
    gap: 12,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementText: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  achievementDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
});

export default StatsScreen;