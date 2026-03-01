/**
 * RackElevation — visual 1:1 rack elevation view inspired by NetBox.
 * Shows a single rack as a vertical column of U slots. Occupied slots
 * are rendered as coloured blocks; empty slots are shown as a thin
 * striped row so you can see exactly how much space is free.
 */
import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rackUnitsApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { X, Plus, Server, Layers, Cable, Cpu, Battery, Package } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { Rack, RackUnit } from '@/types'

// ─── Colour palette for item types ───────────────────────────────────────────

const TYPE_STYLE: Record<string, { bg: string; border: string; text: string; icon: typeof Server }> = {
  device:      { bg: 'bg-blue-500/15 dark:bg-blue-500/20',   border: 'border-blue-500/50',   text: 'text-blue-700 dark:text-blue-300',   icon: Server  },
  patch_panel: { bg: 'bg-amber-500/15 dark:bg-amber-500/20', border: 'border-amber-500/50',  text: 'text-amber-700 dark:text-amber-300', icon: Cable   },
  cable_mgmt:  { bg: 'bg-zinc-400/15 dark:bg-zinc-400/20',   border: 'border-zinc-400/50',   text: 'text-zinc-600 dark:text-zinc-400',   icon: Cable   },
  blank:       { bg: 'bg-zinc-200/30 dark:bg-zinc-700/20',   border: 'border-zinc-300/40',   text: 'text-zinc-400 dark:text-zinc-500',   icon: Package },
  pdu:         { bg: 'bg-orange-500/15 dark:bg-orange-500/20',border: 'border-orange-500/50',text: 'text-orange-700 dark:text-orange-300',icon: Battery },
  ups:         { bg: 'bg-green-500/15 dark:bg-green-500/20', border: 'border-green-500/50',  text: 'text-green-700 dark:text-green-300', icon: Battery },
  other:       { bg: 'bg-purple-500/15 dark:bg-purple-500/20',border: 'border-purple-500/50',text: 'text-purple-700 dark:text-purple-300',icon: Cpu    },
}

const U_HEIGHT_PX = 28 // px height per 1U

// ─── Add unit dialog ──────────────────────────────────────────────────────────

interface AddUnitDialogProps {
  rack: Rack
  positionU: number
  freeSlots: number
  hosts: { id: number; name: string; ip: string }[]
  panels: { id: number; name: string }[]
  onClose: () => void
}

const ITEM_TYPE_OPTIONS = [
  { value: 'device',      label: 'Device / Host' },
  { value: 'patch_panel', label: 'Patch Panel' },
  { value: 'cable_mgmt',  label: 'Cable Management' },
  { value: 'blank',       label: 'Blank Panel' },
  { value: 'pdu',         label: 'PDU' },
  { value: 'ups',         label: 'UPS' },
  { value: 'other',       label: 'Other' },
]

function AddUnitDialog({ rack, positionU, freeSlots, hosts, panels, onClose }: AddUnitDialogProps) {
  const queryClient = useQueryClient()
  const [itemType, setItemType] = useState<string>('device')
  const [hostId, setHostId] = useState('')
  const [panelId, setPanelId] = useState('')
  const [label, setLabel] = useState('')
  const [heightU, setHeightU] = useState(1)
  const [face, setFace] = useState<'front' | 'rear'>('front')

  const createMutation = useMutation({
    mutationFn: () => rackUnitsApi.create({
      rack: rack.id,
      item_type: itemType as RackUnit['item_type'],
      position_u: positionU,
      height_u: heightU,
      face,
      label,
      host: itemType === 'device' && hostId ? Number(hostId) : undefined,
      patch_panel: itemType === 'patch_panel' && panelId ? Number(panelId) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks'] })
      toast.success('Item added to rack')
      onClose()
    },
    onError: () => toast.error('Failed to add item'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs flex items-center gap-3">
        <span className="font-mono font-semibold text-foreground">U{positionU}</span>
        <span className="text-muted-foreground">in {rack.name}</span>
        <span className="ml-auto text-muted-foreground">{freeSlots} free slots below</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Type</label>
          <select value={itemType} onChange={e => setItemType(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs">
            {ITEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Height (U)</label>
          <input type="number" min={1} max={Math.min(freeSlots, 10)} value={heightU}
            onChange={e => setHeightU(Number(e.target.value))}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs" />
        </div>
      </div>

      {itemType === 'device' && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Host / Device</label>
          <select value={hostId} onChange={e => setHostId(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs">
            <option value="">— None / Unmanaged —</option>
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name} ({h.ip})</option>)}
          </select>
        </div>
      )}

      {itemType === 'patch_panel' && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Patch Panel</label>
          <select value={panelId} onChange={e => setPanelId(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs">
            <option value="">— Select panel —</option>
            {panels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          {itemType === 'device' && !hostId ? 'Label (unmanaged device name)' : 'Label / notes (optional)'}
        </label>
        <input value={label} onChange={e => setLabel(e.target.value)}
          placeholder={itemType === 'blank' ? 'Blank 1U' : 'e.g. Core Switch, Cable Manager…'}
          className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs" />
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Face</label>
        <div className="flex gap-2">
          {(['front', 'rear'] as const).map(f => (
            <button key={f} onClick={() => setFace(f)}
              className={cn(
                'flex-1 rounded border py-1.5 text-xs capitalize transition-colors',
                face === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent',
              )}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onClose}
          className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors">
          Cancel
        </button>
        <button onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {createMutation.isPending ? 'Adding…' : 'Add to Rack'}
        </button>
      </div>
    </div>
  )
}

// ─── RackElevation ────────────────────────────────────────────────────────────

interface Props {
  rack: Rack
  hosts: { id: number; name: string; ip: string }[]
  panels: { id: number; name: string }[]
}

export function RackElevation({ rack, hosts, panels }: Props) {
  const queryClient = useQueryClient()
  const [addAt, setAddAt] = useState<number | null>(null)
  const [hoveredU, setHoveredU] = useState<number | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rackUnitsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks'] })
      toast.success('Removed from rack')
    },
  })

  // Build slot map: positionU → RackUnit (for occupied slots)
  const slotMap = useMemo(() => {
    const m = new Map<number, RackUnit>()
    for (const u of rack.rack_units) {
      for (let i = 0; i < u.height_u; i++) {
        m.set(u.position_u + i, u)
      }
    }
    return m
  }, [rack.rack_units])

  // Build display rows: for each U from top to bottom (or bottom to top)
  const uSlots = useMemo(() => {
    const rows: { u: number; unit: RackUnit | null; isFirst: boolean }[] = []
    const start = rack.numbering_desc ? rack.height_u : 1
    const end = rack.numbering_desc ? 1 : rack.height_u
    const step = rack.numbering_desc ? -1 : 1

    const rendered = new Set<number>()
    for (let u = start; rack.numbering_desc ? u >= end : u <= end; u += step) {
      const unit = slotMap.get(u) ?? null
      if (unit && rendered.has(unit.id)) continue // skip continuation rows
      if (unit) rendered.add(unit.id)
      rows.push({ u, unit, isFirst: true })
    }
    return rows
  }, [rack, slotMap])

  // Free slots from a given U downward
  const freeFrom = (startU: number) => {
    let count = 0
    for (let u = startU; u <= rack.height_u; u++) {
      if (!slotMap.has(u)) count++
      else break
    }
    return count
  }

  const freeU = rack.height_u - rack.used_u

  return (
    <div className="select-none">
      {/* Rack cabinet header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm">{rack.name}</h3>
            {rack.facility_id && (
              <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 font-mono">{rack.facility_id}</span>
            )}
            <span className={cn(
              'text-[10px] rounded-full px-2 py-0.5 font-medium capitalize',
              rack.status === 'active' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
              rack.status === 'planned' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400' :
              'bg-muted text-muted-foreground',
            )}>{rack.status}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{rack.height_u}U</span>
            <span>·</span>
            <span className={cn('font-medium', freeU > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
              {freeU}U free
            </span>
            {rack.location && <><span>·</span><span>{rack.location}</span></>}
          </div>
          {/* Utilization bar */}
          <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden w-32">
            <div className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round((rack.used_u / rack.height_u) * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* The rack visual */}
      <div className="rounded-lg overflow-hidden border-2 border-zinc-400/60 dark:border-zinc-600 shadow-lg bg-zinc-900 dark:bg-zinc-950 w-full max-w-sm">
        {/* Top bracket */}
        <div className="h-3 bg-zinc-700 dark:bg-zinc-800 border-b border-zinc-600 flex items-center px-2 gap-1">
          <div className="w-1 h-1 rounded-full bg-zinc-500" />
          <div className="w-1 h-1 rounded-full bg-zinc-500" />
          <div className="flex-1" />
          <div className="w-1 h-1 rounded-full bg-zinc-500" />
          <div className="w-1 h-1 rounded-full bg-zinc-500" />
        </div>

        {/* Rails + slots */}
        <div className="flex">
          {/* Left rail (U numbers) */}
          <div className="w-7 shrink-0 bg-zinc-800 dark:bg-zinc-900 border-r border-zinc-700">
            {uSlots.map(({ u, unit }) => (
              <div key={u}
                className="flex items-center justify-center text-[8px] font-mono text-zinc-500 border-b border-zinc-700/50"
                style={{ height: `${(unit?.height_u ?? 1) * U_HEIGHT_PX}px` }}>
                {u}
              </div>
            ))}
          </div>

          {/* Slot area */}
          <div className="flex-1 relative">
            {uSlots.map(({ u, unit }) => {
              const height = (unit?.height_u ?? 1) * U_HEIGHT_PX
              const style = TYPE_STYLE[unit?.item_type ?? ''] ?? TYPE_STYLE.other
              const Icon = style.icon

              if (unit) {
                const displayLabel = unit.host_name || unit.patch_panel_name || unit.label || unit.item_type
                return (
                  <div key={u}
                    className={cn(
                      'relative group border-b border-zinc-700/50',
                      'flex items-center gap-1.5 px-2',
                      style.bg, style.border, 'border-l-2',
                    )}
                    style={{ height: `${height}px` }}
                    onMouseEnter={() => setHoveredU(u)}
                    onMouseLeave={() => setHoveredU(null)}
                  >
                    <Icon className={cn('h-3 w-3 shrink-0', style.text)} />
                    <span className={cn('text-[10px] font-medium truncate', style.text)}>
                      {displayLabel}
                    </span>
                    {unit.host_ip && (
                      <span className="text-[9px] font-mono text-zinc-400 ml-auto shrink-0 hidden group-hover:inline">
                        {unit.host_ip}
                      </span>
                    )}
                    {/* Remove button */}
                    <button
                      className="absolute right-1 top-1 w-4 h-4 rounded bg-zinc-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => { if (window.confirm('Remove from rack?')) deleteMutation.mutate(unit.id) }}
                      title="Remove"
                    >
                      <X className="h-2.5 w-2.5 text-zinc-300" />
                    </button>
                  </div>
                )
              }

              // Empty slot
              return (
                <div key={u}
                  className={cn(
                    'relative group border-b border-zinc-700/30 cursor-pointer',
                    'hover:bg-zinc-700/20 transition-colors',
                  )}
                  style={{ height: `${height}px` }}
                  onMouseEnter={() => setHoveredU(u)}
                  onMouseLeave={() => setHoveredU(null)}
                  onClick={() => setAddAt(u)}
                >
                  {/* Subtle stripe pattern for empty */}
                  <div className="absolute inset-0"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.02) 3px, rgba(255,255,255,0.02) 4px)',
                    }} />
                  {hoveredU === u && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Plus className="h-3 w-3 text-zinc-500" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right rail */}
          <div className="w-4 shrink-0 bg-zinc-800 dark:bg-zinc-900 border-l border-zinc-700" />
        </div>

        {/* Bottom bracket */}
        <div className="h-3 bg-zinc-700 dark:bg-zinc-800 border-t border-zinc-600 flex items-center px-2 gap-1">
          <div className="w-1 h-1 rounded-full bg-zinc-500" />
          <div className="w-1 h-1 rounded-full bg-zinc-500" />
        </div>
      </div>

      {/* Add unit dialog */}
      <Dialog open={addAt !== null} onOpenChange={(o) => { if (!o) setAddAt(null) }}
        title={`Add Item — U${addAt}`}>
        {addAt !== null && (
          <AddUnitDialog
            rack={rack}
            positionU={addAt}
            freeSlots={freeFrom(addAt)}
            hosts={hosts}
            panels={panels}
            onClose={() => setAddAt(null)}
          />
        )}
      </Dialog>
    </div>
  )
}
