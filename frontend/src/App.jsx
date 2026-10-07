import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { API_URL, GITHUB_URL, LINKEDIN_URL, PROJECTS, QUICK_PROMPTS } from './data';
import { useConversations } from './hooks/useConversations';

const glass =
  'bg-white/70 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-indigo-900/10';

/* ---------- icons ---------- */
const Icon = ({ d, className = 'w-5 h-5', fill = 'none' }) => (
  <svg viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d={d} />
  </svg>
);
const SidebarIcon = (p) => <Icon d="M4 5h16v14H4zM9 5v14" {...p} />;
const SendIcon = (p) => <Icon d="M5 12l14-7-5 16-3-6.5L5 12z" {...p} />;
const PlusIcon = (p) => <Icon d="M12 5v14M5 12h14" {...p} />;
const TrashIcon = (p) => <Icon d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" {...p} />;
const CloseIcon = (p) => <Icon d="M6 6l12 12M18 6L6 18" {...p} />;

const fmtTime = (ts) =>
  new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ---------- Navbar ---------- */
function Navbar({ onToggle, drawerOpen }) {
  return (
    <motion.nav
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`${glass} rounded-full px-3 py-2 flex items-center gap-3 mx-auto w-full max-w-6xl`}
    >
      <button
        id="drawer-toggle"
        onClick={onToggle}
        aria-label="Toggle conversation history"
        aria-expanded={drawerOpen}
        className="p-2 rounded-full text-slate-600 hover:bg-white/80 hover:text-indigo-600 transition"
      >
        <SidebarIcon />
      </button>
      <h1 className="font-bold tracking-tight text-slate-800 text-sm sm:text-base">
        Om Prakash Chaubey
        <span className="hidden sm:inline font-medium text-slate-400"> · AI Portfolio</span>
      </h1>
      <div className="ml-auto flex items-center gap-1 sm:gap-2 text-sm">
        <a href={GITHUB_URL} target="_blank" rel="noreferrer"
          className="px-3 py-1.5 rounded-full text-slate-600 hover:bg-white/80 hover:text-indigo-600 transition">
          GitHub
        </a>
        <a href={LINKEDIN_URL.startsWith('http') ? LINKEDIN_URL : `https://${LINKEDIN_URL}`}
          target="_blank" rel="noreferrer"
          className="px-3 py-1.5 rounded-full text-slate-600 hover:bg-white/80 hover:text-indigo-600 transition">
          LinkedIn
        </a>
        <span className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/80 text-emerald-700 text-xs font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Online
        </span>
      </div>
    </motion.nav>
  );
}

/* ---------- History drawer ---------- */
function HistoryDrawer({ open, onClose, conversations, activeId, onSelect, onNew, onClear, onDelete }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-label="Conversation history"
            className={`${glass} fixed z-40 top-3 bottom-3 left-3 w-[min(22rem,calc(100vw-1.5rem))] rounded-3xl flex flex-col`}
            initial={{ x: '-110%' }}
            animate={{ x: 0 }}
            exit={{ x: '-110%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="font-bold text-slate-800">History</h2>
              <button onClick={onClose} aria-label="Close history"
                className="p-2 rounded-full text-slate-500 hover:bg-white/80 transition">
                <CloseIcon />
              </button>
            </div>

            <div className="px-4 pb-3">
              <button id="new-chat" onClick={() => { onNew(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:opacity-90 active:scale-[.98] transition">
                <PlusIcon /> New Chat
              </button>
            </div>

            <ul className="flex-1 overflow-y-auto px-3 space-y-1.5 no-scrollbar">
              {conversations.map((c) => {
                const userCount = c.messages.filter((m) => m.role === 'user').length;
                return (
                  <li key={c.id} className="group relative">
                    <button
                      onClick={() => { onSelect(c.id); onClose(); }}
                      className={`w-full text-left rounded-2xl px-3 py-2.5 transition ${
                        c.id === activeId ? 'bg-indigo-100/80' : 'hover:bg-white/70'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-800 truncate pr-6">{c.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmtTime(c.createdAt)} · {userCount} {userCount === 1 ? 'query' : 'queries'}
                      </p>
                    </button>
                    <button onClick={() => onDelete(c.id)} aria-label={`Delete ${c.title}`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-white transition">
                      <TrashIcon />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="p-4 pt-2">
              <button id="clear-history" onClick={onClear}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold text-rose-600 bg-rose-50/80 hover:bg-rose-100 transition">
                <TrashIcon className="w-4 h-4" /> Clear history
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Floating project widgets ---------- */
function ProjectWidget({ project, index, onAsk, disabled }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: [-4, 4, -4] }}
      transition={{
        opacity: { duration: 0.5, delay: index * 0.1 },
        y: { duration: 6 + index, repeat: Infinity, ease: 'easeInOut', delay: index * 0.4 },
      }}
      whileHover={{ scale: 1.03 }}
      className={`${glass} relative rounded-3xl p-4 overflow-hidden`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${project.accent} opacity-70 pointer-events-none`} />
      <div className="relative">
        <h3 className="font-bold text-slate-800">{project.name}</h3>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{project.blurb}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {project.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/70 text-slate-700 border border-white/60">
              {t}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs font-semibold">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
            GitHub ↗
          </a>
          <button onClick={() => onAsk(project.query)} disabled={disabled}
            className="text-fuchsia-600 hover:underline disabled:opacity-40">
            Ask AI →
          </button>
        </div>
      </div>
    </motion.article>
  );
}

/* ---------- Chat ---------- */
function Bubble({ msg, streaming }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg px-4 py-2.5 text-sm text-white bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20 whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start gap-2.5">
      <div className="shrink-0 mt-1 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-emerald-300 grid place-items-center text-white text-xs font-bold shadow">
        AI
      </div>
      <div className="max-w-[85%] rounded-3xl rounded-bl-lg px-4 py-2.5 text-sm text-slate-800 bg-white/90 border border-white shadow-md">
        {msg.text ? (
          <div className="md">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{msg.text}</ReactMarkdown>
          </div>
        ) : streaming && !msg.error ? (
          <span className="flex gap-1 py-1" aria-label="Assistant is typing">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400"
                animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />
            ))}
          </span>
        ) : null}
        {streaming && msg.text && <span className="cursor-blink text-indigo-500"> ▍</span>}
        {msg.error && (
          <p className="mt-2 font-mono text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
            {msg.error}
          </p>
        )}
      </div>
    </div>
  );
}

function App() {
  const convo = useConversations();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const messages = convo.active.messages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, convo.activeId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sendMessage = async (text) => {
    const userMsg = (text ?? input).trim();
    if (!userMsg || isLoading) return;

    const id = convo.activeId;
    const patchLast = (fn) =>
      convo.updateMessages(id, (msgs) => {
        const copy = [...msgs];
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });

    setInput('');
    setIsLoading(true);
    convo.updateMessages(id, (msgs) => [...msgs, { role: 'user', text: userMsg }, { role: 'ai', text: '' }]);

    const handleEvent = (event, payload) => {
      if (event === 'token') patchLast((m) => ({ ...m, text: m.text + payload.token }));
      else if (event === 'error') patchLast((m) => ({ ...m, error: payload.message }));
    };

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Conversation id doubles as the backend session id => "New Chat" resets context.
        body: JSON.stringify({ message: userMsg, session_id: id }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop();
        for (const frame of frames) {
          let event = 'message';
          let data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (data) {
            try { handleEvent(event, JSON.parse(data)); } catch { /* ignore malformed frame */ }
          }
        }
      }
    } catch (err) {
      patchLast((m) => ({
        ...m,
        error: err instanceof TypeError
          ? '[ERROR] Connection refused: backend unreachable'
          : `[ERROR] ${err.message}`,
      }));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="h-screen flex flex-col px-3 sm:px-6 py-4 gap-4 overflow-hidden">
      <div className="mesh-bg" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <Navbar drawerOpen={drawerOpen} onToggle={() => setDrawerOpen((o) => !o)} />

      <HistoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={convo.conversations}
        activeId={convo.activeId}
        onSelect={convo.selectChat}
        onNew={convo.newChat}
        onClear={convo.clearAll}
        onDelete={convo.deleteChat}
      />

      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden lg:flex flex-col gap-4 overflow-y-auto no-scrollbar py-2 pr-1" aria-label="Projects">
          {PROJECTS.map((p, i) => (
            <ProjectWidget key={p.id} project={p} index={i} onAsk={sendMessage} disabled={isLoading} />
          ))}
        </aside>

        <section className={`${glass} rounded-3xl flex flex-col min-h-0 overflow-hidden`}>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((msg, i) => (
              <motion.div key={`${convo.activeId}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Bubble msg={msg} streaming={isLoading && i === messages.length - 1} />
              </motion.div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="p-3 sm:p-4 pt-0 space-y-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1" aria-label="Quick prompts">
              {QUICK_PROMPTS.map((q) => (
                <motion.button
                  key={q}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={isLoading}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium text-indigo-700 bg-white/80 border border-indigo-100 shadow-sm hover:bg-indigo-50 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {q}
                </motion.button>
              ))}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex items-center gap-2 rounded-full bg-white/90 border border-white shadow-xl shadow-indigo-900/10 pl-5 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-indigo-300 transition"
            >
              <input
                ref={inputRef}
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Ask about projects, skills, experience…"
                autoComplete="off"
                className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 py-2"
              />
              <button
                id="send-button"
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
                className="h-10 w-10 grid place-items-center rounded-full text-white bg-gradient-to-br from-indigo-500 to-fuchsia-500 disabled:opacity-40 hover:scale-105 active:scale-95 transition"
              >
                {isLoading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <SendIcon />
                )}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;