/**
 * SubscriberBoxView — widok puszek abonenckich.
 * Wyświetla puszki z podziałem na porty trunk (wejście) i drop (wyjście abonent).
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriberBoxesApi, subscriberBoxPortsApi, subscriberBoxConnectionsApi, patchPanelsApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, Trash2, ChevronDown, ChevronRight, Box, Link2, X,
  ArrowDownToLine, ArrowUpFromLine, Pencil, Check,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { SubscriberBox, SubscriberBoxPort, PatchPanel } from '@/types'

// ─── Stałe ────────────────────────────────────────────────────────────────────

const BOX_TYPES = [
  { value: 'indoor',      label: 'Wewnętrzna' },
  { value: 'outdoor',     label: 'Zewnętrzna' },
  { value: 'wall_mount',  label: 'Naścienna' },
  { value: 'pole_mount',  label: 'Słupowa' },
  { value: 'underground', label: 'Ziemna' },
  { value: 'cabinet',     label: 'Szafkowa' },
  { value: 'other',       label: 'Inna' },
]

const MEDIA_OPTIONS = [
  { value: 'fiber_sc_apc', label: 'Fiber SM — SC/APC' },
  { value: 'fiber_sc_upc', label: 'Fiber SM — SC/UPC' },
  { value: 'fiber_sc_sm',  label: 'Fiber SM — SC' },
  { value: 'fiber_lc_sm',  label: 'Fiber SM — LC' },
  { value: 'fiber_st_sm',  label: 'Fiber SM — ST' },
  { value: 'fiber_fc_sm',  label: 'Fiber SM — FC' },
  { value: 'fiber_lc_mm',  label: 'Fiber MM — LC' },
  { value: 'fiber_sc_mm',  label: 'Fiber MM — SC' },
  { value: 'fiber_mpo12',  label: 'Fiber MPO-12' },
  { value: 'fiber_mpo24',  label: 'Fiber MPO-24' },
  { value: 'copper',       label: 'Copper — RJ45' },
  { value: 'copper_rj11',  label: 'Copper — RJ11' },
  { value: 'other',        label: 'Inne' },
]

const MEDIA_COLOR: Record<string, string> = {
  fiber_sc_apc: '#10b981', fiber_sc_upc: '#34d399', fiber_sc_sm: '#fbbf24',
  fiber_lc_sm: '#f59e0b', fiber_st_sm: '#fcd34d', fiber_fc_sm: '#fde68a',
  fiber_lc_mm: '#a855f7', fiber_sc_mm: '#c084fc',
  fiber_mpo12: '#ec4899', fiber_mpo24: '#f472b6',
  copper: '#3b82f6', copper_rj11: '#60a5fa', other: '#9ca3af',
}

// ─── Połączenie portu puszki z panelem ────────────────────────────────────────

function ConnectBoxPortDialog({
  box, port, panels, onClose,
}: {
  box: SubscriberBox
  port: SubscriberBoxPort
  panels: PatchPanel[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [panelId, setPanelId] = useState('')
  const [portId, setPortId] = useState('')

  const selectedPanel = panels.find(p => String(p.id) === panelId)
  const freePorts = selectedPanel?.ports.filter(p => !p.device_port_info) ?? []

  const connectMut = useMutation({
    mutationFn: () => subscriberBoxConnectionsApi.create({
      box_port: port.id,
      panel_port: Number(portId),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriber-boxes'] })
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      toast.success('Połączono')
      onClose()
    },
    onError: () => toast.error('Błąd połączenia'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs flex items-center gap-2">
        <Box className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-semibold">{box.name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono">{port.direction === 'trunk' ? '↓' : '↑'} Port {port.port_number}</span>
        {port.label && <span className="text-muted-foreground">({port.label})</span>}
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Patch Panel</label>
        <select value={panelId} onChange={e => { setPanelId(e.target.value); setPortId('') }}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">— Wybierz panel —</option>
          {panels.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.site_name || 'bez site'})</option>
          ))}
        </select>
      </div>

      {panelId && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Port panelu</label>
          {freePorts.length === 0
            ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5">Brak wolnych portów</p>
            : (
              <select value={portId} onChange={e => setPortId(e.target.value)}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                <option value="">— Wybierz port —</option>
                {freePorts.map(p => (
                  <option key={p.id} value={p.id}>Port {p.port_number} {p.label && `(${p.label})`}</option>
                ))}
              </select>
            )}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => connectMut.mutate()} disabled={!portId || connectMut.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
          Połącz
        </button>
      </div>
    </div>
  )
}

// ─── Pojedynczy port puszki ───────────────────────────────────────────────────

function BoxPortRow({
  port, onConnect, onDisconnect, onDelete,
}: {
  port: SubscriberBoxPort
  onConnect: (p: SubscriberBoxPort) => void
  onDisconnect: (connId: number) => void
  onDelete: (p: SubscriberBoxPort) => void
}) {
  const color = MEDIA_COLOR[port.media_type] ?? '#9ca3af'
  const info = port.connection_info
  const isTrunk = port.direction === 'trunk'

  return (
    <div className={cn(
      'group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-all',
      info
        ? 'border-border/80 bg-card hover:border-primary/30'
        : 'border-border/40 bg-muted/20 hover:border-border hover:bg-muted/40',
    )}>
      {/* Kierunek */}
      <div className="shrink-0" title={port.direction_display}>
        {isTrunk
          ? <ArrowDownToLine className="h-3.5 w-3.5 text-blue-500" />
          : <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-500" />}
      </div>

      {/* Numer + etykieta */}
      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-[9px] font-mono"
        style={{ backgroundColor: color + '22', border: `1px solid ${color}55`, color }}>
        {port.port_number}
      </div>

      <span className="font-medium flex-1 min-w-0 truncate">
        {port.label || `Port ${port.port_number}`}
      </span>

      {/* Typ medium */}
      <span className="text-[9px] rounded px-1.5 py-0.5 shrink-0"
        style={{ backgroundColor: color + '18', color, border: `1px solid ${color}44` }}>
        {port.media_display.split('—').pop()?.trim() ?? port.media_type}
      </span>

      {/* Połączenie */}
      {info ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Link2 className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground text-[10px]">
            {info.panel_name} · Port {info.panel_port_number}
          </span>
          <button
            onClick={() => onDisconnect(info.connection_id)}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all"
            title="Rozłącz"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => onConnect(port)}
          className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-all shrink-0 flex items-center gap-1"
        >
          <Link2 className="h-3 w-3" /> Połącz
        </button>
      )}

      {/* Usuń port (tylko wolne) */}
      {!info && (
        <button
          onClick={() => onDelete(port)}
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all shrink-0"
          title="Usuń port"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}

// ─── Karta puszki abonenckiej ─────────────────────────────────────────────────

function SubscriberBoxCard({
  box, panels, projectId,
}: {
  box: SubscriberBox
  panels: PatchPanel[]
  projectId: number
}) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(true)
  const [connectTarget, setConnectTarget] = useState<SubscriberBoxPort | null>(null)
  const [addingPort, setAddingPort] = useState(false)
  const [newPortDirection, setNewPortDirection] = useState<'trunk' | 'drop'>('drop')
  const [newPortMedia, setNewPortMedia] = useState('fiber_sc_apc')
  const [newPortLabel, setNewPortLabel] = useState('')

  const trunkPorts = box.ports.filter(p => p.direction === 'trunk')
  const dropPorts  = box.ports.filter(p => p.direction === 'drop')
  const connectedCount = box.ports.filter(p => p.connection_info).length

  const addPort = useMutation({
    mutationFn: () => {
      const sameDirPorts = box.ports.filter(p => p.direction === newPortDirection)
      const nextNum = sameDirPorts.length > 0
        ? Math.max(...sameDirPorts.map(p => p.port_number)) + 1
        : 1
      return subscriberBoxPortsApi.create({
        box: box.id, port_number: nextNum,
        direction: newPortDirection, media_type: newPortMedia,
        label: newPortLabel.trim(),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriber-boxes'] })
      setNewPortLabel('')
      setAddingPort(false)
      toast.success('Port dodany')
    },
    onError: () => toast.error('Błąd dodawania portu'),
  })

  const deletePort = useMutation({
    mutationFn: (id: number) => subscriberBoxPortsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscriber-boxes'] }); toast.success('Port usunięty') },
  })

  const disconnect = useMutation({
    mutationFn: (id: number) => subscriberBoxConnectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriber-boxes'] })
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      toast.success('Rozłączono')
    },
  })

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Nagłówek */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}

        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-violet-500/10 border border-violet-500/30">
          <Box className="h-4.5 w-4.5 text-violet-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{box.name}</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{box.box_type_display}</span>
            {box.location && <span className="text-[10px] text-muted-foreground">{box.location}</span>}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-3">
            <span className="flex items-center gap-1">
              <ArrowDownToLine className="h-2.5 w-2.5 text-blue-500" />{box.trunk_count} trunk
            </span>
            <span className="flex items-center gap-1">
              <ArrowUpFromLine className="h-2.5 w-2.5 text-emerald-500" />{box.drop_count} drop
            </span>
            <span className={cn('font-medium', connectedCount > 0 ? 'text-primary' : '')}>
              {connectedCount}/{box.ports.length} połączonych
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border/30">
          {/* Porty trunk */}
          {trunkPorts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownToLine className="h-3 w-3 text-blue-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Wejście — Trunk ({trunkPorts.length})</span>
              </div>
              <div className="space-y-1">
                {trunkPorts.map(p => (
                  <BoxPortRow key={p.id} port={p}
                    onConnect={setConnectTarget}
                    onDisconnect={id => { if (window.confirm('Rozłączyć?')) disconnect.mutate(id) }}
                    onDelete={p => { if (window.confirm('Usunąć port?')) deletePort.mutate(p.id) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Porty drop */}
          {dropPorts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpFromLine className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Wyjście — Abonent ({dropPorts.length})</span>
              </div>
              <div className="space-y-1">
                {dropPorts.map(p => (
                  <BoxPortRow key={p.id} port={p}
                    onConnect={setConnectTarget}
                    onDisconnect={id => { if (window.confirm('Rozłączyć?')) disconnect.mutate(id) }}
                    onDelete={p => { if (window.confirm('Usunąć port?')) deletePort.mutate(p.id) }}
                  />
                ))}
              </div>
            </div>
          )}

          {box.ports.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3 italic">Brak portów — dodaj poniżej</p>
          )}

          {/* Formularz dodawania portu */}
          {addingPort ? (
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Kierunek</label>
                  <select value={newPortDirection} onChange={e => setNewPortDirection(e.target.value as 'trunk' | 'drop')}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs">
                    <option value="drop">↑ Drop (abonent)</option>
                    <option value="trunk">↓ Trunk (wejście)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Typ złącza</label>
                  <select value={newPortMedia} onChange={e => setNewPortMedia(e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs">
                    {MEDIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5">Etykieta (opcjonalna)</label>
                <input value={newPortLabel} onChange={e => setNewPortLabel(e.target.value)}
                  placeholder="np. Mieszkanie 1, Piętro 2…"
                  onKeyDown={e => { if (e.key === 'Enter') addPort.mutate(); if (e.key === 'Escape') setAddingPort(false) }}
                  className="w-full rounded border border-input bg-background px-2 py-1 text-xs" autoFocus />
              </div>
              <div className="flex gap-1 justify-end">
                <button onClick={() => setAddingPort(false)} className="px-2 py-1 rounded border border-border text-xs hover:bg-accent">Anuluj</button>
                <button onClick={() => addPort.mutate()} disabled={addPort.isPending}
                  className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">
                  <Check className="h-3 w-3" /> Dodaj
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingPort(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors">
              <Plus className="h-3.5 w-3.5" /> Dodaj port
            </button>
          )}
        </div>
      )}

      {/* Dialog łączenia z panelem */}
      <Dialog open={!!connectTarget} onOpenChange={o => { if (!o) setConnectTarget(null) }} title="Połącz port puszki z panelem">
        {connectTarget && (
          <ConnectBoxPortDialog
            box={box} port={connectTarget} panels={panels}
            onClose={() => setConnectTarget(null)}
          />
        )}
      </Dialog>
    </div>
  )
}

// ─── Główny widok puszek ──────────────────────────────────────────────────────

export function SubscriberBoxView({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [showAddBox, setShowAddBox] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('indoor')
  const [newLocation, setNewLocation] = useState('')

  const { data: boxes, isLoading } = useQuery({
    queryKey: ['subscriber-boxes', { project: projectId }],
    queryFn: () => subscriberBoxesApi.list({ project: String(projectId) }),
    select: r => r.data,
  })

  const { data: panels } = useQuery({
    queryKey: ['patch-panels', { project: projectId }],
    queryFn: () => patchPanelsApi.list({ project: String(projectId) }),
    select: r => r.data,
  })

  const createBox = useMutation({
    mutationFn: () => subscriberBoxesApi.create({ name: newName.trim(), box_type: newType, location: newLocation.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriber-boxes'] })
      setShowAddBox(false); setNewName(''); setNewType('indoor'); setNewLocation('')
      toast.success('Puszka dodana')
    },
    onError: () => toast.error('Błąd tworzenia'),
  })

  if (isLoading) return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Ładowanie puszek abonenckich…
    </div>
  )

  const bySite: Record<string, SubscriberBox[]> = {}
  for (const b of (boxes ?? [])) {
    const k = b.site_name ?? 'Nieprzypisane'
    ;(bySite[k] ??= []).push(b)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Box className="h-5 w-5 text-violet-500" />
          <h2 className="text-base font-semibold">Puszki abonenckie</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {boxes?.length ?? 0} puszek
          </span>
          <button onClick={() => setShowAddBox(v => !v)}
            className="ml-auto flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Nowa puszka
          </button>
        </div>

        {/* Formularz nowej puszki */}
        {showAddBox && (
          <div className="rounded-xl border border-dashed border-border p-4 space-y-3 bg-muted/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nowa puszka abonencka</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground block mb-0.5">Nazwa *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                  placeholder="np. Puszka A1, Box piętro 3…"
                  className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5">Typ</label>
                <select value={newType} onChange={e => setNewType(e.target.value)}
                  className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                  {BOX_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-[10px] text-muted-foreground block mb-0.5">Lokalizacja (opcjonalna)</label>
                <input value={newLocation} onChange={e => setNewLocation(e.target.value)}
                  placeholder="np. Klatka B, skrzynka 2"
                  className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => createBox.mutate()} disabled={!newName.trim() || createBox.isPending}
                className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
                <Plus className="h-3 w-3" /> Dodaj puszkę
              </button>
              <button onClick={() => setShowAddBox(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
            </div>
          </div>
        )}

        {/* Puste state */}
        {!boxes?.length && !showAddBox && (
          <div className="flex h-48 items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Box className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-medium">Brak puszek abonenckich</p>
              <p className="text-sm text-muted-foreground">Kliknij „Nowa puszka" aby dodać.</p>
            </div>
          </div>
        )}

        {/* Lista puszek */}
        {Object.entries(bySite).map(([siteName, siteBoxes]) => (
          <div key={siteName} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{siteName}</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            {siteBoxes.map(box => (
              <SubscriberBoxCard key={box.id} box={box} panels={panels ?? []} projectId={projectId} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
