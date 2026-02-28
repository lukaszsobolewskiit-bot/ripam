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
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hostsApi, portConnectionsApi } from '@/api/endpoints'
import { Dialog } from '@/components/ui/Dialog'
import { PortConnectionForm } from '@/components/data/forms/PortConnectionForm'
import { ArrowLeftRight, Plus, Trash2, LayoutGrid } from 'lucide-react'
import type { PortConnection } from '@/types'
import { toast } from 'sonner'

// ─── Host node ──────────────────────────────────────────────────────────────

function HostNode({ data }: { data: { label: string; ip: string; model?: string; ports: number; connected: number } }) {
  return (
    <div className="rounded-lg border-2 border-border bg-card shadow-md min-w-[140px] overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b border-border">
        <div className="text-xs font-semibold truncate">{data.label}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{data.ip}</div>
      </div>
      {data.model && (
        <div className="px-3 py-1 text-[10px] text-muted-foreground border-b border-border/50 truncate">{data.model}</div>
      )}
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground flex gap-3">
        <span>{data.ports} ports</span>
        <span className="text-green-500">{data.connected} connected</span>
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = { hostNode: HostNode as never }

// ─── Connection edge label ──────────────────────────────────────────────────

function ConnectionEdge({ data, ...props }: { data: { portA: string; portB: string; id: number }; sourceX: number; sourceY: number; targetX: number; targetY: number; sourcePosition: never; targetPosition: never }) {
  const { sourceX, sourceY, targetX, targetY } = props
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  const d = `M${sourceX},${sourceY} C${sourceX + 60},${sourceY} ${targetX - 60},${targetY} ${targetX},${targetY}`

  return (
    <>
      <path d={d} stroke="#22c55e" strokeWidth={2} fill="none" markerEnd="url(#arrow-green)" />
      <foreignObject x={midX - 60} y={midY - 14} width={120} height={28}>
        <div className="flex items-center justify-center gap-1 rounded bg-card border border-border px-1.5 py-0.5 text-[9px] shadow-sm">
          <span className="font-mono text-green-600 truncate">{data.portA}</span>
          <ArrowLeftRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
          <span className="font-mono text-green-600 truncate">{data.portB}</span>
        </div>
      </foreignObject>
    </>
  )
}

const edgeTypes: EdgeTypes = { connectionEdge: ConnectionEdge as never }

// ─── Layout helper ──────────────────────────────────────────────────────────

function autoLayout(nodeIds: string[]): Record<string, { x: number; y: number }> {
  const cols = Math.ceil(Math.sqrt(nodeIds.length))
  const positions: Record<string, { x: number; y: number }> = {}
  nodeIds.forEach((id, i) => {
    positions[id] = {
      x: (i % cols) * 220 + 60,
      y: Math.floor(i / cols) * 180 + 60,
    }
  })
  return positions
}

// ─── Main component ──────────────────────────────────────────────────────────

interface PortConnectionsTopologyProps {
  projectId: number
}

export function PortConnectionsTopology({ projectId }: PortConnectionsTopologyProps) {
  return (
    <ReactFlowProvider>
      <PortConnectionsTopologyInner projectId={projectId} />
    </ReactFlowProvider>
  )
}

function PortConnectionsTopologyInner({ projectId }: PortConnectionsTopologyProps) {
  const queryClient = useQueryClient()
  const { fitView } = useReactFlow()
  const [addOpen, setAddOpen] = useState(false)
  const [editConnection, setEditConnection] = useState<PortConnection | null>(null)
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({})

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

  const deleteConnection = useMutation({
    mutationFn: (id: number) => portConnectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-connections-all'] })
      queryClient.invalidateQueries({ queryKey: ['port-connections'] })
      queryClient.invalidateQueries({ queryKey: ['host-ports'] })
      toast.success('Connection deleted')
    },
  })

  // Only show hosts that have at least one connection
  const connectedHostIds = useMemo(() => {
    const ids = new Set<number>()
    for (const c of (connections ?? [])) {
      ids.add(c.host_a_id)
      ids.add(c.host_b_id)
    }
    return ids
  }, [connections])

  const visibleHosts = useMemo(
    () => (hosts ?? []).filter((h) => connectedHostIds.has(h.id)),
    [hosts, connectedHostIds]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (!visibleHosts.length) { setNodes([]); setEdges([]); return }

    const hostIds = visibleHosts.map((h) => String(h.id))
    // Init positions for new nodes
    const auto = autoLayout(hostIds)
    for (const id of hostIds) {
      if (!positionsRef.current[id]) positionsRef.current[id] = auto[id]
    }

    const newNodes = visibleHosts.map((h) => {
      const connCount = (connections ?? []).filter(
        (c) => c.host_a_id === h.id || c.host_b_id === h.id
      ).length
      return {
        id: String(h.id),
        type: 'hostNode',
        position: positionsRef.current[String(h.id)],
        data: {
          label: h.hostname || h.ip_address,
          ip: h.ip_address,
          model: h.device_model_name ?? undefined,
          ports: h.ports?.length ?? 0,
          connected: connCount,
        },
      }
    })

    const newEdges = (connections ?? []).map((c) => ({
      id: String(c.id),
      source: String(c.host_a_id),
      target: String(c.host_b_id),
      type: 'connectionEdge',
      data: { portA: c.port_a_name, portB: c.port_b_name, id: c.id },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
    }))

    setNodes(newNodes as never)
    setEdges(newEdges as never)
  }, [visibleHosts, connections])

  const onNodeDragStop = useCallback((_: never, node: { id: string; position: { x: number; y: number } }) => {
    positionsRef.current[node.id] = node.position
  }, [])

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.15, duration: 400 })
  }, [fitView])

  const totalConnections = connections?.length ?? 0
  const totalHosts = visibleHosts.length

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop as never}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onEdgeClick={(_, edge) => {
          const conn = connections?.find((c) => String(c.id) === edge.id)
          if (conn) setEditConnection(conn)
        }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />

        {/* Stats panel */}
        <Panel position="top-left">
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-1.5 shadow-sm text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ArrowLeftRight className="h-3 w-3" />
              {totalConnections} connections
            </span>
            <span>{totalHosts} devices</span>
          </div>
        </Panel>

        {/* Controls panel */}
        <Panel position="top-right">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" /> Add Connection
            </button>
            <button
              onClick={handleFitView}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs shadow-sm hover:bg-accent"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Fit View
            </button>
          </div>
        </Panel>

        {/* Edge tooltip — click edge to edit/delete */}
        {editConnection && (
          <Panel position="bottom-center">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-md text-xs">
              <span className="font-mono text-green-600">{editConnection.host_a_name} / {editConnection.port_a_name}</span>
              <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-green-600">{editConnection.host_b_name} / {editConnection.port_b_name}</span>
              <button
                onClick={() => setEditConnection(null)}
                className="ml-2 rounded border border-border px-2 py-0.5 hover:bg-accent"
              >Edit</button>
              <button
                onClick={() => {
                  if (window.confirm('Delete this connection?')) {
                    deleteConnection.mutate(editConnection.id)
                    setEditConnection(null)
                  }
                }}
                className="rounded border border-destructive/50 px-2 py-0.5 text-destructive hover:bg-destructive/10"
              >Delete</button>
              <button onClick={() => setEditConnection(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Empty state */}
      {totalConnections === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto">
              <ArrowLeftRight className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium">No port connections yet</p>
            <p className="text-sm text-muted-foreground">Connect device ports to visualize your physical topology.</p>
            <button
              onClick={() => setAddOpen(true)}
              className="pointer-events-auto flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 mx-auto"
            >
              <Plus className="h-4 w-4" /> Add Connection
            </button>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add Port Connection">
        <PortConnectionForm projectId={projectId} onClose={() => setAddOpen(false)} />
      </Dialog>

      <Dialog
        open={editConnection !== null}
        onOpenChange={(open) => { if (!open) setEditConnection(null) }}
        title="Edit Port Connection"
      >
        {editConnection && (
          <PortConnectionForm
            projectId={projectId}
            connection={editConnection}
            onClose={() => setEditConnection(null)}
          />
        )}
      </Dialog>
    </div>
  )
}
