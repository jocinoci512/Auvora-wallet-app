'use client';

import {
  AuvoraClientError,
  type AiAssistant,
  type AiChatMessage,
  type AiConversation,
} from '@auvora/sdk';
import { Alert, Button, EmptyState, PageHeader } from '@auvora/ui';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Subnav } from '../../components/Subnav';
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
        {
          id: `local-${Date.now()}`,
          conversationId: result.conversationId,
          role: 'USER',
          content: input,
          createdAt: new Date().toISOString(),
        },
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
      <PageHeader title="AI assistant" subtitle="Ask questions grounded in your knowledge base.">
        <Subnav
          label="AI sections"
          links={[
            { href: '/ai', label: 'Chat' },
            { href: '/ai/knowledge', label: 'Knowledge search' },
          ]}
        />
      </PageHeader>

      {error ? (
        <Alert tone="error" title="AI request failed">
          {error}
        </Alert>
      ) : null}

      <label className="field" style={{ maxWidth: '24rem' }}>
        <span className="field-label">Assistant</span>
        <select
          className="field-input"
          value={assistantId}
          onChange={(e) => setAssistantId(e.target.value)}
          aria-label="Select assistant"
        >
          {assistants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.type})
            </option>
          ))}
          {!assistants.length ? <option value="">Default</option> : null}
        </select>
      </label>

      <div className="auvora-chat" style={{ marginTop: '1rem' }}>
        <aside className="auvora-chat__sidebar" aria-label="Conversations">
          <div className="section-header">
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Conversations</h2>
            <Button type="button" variant="secondary" onClick={newConversation}>
              New
            </Button>
          </div>
          {conversations.length === 0 ? (
            <EmptyState title="No conversations" description="Start a new chat to begin." />
          ) : (
            <ul className="stack">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Button
                    type="button"
                    variant={conversationId === c.id ? 'primary' : 'ghost'}
                    onClick={() => void openConversation(c.id)}
                    style={{ width: '100%', textAlign: 'left' }}
                  >
                    {c.title ?? c.id.slice(0, 8)} · {c.status}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="auvora-chat__main" aria-label="Chat messages">
          <div className="auvora-chat__messages" role="log" aria-live="polite">
            {messages.length === 0 ? (
              <EmptyState
                title="Say hello"
                description="Send a message to start the conversation."
              />
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`auvora-chat__bubble auvora-chat__bubble--${m.role === 'USER' ? 'user' : 'assistant'}`}
                >
                  <strong>{m.role === 'USER' ? 'You' : 'Assistant'}</strong>
                  <p style={{ margin: '0.35rem 0 0' }}>{m.content}</p>
                  {m.role === 'ASSISTANT' ? (
                    <div className="action-row" style={{ marginTop: '0.5rem' }}>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label="Helpful response"
                        onClick={() => void onFeedback(m.id, 'UP')}
                      >
                        Helpful
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label="Unhelpful response"
                        onClick={() => void onFeedback(m.id, 'DOWN')}
                      >
                        Not helpful
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <form className="form-stack" onSubmit={(e) => void onSend(e)}>
            <label>
              Message
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                required
                placeholder="Ask a question…"
                aria-label="Chat message"
              />
            </label>
            <Button type="submit" disabled={sending || !input.trim()}>
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
