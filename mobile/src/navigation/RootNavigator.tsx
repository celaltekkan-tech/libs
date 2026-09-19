import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { StudentLookupScreen } from '../screens/StudentLookupScreen';
import { ReasonSelectScreen } from '../screens/ReasonSelectScreen';
import { MyNotesScreen } from '../screens/MyNotesScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator>
          <Stack.Screen name="StudentLookup" component={StudentLookupScreen} options={{ title: 'Öğrenci Ara' }} />
          <Stack.Screen name="ReasonSelect" component={ReasonSelectScreen} options={{ title: 'Bildirim Oluştur' }} />
          <Stack.Screen name="MyNotes" component={MyNotesScreen} options={{ title: 'Geçmiş Bildirimlerim' }} />
        </Stack.Navigator>
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}
