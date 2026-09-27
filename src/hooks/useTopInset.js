import { StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height to keep clear of the status bar. Falls back to the value Android
 * reports directly, because a SafeAreaProvider nested inside another one
 * measures a view that is already inset and so reports nothing.
 */
export function useTopInset() {
  const insets = useSafeAreaInsets();
  return insets.top || StatusBar.currentHeight || 0;
}
