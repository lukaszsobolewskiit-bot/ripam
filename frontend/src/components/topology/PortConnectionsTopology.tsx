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
  getBezierPath,
  Handle,
  type NodeTypes,
  type EdgeTypes,
  type EdgeProps,
  MarkerType,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hostsApi, portConnectionsApi, deviceTypesApi } from '@/api/endpoints'
import { Dialog } from '@/components/ui/Dialog'
import { PortConnectionForm } from '@/components/data/forms/PortConnectionForm'
import { ArrowLeftRight, Plus, LayoutGrid, X } from 'lucide-react'
import type { PortConnection } from '@/types'
import { toast } from 'sonner'

// ─── Port type → color ───────────────────────────────────────────────────────

const PORT_TYPE_COLORS: Record<string, { stroke: string; label: string }> = {
  rj45:   { stroke: '#3b82f6', label: 'RJ45' },
  sfp:    { stroke: '#8b5cf6', label: 'SFP' },
  'sfp+': { stroke: '#a855f7', label: 'SFP+' },
  qsfp:   { stroke: '#ec4899', label: 'QSFP' },
  usb:    { stroke: '#f59e0b', label: 'USB' },
  serial: { stroke: '#6b7280', label: 'Serial' },
}
function portColor(t: string) { return PORT_TYPE_COLORS[t]?.stroke ?? '#22c55e' }

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend({ types }: { types: Set<string> }) {
  if (!types.size) return null
  return (
    <div className="rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-2 shadow-sm space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Port types</p>
      {Array.from(types).map(t => (
        <div key={t} className="flex items-center gap-2 text-[11px]">
          <span className="w-5 h-0.5 rounded inline-block" style={{ backgroundColor: portColor(t) }} />
          <span>{PORT_TYPE_COLORS[t]?.label ?? t.toUpperCase()}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Host node ───────────────────────────────────────────────────────────────

type HostData = { label: string; ip: string; model?: string; deviceType?: string; ports: number; connected: number }

function HostNode({ data }: { data: HostData }) {
  return (
    <div className="rounded-lg border-2 border-border bg-card shadow-md min-w-[150px] max-w-[200px] overflow-hidden select-none">
      {/* ReactFlow connection handles — left=target, right=source */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#6b7280', width: 8, height: 8, border: '2px solid #fff' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#6b7280', width: 8, height: 8, border: '2px solid #fff' }}
      />
      <div className="px-3 py-2 bg-muted/50 border-b border-border">
        <div className="text-xs font-semibold truncate">{data.label}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{data.ip}</div>
      </div>
      {(data.model || data.deviceType) && (
        <div className="px-3 py-1 text-[10px] text-muted-foreground border-b border-border/50 flex items-center gap-1.5">
          {data.deviceType && (
            <span className="bg-muted rounded px-1.5 py-0.5 shrink-0">{data.deviceType}</span>
          )}
          {data.model && <span className="truncate">{data.model}</span>}
        </div>
      )}
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground flex gap-3">
        <span>{data.ports} ports</span>
        <span className="text-green-500 font-medium">{data.connected} conn.</span>
      </div>
    </div>
  )
}
const nodeTypes: NodeTypes = { hostNode: HostNode as never }

// ─── Connection edge ──────────────────────────────────────────────────────────

function ConnectionEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const d = data as { portA?: string; portB?: string; color?: string; isSelected?: boolean }
  const [path, lx, ly] = getBezierPath({
    sourceX, sourceY,
    sourcePosition: sourcePosition ?? Position.Right,
    targetX, targetY,
    targetPosition: targetPosition ?? Position.Left,
  })
  const color = d?.color ?? '#22c55e'
  const width = d?.isSelected ? 3 : 2

  return (
    <g>
      {/* Wide invisible click target */}
      <path d={path} strokeWidth={16} stroke="transparent" fill="none" className="cursor-pointer" />

      {/* Arrow marker definition */}
      <defs>
        <marker
          id={`arrow-${id}`}
          markerWidth="10"
          markerHeight="10"
          refX="6"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,10 L9,5 z" fill={color} />
        </marker>
      </defs>

      {/* Main line */}
      <path
        d={path}
        stroke={color}
        strokeWidth={width}
        fill="none"
        markerEnd={`url(#arrow-${id})`}
        style={{ filter: d?.isSelected ? `drop-shadow(0 0 4px ${color})` : undefined }}
      />

      {/* Port label badge */}
      {d?.portA && d?.portB && (
        <foreignObject
          x={lx - 60}
          y={ly - 13}
          width={120}
          height={26}
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          <div
            style={{ borderColor: color + '66' }}
            className="flex items-center justify-center gap-1 rounded-full border bg-card/90 backdrop-blur-sm px-2 py-0.5 text-[9px] shadow-sm whitespace-nowrap"
          >
            <span className="font-mono truncate max-w-[38px]" style={{ color }}>{d.portA}</span>
            <ArrowLeftRight className="h-2 w-2 text-muted-foreground shrink-0" />
            <span className="font-mono truncate max-w-[38px]" style={{ color }}>{d.portB}</span>
          </div>
        </foreignObject>
      )}
    </g>
  )
}
const edgeTypes: EdgeTypes = { connectionEdge: ConnectionEdge as never }

// ─── Circle layout ────────────────────────────────────────────────────────────

function circleLayout(n: number) {
  if (n === 1) return [{ x: 300, y: 300 }]
  const r = Math.max(200, n * 70)
  return Array.from({ length: n }, (_, i) => ({
    x: Math.cos((2 * Math.PI * i) / n - Math.PI / 2) * r + r + 80,
    y: Math.sin((2 * Math.PI * i) / n - Math.PI / 2) * r + r + 80,
  }))
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { projectId: number }

export function PortConnectionsTopology({ projectId }: Props) {
  return (
    <ReactFlowProvider>
      <Inner projectId={projectId} />
    </ReactFlowProvider>
  )
}

function Inner({ projectId }: Props) {
  const queryClient = useQueryClient()
  const { fitView } = useReactFlow()
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<PortConnection | null>(null)
  const posRef = useRef<Record<string, { x: number; y: number }>>({})
  const [dtMap, setDtMap] = useState<Record<string, string>>({})

  // Hosts in this project
  const { data: hosts } = useQuery({
    queryKey: ['hosts', { project: projectId }],
    queryFn: () => hostsApi.list({ project: String(projectId), page_size: '500' }),
    select: (res) => res.data.results,
  })

  // Connections filtered by project
  const { data: connections } = useQuery({
    queryKey: ['port-connections-all', projectId],
    queryFn: () => portConnectionsApi.list({ project: String(projectId) }),
    select: (res) => res.data,
  })

  // Device types for display labels
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

  // Only show hosts that have at least one connection
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

  useEffect(() => {
    if (!visibleHosts.length) { setNodes([]); setEdges([]); return }

    // Assign positions to newly seen hosts
    const unpositioned = visibleHosts.filter(h => !posRef.current[String(h.id)])
    if (unpositioned.length) {
      const layout = circleLayout(visibleHosts.length)
      visibleHosts.forEach((h, i) => {
        if (!posRef.current[String(h.id)]) {
          posRef.current[String(h.id)] = layout[i]
        }
      })
    }

    const selId = selected ? String(selected.id) : null

    const newNodes = visibleHosts.map(h => ({
      id: String(h.id),
      type: 'hostNode',
      position: { ...posRef.current[String(h.id)] },
      data: {
        label: h.hostname || h.ip_address.split('/')[0],
        ip: h.ip_address.split('/')[0],
        model: h.device_model_name ?? undefined,
        deviceType: h.device_type ? (dtMap[h.device_type] ?? h.device_type) : undefined,
        ports: h.ports?.length ?? 0,
        connected: (connections ?? []).filter(c => c.host_a_id === h.id || c.host_b_id === h.id).length,
      } as HostData,
    }))

    const newEdges = (connections ?? []).map(c => {
      const color = portColor(c.port_a_type)
      return {
        id: String(c.id),
        source: String(c.host_a_id),
        target: String(c.host_b_id),
        type: 'connectionEdge',
        data: {
          portA: c.port_a_name,
          portB: c.port_b_name,
          color,
          isSelected: selId === String(c.id),
        },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      }
    })

    setNodes(newNodes as never)
    setEdges(newEdges as never)
  }, [visibleHosts, connections, selected, dtMap])

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
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2.5}
        defaultEdgeOptions={{ type: 'connectionEdge' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />

        {/* Stats — top left */}
        <Panel position="top-left">
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-1.5 shadow-sm text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ArrowLeftRight className="h-3 w-3" />
              {connections?.length ?? 0} connections
            </span>
            <span>{visibleHosts.length} devices</span>
          </div>
        </Panel>

        {/* Legend — bottom left */}
        <Panel position="bottom-left">
          <Legend types={usedTypes} />
        </Panel>

        {/* Actions — top right */}
        <Panel position="top-right">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Connection
            </button>
            <button
              onClick={() => fitView({ padding: 0.2, duration: 500 })}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs shadow-sm hover:bg-accent transition-colors"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Fit View
            </button>
          </div>
        </Panel>

        {/* Selected connection info — bottom center */}
        {selected && (
          <Panel position="bottom-center">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg text-xs max-w-lg">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: portColor(selected.port_a_type) }}
              />
              <span className="font-mono" style={{ color: portColor(selected.port_a_type) }}>
                {selected.host_a_name} / {selected.port_a_name}
              </span>
              <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-mono" style={{ color: portColor(selected.port_b_type) }}>
                {selected.host_b_name} / {selected.port_b_name}
              </span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                {selected.port_a_type.toUpperCase()}
              </span>
              {selected.description && (
                <span className="italic text-muted-foreground truncate max-w-[100px]">{selected.description}</span>
              )}
              <button
                onClick={() => { setAddOpen(true) }}
                className="ml-1 rounded border border-border px-2 py-0.5 hover:bg-accent transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => { if (window.confirm('Delete this connection?')) deleteMutation.mutate(selected.id) }}
                className="rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10 transition-colors"
              >
                Delete
              </button>
              <button onClick={() => setSelected(null)} className="ml-1 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
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
            <p className="text-sm text-muted-foreground">
              Connect device ports to visualize your physical topology.
            </p>
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
