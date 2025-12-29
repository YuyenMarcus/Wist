// Stealth plugin is optional - declared here for type safety if needed
declare module 'playwright-extra-plugin-stealth' {
  import { Plugin } from 'playwright-extra';
  const StealthPlugin: () => Plugin;
  export default StealthPlugin;
}

