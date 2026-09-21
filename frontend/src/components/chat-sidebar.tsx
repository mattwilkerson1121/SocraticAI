import { Session } from '../types/index';

type ChatSidebarProps = {
  sessions: Session[];
  activeSessionId?: string;
  projectName?: string;
  isLoading?: boolean;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onOpenProjects: () => void;
  userEmail?: string;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

function formatSessionTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  projectName,
  isLoading,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onOpenProjects,
  userEmail,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: ChatSidebarProps) {
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-neutral-800 bg-neutral-950 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-neutral-800 p-3">
          <button
            type="button"
            onClick={onNewChat}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-100 px-3 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New chat
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white md:hidden"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-neutral-800 px-3 py-2">
          <button
            type="button"
            onClick={onOpenProjects}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
          >
            <span className="truncate font-medium">{projectName || 'Projects'}</span>
            <svg className="h-4 w-4 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Chats
          </p>

          {isLoading && sessions.length === 0 ? (
            <p className="px-2 py-4 text-sm text-neutral-500">Loading chats…</p>
          ) : sessions.length === 0 ? (
            <p className="px-2 py-4 text-sm text-neutral-500">No chats yet. Start a new one.</p>
          ) : (
            <ul className="space-y-0.5">
              {sessions.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <li key={session.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSession(session.id);
                        onCloseMobile();
                      }}
                      className={`flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition ${
                        active
                          ? 'bg-neutral-800 text-white'
                          : 'text-neutral-300 hover:bg-neutral-900 hover:text-white'
                      }`}
                    >
                      <span className="truncate pr-6 text-sm font-medium">{session.title}</span>
                      <span className="mt-0.5 text-xs text-neutral-500">
                        {formatSessionTime(session.updated_at || session.created_at)}
                      </span>
                    </button>
                    {onDeleteSession && (
                      <button
                        type="button"
                        title="Delete chat"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="absolute right-1.5 top-1.5 hidden rounded p-1 text-neutral-500 hover:bg-neutral-700 hover:text-white group-hover:block"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8"
                          />
                        </svg>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-800 p-3">
          <div className="mb-2 truncate px-1 text-xs text-neutral-500">{userEmail}</div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-lg px-2 py-2 text-left text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white"
          >
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
