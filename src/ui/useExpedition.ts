import { useCallback, useEffect, useRef, useState } from 'react';
import { createExpedition, createMatchedBaseline, type ExpeditionSession } from '../simulation/expedition';
import type { ExpeditionCommand, ExpeditionRecord } from '../simulation/types';
import { createTypeSafeController } from '../controllers/typesafe';

const createDefaultSession = () => createExpedition({ typesafeController: createTypeSafeController() });
export function useExpedition(createSession: () => ExpeditionSession = createDefaultSession) {
  const [session, setSession] = useState(createSession);
  const sessionFactory = useRef(createSession);
  const matchedSession = useRef<ExpeditionSession | null>(null);
  const sessions = useRef([session]);
  const [snapshot, setSnapshot] = useState(session.getSnapshot);
  const [decisions, setDecisions] = useState(session.getDecisions);
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const [usageRefreshMessage, setUsageRefreshMessage] = useState('');
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

  useEffect(() => {
    const collect = () => setCompletedRecords(sessions.current.flatMap(item => item.getCompletedRecords()));
    collect();
    const subscriptions = sessions.current.flatMap(item => [item.onExpeditionCompleted(collect),
      item.onUsageUpdated(() => { refresh(); collect(); })]);
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [session, refresh]);

  const refreshInferenceUsage = async () => {
    setRefreshingUsage(true);
    setUsageRefreshMessage('');
    try {
      await Promise.all(sessions.current.map(item => item.refreshInferenceUsage()));
      setUsageRefreshMessage('Accounting refresh complete. Any unresolved usage remains unavailable.');
    } finally { setRefreshingUsage(false); }
  };

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
    if (command.type === 'reset' && matchedSession.current === session) {
      matchedSession.current = null;
      replaceSession(sessionFactory.current());
      return;
    }
    refresh();
  };

  function replaceSession(next: ExpeditionSession) {
    sessions.current.push(next);
    setSession(next);
    const state = next.getSnapshot();
    decisionRevision.current = state.decisionRevision;
    lastTime.current = performance.now();
    setSnapshot(state);
    setDecisions(next.getDecisions());
  }

  const startMatchedBaseline = (record: ExpeditionRecord) => {
    const status = session.getSnapshot().status;
    if (status === 'running' || status === 'paused') throw new Error('Stop or reset the active expedition before starting a matched baseline.');
    const next = createMatchedBaseline(record);
    next.dispatch({ type: 'start' });
    matchedSession.current = next;
    replaceSession(next);
  };

  return { snapshot, decisions, completedRecords, refreshingUsage, usageRefreshMessage, refreshInferenceUsage, pauseForInspection, dispatch, startMatchedBaseline, getFullWorldView: session.getFullWorldView };
}
