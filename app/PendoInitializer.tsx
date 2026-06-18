'use client';

import { useEffect } from 'react';

export default function PendoInitializer() {
  useEffect(() => {
    try {
      if (typeof pendo !== 'undefined') {
        pendo.initialize({ visitor: { id: '' } });
      }
    } catch {
      /* analytics is best-effort — never break the app */
    }
  }, []);

  return null;
}
