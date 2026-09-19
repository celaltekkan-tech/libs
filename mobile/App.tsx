import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { ServerConfigProvider, useServerConfig } from './src/context/ServerConfigContext';
import { ServerSetupScreen } from './src/screens/ServerSetupScreen';
import { RootNavigator } from './src/navigation/RootNavigator';

function AppGate() {
  const { apiBaseUrl, isLoading } = useServerConfig();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!apiBaseUrl) {
    return <ServerSetupScreen />;
  }

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ServerConfigProvider>
      <AppGate />
      <StatusBar style="auto" />
    </ServerConfigProvider>
  );
}
