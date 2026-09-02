import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Wraps the built web app as a native iOS app.
 * See README "Getting it into the App Store" — the `npx cap add ios` step needs
 * macOS with Xcode, so it is not run here.
 */
const config: CapacitorConfig = {
  appId: 'com.rescue.app',
  appName: 'Rescue',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#F1F3EE',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
