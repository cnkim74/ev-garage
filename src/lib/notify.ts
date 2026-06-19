import { Alert, Platform } from 'react-native';

/**
 * 크로스플랫폼 알림.
 * RN 의 Alert.alert 는 웹(react-native-web)에서 동작하지 않으므로,
 * 웹에서는 window.alert 로 폴백한다.
 */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
