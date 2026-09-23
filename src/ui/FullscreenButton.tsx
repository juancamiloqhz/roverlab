import { useEffect, useState } from 'react';

export function FullscreenButton() {
  const [active, setActive] = useState(!!document.fullscreenElement);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const sync = () => { setActive(!!document.fullscreenElement); setMessage(''); };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setMessage('Fullscreen is unavailable. All controls work in this window.');
    } catch {
      setMessage('Fullscreen could not open. All controls work in this window.');
    }
  }
  return <div className="fullscreen-control">
    <button className="secondary" aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={active} onClick={() => void toggle()}>{active ? 'Exit fullscreen' : 'Fullscreen'}</button>
    {message && <p role="status">{message}<button aria-label="Dismiss fullscreen message" onClick={() => setMessage('')}>Close</button></p>}
  </div>;
}
