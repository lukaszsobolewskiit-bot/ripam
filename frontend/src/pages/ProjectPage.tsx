import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import { TopologyCanvas } from '@/components/topology/TopologyCanvas'
import { GeoMap } from '@/components/geo/GeoMap'
import { ProjectTableView } from '@/components/data/tables/ProjectTableView'
import { PortConnectionsTopology } from '@/components/topology/PortConnectionsTopology'
import { PatchPanelView } from '@/components/patchpanel/PatchPanelView'

import { useEffect } from 'react'
import { useSelectionStore } from '@/stores/selection.store'

function parseView(wildcard: string | undefined) {
  if (!wildcard) return undefined
  const view = wildcard.split('/')[0] as 'topology' | 'geo' | 'table' | 'connections' | 'patches'
  if (view === 'topology' || view === 'geo' || view === 'table' || view === 'connections' || view === 'patches') return view
  return undefined
}

export function ProjectPage() {
  const { projectId, '*': wildcard } = useParams<{ projectId: string; '*': string }>()
  const id = Number(projectId)
  const navigate = useNavigate()
  const setSelectedProject = useSelectionStore((s) => s.setSelectedProject)

  const view = parseView(wildcard)

  useEffect(() => {
    setSelectedProject(id)
  }, [id, setSelectedProject])

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
    select: (res) => res.data,
    enabled: !!id,
  })

  // Keyboard shortcuts for view switching
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === '1') navigate(`/projects/${id}/table`, { replace: true })
      else if (e.key === '2') navigate(`/projects/${id}/topology`, { replace: true })
      else if (e.key === '3') navigate(`/projects/${id}/geo`, { replace: true })
      else if (e.key === '4') navigate(`/projects/${id}/connections`, { replace: true })
      else if (e.key === '5') navigate(`/projects/${id}/patches`, { replace: true })
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [id, navigate])

  if (!view) {
    return <Navigate to={`/projects/${id}/topology`} replace />
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading project...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div className="flex items-center gap-2 md:gap-3 border-b border-border px-3 md:px-4 py-2 bg-card/50">
        <h2 className="text-sm font-semibold truncate">{project.name}</h2>

        {project.supernet && (
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">{project.supernet}</span>
        )}

        {/* View switcher buttons */}
        <div className="ml-auto flex items-center gap-1">
          {(
            [
              { key: 'topology', label: 'Topology', kbd: '2' },
              { key: 'connections', label: 'Connections', kbd: '4' },
              { key: 'patches', label: 'Patches', kbd: '5' },
              { key: 'geo', label: 'Geo', kbd: '3' },
              { key: 'table', label: 'Table', kbd: '1' },
            ] as const
          ).map(({ key, label, kbd }) => (
            <button
              key={key}
              onClick={() => navigate(`/projects/${id}/${key}`, { replace: true })}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                view === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {label}
              <kbd className={`hidden md:inline rounded border px-1 text-[9px] ${view === key ? 'border-primary-foreground/30' : 'border-border'}`}>
                {kbd}
              </kbd>
            </button>
          ))}
        </div>
      </div>

      {/* Main view */}
      <div className="flex-1 overflow-hidden">
        {view === 'topology' && <TopologyCanvas projectId={id} />}
        {view === 'geo' && <GeoMap projectId={id} />}
        {view === 'table' && <ProjectTableView projectId={id} />}
        {view === 'connections' && <PortConnectionsTopology projectId={id} />}
        {view === 'patches' && <PatchPanelView projectId={id} />}
      </div>
    </div>
  )
}
