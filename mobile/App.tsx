import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ServerConfigProvider, useServerConfig } from './src/context/ServerConfigContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ServerSetupScreen } from './src/screens/ServerSetupScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { UpdateBanner } from './src/update/UpdateBanner';

function AppGate() {
  const { apiBaseUrl, isLoading } = useServerConfig();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
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

function ThemedStatusBar() {
  const { colors } = useTheme();
  return <StatusBar style={colors.statusBar} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ServerConfigProvider>
          <AppGate />
          <UpdateBanner />
          <ThemedStatusBar />
        </ServerConfigProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
