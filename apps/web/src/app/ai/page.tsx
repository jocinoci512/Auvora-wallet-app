'use client';

import {
  AuvoraClientError,
  type AiAssistant,
  type AiChatMessage,
  type AiConversation,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AiPage(): ReactElement {
  const [assistants, setAssistants] = useState<AiAssistant[]>([]);
  const [assistantId, setAssistantId] = useState('');
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      const [assistantList, conversationList] = await Promise.all([
        client.listAiAssistants(),
        client.listAiConversations(),
      ]);
      setAssistants(assistantList);
      setConversations(conversationList.items);
      if (!assistantId && assistantList[0]) {
        setAssistantId(assistantList[0].id);
      }
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save a JWT access token above.'
          : formatApiError(err),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openConversation(id: string): Promise<void> {
    setError(null);
    try {
      const client = createApiClient();
      const detail = await client.getAiConversation(id);
      setConversationId(detail.id);
      setMessages(detail.messages);
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function onSend(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!input.trim()) return;
    setError(null);
    setSending(true);
    try {
      const client = createApiClient();
      const result = await client.chatAi({
        assistantId: assistantId || undefined,
        conversationId: conversationId ?? undefined,
        message: input,
      });
      setConversationId(result.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, conversationId: result.conversationId, role: 'USER', content: input, createdAt: new Date().toISOString() },
        result.message,
      ]);
      setInput('');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSending(false);
    }
  }

  async function onFeedback(messageId: string, rating: 'UP' | 'DOWN'): Promise<void> {
    try {
      const client = createApiClient();
      await client.submitAiMessageFeedback(messageId, { rating });
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  function newConversation(): void {
    setConversationId(null);
    setMessages([]);
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>AI assistant</h1>
        <nav className="page__subnav">
          <Link href="/ai">Chat</Link>
          <Link href="/ai/knowledge">Knowledge search</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <label>
        Assistant
        <select value={assistantId} onChange={(e) => setAssistantId(e.target.value)}>
          {assistants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.type})
            </option>
          ))}
          {!assistants.length ? <option value="">Default</option> : null}
        </select>
      </label>
      <section className="stack">
        <h2>Conversations</h2>
        <Button type="button" onClick={newConversation}>
          New conversation
        </Button>
        <ul>
          {conversations.map((c) => (
            <li key={c.id}>
              <Button type="button" onClick={() => void openConversation(c.id)}>
                {c.title ?? c.id} · {c.status}
              </Button>
            </li>
          ))}
          {!conversations.length ? <li>No conversations yet.</li> : null}
        </ul>
      </section>
      <section className="stack">
        <h2>Messages</h2>
        <ul>
          {messages.map((m) => (
            <li key={m.id}>
              <strong>{m.role}</strong>: {m.content}
              {m.role === 'ASSISTANT' ? (
                <span>
                  {' '}
                  <Button type="button" onClick={() => void onFeedback(m.id, 'UP')}>
                    👍
                  </Button>
                  <Button type="button" onClick={() => void onFeedback(m.id, 'DOWN')}>
                    👎
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
          {!messages.length ? <li>No messages yet. Say hello below.</li> : null}
        </ul>
        <form onSubmit={onSend} className="stack">
          <label>
            Message
            <input value={input} onChange={(e) => setInput(e.target.value)} required />
          </label>
          <Button type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </form>
      </section>
    </main>
  );
}
