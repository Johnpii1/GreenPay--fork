/**
 * app/index.tsx
 * Home screen - featured projects and global stats
 */
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useTheme } from './theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

const CACHE_KEY_FEATURED = 'home:featured_project';
const CACHE_KEY_STATS = 'home:global_stats';

interface ClimateProject {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl?: string;
  goalXLM: string;
  raisedXLM: string;
  donorCount: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [featuredProject, setFeaturedProject] = useState<ClimateProject | null>(null);
  const [globalStats, setGlobalStats] = useState({ totalDonations: 0, totalXLMRaised: '0' });
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [featuredRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects/featured`),
        axios.get(`${API_URL}/api/stats/global`)
      ]);
      const featured = featuredRes.data.data;
      const stats = statsRes.data.data;
      setFeaturedProject(featured);
      setGlobalStats(stats);
      setIsOffline(false);
      await Promise.all([
        setCachedData(CACHE_KEY_FEATURED, featured),
        setCachedData(CACHE_KEY_STATS, stats),
      ]);
    } catch (error) {
      // Network failed — try cache
      const [cachedFeatured, cachedStats] = await Promise.all([
        getCachedData<ClimateProject>(CACHE_KEY_FEATURED),
        getCachedData<{ totalDonations: number; totalXLMRaised: string }>(CACHE_KEY_STATS),
      ]);
      if (cachedFeatured) setFeaturedProject(cachedFeatured.data);
      if (cachedStats) setGlobalStats(cachedStats.data);
      if (cachedFeatured || cachedStats) setIsOffline(true);
      else console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <Text style={[styles.loadingText, { color: colors.secondaryText }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.header, { backgroundColor: colors.primary }]}> 
        <Text style={[styles.title, { color: colors.headerText }]}>Stellar GreenPay</Text>
        <Text style={[styles.subtitle, { color: colors.headerText }]}>Climate donations on Stellar</Text>
      </View>

      <View style={[styles.statsCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow, borderColor: colors.cardBorder }]}> 
        <Text style={[styles.statsTitle, { color: colors.muted }]}>Global Impact</Text>
        <Text style={[styles.statsValue, { color: colors.accent }]}>{globalStats.totalDonations} donations</Text>
        <Text style={[styles.statsSub, { color: colors.secondaryText }]}>{globalStats.totalXLMRaised} XLM raised</Text>
      </View>

      {featuredProject && (
        <View style={[styles.featuredCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow, borderColor: colors.cardBorder }]}> 
          <Text style={[styles.featuredTitle, { color: colors.muted }]}>Featured Project</Text>
          <Text style={[styles.projectName, { color: colors.primaryText }]}>{featuredProject.name}</Text>
          <Text style={[styles.projectDescription, { color: colors.secondaryText }]} numberOfLines={3}>
            {featuredProject.description}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.buttonBackground }]}
            onPress={() => router.push(`/projects/${featuredProject.id}`)}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>View Project</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.browseButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
        onPress={() => router.push('/projects')}
      >
        <Text style={[styles.browseButtonText, { color: colors.accent }]}>Browse All Projects</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'Lora_700Bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 40,
  },
  statsCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  statsTitle: {
    fontSize: 14,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statsSub: {
    fontSize: 16,
    marginTop: 4,
  },
  featuredCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  featuredTitle: {
    fontSize: 14,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  projectName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  projectDescription: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  browseButton: {
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  offlineBanner: {
    backgroundColor: '#f5a623',
    padding: 8,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
