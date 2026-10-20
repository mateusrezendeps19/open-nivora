import { useEffect, useState, type ReactNode } from 'react';
import { bridge, hasShell } from '../bridge';
import { WindowChannel } from '../channels';
import './TitleBar.css';

interface TitleBarProps {
  title: string;
  /** Rendered inside the draggable strip, e.g. search or board switcher. */
  children?: ReactNode;
}

/**
 * The real app creates every window with `frame: false`, so the title bar is
 * drawn by the renderer and minimise/maximise/close round-trip through IPC
 * (TRIGGER_MINIMIZE / TRIGGER_MAXIMIZE / TRIGGER_CLOSE, the three channels REA
 * found in all ten preloads). This reproduces that arrangement.
 */
export function TitleBar({ title, children }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const [focused, setFocused] = useState(true);
  const { ipc } = bridge();

  useEffect(() => {
    if (!hasShell()) return;
    ipc.send(WindowChannel.TITLE_CHANGE, title);
  }, [ipc, title]);

  useEffect(() => {
    if (!hasShell()) return;
    const offState = ipc.on(WindowChannel.STATE, (payload) => {
      setMaximized(!!(payload as { maximized?: boolean })?.maximized);
    });
    const offFocus = ipc.on(WindowChannel.FOCUS, () => setFocused(true));
    const offBlur = ipc.on(WindowChannel.BLUR, () => setFocused(false));

    void ipc
      .invoke<{ maximized: boolean }>(WindowChannel.STATE)
      .then((state) => setMaximized(!!state?.maximized))
      .catch(() => undefined);

    return () => {
      offState();
      offFocus();
      offBlur();
    };
  }, [ipc]);

  if (!hasShell()) {
    // Running in a plain browser: no OS chrome to replace, but keep the strip
    // so layout and the embedded controls stay identical.
    return (
      <header className="titlebar titlebar--browser">
        <span className="titlebar__title">{title}</span>
        <div className="titlebar__slot">{children}</div>
      </header>
    );
  }

  return (
    <header className={`titlebar${focused ? '' : ' titlebar--blurred'}`}>
      <span className="titlebar__title">{title}</span>
      <div className="titlebar__slot">{children}</div>
      <div className="titlebar__controls">
        <button
          type="button"
          className="titlebar__btn"
          aria-label="Minimizar"
          onClick={() => ipc.send(WindowChannel.TRIGGER_MINIMIZE)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar__btn"
          aria-label={maximized ? 'Restaurar' : 'Maximizar'}
          onClick={() => ipc.send(WindowChannel.TRIGGER_MAXIMIZE)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar__btn titlebar__btn--close"
          aria-label="Fechar"
          onClick={() => ipc.send(WindowChannel.TRIGGER_CLOSE)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
