import { useCallback, useEffect, useState } from 'react';
import { WELCOME } from '../data';

const STORAGE_KEY = 'om-portfolio:conversations:v1';

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const newConversation = () => ({
  id: uid(),
  title: 'New chat',
  createdAt: Date.now(),
  messages: [{ role: 'ai', text: WELCOME }],
});

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.conversations?.length) return saved;
  } catch {
    /* ignore corrupt storage */
  }
  const first = newConversation();
  return { conversations: [first], activeId: first.id };
}

/** Conversation history state, persisted to localStorage. */
export function useConversations() {
  const [state, setState] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const active =
    state.conversations.find((c) => c.id === state.activeId) ?? state.conversations[0];

  const newChat = useCallback(() => {
    setState((s) => {
      // Reuse an untouched empty chat instead of piling up blanks.
      const current = s.conversations.find((c) => c.id === s.activeId);
      if (current && current.messages.length <= 1) return s;
      const c = newConversation();
      return { conversations: [c, ...s.conversations], activeId: c.id };
    });
  }, []);

  const selectChat = useCallback((id) => setState((s) => ({ ...s, activeId: id })), []);

  const clearAll = useCallback(() => {
    const c = newConversation();
    setState({ conversations: [c], activeId: c.id });
  }, []);

  const deleteChat = useCallback((id) => {
    setState((s) => {
      const rest = s.conversations.filter((c) => c.id !== id);
      if (!rest.length) {
        const c = newConversation();
        return { conversations: [c], activeId: c.id };
      }
      return { conversations: rest, activeId: s.activeId === id ? rest[0].id : s.activeId };
    });
  }, []);

  /** Apply fn to a conversation's messages (by id, safe if user switches mid-stream). */
  const updateMessages = useCallback((id, fn) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => {
        if (c.id !== id) return c;
        const messages = fn(c.messages);
        const firstUser = messages.find((m) => m.role === 'user');
        return {
          ...c,
          messages,
          title: firstUser ? firstUser.text.slice(0, 48) : c.title,
        };
      }),
    }));
  }, []);

  return { ...state, active, newChat, selectChat, clearAll, deleteChat, updateMessages };
}
