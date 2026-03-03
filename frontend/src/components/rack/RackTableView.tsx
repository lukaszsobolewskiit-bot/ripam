/**
 * RackTableView — szczegółowy widok tabeli wszystkich rack'ów w projekcie.
 * Wzorowany na ProjectTableView, z grupowaniem po site, rozwijalnymi wierszami,
 * podglądem jednostek rack oraz statusem zajętości.
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi, racksApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ChevronRight, ChevronDown, MapPin, Plus, Pencil, Trash2,
  Server, Cable, Package, Zap, Battery, Cpu,
  LayoutGrid, ExternalLink, AlertCircle,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { Site, Rack, RackUnit } from '@/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const ITEM_CFG: Record<string, { color: string; label: string; icon: typeof Server }> = {
  device:      { color: '#3b82f6', label: 'Urządzenie',   icon: Server  },
  patch_panel: { color: '#f59e0b', label: 'Patch Panel',  icon: Cable   },
  cable_mgmt:  { color: '#6b7280', label: 'Kabel. mgmt',  icon: Cable   },
  blank:       { color: '#9ca3af', label: 'Blank',        icon: Package },
  pdu:         { color: '#ea580c', label: 'PDU',          icon: Zap     },
  ups:         { color: '#16a34a', label: 'UPS',          icon: Battery },
  other:       { color: '#7c3aed', label: 'Inne',         icon: Cpu     },
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  active:           { label: 'Aktywna',         cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  planned:          { label: 'Planowana',        cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400'         },
  reserved:         { label: 'Zarezerwowana',    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400'      },
  decommissioning:  { label: 'Wycofywana',       cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-400'  },
  retired:          { label: 'Wycofana',         cls: 'bg-muted text-muted-foreground'                          },
}

// ─── Util bar inline ──────────────────────────────────────────────────────────

function FillBar({ used, total, className }: { used: number; total: number; className?: string }) {
  const pct = total > 0 ? (used / total) * 100 : 0
  const color = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e'
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[48px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono shrink-0 w-8 text-right" style={{ color }}>
        {used}/{total}U
      </span>
    </div>
  )
}

// ─── Unit row ─────────────────────────────────────────────────────────────────

function UnitRow({ unit }: { unit: RackUnit }) {
  const cfg = ITEM_CFG[unit.item_type] ?? ITEM_CFG.other
  const Icon = cfg.icon
  const name = unit.host_name || unit.patch_panel_name || unit.label || cfg.label

  return (
    <tr className="hover:bg-muted/30 transition-colors text-xs group">
      <td className="pl-10 pr-2 py-1 font-mono text-muted-foreground w-12">
        U{unit.position_u}
        {unit.height_u > 1 && <span className="text-[9px] ml-0.5 text-muted-foreground/60">+{unit.height_u - 1}</span>}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: cfg.color + '20', border: `1px solid ${cfg.color}40` }}>
            <Icon className="h-3 w-3" style={{ color: cfg.color }} />
          </div>
          <span className="font-medium truncate max-w-[200px]">{name}</span>
        </div>
      </td>
      <td className="px-2 py-1 hidden sm:table-cell">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {cfg.label}
        </span>
      </td>
      <td className="px-2 py-1 hidden md:table-cell font-mono text-muted-foreground">
        {unit.host_ip || '-'}
      </td>
      <td className="px-2 py-1 hidden lg:table-cell text-muted-foreground">
        {unit.host_model_name || unit.patch_panel_media_type || '-'}
      </td>
      <td className="px-2 py-1 hidden sm:table-cell">
        <span className={cn('text-[9px] px-1 py-0.5 rounded font-mono uppercase',
          unit.face === 'front' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
        )}>
          {unit.face === 'front' ? 'Przód' : 'Tył'}
        </span>
      </td>
    </tr>
  )
}

// ─── Rack row (expandable) ────────────────────────────────────────────────────

function RackRow({
  rack,
  projectId,
  siteId,
  onEdit,
  onDelete,
}: {
  rack: Rack
  projectId: number
  siteId: number
  onEdit: (rack: Rack) => void
  onDelete: (rack: Rack) => void
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const statusCfg = STATUS_CFG[rack.status] ?? STATUS_CFG.active
  const units = (rack.rack_units ?? []).slice().sort((a, b) => a.position_u - b.position_u)

  // Group counts by type
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const u of units) m[u.item_type] = (m[u.item_type] ?? 0) + 1
    return m
  }, [units])

  return (
    <>
      {/* Main rack row */}
      <tr
        className={cn(
          'border-t border-border/50 hover:bg-accent/40 cursor-pointer transition-colors group',
          expanded && 'bg-accent/20',
        )}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Expand toggle */}
        <td className="pl-8 pr-2 py-2 w-8">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </td>

        {/* Name */}
        <td className="px-2 py-2">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-3.5 w-3.5 text-primary/70 shrink-0" />
            <span className="font-semibold text-sm">{rack.name}</span>
            {rack.facility_id && (
              <span className="text-[10px] font-mono bg-muted border border-border/60 rounded px-1 py-0.5 hidden sm:inline shrink-0">
                {rack.facility_id}
              </span>
            )}
          </div>
          {rack.location && (
            <div className="text-[10px] text-muted-foreground mt-0.5 pl-5">{rack.location}</div>
          )}
        </td>

        {/* Status */}
        <td className="px-2 py-2 hidden sm:table-cell">
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full capitalize', statusCfg.cls)}>
            {statusCfg.label}
          </span>
        </td>

        {/* Size */}
        <td className="px-2 py-2 hidden md:table-cell">
          <span className="text-xs font-mono text-muted-foreground">{rack.height_u}U</span>
        </td>

        {/* Fill bar */}
        <td className="px-2 py-2">
          <FillBar used={rack.used_u ?? 0} total={rack.height_u} className="min-w-[100px] max-w-[180px]" />
        </td>

        {/* Items summary */}
        <td className="px-2 py-2 hidden lg:table-cell">
          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(typeCounts).map(([type, count]) => {
              const cfg = ITEM_CFG[type] ?? ITEM_CFG.other
              return (
                <span key={type} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: cfg.color + '18', color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                  {count}× {cfg.label}
                </span>
              )
            })}
            {units.length === 0 && <span className="text-[10px] text-muted-foreground italic">Pusta</span>}
          </div>
        </td>

        {/* Actions */}
        <td className="px-2 py-2 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => navigate(`/projects/${projectId}/sites/${siteId}/racks`)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
              title="Otwórz widok rack"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onEdit(rack)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Edytuj"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(rack)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Usuń"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded: unit rows */}
      {expanded && units.length > 0 && (
        <>
          {/* Sub-header */}
          <tr className="bg-muted/10">
            <td />
            <td className="px-2 py-1 text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">U</td>
            <td className="px-2 py-1 text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Nazwa</td>
            <td className="px-2 py-1 text-[9px] font-semibold uppercase text-muted-foreground tracking-wider hidden sm:table-cell">Typ</td>
            <td className="px-2 py-1 text-[9px] font-semibold uppercase text-muted-foreground tracking-wider hidden md:table-cell">IP</td>
            <td className="px-2 py-1 text-[9px] font-semibold uppercase text-muted-foreground tracking-wider hidden lg:table-cell">Model</td>
            <td className="px-2 py-1 text-[9px] font-semibold uppercase text-muted-foreground tracking-wider hidden sm:table-cell">Strona</td>
            <td />
          </tr>
          {units.map(unit => (
            <tr key={unit.id} className="hover:bg-muted/30 transition-colors text-xs">
              <td />
              <td className="pl-10 pr-2 py-1 font-mono text-muted-foreground">
                U{unit.position_u}
                {unit.height_u > 1 && <span className="text-[9px] ml-0.5 text-muted-foreground/60">+{unit.height_u - 1}</span>}
              </td>
              <td className="px-2 py-1">
                <div className="flex items-center gap-2">
                  {(() => {
                    const cfg = ITEM_CFG[unit.item_type] ?? ITEM_CFG.other
                    const Icon = cfg.icon
                    const name = unit.host_name || unit.patch_panel_name || unit.label || cfg.label
                    return (
                      <>
                        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                          style={{ backgroundColor: cfg.color + '20', border: `1px solid ${cfg.color}40` }}>
                          <Icon className="h-3 w-3" style={{ color: cfg.color }} />
                        </div>
                        <span className="font-medium truncate max-w-[200px]">{name}</span>
                      </>
                    )
                  })()}
                </div>
              </td>
              <td className="px-2 py-1 hidden sm:table-cell">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {(ITEM_CFG[unit.item_type] ?? ITEM_CFG.other).label}
                </span>
              </td>
              <td className="px-2 py-1 hidden md:table-cell font-mono text-muted-foreground text-[11px]">
                {unit.host_ip || '-'}
              </td>
              <td className="px-2 py-1 hidden lg:table-cell text-muted-foreground text-[11px]">
                {unit.host_model_name || unit.patch_panel_media_type || '-'}
              </td>
              <td className="px-2 py-1 hidden sm:table-cell">
                <span className={cn('text-[9px] px-1 py-0.5 rounded font-mono uppercase',
                  unit.face === 'front' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                )}>
                  {unit.face === 'front' ? 'Przód' : 'Tył'}
                </span>
              </td>
              <td />
            </tr>
          ))}
          {/* Empty slots info */}
          {rack.height_u - (rack.used_u ?? 0) > 0 && (
            <tr className="text-[10px] text-muted-foreground/50 italic">
              <td /><td colSpan={6} className="pl-10 py-1">
                + {rack.height_u - (rack.used_u ?? 0)}U wolne
              </td><td />
            </tr>
          )}
        </>
      )}

      {expanded && units.length === 0 && (
        <tr>
          <td colSpan={8}>
            <div className="flex items-center gap-2 pl-10 py-2 text-xs text-muted-foreground italic">
              <AlertCircle className="h-3.5 w-3.5" /> Brak jednostek w szafie
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Site section ─────────────────────────────────────────────────────────────

function SiteSection({
  site,
  projectId,
  onEdit,
  onDelete,
}: {
  site: Site
  projectId: number
  onEdit: (rack: Rack) => void
  onDelete: (rack: Rack) => void
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(true)

  const { data: racks, isLoading } = useQuery({
    queryKey: ['racks', { site: site.id }],
    queryFn: () => racksApi.list({ site: String(site.id) }),
    select: r => (r.data as unknown as Rack[]).slice().sort((a, b) => a.name.localeCompare(b.name)),
  })

  const rackList = racks ?? []
  const totalU = rackList.reduce((s, r) => s + r.height_u, 0)
  const usedU = rackList.reduce((s, r) => s + (r.used_u ?? 0), 0)

  return (
    <>
      {/* Site header row */}
      <tr
        className="bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors border-t border-border"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="pl-3 pr-2 py-2 w-8">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </td>
        <td className="px-2 py-2" colSpan={2}>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold text-sm">{site.name}</span>
            {site.location && (
              <span className="text-xs text-muted-foreground hidden sm:inline">· {site.location}</span>
            )}
            <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
              {isLoading ? '…' : `${rackList.length} rack${rackList.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </td>
        <td className="px-2 py-2 hidden md:table-cell">
          {!isLoading && <span className="text-xs text-muted-foreground">{totalU}U łącznie</span>}
        </td>
        <td className="px-2 py-2" colSpan={2}>
          {!isLoading && totalU > 0 && (
            <FillBar used={usedU} total={totalU} className="min-w-[100px] max-w-[200px]" />
          )}
        </td>
        <td className="px-2 py-2 text-right" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/projects/${projectId}/sites/${site.id}/racks`)}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline ml-auto"
          >
            Zarządzaj <ExternalLink className="h-3 w-3" />
          </button>
        </td>
        <td />
      </tr>

      {/* Rack rows */}
      {expanded && isLoading && (
        <tr>
          <td colSpan={8} className="px-4 py-3 text-xs text-muted-foreground text-center">
            Ładowanie…
          </td>
        </tr>
      )}

      {expanded && !isLoading && rackList.length === 0 && (
        <tr>
          <td colSpan={8}>
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground italic">
              Brak szaf rack w tym site
            </div>
          </td>
        </tr>
      )}

      {expanded && rackList.map(rack => (
        <RackRow
          key={rack.id}
          rack={rack}
          projectId={projectId}
          siteId={site.id}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

// ─── Edit Rack Dialog (inline simple form) ────────────────────────────────────

function EditRackDialog({ rack, onClose }: { rack: Rack; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(rack.name)
  const [location, setLocation] = useState(rack.location || '')
  const [facilityId, setFacilityId] = useState(rack.facility_id || '')
  const [status, setStatus] = useState(rack.status)
  const [heightU, setHeightU] = useState(rack.height_u)
  const [description, setDescription] = useState(rack.description || '')

  const mut = useMutation({
    mutationFn: () => racksApi.update(rack.id, { name, location, facility_id: facilityId, status, height_u: heightU, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['racks'] })
      toast.success('Szafa zaktualizowana')
      onClose()
    },
    onError: () => toast.error('Błąd zapisu'),
  })

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-muted-foreground block mb-0.5">Nazwa *</label>
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-0.5">Facility ID</label>
          <input value={facilityId} onChange={e => setFacilityId(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-0.5">Wysokość (U)</label>
          <input type="number" min={1} max={99} value={heightU} onChange={e => setHeightU(Number(e.target.value))}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-0.5">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm">
            {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-0.5">Lokalizacja</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="np. Pomieszczenie 101"
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-0.5">Opis</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm resize-none" />
      </div>
      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
          {mut.isPending ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function RackTableView({ projectId }: { projectId: number }) {
  const qc = useQueryClient()
  const [editRack, setEditRack] = useState<Rack | null>(null)

  const { data: sites, isLoading } = useQuery({
    queryKey: ['sites', projectId],
    queryFn: () => sitesApi.list(projectId),
    select: r => (r.data.results as Site[]).slice().sort((a, b) => a.name.localeCompare(b.name)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => racksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['racks'] })
      toast.success('Szafa usunięta')
    },
    onError: () => toast.error('Błąd usuwania szafy'),
  })

  const handleDelete = (rack: Rack) => {
    if (window.confirm(`Usunąć szafę "${rack.name}"? Wszystkie jednostki zostaną usunięte.`)) {
      deleteMut.mutate(rack.id)
    }
  }

  const siteList = sites ?? []

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-2 md:p-4">
        {isLoading && (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Ładowanie…</div>
        )}

        {!isLoading && siteList.length === 0 && (
          <div className="flex h-40 items-center justify-center flex-col gap-2">
            <LayoutGrid className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Brak site'ów w projekcie</p>
            <p className="text-xs text-muted-foreground">Dodaj site w bocznym panelu, aby móc zarządzać szafami.</p>
          </div>
        )}

        {!isLoading && siteList.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-8" />
                  <th className="px-2 py-2.5 text-left font-semibold text-xs">Szafa</th>
                  <th className="px-2 py-2.5 text-left font-semibold text-xs hidden sm:table-cell">Status</th>
                  <th className="px-2 py-2.5 text-left font-semibold text-xs hidden md:table-cell">Wys.</th>
                  <th className="px-2 py-2.5 text-left font-semibold text-xs">Zajętość</th>
                  <th className="px-2 py-2.5 text-left font-semibold text-xs hidden lg:table-cell">Zawartość</th>
                  <th className="px-2 py-2.5 text-right font-semibold text-xs">Akcje</th>
                  <th className="w-2" />
                </tr>
              </thead>
              <tbody>
                {siteList.map(site => (
                  <SiteSection
                    key={site.id}
                    site={site}
                    projectId={projectId}
                    onEdit={setEditRack}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!editRack} onOpenChange={o => { if (!o) setEditRack(null) }} title="Edytuj szafę">
        {editRack && <EditRackDialog rack={editRack} onClose={() => setEditRack(null)} />}
      </Dialog>
    </div>
  )
}
