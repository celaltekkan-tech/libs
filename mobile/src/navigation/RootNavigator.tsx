import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { StudentLookupScreen } from '../screens/StudentLookupScreen';
import { ReasonSelectScreen } from '../screens/ReasonSelectScreen';
import { MyNotesScreen } from '../screens/MyNotesScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { ThemeToggle } from '../components/ThemeToggle';
import type { AuthStackParamList, RootStackParamList } from './types';

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { colors, isDark } = useTheme();

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    }),
    [colors, isDark],
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const headerOptions = {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    contentStyle: { backgroundColor: colors.background },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {user ? (
        <AppStack.Navigator
          screenOptions={{
            ...headerOptions,
            headerRight: () => (
              <View style={{ marginRight: 4 }}>
                <ThemeToggle compact />
              </View>
            ),
          }}
        >
          <AppStack.Screen name="StudentLookup" component={StudentLookupScreen} options={{ title: 'Öğrenci Ara' }} />
          <AppStack.Screen name="ReasonSelect" component={ReasonSelectScreen} options={{ title: 'Bildirim Oluştur' }} />
          <AppStack.Screen name="MyNotes" component={MyNotesScreen} options={{ title: 'Geçmiş Bildirimlerim' }} />
          <AppStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Şifre Değiştir' }} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ ...headerOptions, headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
