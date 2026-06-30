import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface Props {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchableSelect({
  value, options, onChange, placeholder = 'Search…', className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = useCallback((v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-xs
                   text-slate-100 text-left truncate
                   focus:outline-none focus:border-amber-500/60 transition-colors"
      >
        {value}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-slate-900 border border-slate-600
                        rounded-lg shadow-xl overflow-hidden"
             style={{ top: '100%', left: 0 }}>
          <div className="p-1.5 border-b border-slate-700">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1
                         text-xs text-slate-100 placeholder-slate-500
                         focus:outline-none focus:border-amber-500/60"
            />
          </div>
          <ul className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-xs text-slate-500">No matches</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => select(opt)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors
                      ${opt === value
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-slate-100'
                      }`}
                  >
                    {opt}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
