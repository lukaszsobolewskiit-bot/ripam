import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  useInternalNode,
  type NodeTypes,
  type EdgeTypes,
  type EdgeProps,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hostsApi, portConnectionsApi, deviceTypesApi } from '@/api/endpoints'
import { Dialog } from '@/components/ui/Dialog'
import { PortConnectionForm } from '@/components/data/forms/PortConnectionForm'
import { ArrowLeftRight, Plus, LayoutGrid, X, ChevronRight, Server, Cable } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PortConnection } from '@/types'
import { toast } from 'sonner'

// ─── Port type colours ────────────────────────────────────────────────────────

const PORT_TYPE_META: Record<string, { color: string; label: string }> = {
  rj45:   { color: '#3b82f6', label: 'RJ45' },
  sfp:    { color: '#8b5cf6', label: 'SFP' },
  'sfp+': { color: '#a855f7', label: 'SFP+' },
  qsfp:   { color: '#ec4899', label: 'QSFP' },
  usb:    { color: '#f59e0b', label: 'USB' },
  serial: { color: '#6b7280', label: 'Serial' },
}
const portColor = (t: string) => PORT_TYPE_META[t]?.color ?? '#22c55e'

// ─── Node types ───────────────────────────────────────────────────────────────

type PortInfo = { id: number; name: string; port_type: string; connected: boolean }

type DeviceNodeData = {
  label: string
  ip: string
  model?: string
  deviceType?: string
  ports: PortInfo[]
  connectedCount: number
  isExpanded: boolean
  onToggle: () => void
}

function DeviceNode({ id, data }: { id: string; data: DeviceNodeData }) {
  const d = data as DeviceNodeData
  const isHighlighted = false // reserved for future selection logic

  return (
    <div
      className={cn(
        'w-[240px] rounded-xl border bg-card shadow-md',
        'transition-[border-color,box-shadow] duration-200',
        isHighlighted
          ? 'border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10'
          : 'border-border/60 hover:border-primary/40 hover:shadow-lg',
      )}
    >
      {/* Header handles (collapsed mode) */}
      {!d.isExpanded && (
        <>
          <Handle type="target" id="h-left"   position={Position.Left}   className="!w-2 !h-2 !border-2 !border-card" style={{ background: '#6b7280' }} />
          <Handle type="source" id="h-right"  position={Position.Right}  className="!w-2 !h-2 !border-2 !border-card" style={{ background: '#6b7280' }} />
          <Handle type="target" id="h-top"    position={Position.Top}    className="!w-1.5 !h-1.5 !opacity-0" />
          <Handle type="source" id="h-bottom" position={Position.Bottom} className="!w-1.5 !h-1.5 !opacity-0" />
        </>
      )}

      {/* Site-style header */}
      <button
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-t-xl w-full text-left',
          'bg-gradient-to-r from-primary/5 via-primary/3 to-transparent',
          'dark:from-primary/10 dark:via-primary/5 dark:to-transparent',
          'group cursor-pointer',
        )}
        onClick={(e) => { e.stopPropagation(); d.onToggle() }}
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 bg-primary/10 dark:bg-primary/20 transition-all duration-200 group-hover:scale-110">
          <Server className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate">{d.label}</span>
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-300 ease-out',
                d.isExpanded && 'rotate-90',
              )}
            />
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
            <span className="flex items-center gap-0.5 font-mono">{d.ip}</span>
            <span className="flex items-center gap-0.5">
              <Cable className="h-3 w-3" />
              {d.connectedCount} conn.
            </span>
          </div>
        </div>
      </button>

      {/* Model/type badge strip */}
      {(d.deviceType || d.model) && !d.isExpanded && (
        <div className="px-4 pb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {d.deviceType && (
            <span className="bg-muted rounded px-1.5 py-0.5 shrink-0">{d.deviceType}</span>
          )}
          {d.model && <span className="truncate">{d.model}</span>}
        </div>
      )}

      {/* Expanded port list — animated with grid-template-rows like SiteNode */}
      {d.isExpanded && d.ports.length > 0 && (
        <div className="px-3 pb-3 border-t border-border/30 pt-2 space-y-0.5">
          {d.ports.map((port, idx) => {
            const color = portColor(port.port_type)
            return (
              <div
                key={port.id}
                className={cn(
                  'relative flex items-center gap-2 rounded-md px-2 py-1.5',
                  'border border-border/50 bg-muted/20',
                  'opacity-0 animate-[vlan-slide-in_0.2s_ease-out_forwards]',
                )}
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                {/* Per-port handles */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`pt-${port.id}`}
                  style={{ background: color, width: 8, height: 8, border: '2px solid hsl(var(--card))', top: '50%' }}
                />
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="font-mono text-[11px] font-semibold flex-1 truncate">{port.name}</span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ color, background: color + '22' }}
                >
                  {port.port_type.toUpperCase()}
                </span>
                {port.connected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 dark:bg-green-500 shrink-0" title="Connected" />
                )}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`ps-${port.id}`}
                  style={{ background: color, width: 8, height: 8, border: '2px solid hsl(var(--card))', top: '50%' }}
                />
              </div>
            )
          })}
        </div>
      )}

      {d.isExpanded && d.ports.length === 0 && (
        <div className="px-4 py-2 text-[10px] text-muted-foreground italic border-t border-border/30">
          No ports defined
        </div>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = { deviceNode: DeviceNode as never }

// ─── Connection edge — floating, animated like TunnelEdge ────────────────────

function getNodeIntersection(
  node: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number },
) {
  const w = node.width / 2, h = node.height / 2
  const cx = node.x + w, cy = node.y + h
  const dx = target.x - cx, dy = target.y - cy
  if (!dx && !dy) return { x: cx, y: cy }
  if (Math.abs(dx) * h > Math.abs(dy) * w) {
    const sx = dx > 0 ? 1 : -1
    return { x: cx + sx * w, y: cy + (dy * w) / Math.abs(dx) }
  }
  const sy = dy > 0 ? 1 : -1
  return { x: cx + (dx * h) / Math.abs(dy), y: cy + sy * h }
}

function getEdgePos(node: { x: number; y: number; width: number; height: number }, pt: { x: number; y: number }) {
  const dx = pt.x - (node.x + node.width / 2)
  const dy = pt.y - (node.y + node.height / 2)
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? Position.Right : Position.Left
  return dy > 0 ? Position.Bottom : Position.Top
}

function ConnectionEdge({ id, source, target, data, sourceHandle, targetHandle }: EdgeProps) {
  const d = data as { portA?: string; portB?: string; color?: string; isSelected?: boolean; usePortHandles?: boolean }
  const srcNode = useInternalNode(source)
  const tgtNode = useInternalNode(target)

  const { sx, sy, tx, ty, sp, tp } = useMemo(() => {
    if (!srcNode || !tgtNode) return { sx: 0, sy: 0, tx: 0, ty: 0, sp: Position.Right, tp: Position.Left }
    const sr = {
      x: srcNode.internals.positionAbsolute.x,
      y: srcNode.internals.positionAbsolute.y,
      width: srcNode.measured.width ?? 240,
      height: srcNode.measured.height ?? 80,
    }
    const tr = {
      x: tgtNode.internals.positionAbsolute.x,
      y: tgtNode.internals.positionAbsolute.y,
      width: tgtNode.measured.width ?? 240,
      height: tgtNode.measured.height ?? 80,
    }
    const si = getNodeIntersection(sr, { x: tr.x + tr.width / 2, y: tr.y + tr.height / 2 })
    const ti = getNodeIntersection(tr, { x: sr.x + sr.width / 2, y: sr.y + sr.height / 2 })
    return { sx: si.x, sy: si.y, tx: ti.x, ty: ti.y, sp: getEdgePos(sr, si), tp: getEdgePos(tr, ti) }
  }, [srcNode, tgtNode])

  if (!srcNode || !tgtNode) return null

  const color = d?.color ?? '#22c55e'
  const [path, lx, ly] = getBezierPath({ sourceX: sx, sourceY: sy, sourcePosition: sp, targetX: tx, targetY: ty, targetPosition: tp })
  const strokeWidth = d?.isSelected ? 2.5 : 1.5

  return (
    <>
      {/* Glow for selected */}
      {d?.isSelected && (
        <BaseEdge
          id={`${id}-glow`}
          path={path}
          style={{ stroke: color, strokeWidth: 8, opacity: 0.15, filter: 'blur(4px)' }}
        />
      )}

      {/* Main line with animated flow */}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: '8 4',
          opacity: 0.9,
        }}
      />

      {/* Flow animation */}
      <BaseEdge
        id={`${id}-flow`}
        path={path}
        style={{
          stroke: color,
          strokeWidth: strokeWidth - 0.5,
          strokeDasharray: '4 8',
          opacity: 0.55,
          animation: 'dash-flow 2s linear infinite',
        }}
      />

      {/* Label badge at midpoint */}
      <EdgeLabelRenderer>
        {d?.portA && d?.portB && (
          <div
            className="absolute pointer-events-none"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          >
            <div
              className="rounded-md border bg-card/95 backdrop-blur-sm px-2 py-0.5 text-[9px] font-mono shadow-sm flex items-center gap-1 whitespace-nowrap"
              style={{ borderColor: color }}
            >
              <span style={{ color }}>{d.portA}</span>
              <span className="text-muted-foreground">—</span>
              <span style={{ color }}>{d.portB}</span>
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes: EdgeTypes = { connectionEdge: ConnectionEdge as never }

// ─── Legend (same style as TunnelLegend) ─────────────────────────────────────

function PortTypeLegend({ types }: { types: Set<string> }) {
  if (!types.size) return null
  return (
    <Panel position="bottom-right">
      <div className="rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-2 shadow-sm">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Port types</div>
        <div className="space-y-1">
          {Array.from(types).map(t => (
            <div key={t} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: portColor(t) }} />
              <span>{PORT_TYPE_META[t]?.label ?? t.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

// ─── Stats panel (same style as TopologyStats) ────────────────────────────────

function ConnectionStats({ connections, devices }: { connections: number; devices: number }) {
  return (
    <Panel position="top-left">
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-1.5 shadow-sm text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Server className="h-3 w-3" />
          {devices}
        </span>
        <span className="flex items-center gap-1">
          <ArrowLeftRight className="h-3 w-3" />
          {connections}
        </span>
      </div>
    </Panel>
  )
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function circleLayout(n: number) {
  if (n === 1) return [{ x: 300, y: 300 }]
  if (n === 2) return [{ x: 100, y: 250 }, { x: 500, y: 250 }]
  const r = Math.max(250, n * 90)
  return Array.from({ length: n }, (_, i) => ({
    x: Math.cos((2 * Math.PI * i) / n - Math.PI / 2) * r + r + 100,
    y: Math.sin((2 * Math.PI * i) / n - Math.PI / 2) * r + r + 100,
  }))
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { projectId: number }

export function PortConnectionsTopology({ projectId }: Props) {
  return <ReactFlowProvider><Inner projectId={projectId} /></ReactFlowProvider>
}

function Inner({ projectId }: Props) {
  const queryClient = useQueryClient()
  const { fitView } = useReactFlow()
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<PortConnection | null>(null)
  const posRef = useRef<Record<string, { x: number; y: number }>>({})
  const [dtMap, setDtMap] = useState<Record<string, string>>({})
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const { data: hosts } = useQuery({
    queryKey: ['hosts', { project: projectId }],
    queryFn: () => hostsApi.list({ project: String(projectId), page_size: '500' }),
    select: (res) => res.data.results,
  })

  const { data: connections } = useQuery({
    queryKey: ['port-connections-all', projectId],
    queryFn: () => portConnectionsApi.list({ project: String(projectId) }),
    select: (res) => res.data,
  })

  const { data: dtData } = useQuery({
    queryKey: ['device-types'],
    queryFn: () => deviceTypesApi.list(),
    select: (res) => res.data,
  })

  useEffect(() => {
    if (dtData) {
      const m: Record<string, string> = {}
      for (const dt of dtData) m[dt.value] = dt.label
      setDtMap(m)
    }
  }, [dtData])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => portConnectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-connections-all'] })
      queryClient.invalidateQueries({ queryKey: ['host-ports'] })
      setSelected(null)
      toast.success('Connection deleted')
    },
  })

  const connectedHostIds = useMemo(() => {
    const s = new Set<number>()
    for (const c of (connections ?? [])) { s.add(c.host_a_id); s.add(c.host_b_id) }
    return s
  }, [connections])

  const visibleHosts = useMemo(
    () => (hosts ?? []).filter(h => connectedHostIds.has(h.id)),
    [hosts, connectedHostIds]
  )

  const usedTypes = useMemo(() => {
    const s = new Set<string>()
    for (const c of (connections ?? [])) s.add(c.port_a_type)
    return s
  }, [connections])

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const n = new Set(prev)
      n.has(nodeId) ? n.delete(nodeId) : n.add(nodeId)
      return n
    })
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (!visibleHosts.length) { setNodes([]); setEdges([]); return }

    if (visibleHosts.some(h => !posRef.current[String(h.id)])) {
      const layout = circleLayout(visibleHosts.length)
      visibleHosts.forEach((h, i) => {
        if (!posRef.current[String(h.id)]) posRef.current[String(h.id)] = layout[i]
      })
    }

    const connPortIds = new Set<number>()
    for (const c of (connections ?? [])) { connPortIds.add(c.port_a); connPortIds.add(c.port_b) }
    const selId = selected ? String(selected.id) : null

    const newNodes = visibleHosts.map(h => {
      const nodeId = String(h.id)
      const isExpanded = expandedNodes.has(nodeId)
      const ports: PortInfo[] = (h.ports ?? []).map(p => ({
        id: p.id, name: p.name, port_type: p.port_type,
        connected: connPortIds.has(p.id),
      }))
      return {
        id: nodeId, type: 'deviceNode',
        position: { ...posRef.current[nodeId] },
        data: {
          label: h.hostname || h.ip_address.split('/')[0],
          ip: h.ip_address.split('/')[0],
          model: h.device_model_name ?? undefined,
          deviceType: h.device_type ? (dtMap[h.device_type] ?? h.device_type) : undefined,
          ports, connectedCount: ports.filter(p => p.connected).length,
          isExpanded, onToggle: () => toggleNode(nodeId),
        } as DeviceNodeData,
      }
    })

    const newEdges = (connections ?? []).map(c => {
      const color = portColor(c.port_a_type)
      const srcExp = expandedNodes.has(String(c.host_a_id))
      const tgtExp = expandedNodes.has(String(c.host_b_id))
      return {
        id: String(c.id),
        source: String(c.host_a_id),
        target: String(c.host_b_id),
        sourceHandle: srcExp ? `ps-${c.port_a}` : undefined,
        targetHandle: tgtExp ? `pt-${c.port_b}` : undefined,
        type: 'connectionEdge',
        data: {
          portA: c.port_a_name, portB: c.port_b_name, color,
          isSelected: selId === String(c.id),
        },
      }
    })

    setNodes(newNodes as never)
    setEdges(newEdges as never)
  }, [visibleHosts, connections, selected, dtMap, expandedNodes, toggleNode])

  const onNodeDragStop = useCallback((_: never, node: { id: string; position: { x: number; y: number } }) => {
    posRef.current[node.id] = { ...node.position }
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: { id: string }) => {
    const c = (connections ?? []).find(x => String(x.id) === edge.id)
    setSelected(c ?? null)
  }, [connections])

  if (!(connections?.length) && !(hosts?.length)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto">
            <ArrowLeftRight className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-medium">No port connections yet</p>
          <p className="text-sm text-muted-foreground">Connect device ports to visualize the physical topology.</p>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Connection
          </button>
          <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add Port Connection">
            <PortConnectionForm projectId={projectId} onClose={() => setAddOpen(false)} />
          </Dialog>
        </div>
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop as never}
      onEdgeClick={onEdgeClick as never}
      onPaneClick={() => setSelected(null)}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.08}
      maxZoom={3}
      className="bg-background"
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="!text-border/40" />
      <Controls className="!bg-card !border-border/50 !shadow-md !rounded-lg [&>button]:!bg-card [&>button]:!border-border/50 [&>button]:!text-foreground [&>button:hover]:!bg-accent [&>button>svg]:!fill-foreground" />

      <ConnectionStats connections={connections?.length ?? 0} devices={visibleHosts.length} />
      <PortTypeLegend types={usedTypes} />

      {/* Toolbar — same style as TopologyToolbar */}
      <Panel position="top-right">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Connection
          </button>
          <button
            onClick={() => fitView({ padding: 0.25, duration: 400 })}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Fit View
          </button>
          {expandedNodes.size > 0 && (
            <button
              onClick={() => setExpandedNodes(new Set())}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm hover:bg-accent transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Collapse all
            </button>
          )}
        </div>
      </Panel>

      {/* Selected connection detail — floating bottom bar */}
      {selected && (
        <Panel position="bottom-center">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg text-xs max-w-xl">
            <span
              className="w-3 h-3 rounded-full shrink-0 border-2 border-card shadow-sm"
              style={{ backgroundColor: portColor(selected.port_a_type) }}
            />
            <span className="font-mono font-semibold" style={{ color: portColor(selected.port_a_type) }}>
              {selected.host_a_name}
            </span>
            <span className="font-mono text-muted-foreground text-[10px]">/{selected.port_a_name}</span>
            <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-mono font-semibold" style={{ color: portColor(selected.port_b_type) }}>
              {selected.host_b_name}
            </span>
            <span className="font-mono text-muted-foreground text-[10px]">/{selected.port_b_name}</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0 uppercase">
              {selected.port_a_type}
            </span>
            {selected.description && (
              <span className="italic text-muted-foreground truncate max-w-[80px] text-[10px]">{selected.description}</span>
            )}
            <div className="flex gap-1 ml-1">
              <button
                onClick={() => setAddOpen(true)}
                className="rounded border border-border px-2 py-0.5 hover:bg-accent transition-colors"
              >Edit</button>
              <button
                onClick={() => { if (window.confirm('Delete this connection?')) deleteMutation.mutate(selected.id) }}
                className="rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10"
              >Delete</button>
            </div>
            <button onClick={() => setSelected(null)} className="ml-1">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </Panel>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(o) => { setAddOpen(o); if (!o) setSelected(null) }}
        title={selected ? 'Edit Connection' : 'Add Port Connection'}
      >
        <PortConnectionForm
          projectId={projectId}
          connection={selected ?? undefined}
          onClose={() => { setAddOpen(false); setSelected(null) }}
        />
      </Dialog>
    </ReactFlow>
  )
}
