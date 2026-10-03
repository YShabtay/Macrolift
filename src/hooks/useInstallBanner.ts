import { useState } from 'react';
import { shouldShowInstallBanner, snoozeInstallBanner } from '../utils/pwaInstall';

/** Visibility of the "add to home screen" banner: hidden in the installed app, on desktop, and for 7 days after it was dismissed. */
export function useInstallBanner(): { isVisible: boolean; dismiss: () => void } {
  const [isVisible, setIsVisible] = useState(() => shouldShowInstallBanner());
  return {
    isVisible,
    dismiss: () => {
      snoozeInstallBanner();
      setIsVisible(false);
    },
  };
}
