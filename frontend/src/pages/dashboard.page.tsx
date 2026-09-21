import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../store/projects.store';
import { useChatStore } from '../store/chat.store';
import { useAuthStore } from '../store/auth.store';
import { getApiErrorMessage } from '../services/api.client';

/**
 * Dashboard Page Component
 * Shows projects and allows creating new ones
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { projects, currentProject, setCurrentProject, createProject, fetchProjects, isLoading } =
    useProjectsStore();
  const { sessions, fetchSessions, createSession } = useChatStore();

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
      const newSession = await createSession(projectId, `Session ${new Date().toLocaleString()}`);
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
      {/* Header */}
      <header className="bg-neutral-800 border-b border-neutral-700 px-2xl py-lg">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-white">SocraticAI</h1>
            <p className="text-neutral-400 text-sm">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-lg py-md bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition"
          >
            Log Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2xl py-3xl">
        {actionError && (
          <div className="mb-xl bg-error/10 border border-error/30 text-error px-lg py-md rounded-lg text-sm">
            {actionError}
          </div>
        )}
        {/* Projects Section */}
        <div className="mb-3xl">
          <div className="flex justify-between items-center mb-2xl">
            <h2 className="text-3xl font-bold text-white">Your Projects</h2>
            <button
              onClick={() => setShowNewProjectForm(!showNewProjectForm)}
              className="px-lg py-md bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition"
            >
              + New Project
            </button>
          </div>

          {/* New Project Form */}
          {showNewProjectForm && (
            <form
              onSubmit={handleCreateProject}
              className="bg-neutral-800 rounded-lg p-2xl mb-2xl border border-neutral-700"
            >
              <div className="mb-lg">
                <label className="block text-sm font-medium text-neutral-200 mb-sm">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Business Strategy Q1 2025"
                  required
                  className="w-full px-lg py-md bg-neutral-700 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="mb-2xl">
                <label className="block text-sm font-medium text-neutral-200 mb-sm">
                  Description (optional)
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="What will you explore?"
                  rows={3}
                  className="w-full px-lg py-md bg-neutral-700 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-md">
                <button
                  type="submit"
                  className="flex-1 px-lg py-md bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition"
                >
                  Create Project
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewProjectForm(false)}
                  className="flex-1 px-lg py-md bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Projects Grid */}
          {isLoading ? (
            <div className="text-center text-neutral-400 py-3xl">
              <svg className="w-8 h-8 animate-spin mx-auto mb-lg" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-neutral-800 rounded-lg p-3xl text-center border-2 border-dashed border-neutral-700">
              <p className="text-neutral-400">No projects yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => setCurrentProject(project)}
                  className="bg-neutral-800 rounded-lg p-2xl border border-neutral-700 hover:border-primary-500 cursor-pointer transition"
                >
                  <h3 className="text-lg font-semibold text-white mb-md">{project.name}</h3>
                  <p className="text-neutral-400 text-sm mb-2xl line-clamp-2">
                    {project.description || 'No description'}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateSession(project.id);
                    }}
                    className="w-full px-lg py-md bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition"
                  >
                    New Session
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sessions Section */}
        {currentProject && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2xl">
              Sessions in "{currentProject.name}"
            </h2>

            {sessions.length === 0 ? (
              <div className="bg-neutral-800 rounded-lg p-3xl text-center border-2 border-dashed border-neutral-700">
                <p className="text-neutral-400">
                  No sessions yet. Create one to start a Socratic conversation!
                </p>
              </div>
            ) : (
              <div className="space-y-md">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => navigate(`/chat/${session.id}`)}
                    className="bg-neutral-800 rounded-lg p-lg border border-neutral-700 hover:border-primary-500 cursor-pointer transition group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold group-hover:text-primary-400 transition">
                          {session.title}
                        </h3>
                        <p className="text-neutral-400 text-sm">
                          {new Date(session.created_at).toLocaleString()}
                        </p>
                      </div>
                      <svg
                        className="w-5 h-5 text-neutral-600 group-hover:text-primary-400 transition"
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
