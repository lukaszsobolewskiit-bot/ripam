/**
 * ProjectRacksPage — lista wszystkich szaf rack w projekcie, pogrupowana według site.
 * Dostępna z górnego paska nawigacji (zakładka "Racks").
 */
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { sitesApi, racksApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import {
  Server, ChevronRight, Layers, Plus, Package, Zap, Battery,
  Cable, Cpu, LayoutGrid,
} from 'lucide-react'
import type { Site, Rack } from '@/types'

// ─── Rack karta ───────────────────────────────────────────────────────────────

function RackCard({ rack, projectId, siteId }: { rack: Rack; projectId: number; siteId: number }) {
  const navigate = useNavigate()
  const fillPct  = rack.total_u > 0 ? Math.round((rack.used_u / rack.total_u) * 100) : 0
  const fillColor = fillPct > 80 ? '#ef4444' : fillPct > 50 ? '#f59e0b' : '#22c55e'

  return (
    <button
      onClick={() => navigate(`/projects/${projectId}/sites/${siteId}/racks`)}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md transition-all text-left"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#3b82f620', border: '1.5px solid #3b82f655' }}>
          <LayoutGrid className="h-4.5 w-4.5" style={{ color: '#3b82f6' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{rack.name}</p>
          {rack.location && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{rack.location}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
      </div>

      {/* Stats */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Zajętość</span>
          <span className="font-mono font-medium" style={{ color: fillColor }}>
            {rack.used_u ?? 0}/{rack.total_u}U
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${fillPct}%`, backgroundColor: fillColor }}
          />
        </div>
      </div>

      {/* Type badges */}
      <div className="flex gap-1 flex-wrap">
        {rack.total_u > 0 && (
          <span className="text-[9px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
            {rack.total_u}U
          </span>
        )}
        {rack.rack_type && (
          <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded capitalize">
            {rack.rack_type}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Site sekcja ──────────────────────────────────────────────────────────────

function SiteSection({ site, projectId }: { site: Site; projectId: number }) {
  const navigate = useNavigate()

  const { data: racks, isLoading } = useQuery({
    queryKey: ['racks', { site: site.id }],
    queryFn: () => racksApi.list({ site: String(site.id) }),
    select: r => r.data as unknown as Rack[],
  })

  const rackList = racks ?? []

  return (
    <div className="space-y-3">
      {/* Site header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Server className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">{site.name}</span>
          {site.location && (
            <span className="text-[11px] text-muted-foreground">· {site.location}</span>
          )}
        </div>
        <div className="flex-1 h-px bg-border/50" />
        <span className="text-[11px] text-muted-foreground shrink-0">
          {isLoading ? '…' : `${rackList.length} rack${rackList.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={() => navigate(`/projects/${projectId}/sites/${site.id}/racks`)}
          className="flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
        >
          Zarządzaj <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Rack grid */}
      {isLoading && (
        <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
          Ładowanie…
        </div>
      )}

      {!isLoading && rackList.length === 0 && (
        <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
          Brak szaf rack w tym site
        </div>
      )}

      {!isLoading && rackList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {rackList.map(rack => (
            <RackCard key={rack.id} rack={rack} projectId={projectId} siteId={site.id} />
          ))}
          {/* Dodaj szafę — skrót */}
          <button
            onClick={() => navigate(`/projects/${projectId}/sites/${site.id}/racks`)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-4 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all min-h-[120px]"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">Dodaj szafę</span>
          </button>
        </div>
      )}

      {!isLoading && rackList.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}/sites/${site.id}/racks`)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-4 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all min-h-[120px]"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">Dodaj szafę</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProjectRacksPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const id = Number(projectId)

  const { data: sites, isLoading } = useQuery({
    queryKey: ['sites', id],
    queryFn: () => sitesApi.list(id),
    select: r => r.data.results as Site[],
    enabled: !!id,
  })

  const siteList = sites ?? []

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6 max-w-7xl mx-auto">
        {/* Nagłówek */}
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Szafy Rack</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {siteList.length} site{siteList.length !== 1 ? 'ów' : ''}
            </span>
          )}
        </div>

        {/* Ładowanie */}
        {isLoading && (
          <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
            Ładowanie…
          </div>
        )}

        {/* Puste */}
        {!isLoading && siteList.length === 0 && (
          <div className="flex h-40 items-center justify-center">
            <div className="text-center space-y-2">
              <LayoutGrid className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-medium">Brak site'ów w projekcie</p>
              <p className="text-xs text-muted-foreground">Dodaj site w bocznym menu, aby móc zarządzać szafami rack.</p>
            </div>
          </div>
        )}

        {/* Lista site'ów z rackami */}
        {siteList.map(site => (
          <SiteSection key={site.id} site={site} projectId={id} />
        ))}
      </div>
    </div>
  )
}
