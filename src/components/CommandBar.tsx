import { useState, useRef, useEffect, type KeyboardEvent } from 'react';

interface CommandBarProps {
  onCommand: (command: string) => void;
}

const HELP_TEXT = `Commands: SPCX | LAUNCHES | NEWS | ORBITAL | REFRESH | HELP | CLEAR`;

export function CommandBar({ onCommand }: CommandBarProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([HELP_TEXT]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const execute = (raw: string) => {
    const cmd = raw.trim().toUpperCase();
    if (!cmd) return;

    setHistory((prev) => [...prev.slice(-50), `> ${raw}`]);

    if (cmd === 'HELP') {
      setHistory((prev) => [...prev, HELP_TEXT]);
      setInput('');
      return;
    }

    if (cmd === 'CLEAR') {
      setHistory([HELP_TEXT]);
      setInput('');
      return;
    }

    if (cmd === 'REFRESH') {
      onCommand('refresh');
      setHistory((prev) => [...prev, 'Refreshing data...']);
      setInput('');
      return;
    }

    if (cmd === 'LAUNCHES') {
      onCommand('launches');
      setHistory((prev) => [...prev, 'Focus: Launch Manifest']);
      setInput('');
      return;
    }

    if (cmd === 'NEWS') {
      onCommand('news');
      setHistory((prev) => [...prev, 'Focus: News Wire']);
      setInput('');
      return;
    }

    if (cmd === 'ORBITAL' || cmd === 'OPS') {
      onCommand('orbital');
      setHistory((prev) => [...prev, 'Focus: Orbital Ops']);
      setInput('');
      return;
    }

    if (cmd === 'SPCX' || cmd === 'STATS') {
      onCommand('spcx');
      setHistory((prev) => [...prev, 'Focus: SPCX Statistics']);
      setInput('');
      return;
    }

    setHistory((prev) => [...prev, `Unknown command: ${raw}`]);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      execute(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const cmds = history.filter((h) => h.startsWith('> ')).map((h) => h.slice(2));
      if (cmds.length > 0) {
        const newIdx = historyIndex < cmds.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIdx);
        setInput(cmds[cmds.length - 1 - newIdx] ?? '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        const cmds = history.filter((h) => h.startsWith('> ')).map((h) => h.slice(2));
        setInput(cmds[cmds.length - 1 - newIdx] ?? '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="command-shell shrink-0 flex flex-col" style={{ height: 112 }}>
      <div className="command-log flex-1 overflow-auto px-4 py-1.5 text-[10px] text-bbg-muted font-mono">
        {history.slice(-6).map((line, i) => (
          <div key={i} className={line.startsWith('>') ? 'text-bbg-cyan' : 'text-bbg-muted'}>
            {line}
          </div>
        ))}
      </div>
      <div className="command-input-row flex items-center px-4 py-2 gap-2 transition-all">
        <span className="command-prompt font-bold text-[11px]">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="command"
          className="flex-1 bg-transparent text-bbg-white text-[11px] outline-none placeholder:text-bbg-muted/60 font-mono"
          spellCheck={false}
          autoComplete="off"
        />
        <span className="text-bbg-muted text-[9px] hidden sm:inline tracking-wide">
          / focus · ↑↓ history
        </span>
      </div>
    </div>
  );
}
