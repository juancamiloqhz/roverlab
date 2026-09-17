import { useCallback, useEffect, useRef, useState } from 'react';
import { createExpedition } from '../simulation/expedition';
import type { ExpeditionCommand } from '../simulation/types';

export function useExpedition() {
  const [session] = useState(createExpedition);
  const [snapshot, setSnapshot] = useState(session.getSnapshot);
  const lastTime = useRef(performance.now());

  const advanceToNow = useCallback(() => {
    const now = performance.now();
    session.advanceWallTime(now - lastTime.current);
    lastTime.current = now;
  }, [session]);

  useEffect(() => {
    lastTime.current = performance.now();
    const timer = window.setInterval(() => {
      advanceToNow();
      setSnapshot(session.getSnapshot());
    }, 50);
    return () => window.clearInterval(timer);
  }, [session, advanceToNow]);

  const dispatch = (command: ExpeditionCommand) => {
    // Account for wall time at the old speed/status before applying a command.
    advanceToNow();
    session.dispatch(command);
    setSnapshot(session.getSnapshot());
  };

  return { snapshot, dispatch };
}
