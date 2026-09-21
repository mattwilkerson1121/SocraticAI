import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../store/projects.store';
import { useChatStore } from '../store/chat.store';
import { useAuthStore } from '../store/auth.store';
import { getApiErrorMessage } from '../services/api.client';

/**
 * Dashboard — project picker + chat history (persists when leaving a session).
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { projects, currentProject, setCurrentProject, createProject, fetchProjects, isLoading } =
    useProjectsStore();
  const { sessions, fetchSessions, createSession, isLoadingSessions } = useChatStore();

  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (currentProject) {
      fetchSessions(currentProject.id);
    }
  }, [currentProject, fetchSessions]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const newProject = await createProject({
        name: projectName,
        description: projectDescription,
      });
      setCurrentProject(newProject);
      setProjectName('');
      setProjectDescription('');
      setShowNewProjectForm(false);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Failed to create project'));
    }
  };

  const handleCreateSession = async (projectId: string) => {
    setActionError(null);
    try {
      const project = projects.find((p) => p.id === projectId);
      if (project) setCurrentProject(project);
      const newSession = await createSession(projectId, 'New chat');
      navigate(`/chat/${newSession.id}`);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Failed to create session'));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-neutral-900">
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">SocraticAI</h1>
            <p className="text-sm text-neutral-500">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        {actionError && (
          <div className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {actionError}
          </div>
        )}

        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Your workspace</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Open a past chat or start a new one — conversations stay saved here.
            </p>
          </div>
          <button
            onClick={() => setShowNewProjectForm(!showNewProjectForm)}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-white"
          >
            + New project
          </button>
        </div>

        {showNewProjectForm && (
          <form
            onSubmit={handleCreateProject}
            className="mb-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-6"
          >
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-neutral-300">Project name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Business Strategy Q1"
                required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-white placeholder-neutral-500 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-neutral-300">
                Description (optional)
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="What will you explore?"
                rows={2}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-white placeholder-neutral-500 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNewProjectForm(false)}
                className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <p className="py-12 text-center text-neutral-500">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-700 px-6 py-16 text-center text-neutral-400">
            No projects yet. Create one to start chatting.
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Projects
              </h3>
              <ul className="space-y-1">
                {projects.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => setCurrentProject(project)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        currentProject?.id === project.id
                          ? 'bg-neutral-800 text-white'
                          : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                      }`}
                    >
                      <div className="truncate font-medium">{project.name}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              {currentProject && (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{currentProject.name}</h3>
                      {currentProject.description && (
                        <p className="text-sm text-neutral-500">{currentProject.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCreateSession(currentProject.id)}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200"
                    >
                      New chat
                    </button>
                  </div>

                  {isLoadingSessions ? (
                    <p className="py-8 text-sm text-neutral-500">Loading chats…</p>
                  ) : sessions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-neutral-700 px-6 py-12 text-center text-neutral-400">
                      No chats in this project yet.
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => handleCreateSession(currentProject.id)}
                          className="text-sm font-medium text-primary-400 hover:text-primary-300"
                        >
                          Start your first chat
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ul className="divide-y divide-neutral-800 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                      {sessions.map((session) => (
                        <li key={session.id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/chat/${session.id}`)}
                            className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-neutral-900"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-white">{session.title}</div>
                              <div className="mt-0.5 text-xs text-neutral-500">
                                {new Date(session.updated_at || session.created_at).toLocaleString()}
                              </div>
                            </div>
                            <svg
                              className="h-4 w-4 shrink-0 text-neutral-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
