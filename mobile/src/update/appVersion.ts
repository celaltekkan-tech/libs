import { Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Kurulu uygulamanın mağaza sürümü (ör. "1.2.0") ve derleme numarası
// (Android versionCode / iOS buildNumber). Expo Go'da native değerler Expo Go'nun
// kendisine ait olduğundan app.json'daki sürüme düşülür.
export function getAppVersionLabel(): string {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const version = (!isExpoGo && Application.nativeApplicationVersion) || Constants.expoConfig?.version || '?';
  const build = !isExpoGo ? Application.nativeBuildVersion : null;
  return build ? `${version} (${build})` : version;
}

// Mağaza güncelleme kontrolü yalnızca mağazadan/derlemeden kurulan native
// uygulamada anlamlıdır; geliştirme, Expo Go ve web'de atlanır.
export function canCheckStoreUpdates(): boolean {
  if (__DEV__ || Platform.OS === 'web') return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}
