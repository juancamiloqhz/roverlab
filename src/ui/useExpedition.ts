import { useCallback, useEffect, useRef, useState } from 'react';
import { createExpedition, type ExpeditionSession } from '../simulation/expedition';
import type { ExpeditionCommand } from '../simulation/types';
import { createTypeSafeController } from '../controllers/typesafe';

const createDefaultSession = () => createExpedition({ typesafeController: createTypeSafeController() });
export function useExpedition(createSession: () => ExpeditionSession = createDefaultSession) {
  const [session] = useState(createSession);
  const [snapshot, setSnapshot] = useState(session.getSnapshot);
  const [decisions, setDecisions] = useState(session.getDecisions);
  const [completedRecords, setCompletedRecords] = useState(session.getCompletedRecords);
  const decisionRevision = useRef(snapshot.decisionRevision);
  const lastTime = useRef(performance.now());

  const advanceToNow = useCallback(() => {
    const now = performance.now();
    session.advanceWallTime(now - lastTime.current);
    lastTime.current = now;
  }, [session]);

  const refresh = useCallback(() => {
    const next = session.getSnapshot();
    if (next.decisionRevision !== decisionRevision.current) {
      decisionRevision.current = next.decisionRevision;
      setDecisions(session.getDecisions());
    }
    setSnapshot(next);
  }, [session]);

  useEffect(() => {
    lastTime.current = performance.now();
    const timer = window.setInterval(() => {
      advanceToNow();
      refresh();
    }, 50);
    const unsubscribe = session.onDecisionSettled(() => {
      lastTime.current = performance.now();
      refresh();
    });
    return () => { window.clearInterval(timer); unsubscribe(); };
  }, [session, advanceToNow, refresh]);

  useEffect(() => session.onExpeditionCompleted(record => {
    setCompletedRecords(records => [...records, record]);
  }), [session]);

  const pauseForInspection = () => {
    // Opening a saved record must not consume any additional expedition time.
    session.dispatch({ type: 'pause' });
    lastTime.current = performance.now();
    refresh();
  };

  const dispatch = (command: ExpeditionCommand) => {
    // Account for wall time at the old speed/status before applying a command.
    advanceToNow();
    session.dispatch(command);
    refresh();
  };

  return { snapshot, decisions, completedRecords, pauseForInspection, dispatch, getFullWorldView: session.getFullWorldView };
}
