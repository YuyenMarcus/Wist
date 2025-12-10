declare module '@cliqzdev/playwright-extra-plugin-stealth' {
  import { Plugin } from 'playwright-extra';
  const StealthPlugin: () => Plugin;
  export default StealthPlugin;
}

