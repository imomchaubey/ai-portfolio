export const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:8000' : 'https://ai-portfolio-2bok.onrender.com');

export const GITHUB_URL = 'https://github.com/imomchaubey';
export const LINKEDIN_URL = 'https://linkedin.com/in/ochaubey';

export const WELCOME =
  "Hi! I'm Om's AI portfolio assistant. Ask about his projects, skills or experience — or tap a quick prompt below.";

export const QUICK_PROMPTS = [
  'Tell me about De-Insure',
  'How was the anomaly detection built?',
  'List top skills',
  "What's on your GitHub?",
  'Explain the TOPSIS PyPI package',
  'What is Brainova?',
];

export const PROJECTS = [
  {
    id: 'de-insure',
    name: 'De-Insure',
    blurb: 'IoT system streaming ESP32 + DHT22 temperature & humidity telemetry.',
    tags: ['ESP32', 'DHT22', 'IoT'],
    accent: 'from-sky-400/30 to-indigo-400/30',
    query: 'Tell me about De-Insure',
  },
  {
    id: 'brainova',
    name: 'Brainova',
    blurb: 'A platform project built by Om.',
    tags: ['Platform'],
    accent: 'from-fuchsia-400/30 to-pink-400/30',
    query: 'What is Brainova?',
  },
  {
    id: 'topsis',
    name: 'TOPSIS Package',
    blurb: 'PyPI package implementing the TOPSIS multi-criteria ranking algorithm.',
    tags: ['Python', 'NumPy', 'Pandas', 'PyPI'],
    accent: 'from-emerald-400/30 to-teal-400/30',
    query: 'Explain the TOPSIS PyPI package',
  },
  {
    id: 'anomaly',
    name: 'Anomaly Detection',
    blurb: 'Isolation Forest + Random Forest with SMOTE on UNSW-NB15 — 95% accuracy, 1.00 precision.',
    tags: ['Scikit-learn', 'SMOTE', 'Isolation Forest', 'Random Forest'],
    accent: 'from-amber-400/30 to-rose-400/30',
    query: 'How was the anomaly detection built?',
  },
];
