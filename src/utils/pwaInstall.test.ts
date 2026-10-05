import { describe, expect, it } from 'vitest';
import { getInAppBrowserName } from './pwaInstall';

describe('getInAppBrowserName', () => {
  it('recognises the built-in browsers a story link opens in', () => {
    const instagramAndroid =
      'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.0.0 Android (34/14; 480dpi; 1080x2340; samsung; SM-S911B; dm1q; qcom; he_IL; 600000000)';
    const instagramIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 330.0.0.0.0';
    const facebook = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0.0;]';
    expect(getInAppBrowserName(instagramAndroid)).toBe('אינסטגרם');
    expect(getInAppBrowserName(instagramIos)).toBe('אינסטגרם');
    expect(getInAppBrowserName(facebook)).toBe('פייסבוק');
    expect(getInAppBrowserName('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 TikTok_32.0')).toBe('טיקטוק');
  });

  it('flags a generic Android WebView', () => {
    expect(getInAppBrowserName('Mozilla/5.0 (Linux; Android 12; SM-A525F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36')).toBe('אפליקציה');
  });

  it('leaves real browsers alone, so they get the normal install steps', () => {
    const chromeAndroid = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
    const samsungInternet = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
    const safariIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    for (const ua of [chromeAndroid, samsungInternet, safariIos, desktop]) expect(getInAppBrowserName(ua)).toBeNull();
  });
});
