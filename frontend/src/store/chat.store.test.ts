import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message, Session } from '../types/index';

const api = {
  getSession: vi.fn(),
  listSessionMessages: vi.fn(),
  createMessage: vi.fn(),
  updateSession: vi.fn(),
  listSessions: vi.fn(),
};

vi.mock('../services/api.client', () => ({
  getApiClient: () => api,
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

import { useChatStore } from './chat.store';

function session(id: string): Session {
  return {
    id,
    user_id: 'user-1',
    project_id: 'project-1',
    title: `Chat ${id}`,
    created_at: '2026-11-19T00:00:00.000Z',
    updated_at: '2026-11-19T00:00:00.000Z',
  };
}

function message(id: string, sessionId: string, role: Message['role'], content: string): Message {
  return {
    id,
    session_id: sessionId,
    document_id: null,
    role,
    content,
    modality_type: 'socratic_auditor',
    created_at: '2026-11-19T00:00:00.000Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('chat session switching', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    vi.clearAllMocks();
  });

  it('does not apply a session load after the user opens a different chat', async () => {
    useChatStore.getState().activateSession('session-b');
    const pending = deferred<Session>();
    api.getSession.mockReturnValue(pending.promise);

    const loading = useChatStore.getState().getSession('session-a');
    pending.resolve(session('session-a'));
    await loading;

    expect(useChatStore.getState().activeSessionId).toBe('session-b');
    expect(useChatStore.getState().currentSession).toBeNull();
  });

  it('does not replace the open transcript with messages from a chat the user left', async () => {
    useChatStore.getState().activateSession('session-b');
    useChatStore.setState({
      currentSession: session('session-b'),
      messages: [message('b1', 'session-b', 'user', 'stay here')],
    });
    const pending = deferred<{ data: Message[] }>();
    api.listSessionMessages.mockReturnValue(pending.promise);

    const loading = useChatStore.getState().fetchMessages('session-a');
    pending.resolve({ data: [message('a1', 'session-a', 'assistant', 'from the other chat')] });
    await loading;

    expect(useChatStore.getState().messages.map((m) => m.content)).toEqual(['stay here']);
  });

  it('keeps an in-flight reply on the chat that sent it', async () => {
    useChatStore.setState({
      activeSessionId: 'session-a',
      currentSession: session('session-a'),
      messages: [],
    });
    const pending = deferred<{ message: Message; ai_response: Message; modality: 'socratic_auditor' }>();
    api.createMessage.mockReturnValue(pending.promise);
    api.listSessions.mockResolvedValue({ data: [] });

    const sending = useChatStore.getState().sendMessage('question from A');
    useChatStore.getState().activateSession('session-b');
    useChatStore.setState({ currentSession: session('session-b') });

    pending.resolve({
      message: message('user-a', 'session-a', 'user', 'question from A'),
      ai_response: message('ai-a', 'session-a', 'assistant', 'reply for A'),
      modality: 'socratic_auditor',
    });
    await sending;

    const state = useChatStore.getState();
    expect(state.activeSessionId).toBe('session-b');
    expect(state.messages).toEqual([]);
    expect(api.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: 'session-a', content: 'question from A' })
    );
  });
});
