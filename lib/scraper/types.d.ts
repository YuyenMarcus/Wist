declare module 'playwright-extra-plugin-stealth' {
  import { Plugin } from 'playwright-extra';
  const StealthPlugin: () => Plugin;
  export default StealthPlugin;
}

