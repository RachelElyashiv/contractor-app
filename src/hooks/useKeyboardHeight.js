import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Height the keyboard currently covers. Under Android edge-to-edge the window
 * no longer resizes or pans for the keyboard whatever windowSoftInputMode says,
 * so bottom-sheet modals have to be lifted by hand.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
