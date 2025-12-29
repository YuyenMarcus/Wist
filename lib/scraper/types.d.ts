// Stealth plugin type declaration for puppeteer-extra-plugin-stealth
declare module 'puppeteer-extra-plugin-stealth' {
  import { Plugin } from 'playwright-extra';
  const StealthPlugin: () => Plugin;
  export default StealthPlugin;
}

