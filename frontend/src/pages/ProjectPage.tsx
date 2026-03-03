import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import { TopologyCanvas } from '@/components/topology/TopologyCanvas'
import { GeoMap } from '@/components/geo/GeoMap'
import { ProjectTableView } from '@/components/data/tables/ProjectTableView'
import { RackTableView } from '@/components/rack/RackTableView'
import { PortConnectionsTopology } from '@/components/topology/PortConnectionsTopology'
import { PatchPanelView } from '@/components/patchpanel/PatchPanelView'
import { SubscriberBoxView } from '@/components/patchpanel/SubscriberBoxView'

import { useEffect } from 'react'
import { useSelectionStore } from '@/stores/selection.store'
import { cn } from '@/lib/utils'
import { Network, Map, Table, Cable, Layers, Box, LayoutGrid } from 'lucide-react'

type MainView = 'topology' | 'geo' | 'table' | 'physical'
type PhysicalSubView = 'connections' | 'patches' | 'boxes'
type TableSubView = 'network' | 'racks'

function parseView(wildcard: string | undefined): { main: MainView; sub: PhysicalSubView; tableSub: TableSubView } {
  if (!wildcard) return { main: 'topology', sub: 'connections', tableSub: 'network' }
  const [first, second] = wildcard.split('/')
  const main = first as MainView
  if (!['topology', 'geo', 'table', 'physical'].includes(main)) {
    if (first === 'connections') return { main: 'physical', sub: 'connections', tableSub: 'network' }
    if (first === 'patches') return { main: 'physical', sub: 'patches', tableSub: 'network' }
    return { main: 'topology', sub: 'connections', tableSub: 'network' }
  }
  const sub = (second as PhysicalSubView) ?? 'connections'
  const tableSub = (second as TableSubView) ?? 'network'
  return {
    main,
    sub: ['connections', 'patches', 'boxes'].includes(sub) ? sub as PhysicalSubView : 'connections',
    tableSub: ['network', 'racks'].includes(tableSub) ? tableSub as TableSubView : 'network',
  }
}

export function ProjectPage() {
  const { projectId, '*': wildcard } = useParams<{ projectId: string; '*': string }>()
  const id = Number(projectId)
  const navigate = useNavigate()
  const setSelectedProject = useSelectionStore((s) => s.setSelectedProject)

  const { main: view, sub: physicalSub, tableSub } = parseView(wildcard)

  useEffect(() => { setSelectedProject(id) }, [id, setSelectedProject])

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
    select: (res) => res.data,
    enabled: !!id,
  })

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === '1') navigate(`/projects/${id}/table/network`, { replace: true })
      else if (e.key === '2') navigate(`/projects/${id}/topology`, { replace: true })
      else if (e.key === '3') navigate(`/projects/${id}/geo`, { replace: true })
      else if (e.key === '4') navigate(`/projects/${id}/physical/connections`, { replace: true })
      else if (e.key === '5') navigate(`/projects/${id}/physical/patches`, { replace: true })
      else if (e.key === '6') navigate(`/projects/${id}/physical/boxes`, { replace: true })
      else if (e.key === '7') navigate(`/projects/${id}/table/racks`, { replace: true })
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [id, navigate])

  if (!wildcard && wildcard !== '') {
    return <Navigate to={`/projects/${id}/topology`} replace />
  }

  if (!project) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading project…</div>
  }

  const mainTabs = [
    { key: 'topology' as MainView, label: 'Topology',  kbd: '2', icon: Network },
    { key: 'physical' as MainView, label: 'Physical',  kbd: '4', icon: Cable },
    { key: 'geo'      as MainView, label: 'Geo',       kbd: '3', icon: Map },
    { key: 'table'    as MainView, label: 'Table',     kbd: '1', icon: Table },
  ]

  const physTabs = [
    { key: 'connections' as PhysicalSubView, label: 'Connections', icon: Cable, kbd: '4' },
    { key: 'patches'     as PhysicalSubView, label: 'Patches',     icon: Layers, kbd: '5' },
    { key: 'boxes'      as PhysicalSubView, label: 'Puszki',      icon: Box,    kbd: '6' },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 border-b border-border px-3 md:px-4 py-2 bg-card/50">
        <h2 className="text-sm font-semibold truncate">{project.name}</h2>
        {project.supernet && (
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">{project.supernet}</span>
        )}

        {/* Main view tabs */}
        <div className="ml-auto flex items-center gap-0.5">
          {mainTabs.map(({ key, label, kbd, icon: Icon }) => (
            <button
              key={key}
              onClick={() => navigate(`/projects/${id}/${key === 'physical' ? 'physical/connections' : key}`, { replace: true })}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                view === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3 hidden sm:inline" />
              {label}
              <kbd className={cn(
                'hidden md:inline rounded border px-1 text-[9px]',
                view === key ? 'border-primary-foreground/30' : 'border-border',
              )}>{kbd}</kbd>
            </button>
          ))}
        </div>
      </div>

      {/* ── Table sub-tabs ── */}
      {view === 'table' && (
        <div className="flex items-center gap-0 border-b border-border px-4 bg-card/30">
          {([
            { key: 'network' as TableSubView, label: 'Sieć', icon: Table, kbd: '1' },
            { key: 'racks'   as TableSubView, label: 'Racks', icon: LayoutGrid, kbd: '7' },
          ]).map(({ key, label, icon: Icon, kbd }) => (
            <button
              key={key}
              onClick={() => navigate(`/projects/${id}/table/${key}`, { replace: true })}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors',
                tableSub === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
              <kbd className={cn(
                'hidden md:inline rounded border px-1 text-[9px]',
                tableSub === key ? 'border-primary/30' : 'border-border',
              )}>{kbd}</kbd>
            </button>
          ))}
        </div>
      )}

      {/* ── Physical sub-tabs ── */}
      {view === 'physical' && (
        <div className="flex items-center gap-0 border-b border-border px-4 bg-card/30">
          {physTabs.map(({ key, label, icon: Icon, kbd }) => (
            <button
              key={key}
              onClick={() => navigate(`/projects/${id}/physical/${key}`, { replace: true })}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors',
                physicalSub === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
              <kbd className={cn(
                'hidden md:inline rounded border px-1 text-[9px]',
                physicalSub === key ? 'border-primary/30' : 'border-border',
              )}>{kbd}</kbd>
            </button>
          ))}
        </div>
      )}

      {/* ── Main view ── */}
      <div className="flex-1 overflow-hidden">
        {view === 'topology' && <TopologyCanvas projectId={id} />}
        {view === 'geo'      && <GeoMap projectId={id} />}
        {view === 'table' && tableSub === 'network' && <ProjectTableView projectId={id} />}
        {view === 'table' && tableSub === 'racks'   && <RackTableView projectId={id} />}
        {view === 'physical' && physicalSub === 'connections' && <PortConnectionsTopology projectId={id} />}
        {view === 'physical' && physicalSub === 'patches'     && <PatchPanelView projectId={id} />}
        {view === 'physical' && physicalSub === 'boxes'      && <SubscriberBoxView projectId={id} />}
      </div>
    </div>
  )
}
