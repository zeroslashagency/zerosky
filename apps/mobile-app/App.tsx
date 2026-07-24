import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { trpc } from './src/lib/trpc';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import TablesScreen from './src/screens/TablesScreen';
import MenuScreen from './src/screens/MenuScreen';
import OrderScreen from './src/screens/OrderScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: 'http://localhost:4000/trpc',
          transformer: superjson,
          headers() {
            const token = ''; // TODO: Get from secure storage
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
              options={{ title: 'Zerosky Waiter' }}
            />
            <Stack.Screen 
              name="Tables" 
              component={TablesScreen}
              options={{ title: 'Tables' }}
            />
            <Stack.Screen 
              name="Menu" 
              component={MenuScreen}
              options={{ title: 'Menu' }}
            />
            <Stack.Screen 
              name="Order" 
              component={OrderScreen}
              options={{ title: 'Order Details' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
