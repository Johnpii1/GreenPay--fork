/**
 * app/donate/[id].tsx
 * Donate screen with wallet integration
 */
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Linking } from 'expo-linking';
import { useTheme } from '../theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
const HORIZON_URL = process.env.EXPO_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';

interface ClimateProject {
  id: string;
  name: string;
  walletAddress: string;
}

export default function DonateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [project, setProject] = useState<ClimateProject | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [currency, setCurrency] = useState<'XLM' | 'USDC'>('XLM');
  const [loading, setLoading] = useState(false);
  const [publicKey, setPublicKey] = useState('');

  useEffect(() => {
    if (id) loadProject(id as string);
  }, [id]);

  const loadProject = async (projectId: string) => {
    try {
      const res = await axios.get(`${API_URL}/api/projects/${projectId}`);
      setProject(res.data.data);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const handleDonate = async () => {
    if (!project || !amount || parseFloat(amount) < 1) {
      Alert.alert('Error', 'Please enter a valid amount (minimum 1)');
      return;
    }

    if (!publicKey) {
      Alert.alert('Wallet Required', 'Please connect your Stellar wallet first');
      return;
    }

    const confirmed = await authenticate('Confirm donation with biometrics or PIN');
    if (!confirmed) {
      Alert.alert('Authentication Required', 'You must authenticate to sign a transaction');
      return;
    }

    setLoading(true);

    try {
      const { Server, TransactionBuilder, Networks, Operation, Asset } = require('@stellar/stellar-sdk');
      const server = new Server(HORIZON_URL);
      const sourceAccount = await server.loadAccount(publicKey);

      const asset = currency === 'USDC'
        ? new Asset('USDC', process.env.EXPO_PUBLIC_USDC_ISSUER)
        : Asset.native();

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: project.walletAddress,
            asset,
            amount: currency === 'XLM' ? parseFloat(amount).toFixed(7) : parseFloat(amount).toFixed(2),
          })
        )
        .addMemo(Operation.memo({ type: 'text', value: `GreenPay:${project.id.slice(0, 16)}` }))
        .setTimeout(60)
        .build();

      const xdr = transaction.toXDR();
      const freighterUrl = `freighter://tx?xdr=${encodeURIComponent(xdr)}`;

      const supported = await Linking.canOpenURL(freighterUrl);
      if (supported) {
        await Linking.openURL(freighterUrl);
      } else {
        Alert.alert(
          'Wallet Not Found',
          'Please install Freighter mobile app to sign transactions'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to build transaction');
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    Alert.alert(
      'Connect Wallet',
      'Enter your Stellar public key:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: (input: any) => {
            if (input && /^G[A-Z0-9]{55}$/.test(input)) {
              setPublicKey(input);
            } else {
              Alert.alert('Invalid Key', 'Please enter a valid Stellar public key');
            }
          },
        },
      ],
      'plain-text-input'
    );
  };

  if (!project) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <Text style={[styles.loadingText, { color: colors.secondaryText }]}>Loading project...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.header, { backgroundColor: colors.primary }]}> 
        <Text style={[styles.title, { color: colors.headerText }]}>Donate to {project.name}</Text>
        <Text style={[styles.subtitle, { color: colors.headerText }]}>100% goes directly to the project</Text>
      </View>

      {!publicKey ? (
        <TouchableOpacity style={[styles.connectButton, { backgroundColor: colors.buttonBackground }]}
          onPress={connectWallet}
        >
          <Text style={[styles.connectButtonText, { color: colors.buttonText }]}>Connect Wallet</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.walletCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}> 
          <Text style={[styles.walletLabel, { color: colors.muted }]}>Connected as:</Text>
          <Text style={[styles.walletAddress, { color: colors.primary }]}>{publicKey.slice(0, 8)}...{publicKey.slice(-4)}</Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}> 
        <Text style={[styles.label, { color: colors.primaryText }]}>Currency</Text>
        <View style={styles.currencySelector}>
          <TouchableOpacity
            style={[
              styles.currencyButton,
              { backgroundColor: currency === 'XLM' ? colors.primary : colors.inputBackground },
            ]}
            onPress={() => setCurrency('XLM')}
          >
            <Text style={[
              styles.currencyButtonText,
              { color: currency === 'XLM' ? colors.buttonText : colors.secondaryText },
            ]}>
              XLM
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.currencyButton,
              { backgroundColor: currency === 'USDC' ? colors.primary : colors.inputBackground },
            ]}
            onPress={() => setCurrency('USDC')}
          >
            <Text style={[
              styles.currencyButtonText,
              { color: currency === 'USDC' ? colors.buttonText : colors.secondaryText },
            ]}>
              USDC
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.primaryText }]}>Amount ({currency})</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.primaryText }]}
          placeholder="Enter amount..."
          placeholderTextColor={colors.placeholder}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <View style={styles.presets}>
          {['5', '10', '25', '50', '100'].map(preset => (
            <TouchableOpacity
              key={preset}
              style={[
                styles.presetButton,
                { backgroundColor: amount === preset ? colors.primary : colors.inputBackground },
              ]}
              onPress={() => setAmount(preset)}
            >
              <Text style={[
                styles.presetButtonText,
                { color: amount === preset ? colors.buttonText : colors.secondaryText },
              ]}>
                {preset} {currency}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.primaryText }]}>Message (optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.primaryText }]}
          placeholder="Leave a message of support..."
          placeholderTextColor={colors.placeholder}
          value={message}
          onChangeText={setMessage}
          maxLength={100}
        />
      </View>

      <TouchableOpacity
        style={[styles.donateButton, { backgroundColor: colors.buttonBackground }, loading && styles.donateButtonDisabled]}
        onPress={handleDonate}
        disabled={loading}
      >
        <Text style={[styles.donateButtonText, { color: colors.buttonText }]}> 
          {loading ? 'Building...' : `🌱 Donate ${amount || currency}`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 40,
  },
  header: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  connectButton: {
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  walletCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  walletLabel: {
    fontSize: 12,
  },
  walletAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  card: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  currencySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  currencyButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  currencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  donateButton: {
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  donateButtonDisabled: {
    opacity: 0.6,
  },
  donateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
