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
  getStraightPath,
  Handle,
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
import { ArrowLeftRight, Plus, LayoutGrid, X, ChevronDown, ChevronRight } from 'lucide-react'
import type { PortConnection } from '@/types'
import { toast } from 'sonner'

// ─── Port type colours ────────────────────────────────────────────────────────

const PORT_TYPE_COLORS: Record<string, { stroke: string; label: string }> = {
  rj45:   { stroke: '#3b82f6', label: 'RJ45' },
  sfp:    { stroke: '#8b5cf6', label: 'SFP' },
  'sfp+': { stroke: '#a855f7', label: 'SFP+' },
  qsfp:   { stroke: '#ec4899', label: 'QSFP' },
  usb:    { stroke: '#f59e0b', label: 'USB' },
  serial: { stroke: '#6b7280', label: 'Serial' },
}
const portColor = (t: string) => PORT_TYPE_COLORS[t]?.stroke ?? '#22c55e'

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ types }: { types: Set<string> }) {
  if (!types.size) return null
  return (
    <div className="rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-2 shadow-sm space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Port types</p>
      {Array.from(types).map(t => (
        <div key={t} className="flex items-center gap-2 text-[11px]">
          <span className="w-6 h-0.5 rounded inline-block shrink-0" style={{ backgroundColor: portColor(t) }} />
          <span>{PORT_TYPE_COLORS[t]?.label ?? t.toUpperCase()}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Host node ────────────────────────────────────────────────────────────────
// Shows header + collapsible port list; each port gets its own Handle

type PortInfo = {
  id: number
  name: string
  port_type: string
  connected: boolean
}

type HostNodeData = {
  label: string
  ip: string
  model?: string
  deviceType?: string
  ports: PortInfo[]
  expanded: boolean
  onToggle: () => void
}

function HostNode({ id, data }: { id: string; data: HostNodeData }) {
  const d = data as HostNodeData

  return (
    <div
      className="rounded-lg border-2 bg-card shadow-md select-none overflow-visible"
      style={{ minWidth: 170, borderColor: d.expanded ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
    >
      {/* Header */}
      <button
        className="flex items-center gap-1.5 w-full px-3 py-2 bg-muted/50 hover:bg-muted/70 transition-colors text-left rounded-t-lg"
        onClick={(e) => { e.stopPropagation(); d.onToggle() }}
      >
        {d.expanded
          ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        }
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{d.label}</div>
          <div className="text-[10px] text-muted-foreground font-mono">{d.ip}</div>
        </div>
        <span className="text-[9px] text-muted-foreground shrink-0">{d.ports.length}p</span>
      </button>

      {/* Port list (visible when expanded) */}
      {d.expanded && d.ports.length > 0 && (
        <div className="divide-y divide-border/30">
          {d.ports.map((port, idx) => {
            const color = portColor(port.port_type)
            // Alternate left/right handles per port
            return (
              <div key={port.id} className="relative flex items-center px-2 py-1 text-[10px] group">
                {/* Left handle for this port */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`port-${port.id}-target`}
                  style={{
                    top: 'auto',
                    background: color,
                    width: 7,
                    height: 7,
                    border: '1.5px solid #fff',
                  }}
                />
                {/* Port info */}
                <span
                  className="w-2 h-2 rounded-full shrink-0 mr-1.5"
                  style={{ backgroundColor: color }}
                />
                <span className="font-mono truncate flex-1">{port.name}</span>
                <span
                  className="text-[9px] px-1 rounded shrink-0"
                  style={{ color, background: color + '22' }}
                >
                  {port.port_type.toUpperCase()}
                </span>
                {port.connected && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="connected" />
                )}
                {/* Right handle for this port */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`port-${port.id}-source`}
                  style={{
                    top: 'auto',
                    background: color,
                    width: 7,
                    height: 7,
                    border: '1.5px solid #fff',
                  }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Collapsed: single centre handles */}
      {!d.expanded && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="collapsed-target"
            style={{ background: '#6b7280', width: 8, height: 8, border: '2px solid #fff' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="collapsed-source"
            style={{ background: '#6b7280', width: 8, height: 8, border: '2px solid #fff' }}
          />
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground flex gap-3">
            {d.model && <span className="truncate">{d.model}</span>}
            <span className="ml-auto text-green-500">
              {d.ports.filter(p => p.connected).length} connected
            </span>
          </div>
        </>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = { hostNode: HostNode as never }

// ─── Connection edge — no arrows, straight/bezier line ───────────────────────

function ConnectionEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, data } = props
  const d = data as { portA?: string; portB?: string; color?: string; isSelected?: boolean }
  const color = d?.color ?? '#22c55e'
  const width = d?.isSelected ? 3 : 1.5

  const [path, lx, ly] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  // midpoint for label
  const mx = (sourceX + targetX) / 2
  const my = (sourceY + targetY) / 2

  return (
    <g>
      {/* Wide invisible click target */}
      <path d={path} strokeWidth={14} stroke="transparent" fill="none" className="cursor-pointer" />

      {/* Main line — NO markers, no arrows */}
      <path
        d={path}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeDasharray={d?.isSelected ? undefined : undefined}
        style={{
          filter: d?.isSelected ? `drop-shadow(0 0 3px ${color}88)` : undefined,
        }}
      />

      {/* Port label at midpoint (only when selected or short label) */}
      {d?.portA && d?.portB && (
        <foreignObject
          x={mx - 55}
          y={my - 12}
          width={110}
          height={24}
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          <div
            style={{ borderColor: color + '55', backgroundColor: 'hsl(var(--card) / 0.92)' }}
            className="flex items-center justify-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] shadow-sm whitespace-nowrap backdrop-blur-sm"
          >
            <span className="font-mono truncate max-w-[34px]" style={{ color }}>{d.portA}</span>
            <span className="text-muted-foreground shrink-0">—</span>
            <span className="font-mono truncate max-w-[34px]" style={{ color }}>{d.portB}</span>
          </div>
        </foreignObject>
      )}
    </g>
  )
}

const edgeTypes: EdgeTypes = { connectionEdge: ConnectionEdge as never }

// ─── Layout helpers ───────────────────────────────────────────────────────────

function circleLayout(n: number) {
  if (n === 1) return [{ x: 300, y: 300 }]
  if (n === 2) return [{ x: 150, y: 250 }, { x: 500, y: 250 }]
  const r = Math.max(220, n * 80)
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

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])

  useEffect(() => {
    if (!visibleHosts.length) { setNodes([]); setEdges([]); return }

    // Init positions for new nodes
    if (visibleHosts.some(h => !posRef.current[String(h.id)])) {
      const layout = circleLayout(visibleHosts.length)
      visibleHosts.forEach((h, i) => {
        if (!posRef.current[String(h.id)]) posRef.current[String(h.id)] = layout[i]
      })
    }

    const selId = selected ? String(selected.id) : null

    // Build port info per host
    const connPortIds = new Set<number>()
    for (const c of (connections ?? [])) {
      connPortIds.add(c.port_a)
      connPortIds.add(c.port_b)
    }

    const newNodes = visibleHosts.map(h => {
      const nodeId = String(h.id)
      const isExpanded = expandedNodes.has(nodeId)
      const ports: PortInfo[] = (h.ports ?? []).map(p => ({
        id: p.id,
        name: p.name,
        port_type: p.port_type,
        connected: connPortIds.has(p.id),
      }))

      return {
        id: nodeId,
        type: 'hostNode',
        position: { ...posRef.current[nodeId] },
        data: {
          label: h.hostname || h.ip_address.split('/')[0],
          ip: h.ip_address.split('/')[0],
          model: h.device_model_name ?? undefined,
          deviceType: h.device_type ? (dtMap[h.device_type] ?? h.device_type) : undefined,
          ports,
          expanded: isExpanded,
          onToggle: () => toggleNode(nodeId),
        } as HostNodeData,
      }
    })

    const newEdges = (connections ?? []).map(c => {
      const color = portColor(c.port_a_type)
      const srcExpanded = expandedNodes.has(String(c.host_a_id))
      const tgtExpanded = expandedNodes.has(String(c.host_b_id))

      // Use port-specific handles when expanded, collapsed handles otherwise
      const sourceHandle = srcExpanded ? `port-${c.port_a}-source` : 'collapsed-source'
      const targetHandle = tgtExpanded ? `port-${c.port_b}-target` : 'collapsed-target'

      return {
        id: String(c.id),
        source: String(c.host_a_id),
        target: String(c.host_b_id),
        sourceHandle,
        targetHandle,
        type: 'connectionEdge',
        data: {
          portA: c.port_a_name,
          portB: c.port_b_name,
          color,
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

  return (
    <div className="h-full w-full relative">
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
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />

        {/* Stats */}
        <Panel position="top-left">
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-1.5 shadow-sm text-[11px] text-muted-foreground">
            <span>{connections?.length ?? 0} connections</span>
            <span>·</span>
            <span>{visibleHosts.length} devices</span>
            {expandedNodes.size > 0 && (
              <>
                <span>·</span>
                <button
                  onClick={() => setExpandedNodes(new Set())}
                  className="text-primary hover:underline text-[10px]"
                >
                  collapse all
                </button>
              </>
            )}
          </div>
        </Panel>

        {/* Legend */}
        <Panel position="bottom-left">
          <Legend types={usedTypes} />
        </Panel>

        {/* Actions */}
        <Panel position="top-right">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Connection
            </button>
            <button
              onClick={() => fitView({ padding: 0.25, duration: 500 })}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs shadow-sm hover:bg-accent transition-colors"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Fit View
            </button>
          </div>
        </Panel>

        {/* Selected edge info */}
        {selected && (
          <Panel position="bottom-center">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg text-xs max-w-lg">
              <span
                className="w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm"
                style={{ backgroundColor: portColor(selected.port_a_type) }}
              />
              <span className="font-mono font-medium" style={{ color: portColor(selected.port_a_type) }}>
                {selected.host_a_name}
              </span>
              <span className="text-muted-foreground font-mono text-[10px]">/{selected.port_a_name}</span>
              <span className="text-muted-foreground">—</span>
              <span className="font-mono font-medium" style={{ color: portColor(selected.port_b_type) }}>
                {selected.host_b_name}
              </span>
              <span className="text-muted-foreground font-mono text-[10px]">/{selected.port_b_name}</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0">
                {selected.port_a_type.toUpperCase()}
              </span>
              {selected.description && (
                <span className="italic text-muted-foreground truncate max-w-[80px] text-[10px]">{selected.description}</span>
              )}
              <button
                onClick={() => setAddOpen(true)}
                className="ml-1 rounded border border-border px-2 py-0.5 hover:bg-accent transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => { if (window.confirm('Delete this connection?')) deleteMutation.mutate(selected.id) }}
                className="rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
              <button onClick={() => setSelected(null)}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Empty state */}
      {!(connections?.length) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto">
              <ArrowLeftRight className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium">No port connections yet</p>
            <p className="text-sm text-muted-foreground">Connect device ports to visualize the physical topology.</p>
            <button
              onClick={() => setAddOpen(true)}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Connection
            </button>
          </div>
        </div>
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
    </div>
  )
}
