/**
 * Zentrale Einstellungen der App – hier anpassen, nicht im Code verteilt.
 */
export const APP_CONFIG = {
  name: 'KofferFertigRaus',
  /** Quellcode (öffentlich) */
  repositoryUrl: 'https://github.com/MrCatwiesel/KofferFertigRaus',
  /**
   * Spendenlink, z. B. https://paypal.me/<name>.
   * Leer lassen = Spenden-Hinweise werden nicht angezeigt.
   */
  donationUrl: 'https://www.paypal.me/MrCatwiesel',
  /** Anzeigename der Spendenplattform */
  donationLabel: 'PayPal',
  /** Lizenz und Link zum Lizenztext */
  license: 'GNU AGPL-3.0',
  licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.html'
} as const

/** Versionsnummer aus package.json (wird beim Bauen eingesetzt). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
