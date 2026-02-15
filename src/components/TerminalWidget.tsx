import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';

interface HistoryEntry {
  command: string;
  args: string[];
  output: string;
  exitCode: number;
}

export function TerminalDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mc-shell-history') || '[]'); } catch { return []; }
  });
  const [historyIdx, setHistoryIdx] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [history]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const parseInput = (raw: string): { command: string; args: string[] } => {
    const parts = raw.trim().split(/\s+/);
    return { command: parts[0] || '', args: parts.slice(1) };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || running) return;
    const { command, args } = parseInput(input);
    if (!command) return;

    const newCmdHistory = [input, ...cmdHistory.filter(c => c !== input)].slice(0, 20);
    setCmdHistory(newCmdHistory);
    localStorage.setItem('mc-shell-history', JSON.stringify(newCmdHistory));
    setHistoryIdx(-1);
    setRunning(true);

    try {
      const result = await api.terminalExec(command, args);
      setHistory(prev => [...prev, { command, args, output: result.output || '', exitCode: result.exitCode ?? 0 }]);
    } catch (err: any) {
      setHistory(prev => [...prev, { command, args, output: `Error: ${err.message}`, exitCode: -1 }]);
    } finally {
      setRunning(false);
      setInput('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const newIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
        setHistoryIdx(newIdx);
        setInput(cmdHistory[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setInput(cmdHistory[newIdx]);
      } else {
        setHistoryIdx(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="term-drawer">
      <div className="term-drawer__header">
        <span className="term-drawer__title">TERMINAL</span>
        <span className="term-drawer__hint">Whitelisted commands only</span>
        <button className="term-drawer__close" onClick={onClose}>{"\u2715"}</button>
      </div>
      <div className="term-drawer__body" ref={outputRef}>
        {history.map((entry, i) => (
          <div key={i} className="term-drawer__entry">
            <div className="term-drawer__prompt">
              <span className="term-drawer__dollar">$ </span>
              <span>{entry.command} {entry.args.join(' ')}</span>
            </div>
            <pre className={`term-drawer__result ${entry.exitCode !== 0 ? 'term-drawer__result--error' : ''}`}>
              {entry.output || '(no output)'}
            </pre>
          </div>
        ))}
        {running && <div className="term-drawer__running"><span className="term-drawer__spinner" /> Running...</div>}
      </div>
      <form className="term-drawer__input-bar" onSubmit={handleSubmit}>
        <span className="term-drawer__input-dollar">$</span>
        <input
          ref={inputRef}
          type="text"
          className="term-drawer__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="komut gir..."
          disabled={running}
        />
        <button type="submit" className="term-drawer__run-btn" disabled={running || !input.trim()}>
          {running ? '...' : '\u25B6'}
        </button>
      </form>
    </div>
  );
}
