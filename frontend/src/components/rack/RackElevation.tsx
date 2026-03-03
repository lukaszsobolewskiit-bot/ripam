/**
 * RackElevation — jasna szafa rack
 * ✦ Drag & drop przez mouse events (niezawodne, bez HTML5 draggable)
 * ✦ Ghost element podąża za kursorem podczas drag
 * ✦ PDU z widokiem gniazd i przypisaniem urządzeń
 * ✦ Tooltip przy hover
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rackUnitsApi, racksApi, pdusApi, pduOutletsApi, portConnectionsApi, patchPanelPortsApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  X, Plus, Minus, Server, Cable, Cpu, Battery, Package,
  Network, Tag, Hash, Layers, AlertCircle, Zap,
  GripVertical, ZapOff, ArrowRight,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { Rack, RackUnit, PDU, PDUOutlet } from '@/types'

const TYPE_CFG: Record<string, { accent: string; bg: string; text: string; icon: typeof Server; label: string }> = {
  device:      { accent: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  text: '#1d4ed8', icon: Server,  label: 'Device'      },
  patch_panel: { accent: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  text: '#92400e', icon: Cable,   label: 'Patch Panel' },
  cable_mgmt:  { accent: '#6b7280', bg: 'rgba(107,114,128,0.10)', text: '#374151', icon: Cable,   label: 'Cable Mgmt'  },
  blank:       { accent: '#9ca3af', bg: 'rgba(156,163,175,0.08)', text: '#6b7280', icon: Package, label: 'Blank'       },
  pdu:         { accent: '#ea580c', bg: 'rgba(234,88,12,0.10)',   text: '#7c2d12', icon: Zap,     label: 'PDU'         },
  ups:         { accent: '#16a34a', bg: 'rgba(22,163,74,0.10)',   text: '#14532d', icon: Battery, label: 'UPS'         },
  other:       { accent: '#7c3aed', bg: 'rgba(124,58,237,0.10)',  text: '#4c1d95', icon: Cpu,     label: 'Other'       },
}

const U_PX = 30

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function UnitTooltip({ unit, x, y }: { unit: RackUnit; x: number; y: number }) {
  const cfg  = TYPE_CFG[unit.item_type] ?? TYPE_CFG.other
  const name = unit.host_name || unit.patch_panel_name || unit.label || cfg.label
  const left = Math.min(x + 16, window.innerWidth - 300)
  const top  = Math.max(8, Math.min(y - 10, window.innerHeight - 300))

  // Fetch host port connections if this is a device unit with a host
  const { data: connections } = useQuery({
    queryKey: ['port-connections-rack', unit.host],
    queryFn: () => portConnectionsApi.list({ host: String(unit.host) }),
    select: r => r.data,
    enabled: !!unit.host,
    staleTime: 30000,
  })

  // Fetch patch panel ports if this is a patch panel unit
  const { data: panelPorts } = useQuery({
    queryKey: ['patch-panel-ports-rack', unit.patch_panel],
    queryFn: () => patchPanelPortsApi.list({ panel: String(unit.patch_panel) }),
    select: r => r.data,
    enabled: !!unit.patch_panel,
    staleTime: 30000,
  })

  const connectedPorts = (connections ?? []).filter(c =>
    c.host_a_id === unit.host || c.host_b_id === unit.host
  )
  const activePanelPorts = (panelPorts ?? []).filter(p => p.device_port_info?.host_name || p.device_port_info?.far_panel_name)

  return (
    <div className="fixed z-[9999] pointer-events-none" style={{ left, top }}>
      <div className="w-72 rounded-xl border border-border bg-popover shadow-xl overflow-hidden text-xs">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-border/40"
          style={{ background: cfg.accent + '15' }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: cfg.accent + '25', border: `1px solid ${cfg.accent}55` }}>
            <cfg.icon className="h-3.5 w-3.5" style={{ color: cfg.accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{name}</p>
            <p className="text-[10px]" style={{ color: cfg.accent }}>
              {cfg.label} · U{unit.position_u}{unit.height_u > 1 ? `–${unit.position_u + unit.height_u - 1}` : ''}
            </p>
          </div>
        </div>
        <div className="px-3 py-2 space-y-1.5">
          {unit.host_ip          && <TRow icon={<Network className="h-3 w-3"/>} v={unit.host_ip}            mono />}
          {unit.host_model_name  && <TRow icon={<Tag     className="h-3 w-3"/>} v={unit.host_model_name} />}
          {unit.host_device_type && <TRow icon={<Hash    className="h-3 w-3"/>} v={unit.host_device_type.replace(/_/g,' ')} cap />}
          {unit.patch_panel_media_type && <TRow icon={<Layers className="h-3 w-3"/>} v={unit.patch_panel_media_type.replace(/_/g,' ')} />}
          {!unit.host_ip && !unit.host_model_name && !unit.patch_panel_media_type && connectedPorts.length === 0 && activePanelPorts.length === 0 && (
            <p className="text-muted-foreground italic text-[10px]">Brak dodatkowych danych</p>
          )}
        </div>

        {/* Połączenia urządzenia */}
        {connectedPorts.length > 0 && (
          <div className="border-t border-border/30 px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Połączenia portów ({connectedPorts.length})
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {connectedPorts.map(c => {
                const isA = c.host_a_id === unit.host
                const localPort  = isA ? c.port_a_name  : c.port_b_name
                const remoteHost = isA ? c.host_b_name  : c.host_a_name
                const remotePort = isA ? c.port_b_name  : c.port_a_name
                return (
                  <div key={c.id} className="flex items-center gap-1.5 text-[10px]">
                    <span className="font-mono text-primary shrink-0">{localPort}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0"/>
                    <span className="text-foreground truncate">{remoteHost}</span>
                    <span className="font-mono text-muted-foreground shrink-0 ml-auto">{remotePort}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Połączenia patch panelu */}
        {activePanelPorts.length > 0 && (
          <div className="border-t border-border/30 px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Porty panelu ({activePanelPorts.length} połączonych)
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {activePanelPorts.slice(0, 8).map(p => {
                const info = p.device_port_info!
                return (
                  <div key={p.id} className="flex items-center gap-1.5 text-[10px]">
                    <span className="font-mono text-amber-500 shrink-0">P{p.port_number}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0"/>
                    <span className="text-foreground truncate">
                      {info.host_name || info.far_panel_name || '—'}
                    </span>
                    {(info.device_port_name || info.far_panel_port_number) && (
                      <span className="font-mono text-muted-foreground shrink-0 ml-auto">
                        {info.device_port_name || `P${info.far_panel_port_number}`}
                      </span>
                    )}
                  </div>
                )
              })}
              {activePanelPorts.length > 8 && (
                <p className="text-[9px] text-muted-foreground">+{activePanelPorts.length - 8} więcej…</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TRow({ icon, v, mono, cap }: { icon: React.ReactNode; v: string; mono?: boolean; cap?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className={cn('text-foreground truncate', mono && 'font-mono', cap && 'capitalize')}>{v}</span>
    </div>
  )
}

// ─── Resize bar ───────────────────────────────────────────────────────────────

function ResizeBar({ rack }: { rack: Rack }) {
  const qc  = useQueryClient()
  const mut = useMutation({
    mutationFn: (h: number) => racksApi.update(rack.id, { height_u: h }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['racks'] }),
    onError:    () => toast.error('Nie można zmienić rozmiaru'),
  })
  const minH = Math.max(rack.used_u, 1)
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => mut.mutate(Math.max(minH, rack.height_u - 1))}
        disabled={rack.height_u <= minH || mut.isPending}
        className="w-5 h-5 rounded border border-border/70 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30">
        <Minus className="h-2.5 w-2.5" />
      </button>
      <span className="text-[11px] font-mono tabular-nums w-8 text-center">{rack.height_u}U</span>
      <button onClick={() => mut.mutate(rack.height_u + 1)} disabled={mut.isPending}
        className="w-5 h-5 rounded border border-border/70 flex items-center justify-center hover:bg-muted transition-colors">
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

// ─── PDU Dialog ───────────────────────────────────────────────────────────────

const PDU_TYPE_OPTS    = [{ v:'basic',l:'Basic' },{ v:'metered',l:'Metered' },{ v:'switched',l:'Switched' },{ v:'smart',l:'Smart' }]
const OUTLET_TYPE_OPTS = [{ v:'c13',l:'IEC C13' },{ v:'c19',l:'IEC C19' },{ v:'schuko',l:'Schuko (CEE 7/4)' },{ v:'mixed',l:'Mieszany C13/C19' },{ v:'nema',l:'US NEMA 5-15' },{ v:'uk_g',l:'UK BS 1363' }]

function PDUViewDialog({ unit, rack, allUnits, onClose }: {
  unit: RackUnit; rack: Rack; allUnits: RackUnit[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: pduData } = useQuery({
    queryKey: ['pdu', { rack_unit: unit.id }],
    queryFn:  () => pdusApi.list({ rack_unit: String(unit.id) }),
    select:   r => r.data[0] ?? null,
  })
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: unit.label || `PDU U${unit.position_u}`, pdu_type:'basic', outlet_type:'c13', outlet_count:8, max_ampere:16, voltage:230, manufacturer:'', model_name:'' })

  const createMut = useMutation({
    mutationFn: () => pdusApi.create({ ...form, rack_unit: unit.id }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['pdu'] }); qc.invalidateQueries({ queryKey: ['racks'] }); setCreating(false); toast.success('PDU utworzone') },
    onError:    () => toast.error('Błąd tworzenia PDU'),
  })
  const assignMut = useMutation({
    mutationFn: ({ outletId, rackUnitId }: { outletId: number; rackUnitId: number | null }) =>
      pduOutletsApi.update(outletId, { rack_unit: rackUnitId ?? undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdu'] }),
  })
  const deletePduMut = useMutation({
    mutationFn: (id: number) => pdusApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['pdu'] }); qc.invalidateQueries({ queryKey: ['racks'] }); toast.success('PDU usunięte') },
  })

  const deviceUnits = allUnits.filter(u => u.item_type === 'device' || u.item_type === 'ups')

  if (!pduData && !creating) return (
    <div className="space-y-4">
      <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-xs flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-orange-500"/>
        <span className="text-orange-700">Slot <strong>U{unit.position_u}</strong> — nie skonfigurowano szczegółów PDU.</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-xs text-primary-foreground hover:bg-primary/90">
          <Zap className="h-3.5 w-3.5"/> Skonfiguruj PDU
        </button>
        <button onClick={onClose} className="rounded border border-border px-3 py-2 text-xs hover:bg-accent">Zamknij</button>
      </div>
    </div>
  )

  if (creating) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[{ l:'Nazwa PDU',f:'name',t:'text' },{ l:'Producent',f:'manufacturer',t:'text' },{ l:'Model',f:'model_name',t:'text' }].map(({ l,f,t }) => (
          <div key={f}>
            <label className="text-[10px] text-muted-foreground block mb-0.5">{l}</label>
            <input type={t} value={(form as Record<string,string|number>)[f] as string}
              onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
          </div>
        ))}
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Typ PDU</label>
          <select value={form.pdu_type} onChange={e => setForm(p => ({ ...p, pdu_type: e.target.value }))}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
            {PDU_TYPE_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Typ gniazd</label>
          <select value={form.outlet_type} onChange={e => setForm(p => ({ ...p, outlet_type: e.target.value }))}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
            {OUTLET_TYPE_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Liczba gniazd</label>
          <input type="number" min={1} max={48} value={form.outlet_count}
            onChange={e => setForm(p => ({ ...p, outlet_count: Number(e.target.value) }))}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Maks. prąd [A]</label>
          <input type="number" min={1} max={64} value={form.max_ampere}
            onChange={e => setForm(p => ({ ...p, max_ampere: Number(e.target.value) }))}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
        </div>
      </div>
      <div className="flex gap-2 justify-end border-t border-border pt-2">
        <button onClick={() => setCreating(false)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">Utwórz PDU</button>
      </div>
    </div>
  )

  const pdu = pduData!
  const usedPct = Math.round((pdu.used_outlets / pdu.outlet_count) * 100)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-xs">
        {[{ l:'Typ',v:pdu.pdu_type_display },{ l:'Gniazda',v:pdu.outlet_type_display },{ l:'Maks.',v:`${pdu.max_ampere}A / ${pdu.voltage}V` },{ l:'Producent',v:pdu.manufacturer||'—' },{ l:'Model',v:pdu.model_name||'—' },{ l:'Zajęte',v:`${pdu.used_outlets}/${pdu.outlet_count}` }].map(({ l,v }) => (
          <div key={l} className="rounded bg-muted/30 px-2 py-1.5">
            <div className="text-[9px] text-muted-foreground mb-0.5">{l}</div>
            <div className="font-medium text-foreground">{v}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${usedPct}%` }}/>
        </div>
        <span className="text-[10px] text-muted-foreground">{usedPct}% zajęte</span>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Gniazda ({pdu.outlet_count}× {pdu.outlet_type_display})</p>
        <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
          {pdu.outlets.map(outlet => {
            const assigned = !!outlet.rack_unit
            return (
              <div key={outlet.id} className={cn('group rounded-lg border px-2.5 py-2 text-xs transition-all',
                assigned ? 'border-orange-300/60 bg-orange-50' : 'border-border/50 bg-muted/20')}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0 text-[9px] font-bold',
                    assigned ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground')}>
                    {outlet.outlet_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    {assigned ? <span className="font-medium text-foreground truncate block">{outlet.rack_unit_label}</span>
                               : <span className="text-muted-foreground">Wolne</span>}
                  </div>
                  {assigned && (
                    <button onClick={() => assignMut.mutate({ outletId: outlet.id, rackUnitId: null })}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded transition-all">
                      <X className="h-3 w-3 text-muted-foreground"/>
                    </button>
                  )}
                </div>
                {!assigned && deviceUnits.length > 0 && (
                  <select value="" onChange={e => { if (e.target.value) assignMut.mutate({ outletId: outlet.id, rackUnitId: Number(e.target.value) }) }}
                    className="w-full rounded border border-input bg-background px-1.5 py-0.5 text-[10px] mt-0.5">
                    <option value="">+ przypisz urządzenie</option>
                    {deviceUnits.map(u => <option key={u.id} value={u.id}>U{u.position_u} — {u.host_name || u.label || 'Device'}</option>)}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex justify-between pt-1 border-t border-border">
        <button onClick={() => { if (window.confirm(`Usunąć PDU "${pdu.name}"?`)) deletePduMut.mutate(pdu.id) }}
          className="text-xs text-destructive/70 hover:text-destructive flex items-center gap-1">
          <ZapOff className="h-3.5 w-3.5"/> Usuń konfigurację PDU
        </button>
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Zamknij</button>
      </div>
    </div>
  )
}

// ─── Add unit dialog ──────────────────────────────────────────────────────────

const ITEM_TYPES = [
  { v:'device',l:'Device / Host' },{ v:'patch_panel',l:'Patch Panel' },{ v:'cable_mgmt',l:'Cable Mgmt' },
  { v:'blank',l:'Blank Panel' },{ v:'pdu',l:'PDU' },{ v:'ups',l:'UPS' },{ v:'other',l:'Other' },
]

function AddUnitDialog({ rack, positionU, freeSlots, hosts, panels, onClose }: {
  rack: Rack; positionU: number; freeSlots: number
  hosts: { id: number; name: string; ip: string }[]
  panels: { id: number; name: string }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [itemType, setItemType] = useState('device')
  const [hostId, setHostId]     = useState('')
  const [panelId, setPanelId]   = useState('')
  const [label, setLabel]       = useState('')
  const [heightU, setHeightU]   = useState(1)
  const [face, setFace]         = useState<'front' | 'rear'>('front')

  const mut = useMutation({
    mutationFn: () => rackUnitsApi.create({
      rack: rack.id, item_type: itemType as RackUnit['item_type'],
      position_u: positionU, height_u: heightU, face, label,
      host: itemType === 'device' && hostId ? Number(hostId) : undefined,
      patch_panel: itemType === 'patch_panel' && panelId ? Number(panelId) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['racks'] }); toast.success('Dodano'); onClose() },
    onError:   () => toast.error('Błąd dodawania'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded bg-muted/40 border border-border px-3 py-2 text-xs flex items-center gap-2">
        <span className="font-mono font-bold text-primary">U{positionU}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{freeSlots}U wolne</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Typ</label>
          <select value={itemType} onChange={e => setItemType(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
            {ITEM_TYPES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Wysokość (U)</label>
          <input type="number" min={1} max={Math.min(freeSlots, 20)} value={heightU}
            onChange={e => setHeightU(Number(e.target.value))}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
        </div>
      </div>
      {itemType === 'device' && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Host</label>
          <select value={hostId} onChange={e => setHostId(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
            <option value="">— Niezarządzane —</option>
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name} ({h.ip})</option>)}
          </select>
        </div>
      )}
      {itemType === 'patch_panel' && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Patch Panel</label>
          {panels.length === 0
            ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 flex items-center gap-1"><AlertCircle className="h-3 w-3"/>Brak paneli</p>
            : <select value={panelId} onChange={e => setPanelId(e.target.value)}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                <option value="">— Wybierz panel —</option>
                {panels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
          }
        </div>
      )}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Etykieta {itemType !== 'device' || !hostId ? '*' : '(opcjonalna)'}</label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="np. Core Switch 01"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Strona</label>
        <div className="flex gap-2">
          {(['front', 'rear'] as const).map(f => (
            <button key={f} onClick={() => setFace(f)}
              className={cn('flex-1 rounded border py-1.5 text-xs transition-colors',
                face === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent')}>
              {f === 'front' ? 'Przód' : 'Tył'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
          {mut.isPending ? 'Dodawanie…' : 'Dodaj do szafy'}
        </button>
      </div>
    </div>
  )
}

// ─── Ghost drag element ───────────────────────────────────────────────────────

function DragGhost({ unit, x, y }: { unit: RackUnit; x: number; y: number }) {
  const cfg  = TYPE_CFG[unit.item_type] ?? TYPE_CFG.other
  const name = unit.host_name || unit.patch_panel_name || unit.label || cfg.label
  return (
    <div className="fixed pointer-events-none z-[9998]" style={{ left: x + 12, top: y - 14, width: 220 }}>
      <div className="flex items-center gap-2 px-3 rounded-lg shadow-2xl border-2 text-xs font-medium"
        style={{ height: U_PX * unit.height_u, background: cfg.bg, borderColor: cfg.accent, opacity: 0.92 }}>
        <cfg.icon className="h-3.5 w-3.5 shrink-0" style={{ color: cfg.accent }}/>
        <span className="truncate" style={{ color: cfg.text }}>{name}</span>
        <span className="ml-auto text-[9px] font-mono opacity-60" style={{ color: cfg.accent }}>{unit.height_u}U</span>
      </div>
    </div>
  )
}

// ─── Główny komponent ─────────────────────────────────────────────────────────

interface Props {
  rack: Rack
  hosts: { id: number; name: string; ip: string }[]
  panels: { id: number; name: string }[]
}

export function RackElevation({ rack, hosts, panels }: Props) {
  const qc = useQueryClient()

  // UI state
  const [addAt, setAddAt]       = useState<number | null>(null)
  const [pduUnit, setPduUnit]   = useState<RackUnit | null>(null)
  const [tooltip, setTooltip]   = useState<{ unit: RackUnit; x: number; y: number } | null>(null)
  const tooltipTimer            = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Zoom/scale state
  const RACK_W      = 296
  const [scale, setScale] = useState(1)
  const containerRef      = useRef<HTMLDivElement>(null)
  const rackContentRef    = useRef<HTMLDivElement>(null)

  // Auto-fit on mount and when rack changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const fit = () => {
      const availW = el.clientWidth
      if (availW > 0 && RACK_W > 0) {
        const s = Math.min(1, (availW - 8) / RACK_W)
        setScale(Math.round(s * 100) / 100)
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const clampScale = (s: number) => Math.min(2, Math.max(0.3, s))

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setScale(prev => clampScale(prev - e.deltaY * 0.001))
  }, [])

  // Drag state
  const [dragging, setDragging]     = useState<RackUnit | null>(null)
  const [dragOverU, setDragOverU]   = useState<number | null>(null)
  const [ghostPos, setGhostPos]     = useState({ x: 0, y: 0 })
  const isDragging                  = useRef(false)
  const dragUnitRef                 = useRef<RackUnit | null>(null)
  const mouseDownPos                = useRef({ x: 0, y: 0 })

  const deleteMut = useMutation({
    mutationFn: (id: number) => rackUnitsApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['racks'] }); toast.success('Usunięto') },
  })
  const moveMut = useMutation({
    mutationFn: ({ id, position_u }: { id: number; position_u: number }) => rackUnitsApi.move(id, position_u),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['racks'] }); toast.success('Przeniesiono') },
    onError:    (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Nie można przenieść — slot zajęty')
    },
  })

  const slotMap = useMemo(() => {
    const m = new Map<number, RackUnit>()
    for (const u of rack.rack_units)
      for (let i = 0; i < u.height_u; i++) m.set(u.position_u + i, u)
    return m
  }, [rack.rack_units])

  const rows = useMemo(() => {
    const rendered = new Set<number>()
    const result: { u: number; unit: RackUnit | null }[] = []
    const uRange = rack.numbering_desc
      ? Array.from({ length: rack.height_u }, (_, i) => rack.height_u - i)
      : Array.from({ length: rack.height_u }, (_, i) => i + 1)
    for (const u of uRange) {
      const unit = slotMap.get(u) ?? null
      if (unit) { if (rendered.has(unit.id)) continue; rendered.add(unit.id) }
      result.push({ u, unit })
    }
    return result
  }, [rack, slotMap])

  const freeFrom = (u: number) => {
    let n = 0
    for (let i = u; i <= rack.height_u; i++) { if (!slotMap.has(i)) n++; else break }
    return n
  }

  // Tooltip
  const showTT = (unit: RackUnit, e: React.MouseEvent) => {
    if (isDragging.current) return
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    tooltipTimer.current = setTimeout(() => setTooltip({ unit, x: e.clientX, y: e.clientY }), 220)
  }
  const moveTT = (e: React.MouseEvent) => {
    if (isDragging.current) { setTooltip(null); return }
    if (tooltip) setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)
  }
  const hideTT = () => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); setTooltip(null) }
  useEffect(() => () => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current) }, [])

  // ── Mouse drag handlers ────────────────────────────────────────────────────

  // Global mousemove + mouseup
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragUnitRef.current) return
      const dx = Math.abs(e.clientX - mouseDownPos.current.x)
      const dy = Math.abs(e.clientY - mouseDownPos.current.y)
      if (!isDragging.current && (dx > 4 || dy > 4)) {
        isDragging.current = true
        setDragging(dragUnitRef.current)
        setTooltip(null)
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
      }
      if (isDragging.current) {
        setGhostPos({ x: e.clientX, y: e.clientY })
      }
    }
    const onMouseUp = () => {
      if (!dragUnitRef.current) return
      if (isDragging.current && dragOverU !== null && dragUnitRef.current) {
        const unit = dragUnitRef.current
        if (dragOverU !== unit.position_u) {
          // Frontend collision check
          let canMove = true
          for (let i = 0; i < unit.height_u; i++) {
            const s = dragOverU + i
            const occ = slotMap.get(s)
            if ((occ && occ.id !== unit.id) || s < 1 || s > rack.height_u) { canMove = false; break }
          }
          if (canMove) {
            moveMut.mutate({ id: unit.id, position_u: dragOverU })
          } else {
            toast.error('Nie można przenieść — slot zajęty')
          }
        }
      }
      isDragging.current = false
      dragUnitRef.current = null
      setDragging(null)
      setDragOverU(null)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragOverU, slotMap, rack.height_u, moveMut])

  const onMouseDownUnit = useCallback((e: React.MouseEvent, unit: RackUnit) => {
    if (e.button !== 0) return
    // Don't start drag if clicking on a button inside
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    mouseDownPos.current = { x: e.clientX, y: e.clientY }
    dragUnitRef.current  = unit
    setGhostPos({ x: e.clientX, y: e.clientY })
  }, [])

  const onMouseEnterSlot = useCallback((u: number) => {
    if (isDragging.current) setDragOverU(u)
  }, [])

  const onMouseLeaveSlot = useCallback(() => {
    // Keep last dragOverU while hovering intermediate elements
  }, [])

  // Stats
  const freeU   = rack.height_u - rack.used_u
  const utilPct = rack.height_u > 0 ? (rack.used_u / rack.height_u) * 100 : 0
  const utilClr = utilPct > 90 ? '#ef4444' : utilPct > 70 ? '#f59e0b' : '#22c55e'

  // Visual height of rack content: top bar (20) + rows + bottom bar (20) + borders
  const rackVisualH = 20 + rack.height_u * U_PX + 20 + 4

  return (
    <div ref={containerRef} className="w-full" onWheel={onWheel}>

      {/* ── Nagłówek ── */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate flex-1">{rack.name}</span>
          {rack.facility_id && (
            <span className="text-[10px] font-mono bg-muted border border-border/60 rounded px-1.5 py-0.5 shrink-0">{rack.facility_id}</span>
          )}
          <span className={cn('text-[10px] rounded-full px-2 py-0.5 font-medium capitalize shrink-0',
            rack.status === 'active' ? 'bg-emerald-500/15 text-emerald-600' :
            rack.status === 'planned' ? 'bg-blue-500/15 text-blue-600' : 'bg-muted text-muted-foreground',
          )}>{rack.status}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className={cn('font-medium', freeU > 0 ? 'text-emerald-600' : 'text-red-500')}>{freeU}U wolne</span>
          <span className="text-muted-foreground/40">·</span>
          <ResizeBar rack={rack}/>
          <span className="text-muted-foreground/40 ml-auto">·</span>
          {/* Zoom controls */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setScale(prev => clampScale(prev - 0.1))}
              className="w-5 h-5 rounded border border-border flex items-center justify-center text-muted-foreground hover:bg-accent text-xs font-bold leading-none"
              title="Oddal (Ctrl+scroll)">−</button>
            <button
              onClick={() => {
                const el = containerRef.current
                if (!el) return
                const s = Math.min(1, (el.clientWidth - 8) / RACK_W)
                setScale(Math.round(s * 100) / 100)
              }}
              className="min-w-[3rem] h-5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:bg-accent px-1"
              title="Dopasuj do ekranu">{Math.round(scale * 100)}%</button>
            <button
              onClick={() => setScale(prev => clampScale(prev + 0.1))}
              className="w-5 h-5 rounded border border-border flex items-center justify-center text-muted-foreground hover:bg-accent text-xs font-bold leading-none"
              title="Przybliż (Ctrl+scroll)">+</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${utilPct}%`, backgroundColor: utilClr }}/>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{Math.round(utilPct)}%</span>
        </div>
      </div>

      {/* ── Szafa ── */}
      {/* Outer div reserves space equal to scaled height so page scroll works correctly */}
      <div style={{ height: rackVisualH * scale, width: Math.max(RACK_W * scale, containerRef.current?.clientWidth ?? 0) }}>
      <div
        ref={rackContentRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: RACK_W,
        }}
      >
      <div className="rounded-xl overflow-hidden select-none"
        style={{ background:'#f8fafc', border:'2px solid #cbd5e1', boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
        {/* Górna listwa */}
        <div className="h-5 flex items-center justify-between px-3"
          style={{ background:'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)', borderBottom:'1px solid #94a3b8' }}>
          <div className="flex gap-2">{[0,1,2,3].map(i => <div key={i} className="rounded-sm" style={{ width:8,height:4,background:'#94a3b8' }}/>)}</div>
          <span style={{ fontSize:9,color:'#94a3b8',fontFamily:'monospace' }}>{rack.name}</span>
          <div className="flex gap-2">{[0,1,2,3].map(i => <div key={i} className="rounded-sm" style={{ width:8,height:4,background:'#94a3b8' }}/>)}</div>
        </div>

        <div className="flex">
          {/* U-rail */}
          <div className="flex flex-col shrink-0" style={{ width:30,background:'#f1f5f9',borderRight:'1px solid #e2e8f0' }}>
            {rows.map(({ u, unit }) => (
              <div key={u} className="flex items-center justify-center shrink-0"
                style={{ height:(unit?.height_u??1)*U_PX, fontSize:9, fontFamily:'monospace', color:'#94a3b8', borderBottom:'1px solid #e2e8f0' }}>
                {u}
              </div>
            ))}
          </div>

          {/* Sloty */}
          <div className="flex flex-col flex-1 min-w-0">
            {rows.map(({ u, unit }) => {
              const h      = (unit?.height_u ?? 1) * U_PX
              const isOver = dragging !== null && dragOverU === u
              const isSrc  = dragging?.id === unit?.id

              if (unit) {
                const cfg  = TYPE_CFG[unit.item_type] ?? TYPE_CFG.other
                const name = unit.host_name || unit.patch_panel_name || unit.label || cfg.label
                const isPDU = unit.item_type === 'pdu'

                return (
                  <div key={u}
                    onMouseDown={e => onMouseDownUnit(e, unit)}
                    onMouseEnter={() => { onMouseEnterSlot(u); if (!dragging) showTT(unit, { clientX: 0, clientY: 0 } as React.MouseEvent) }}
                    onMouseMove={e => { if (!isDragging.current) moveTT(e) }}
                    onMouseLeave={() => { onMouseLeaveSlot(); hideTT() }}
                    className={cn('group relative flex items-center gap-2 px-2.5 shrink-0 transition-all duration-100',
                      isSrc && 'opacity-30',
                      isOver && !isSrc && 'ring-2 ring-inset ring-blue-400/70',
                    )}
                    style={{
                      height: h,
                      background: isOver && !isSrc ? cfg.accent + '20' : cfg.bg,
                      borderLeft: `3px solid ${cfg.accent}`,
                      borderBottom: '1px solid #e2e8f0',
                      cursor: dragging ? 'grabbing' : 'grab',
                    }}
                  >
                    <GripVertical className="h-3 w-3 shrink-0 opacity-25 group-hover:opacity-60" style={{ color: cfg.accent }}/>
                    <cfg.icon className="h-3.5 w-3.5 shrink-0" style={{ color: cfg.accent }}/>
                    <span className="text-[11px] font-medium truncate flex-1" style={{ color: cfg.text }}>{name}</span>
                    {unit.host_ip && !dragging && (
                      <span className="text-[9px] font-mono opacity-0 group-hover:opacity-50 shrink-0 pr-6" style={{ color:'#64748b' }}>{unit.host_ip}</span>
                    )}
                    {isPDU && !dragging && (
                      <button className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100"
                        style={{ background:'rgba(234,88,12,0.15)' }}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); hideTT(); setPduUnit(unit) }}
                        title="Zarządzaj PDU">
                        <Zap className="h-3 w-3 text-orange-500"/>
                      </button>
                    )}
                    <button
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100"
                      style={{ background:'rgba(248,250,252,0.9)' }}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); hideTT(); if (window.confirm(`Usunąć "${name}"?`)) deleteMut.mutate(unit.id) }}>
                      <X className="h-3 w-3" style={{ color:'#64748b' }}/>
                    </button>
                  </div>
                )
              }

              // Pusty slot
              return (
                <div key={u}
                  onMouseEnter={() => onMouseEnterSlot(u)}
                  onMouseLeave={onMouseLeaveSlot}
                  onClick={() => { if (!dragging && !isDragging.current) setAddAt(u) }}
                  className="group relative flex items-center justify-center shrink-0 transition-all"
                  style={{
                    height: h,
                    borderBottom: '1px solid #e2e8f0',
                    background: isOver ? 'rgba(59,130,246,0.08)' : 'transparent',
                    outline: isOver ? '2px solid rgba(59,130,246,0.35)' : 'none',
                    outlineOffset: '-2px',
                    cursor: dragging ? 'copy' : 'pointer',
                  }}
                >
                  {!dragging && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-3 w-3" style={{ color:'#94a3b8' }}/>
                      <span style={{ fontSize:9, color:'#94a3b8', fontFamily:'monospace' }}>U{u}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Prawa szyna */}
          <div className="shrink-0" style={{ width:10,background:'#f1f5f9',borderLeft:'1px solid #e2e8f0' }}/>
        </div>

        {/* Dolna listwa */}
        <div className="h-5 flex items-center px-3"
          style={{ background:'linear-gradient(0deg, #e2e8f0 0%, #cbd5e1 100%)', borderTop:'1px solid #94a3b8' }}>
          <div className="flex gap-2">{[0,1,2,3].map(i => <div key={i} className="rounded-sm" style={{ width:8,height:4,background:'#94a3b8' }}/>)}</div>
        </div>
      </div>
      </div>{/* end scale wrapper */}
      </div>{/* end height placeholder */}

      {/* Ghost element */}
      {dragging && <DragGhost unit={dragging} x={ghostPos.x} y={ghostPos.y}/>}

      {/* Tooltip */}
      {tooltip && !dragging && <UnitTooltip {...tooltip}/>}

      {/* Dialog dodawania */}
      <Dialog open={addAt !== null} onOpenChange={o => { if (!o) setAddAt(null) }} title={`Dodaj do szafy — U${addAt}`}>
        {addAt !== null && (
          <AddUnitDialog rack={rack} positionU={addAt} freeSlots={freeFrom(addAt)}
            hosts={hosts} panels={panels} onClose={() => setAddAt(null)}/>
        )}
      </Dialog>

      {/* Dialog PDU */}
      <Dialog open={!!pduUnit} onOpenChange={o => { if (!o) setPduUnit(null) }}
        title={`PDU — ${pduUnit?.label || `U${pduUnit?.position_u}`}`}>
        {pduUnit && <PDUViewDialog unit={pduUnit} rack={rack} allUnits={rack.rack_units} onClose={() => setPduUnit(null)}/>}
      </Dialog>
    </div>
  )
}
