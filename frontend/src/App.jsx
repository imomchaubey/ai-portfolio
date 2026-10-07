import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://ai-portfolio-2bok.onrender.com');

const PROMPT = 'guest@om-portfolio:~$';
const SESSION_ID = Math.random().toString(36).slice(2);

const PROJECTS = [
  {
    file: 'de_insure.json',
    data: {
      name: 'De-Insure',
      type: 'IoT system',
      hardware: ['ESP32', 'DHT22'],
      telemetry: ['temperature', 'humidity'],
    },
    query: 'Explain the De-Insure IoT system with ESP32 and DHT22 telemetry.',
  },
  {
    file: 'brainova.json',
    data: {
      name: 'Brainova',
      type: 'platform',
      owner: 'Om Prakash Chaubey',
    },
    query: 'Tell me about the Brainova platform.',
  },
  {
    file: 'topsis_pypi.json',
    data: {
      name: 'topsis',
      type: 'PyPI package',
      language: 'Python',
      algorithm: 'TOPSIS',
      libs: ['NumPy', 'Pandas'],
    },
    query: 'Tell me about the TOPSIS PyPI package.',
  },
  {
    file: 'anomaly_detection.json',
    data: {
      name: 'Anomaly Detection in Network Traffic',
      dataset: 'UNSW-NB15',
      model: ['IsolationForest', 'RandomForest'],
      imbalance: 'SMOTE',
      accuracy: 0.95,
      precision: 1.0,
    },
    query: 'Go deep on the anomaly detection model: the 95% accuracy and SMOTE oversampling.',
  },
];

/* ---------- JSON syntax highlighter ---------- */
function JsonValue({ value, indent = 1 }) {
  const pad = '  '.repeat(indent);
  const padEnd = '  '.repeat(indent - 1);

  if (Array.isArray(value)) {
    return (
      <>
        <span className="tok-punc">[</span>
        {value.map((v, i) => (
          <span key={i}>
            <JsonValue value={v} indent={indent + 1} />
            {i < value.length - 1 && <span className="tok-punc">, </span>}
          </span>
        ))}
        <span className="tok-punc">]</span>
      </>
    );
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return (
      <>
        <span className="tok-punc">{'{'}</span>
        {'\n'}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {pad}
            <span className="tok-key">"{k}"</span>
            <span className="tok-punc">: </span>
            <JsonValue value={v} indent={indent + 1} />
            {i < entries.length - 1 && <span className="tok-punc">,</span>}
            {'\n'}
          </span>
        ))}
        {padEnd}
        <span className="tok-punc">{'}'}</span>
      </>
    );
  }
  if (typeof value === 'number') return <span className="tok-num">{value}</span>;
  if (typeof value === 'boolean') return <span className="tok-bool">{String(value)}</span>;
  return <span className="tok-str">"{value}"</span>;
}

function ProjectBlock({ project, active, onSelect }) {
  return (
    <motion.button
      type="button"
      className={`file-block ${active ? 'active' : ''}`}
      onClick={() => onSelect(project)}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="file-tab">
        <span className="file-icon">{'{}'}</span> {project.file}
      </div>
      <pre className="file-code">
        <JsonValue value={project.data} />
      </pre>
    </motion.button>
  );
}

/* ---------- Typewriter message ---------- */
function TypewriterText({ tokens, streaming }) {
  return (
    <span className="ai-text">
      {tokens.map((t, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
        >
          {t}
        </motion.span>
      ))}
      {streaming && <span className="cursor">▋</span>}
    </span>
  );
}

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      tokens: [
        "Welcome to om-portfolio v1.0. Ask about skills, projects or experience — or click a file in the explorer.",
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeFile, setActiveFile] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateLast = (fn) =>
    setMessages((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });

  const sendMessage = async (text) => {
    const userMsg = (text ?? input).trim();
    if (!userMsg || isLoading) return;

    setInput('');
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: userMsg },
      { role: 'ai', tokens: [], streaming: true },
    ]);

    const handleEvent = (event, payload) => {
      if (event === 'token') {
        updateLast((m) => ({ ...m, tokens: [...m.tokens, payload.token] }));
      } else if (event === 'error') {
        updateLast((m) => ({ ...m, error: payload.message }));
      }
    };

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, session_id: SESSION_ID }),
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
            try {
              handleEvent(event, JSON.parse(data));
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof TypeError
        ? '[ERROR] Connection refused: backend unreachable'
        : `[ERROR] ${err.message}`;
      updateLast((m) => ({ ...m, error: msg }));
    } finally {
      updateLast((m) => ({ ...m, streaming: false }));
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const onSelectProject = (project) => {
    setActiveFile(project.file);
    sendMessage(project.query);
  };

  const clock = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="ide">
      <header className="titlebar">
        <div className="dots"><i /><i /><i /></div>
        <span className="title">om-portfolio — Om Prakash Chaubey</span>
        <span className="status"><span className="pulse" /> online</span>
      </header>

      <div className="panes">
        <aside className="explorer">
          <div className="pane-title">EXPLORER</div>
          <div className="tree-root">▾ PROJECTS</div>
          <div className="file-list">
            {PROJECTS.map((p) => (
              <ProjectBlock
                key={p.file}
                project={p}
                active={activeFile === p.file}
                onSelect={onSelectProject}
              />
            ))}
          </div>
        </aside>

        <section className="terminal" onClick={() => inputRef.current?.focus()}>
          <div className="pane-title">TERMINAL — bash</div>
          <div className="term-body">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  className="line"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {msg.role === 'user' ? (
                    <>
                      <span className="prompt">{PROMPT}</span>{' '}
                      <span className="user-cmd">{msg.text}</span>
                    </>
                  ) : (
                    <>
                      <TypewriterText tokens={msg.tokens} streaming={msg.streaming} />
                      {msg.error && <div className="log-error">{msg.error}</div>}
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={endRef} />
          </div>

          <form
            className="term-input"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <span className="prompt">{PROMPT}</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="ask about the anomaly detection model..."
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </form>
        </section>
      </div>

      <footer className="statusbar">
        <span>main*</span>
        <span>LangChain RAG · Groq</span>
        <span>© {clock}</span>
      </footer>
    </div>
  );
}

export default App;