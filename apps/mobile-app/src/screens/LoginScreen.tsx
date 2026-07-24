import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { trpc } from '../lib/trpc';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('demo-restaurant');

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // TODO: Store token in secure storage
      Alert.alert('Success', 'Logged in successfully!');
      navigation.replace('Home');
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleLogin = () => {
    if (!email || !password || !tenantSlug) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    loginMutation.mutate({ email, password, tenantSlug });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Zerosky Waiter</Text>
      <Text style={styles.subtitle}>Mobile POS System</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Restaurant ID"
          value={tenantSlug}
          onChangeText={setTenantSlug}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.button, loginMutation.isPending && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loginMutation.isPending}
        >
          <Text style={styles.buttonText}>
            {loginMutation.isPending ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
