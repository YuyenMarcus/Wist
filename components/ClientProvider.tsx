'use client';

import { useEffect, useState } from 'react';
import ExtensionSync from './ExtensionSync';

export default function ClientProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log("✅ [ClientProvider] Mounted - ExtensionSync should now load");
  }, []);

  return (
    <>
      {mounted && <ExtensionSync />}
      {children}
    </>
  );
}

