'use client';

import { useEffect } from 'react';

// A stable, anonymous per-browser id so Novus/Pendo counts distinct visitors and
// funnels are meaningful. An empty id would collapse every session into one visitor.
function anonVisitorId(): string {
  try {
    const k = 'meridian_vid';
    let id = localStorage.getItem(k);
    if (!id) {
      id = crypto.randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return `v-${Date.now()}`;
  }
}

export default function PendoInitializer() {
  useEffect(() => {
    try {
      if (typeof pendo !== 'undefined') {
        pendo.initialize({ visitor: { id: anonVisitorId() } });
      }
    } catch {
      /* analytics is best-effort — never break the app */
    }
  }, []);

  return null;
}
