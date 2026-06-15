'use client';

import { useEffect } from 'react';

type GuidanceAutoScrollProps = {
  enabled: boolean;
  targetId: string;
  delayMs?: number;
};

export default function GuidanceAutoScroll({
  enabled,
  targetId,
  delayMs = 150,
}: GuidanceAutoScrollProps) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, enabled, targetId]);

  return null;
}
