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
import type { PortConnection, PortType } from '@/types'
import { toast } from 'sonner'

const PORT_TYPE_COLORS: Record<string, { stroke: string; label: string }> = {
  'rj45':   { stroke: '#3b82f6', label: 'RJ45'   },
  'sfp':    { stroke: '#8b5cf6', label: 'SFP'    },
  'sfp+':   { stroke: '#a855f7', label: 'SFP+'   },
  'qsfp':   { stroke: '#ec4899', label: 'QSFP'   },
  'usb':    { stroke: '#f59e0b', label: 'USB'    },
  'serial': { stroke: '#6b7280', label: 'Serial' },
}

function getPortColor(t: string) { return PORT_TYPE_COLORS[t]?.stroke ?? '#22c55e' }

function PortTypeLegend({ usedTypes }: { usedTypes: Set<string> }) {
  if (!usedTypes.size) return null
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-2 shadow-sm">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Port types</p>
      {Array.from(usedTypes).map((t) => (
        <div key={t} className="flex items-center gap-2 text-[11px]">
          <span className="w-5 h-0.5 inline-block rounded" style={{ backgroundColor: getPortColor(t) }} />
          <span>{PORT_TYPE_COLORS[t]?.label ?? t.toUpperCase()}</span>
        </div>
      ))}
    </div>
  )
}

function HostNode({ data }: { data: { label: string; ip: string; model?: string; deviceType?: string; ports: number; connected: number } }) {
  return (
    <div className="rounded-lg border-2 border-border bg-card shadow-md min-w-[150px] overflow-hidden select-none">
      <div className="px-3 py-2 bg-muted/40 border-b border-border">
        <div className="text-xs font-semibold truncate">{data.label}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{data.ip}</div>
      </div>
      {(data.model || data.deviceType) && (
        <div className="px-3 py-1 text-[10px] text-muted-foreground border-b border-border/50 flex items-center gap-2">
          {data.deviceType && <span className="bg-muted rounded px-1.5 py-0.5">{data.deviceType}</span>}
          {data.model && <span className="truncate">{data.model}</span>}
        </div>
      )}
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground flex gap-3">
        <span>{data.ports} ports</span>
        <span style={{ color: '#22c55e' }}>{data.connected} connected</span>
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = { hostNode: HostNode as never }

function ConnectionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const d = data as { portA: string; portB: string; color: string; selected?: boolean }
  const [edgePath, lx, ly] = getBezierPath({
    sourceX, sourceY, sourcePosition: sourcePosition ?? Position.Right,
    targetX, targetY, targetPosition: targetPosition ?? Position.Left,
  })
  const color = d?.color ?? '#22c55e'
  return (
    <>
      <path d={edgePath} strokeWidth={12} stroke="transparent" fill="none" className="cursor-pointer" />
      <defs>
        <marker id={`arr-${id}`} markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={color} />
        </marker>
      </defs>
      <path d={edgePath} stroke={color} strokeWidth={d?.selected ? 3 : 2} fill="none" markerEnd={`url(#arr-${id})`} />
      <foreignObject x={lx - 55} y={ly - 14} width={110} height={28} className="pointer-events-none">
        <div className="flex items-center justify-center gap-1 rounded border px-1.5 py-0.5 text-[9px] shadow-sm bg-card" style={{ borderColor: color + '55' }}>
          <span className="font-mono truncate" style={{ color }}>{d?.portA}</span>
          <ArrowLeftRight className="h-2 w-2 text-muted-foreground shrink-0" />
          <span className="font-mono truncate" style={{ color }}>{d?.portB}</span>
        </div>
      </foreignObject>
    </>
  )
}

const edgeTypes: EdgeTypes = { connectionEdge: ConnectionEdge as never }

function circleLayout(n: number) {
  const r = Math.max(180, n * 60)
  return Array.from({ length: n }, (_, i) => ({
    x: Math.cos((2 * Math.PI * i) / n - Math.PI / 2) * r + r + 80,
    y: Math.sin((2 * Math.PI * i) / n - Math.PI / 2) * r + r + 80,
  }))
}

interface PortConnectionsTopologyProps { projectId: number }

export function PortConnectionsTopology({ projectId }: PortConnectionsTopologyProps) {
  return <ReactFlowProvider><Inner projectId={projectId} /></ReactFlowProvider>
}

function Inner({ projectId }: PortConnectionsTopologyProps) {
  const queryClient = useQueryClient()
  const { fitView } = useReactFlow()
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<PortConnection | null>(null)
  const posRef = useRef<Record<string, { x: number; y: number }>>({})
  const [dtMap, setDtMap] = useState<Record<string, string>>({})

  const { data: hosts } = useQuery({
    queryKey: ['hosts', { project: projectId }],
    queryFn: () => hostsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })
  const { data: connections } = useQuery({
    queryKey: ['port-connections-all', projectId],
    queryFn: () => portConnectionsApi.list(),
    select: (res) => res.data,
  })
  const { data: deviceTypesData } = useQuery({
    queryKey: ['device-types'],
    queryFn: () => deviceTypesApi.list(),
    select: (res) => res.data,
  })

  useEffect(() => {
    if (deviceTypesData) {
      const m: Record<string, string> = {}
      for (const dt of deviceTypesData) m[dt.value] = dt.label
      setDtMap(m)
    }
  }, [deviceTypesData])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => portConnectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-connections-all'] })
      queryClient.invalidateQueries({ queryKey: ['host-ports'] })
      setSelected(null)
      toast.success('Connection deleted')
    },
  })

  const connectedIds = useMemo(() => {
    const s = new Set<number>()
    for (const c of (connections ?? [])) { s.add(c.host_a_id); s.add(c.host_b_id) }
    return s
  }, [connections])

  const visibleHosts = useMemo(() => (hosts ?? []).filter((h) => connectedIds.has(h.id)), [hosts, connectedIds])

  const usedTypes = useMemo(() => {
    const s = new Set<string>()
    for (const c of (connections ?? [])) s.add(c.port_a_type)
    return s
  }, [connections])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (!visibleHosts.length) { setNodes([]); setEdges([]); return }
    const ids = visibleHosts.map((h) => String(h.id))
    const unpositioned = ids.filter((id) => !posRef.current[id])
    if (unpositioned.length) {
      const layout = circleLayout(unpositioned.length)
      unpositioned.forEach((id, i) => { posRef.current[id] = layout[i] })
    }
    const selId = selected ? String(selected.id) : null
    setNodes(visibleHosts.map((h) => ({
      id: String(h.id), type: 'hostNode',
      position: posRef.current[String(h.id)],
      data: {
        label: h.hostname || h.ip_address,
        ip: h.ip_address.replace(/\/\d+$/, ''),
        model: h.device_model_name ?? undefined,
        deviceType: h.device_type ? (dtMap[h.device_type] ?? h.device_type) : undefined,
        ports: h.ports?.length ?? 0,
        connected: (connections ?? []).filter((c) => c.host_a_id === h.id || c.host_b_id === h.id).length,
      },
    })) as never)
    setEdges((connections ?? []).map((c) => {
      const color = getPortColor(c.port_a_type)
      return {
        id: String(c.id), source: String(c.host_a_id), target: String(c.host_b_id),
        type: 'connectionEdge',
        data: { portA: c.port_a_name, portB: c.port_b_name, color, selected: selId === String(c.id) },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      }
    }) as never)
  }, [visibleHosts, connections, selected, dtMap])

  const onNodeDragStop = useCallback((_: never, node: { id: string; position: { x: number; y: number } }) => {
    posRef.current[node.id] = node.position
  }, [])

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop as never}
        onEdgeClick={(_: never, edge: { id: string }) => {
          const c = connections?.find((x) => String(x.id) === edge.id)
          setSelected(c ?? null)
        }}
        onPaneClick={() => setSelected(null)}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.2} maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <Panel position="top-left">
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-1.5 shadow-sm text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><ArrowLeftRight className="h-3 w-3" /> {connections?.length ?? 0} connections</span>
            <span>{visibleHosts.length} devices</span>
          </div>
        </Panel>
        <Panel position="bottom-left"><PortTypeLegend usedTypes={usedTypes} /></Panel>
        <Panel position="top-right">
          <div className="flex flex-col gap-2">
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent">
              <Plus className="h-3.5 w-3.5" /> Add Connection
            </button>
            <button onClick={() => fitView({ padding: 0.15, duration: 400 })} className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs shadow-sm hover:bg-accent">
              <LayoutGrid className="h-3.5 w-3.5" /> Fit View
            </button>
          </div>
        </Panel>
        {selected && (
          <Panel position="bottom-center">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-md text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getPortColor(selected.port_a_type) }} />
              <span className="font-mono" style={{ color: getPortColor(selected.port_a_type) }}>{selected.host_a_name} / {selected.port_a_name}</span>
              <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono" style={{ color: getPortColor(selected.port_b_type) }}>{selected.host_b_name} / {selected.port_b_name}</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{selected.port_a_type.toUpperCase()}</span>
              {selected.description && <span className="italic text-muted-foreground truncate max-w-[100px]">{selected.description}</span>}
              <button onClick={() => setAddOpen(true)} className="ml-1 rounded border border-border px-2 py-0.5 hover:bg-accent">Edit</button>
              <button onClick={() => { if (window.confirm('Delete?')) deleteMutation.mutate(selected.id) }} className="rounded border border-destructive/50 px-2 py-0.5 text-destructive hover:bg-destructive/10">Delete</button>
              <button onClick={() => setSelected(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {!(connections?.length) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto">
              <ArrowLeftRight className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium">No port connections yet</p>
            <p className="text-sm text-muted-foreground">Connect device ports to visualize your physical topology.</p>
            <button onClick={() => setAddOpen(true)} className="pointer-events-auto flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 mx-auto">
              <Plus className="h-4 w-4" /> Add Connection
            </button>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setSelected(null) }} title={selected ? 'Edit Connection' : 'Add Port Connection'}>
        <PortConnectionForm projectId={projectId} connection={selected ?? undefined} onClose={() => { setAddOpen(false); setSelected(null) }} />
      </Dialog>
    </div>
  )
}
