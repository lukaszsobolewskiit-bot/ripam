import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { backupApi, deviceTypesApi, manufacturersApi, deviceModelsApi, portTemplatesApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import { Download, Upload, AlertTriangle, Trash2, Plus, Pencil, ChevronDown, ChevronRight, Package } from 'lucide-react'
import type { DeviceTypeOption, Manufacturer, DeviceModel, PortTemplate, PortType } from '@/types'

const PORT_TYPE_OPTIONS: { value: PortType; label: string }[] = [
  { value: 'rj45', label: 'RJ45' },
  { value: 'sfp', label: 'SFP' },
  { value: 'sfp+', label: 'SFP+' },
  { value: 'qsfp', label: 'QSFP' },
  { value: 'usb', label: 'USB' },
  { value: 'serial', label: 'Serial' },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'catalog' | 'backup'>('general')
  const [replaceAll, setReplaceAll] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const downloadMutation = useMutation({
    mutationFn: () => backupApi.download(),
    onSuccess: (res) => {
      const blob = new Blob([res.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ripenet-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded')
    },
    onError: () => toast.error('Failed to download backup'),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, replace }: { file: File; replace: boolean }) =>
      backupApi.upload(file, replace),
    onSuccess: (res) => {
      toast.success(res.data.detail)
      setSelectedFile(null)
      setConfirmOpen(false)
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Import failed'
      toast.error(message)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file')
      return
    }
    setSelectedFile(file)
    setConfirmOpen(true)
  }

  const handleImport = () => {
    if (!selectedFile) return
    uploadMutation.mutate({ file: selectedFile, replace: replaceAll })
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-lg font-semibold">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['general', 'catalog', 'backup'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'catalog' ? 'Device Catalog' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <DeviceTypesSection />
      )}

      {activeTab === 'catalog' && (
        <DeviceCatalogSection />
      )}

      {activeTab === 'backup' && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Data Backup</h2>
            <p className="text-xs text-muted-foreground">
              Download a full JSON snapshot of the database. The backup includes:
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
              <li>Projects with settings and supernets</li>
              <li>Sites (names, addresses, coordinates)</li>
              <li>VLANs, subnets, gateways, descriptions</li>
              <li>Hosts (IP, hostname, MAC, device type, notes)</li>
              <li>DHCP pools (ranges, lease time, DNS/gateway)</li>
              <li>Tunnels (type, endpoints, subnet)</li>
              <li>User accounts (usernames, roles, emails)</li>
              <li>Audit log (all recorded changes)</li>
            </ul>
            <button
              onClick={() => downloadMutation.mutate()}
              disabled={downloadMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {downloadMutation.isPending ? 'Downloading...' : 'Download backup'}
            </button>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Restore Data</h2>
            <p className="text-xs text-muted-foreground">
              Import data from a previously downloaded backup file.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent/80 file:cursor-pointer"
            />

            {confirmOpen && selectedFile && (
              <div className="rounded-md border border-border p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium">Import "{selectedFile.name}"?</p>
                    <p className="text-muted-foreground">
                      This will load data into the database. Existing records with the same IDs will be updated.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={replaceAll}
                    onChange={(e) => setReplaceAll(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-destructive font-medium">Replace all data</span>
                  <span className="text-muted-foreground">— deletes everything before import</span>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={uploadMutation.isPending}
                    className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadMutation.isPending ? 'Importing...' : 'Import'}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmOpen(false)
                      setSelectedFile(null)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}


// ─── Device Catalog Section ───────────────────────────────────────────────────

function DeviceCatalogSection() {
  const queryClient = useQueryClient()
  const [expandedManufacturer, setExpandedManufacturer] = useState<number | null>(null)
  const [expandedModel, setExpandedModel] = useState<number | null>(null)

  // Add manufacturer
  const [newMfgName, setNewMfgName] = useState('')
  const [newMfgDesc, setNewMfgDesc] = useState('')

  // Edit manufacturer
  const [editMfgId, setEditMfgId] = useState<number | null>(null)
  const [editMfgName, setEditMfgName] = useState('')
  const [editMfgDesc, setEditMfgDesc] = useState('')

  // Add model (per manufacturer)
  const [addModelFor, setAddModelFor] = useState<number | null>(null)
  const [newModelName, setNewModelName] = useState('')
  const [newModelType, setNewModelType] = useState('')

  // Edit model
  const [editModelId, setEditModelId] = useState<number | null>(null)
  const [editModelName, setEditModelName] = useState('')
  const [editModelType, setEditModelType] = useState('')

  // Add ports (bulk rows per model)
  const [addPortFor, setAddPortFor] = useState<number | null>(null)
  const [portRows, setPortRows] = useState<{ name: string; port_type: PortType }[]>([
    { name: '', port_type: 'rj45' },
  ])
  // Serial port generation
  const [serialPattern, setSerialPattern] = useState('')
  const [serialType, setSerialType] = useState<PortType>('rj45')
  const [serialMode, setSerialMode] = useState<'manual' | 'serial'>('manual')

  // Parse serial pattern like "ether1-8", "sfp1-4", "port01-24"
  const parseSerialPattern = (pattern: string): string[] => {
    const m = pattern.match(/^([a-zA-Z_./-]+?)(\d+)-(\d+)$/)
    if (!m) return []
    const [, prefix, startStr, endStr] = m
    const start = parseInt(startStr, 10)
    const end = parseInt(endStr, 10)
    if (isNaN(start) || isNaN(end) || end < start || end - start > 255) return []
    const padLen = startStr.length > 1 && startStr.startsWith('0') ? startStr.length : 0
    return Array.from({ length: end - start + 1 }, (_, i) => {
      const n = start + i
      return prefix + (padLen > 0 ? String(n).padStart(padLen, '0') : String(n))
    })
  }

  const serialPreview = parseSerialPattern(serialPattern)

  // Device types for select
  const { data: deviceTypes } = useQuery({
    queryKey: ['device-types'],
    queryFn: () => deviceTypesApi.list(),
    select: (res) => res.data,
  })

  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: () => manufacturersApi.list(),
    select: (res) => res.data,
  })

  const createMfg = useMutation({
    mutationFn: (data: Partial<Manufacturer>) => manufacturersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
      setNewMfgName('')
      setNewMfgDesc('')
      toast.success('Manufacturer added')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to add manufacturer')),
  })

  const updateMfg = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Manufacturer> }) =>
      manufacturersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
      setEditMfgId(null)
      toast.success('Manufacturer updated')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to update manufacturer')),
  })

  const deleteMfg = useMutation({
    mutationFn: (id: number) => manufacturersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
      toast.success('Manufacturer deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Cannot delete manufacturer')),
  })

  const createModel = useMutation({
    mutationFn: (data: Partial<DeviceModel>) => deviceModelsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
      queryClient.invalidateQueries({ queryKey: ['device-models'] })
      setAddModelFor(null)
      setNewModelName('')
      setNewModelType('')
      toast.success('Model added')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to add model')),
  })

  const updateModel = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeviceModel> }) =>
      deviceModelsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
      queryClient.invalidateQueries({ queryKey: ['device-models'] })
      setEditModelId(null)
      toast.success('Model updated')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to update model')),
  })

  const deleteModel = useMutation({
    mutationFn: (id: number) => deviceModelsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
      queryClient.invalidateQueries({ queryKey: ['device-models'] })
      toast.success('Model deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Cannot delete model')),
  })

  const createPort = useMutation({
    mutationFn: (data: Partial<PortTemplate>) => portTemplatesApi.create(data),
  })

  const deletePort = useMutation({
    mutationFn: (id: number) => portTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
      toast.success('Port deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Cannot delete port')),
  })

  const handleAddMfg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMfgName.trim()) return
    const slug = newMfgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    createMfg.mutate({ name: newMfgName.trim(), slug, description: newMfgDesc.trim() })
  }

  const handleSaveMfg = () => {
    if (!editMfgName.trim() || editMfgId === null) return
    const slug = editMfgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    updateMfg.mutate({ id: editMfgId, data: { name: editMfgName.trim(), slug, description: editMfgDesc.trim() } })
  }

  const handleSaveModel = () => {
    if (!editModelName.trim() || editModelId === null) return
    updateModel.mutate({ id: editModelId, data: { name: editModelName.trim(), device_type: editModelType.trim() } })
  }

  const handleAddPorts = async (modelId: number, position: number) => {
    const valid = portRows.filter((r) => r.name.trim())
    if (!valid.length) return
    try {
      for (let i = 0; i < valid.length; i++) {
        await createPort.mutateAsync({
          device_model: modelId,
          name: valid[i].name.trim(),
          port_type: valid[i].port_type,
          position: position + i,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
      setAddPortFor(null)
      setPortRows([{ name: '', port_type: 'rj45' }])
      toast.success(`${valid.length} port(s) added`)
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed to add ports'))
    }
  }

  const updatePortRow = (i: number, field: 'name' | 'port_type', val: string) => {
    setPortRows((rows) => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  const addPortRow = () => setPortRows((rows) => [...rows, { name: '', port_type: 'rj45' }])
  const removePortRow = (i: number) => setPortRows((rows) => rows.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Device Catalog</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Define manufacturers, device models, and their port templates. When you assign a model to a host, its ports are copied automatically.
      </p>

      {/* Manufacturers list */}
      <div className="space-y-2">
        {manufacturers?.map((mfg) => (
          <div key={mfg.id} className="rounded-md border border-border overflow-hidden">
            {/* Manufacturer header */}
            {editMfgId === mfg.id ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                <input
                  value={editMfgName}
                  onChange={(e) => setEditMfgName(e.target.value)}
                  className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-xs font-medium"
                  placeholder="Manufacturer name"
                  autoFocus
                />
                <input
                  value={editMfgDesc}
                  onChange={(e) => setEditMfgDesc(e.target.value)}
                  className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-xs text-muted-foreground"
                  placeholder="Description (optional)"
                />
                <button
                  onClick={handleSaveMfg}
                  disabled={updateMfg.isPending}
                  className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
                >Save</button>
                <button
                  onClick={() => setEditMfgId(null)}
                  className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                >Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                <button
                  onClick={() => setExpandedManufacturer(expandedManufacturer === mfg.id ? null : mfg.id)}
                  className="flex items-center gap-1.5 flex-1 text-left"
                >
                  {expandedManufacturer === mfg.id
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                  <span className="text-sm font-medium">{mfg.name}</span>
                  {mfg.description && (
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">{mfg.description}</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">({mfg.model_count} models)</span>
                </button>
                <button
                  onClick={() => { setEditMfgId(mfg.id); setEditMfgName(mfg.name); setEditMfgDesc(mfg.description || '') }}
                  className="p-0.5 rounded hover:bg-accent"
                  title="Edit manufacturer"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => { if (window.confirm(`Delete manufacturer "${mfg.name}"?`)) deleteMfg.mutate(mfg.id) }}
                  className="p-0.5 rounded hover:bg-destructive/20"
                  title="Delete manufacturer"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Models */}
            {expandedManufacturer === mfg.id && (
              <div className="px-3 pb-3 space-y-2 pt-2">
                {mfg.device_models?.map((model) => (
                  <div key={model.id} className="rounded border border-border overflow-hidden ml-4">
                    {/* Model header */}
                    {editModelId === model.id ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border">
                        <input
                          value={editModelName}
                          onChange={(e) => setEditModelName(e.target.value)}
                          className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-xs font-medium"
                          placeholder="Model name"
                          autoFocus
                        />
                        <select
                          value={editModelType}
                          onChange={(e) => setEditModelType(e.target.value)}
                          className="rounded border border-input bg-background px-2 py-0.5 text-xs"
                        >
                          <option value="">— Device type —</option>
                          {deviceTypes?.map((dt) => (
                            <option key={dt.id} value={dt.value}>{dt.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleSaveModel}
                          disabled={updateModel.isPending}
                          className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
                        >Save</button>
                        <button
                          onClick={() => setEditModelId(null)}
                          className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                        >Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-background">
                        <button
                          onClick={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
                          className="flex items-center gap-1.5 flex-1 text-left"
                        >
                          {expandedModel === model.id
                            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          }
                          <span className="text-xs font-medium">{model.name}</span>
                          {model.device_type && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {deviceTypes?.find((dt) => dt.value === model.device_type)?.label ?? model.device_type}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            ({model.port_templates?.length ?? 0} ports)
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setEditModelId(model.id)
                            setEditModelName(model.name)
                            setEditModelType(model.device_type || '')
                          }}
                          className="p-0.5 rounded hover:bg-accent"
                          title="Edit model"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => {
                            setAddPortFor(addPortFor === model.id ? null : model.id)
                            setExpandedModel(model.id)
                            setPortRows([{ name: '', port_type: 'rj45' }])
                            setSerialPattern('')
                            setSerialMode('manual')
                          }}
                          className="p-0.5 rounded hover:bg-accent"
                          title="Add ports"
                        >
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`Delete model "${model.name}"?`)) deleteModel.mutate(model.id) }}
                          className="p-0.5 rounded hover:bg-destructive/20"
                          title="Delete model"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    )}

                    {/* Ports list */}
                    {expandedModel === model.id && (
                      <div className="px-3 pb-2 pt-1 space-y-2 bg-muted/10 ml-4">
                        {model.port_templates?.length > 0 ? (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left py-0.5">Port</th>
                                <th className="text-left py-0.5">Type</th>
                                <th className="w-6" />
                              </tr>
                            </thead>
                            <tbody>
                              {model.port_templates.map((pt) => (
                                <tr key={pt.id} className="border-t border-border/50">
                                  <td className="py-0.5 font-mono">{pt.name}</td>
                                  <td className="py-0.5">
                                    <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                      {pt.port_type.toUpperCase()}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      onClick={() => deletePort.mutate(pt.id)}
                                      className="p-0.5 rounded hover:bg-destructive/20"
                                    >
                                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-[10px] text-muted-foreground py-1">No ports defined yet.</p>
                        )}

                        {/* Add ports form — manual or serial */}
                        {addPortFor === model.id && (
                          <div className="border-t border-border/50 pt-2 space-y-2">
                            {/* Mode toggle */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mr-1">Add ports</span>
                              <button
                                onClick={() => setSerialMode('manual')}
                                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${serialMode === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                              >Manual</button>
                              <button
                                onClick={() => setSerialMode('serial')}
                                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${serialMode === 'serial' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                              >Serial / Range</button>
                            </div>

                            {serialMode === 'manual' && (
                              <>
                                {portRows.map((row, i) => (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <input
                                      value={row.name}
                                      onChange={(e) => updatePortRow(i, 'name', e.target.value)}
                                      placeholder={`e.g. ether${i + 1}`}
                                      className="w-28 rounded border border-input bg-background px-2 py-0.5 text-xs font-mono"
                                      autoFocus={i === 0}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); addPortRow() }
                                      }}
                                    />
                                    <select
                                      value={row.port_type}
                                      onChange={(e) => updatePortRow(i, 'port_type', e.target.value)}
                                      className="rounded border border-input bg-background px-2 py-0.5 text-xs"
                                    >
                                      {PORT_TYPE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                    {portRows.length > 1 && (
                                      <button onClick={() => removePortRow(i)} className="p-0.5 rounded hover:bg-destructive/20">
                                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <div className="flex items-center gap-2 pt-0.5">
                                  <button onClick={addPortRow} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                                    <Plus className="h-3 w-3" /> Add row
                                  </button>
                                  <button
                                    onClick={() => handleAddPorts(model.id, model.port_templates?.length ?? 0)}
                                    disabled={createPort.isPending || portRows.every((r) => !r.name.trim())}
                                    className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
                                  >
                                    <Plus className="h-3 w-3" /> Save ports
                                  </button>
                                  <button
                                    onClick={() => { setAddPortFor(null); setPortRows([{ name: '', port_type: 'rj45' }]) }}
                                    className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                                  >Cancel</button>
                                </div>
                              </>
                            )}

                            {serialMode === 'serial' && (
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <label className="text-[10px] text-muted-foreground block mb-0.5">Pattern <span className="text-muted-foreground/60">(e.g. ether1-8, sfp1-4, port01-24)</span></label>
                                    <input
                                      value={serialPattern}
                                      onChange={(e) => setSerialPattern(e.target.value)}
                                      placeholder="ether1-8"
                                      autoFocus
                                      className="w-full rounded border border-input bg-background px-2 py-1 text-xs font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground block mb-0.5">Type</label>
                                    <select
                                      value={serialType}
                                      onChange={(e) => setSerialType(e.target.value as PortType)}
                                      className="rounded border border-input bg-background px-2 py-1 text-xs"
                                    >
                                      {PORT_TYPE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* Preview */}
                                {serialPreview.length > 0 && (
                                  <div className="rounded border border-border bg-muted/20 p-2">
                                    <p className="text-[10px] text-muted-foreground mb-1.5">
                                      Preview — {serialPreview.length} ports ({serialType.toUpperCase()}):
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {serialPreview.slice(0, 32).map((name) => (
                                        <span key={name} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{name}</span>
                                      ))}
                                      {serialPreview.length > 32 && (
                                        <span className="text-[10px] text-muted-foreground italic">+{serialPreview.length - 32} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {serialPattern && serialPreview.length === 0 && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                    Invalid pattern. Use format like <code className="font-mono">ether1-8</code> or <code className="font-mono">port01-24</code>
                                  </p>
                                )}

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={async () => {
                                      if (!serialPreview.length) return
                                      const startPos = model.port_templates?.length ?? 0
                                      try {
                                        for (let i = 0; i < serialPreview.length; i++) {
                                          await createPort.mutateAsync({
                                            device_model: model.id,
                                            name: serialPreview[i],
                                            port_type: serialType,
                                            position: startPos + i,
                                          })
                                        }
                                        queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
                                        setAddPortFor(null)
                                        setSerialPattern('')
                                        toast.success(`${serialPreview.length} ports added`)
                                      } catch (err: unknown) {
                                        toast.error(extractApiError(err, 'Failed to add ports'))
                                      }
                                    }}
                                    disabled={!serialPreview.length || createPort.isPending}
                                    className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
                                  >
                                    <Plus className="h-3 w-3" />
                                    {createPort.isPending ? 'Adding...' : `Add ${serialPreview.length || 0} ports`}
                                  </button>
                                  <button
                                    onClick={() => { setAddPortFor(null); setSerialPattern('') }}
                                    className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                                  >Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add model form */}
                {addModelFor === mfg.id ? (
                  <div className="ml-4 rounded border border-dashed border-border p-2 space-y-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Add model</p>
                    <div className="flex items-end gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Model name</label>
                        <input
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          placeholder="e.g. RB5009"
                          className="w-32 rounded border border-input bg-background px-2 py-1 text-xs"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Device type</label>
                        <select
                          value={newModelType}
                          onChange={(e) => setNewModelType(e.target.value)}
                          className="w-32 rounded border border-input bg-background px-2 py-1 text-xs"
                        >
                          <option value="">— select —</option>
                          {deviceTypes?.map((dt) => (
                            <option key={dt.id} value={dt.value}>{dt.label}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          if (!newModelName.trim()) return
                          createModel.mutate({
                            manufacturer: mfg.id,
                            name: newModelName.trim(),
                            device_type: newModelType.trim(),
                          })
                        }}
                        disabled={createModel.isPending || !newModelName.trim()}
                        className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                      <button
                        onClick={() => setAddModelFor(null)}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAddModelFor(mfg.id)
                      setExpandedManufacturer(mfg.id)
                    }}
                    className="ml-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Add model
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add manufacturer form */}
      <div className="rounded-md border border-dashed border-border p-3 space-y-2">
        <p className="text-xs font-medium">Add Manufacturer</p>
        <form onSubmit={handleAddMfg} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Name</label>
            <input
              value={newMfgName}
              onChange={(e) => setNewMfgName(e.target.value)}
              placeholder="e.g. Mikrotik"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Description (optional)</label>
            <input
              value={newMfgDesc}
              onChange={(e) => setNewMfgDesc(e.target.value)}
              placeholder="e.g. Latvian networking company"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={createMfg.isPending || !newMfgName.trim()}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </form>
      </div>
    </div>
  )
}

function DeviceTypesSection() {
  const queryClient = useQueryClient()
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const { data: deviceTypes } = useQuery({
    queryKey: ['device-types'],
    queryFn: () => deviceTypesApi.list(),
    select: (res) => res.data,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<DeviceTypeOption>) => deviceTypesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-types'] })
      setNewValue('')
      setNewLabel('')
      toast.success('Device type added')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to add device type')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeviceTypeOption> }) =>
      deviceTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-types'] })
      setEditingId(null)
      toast.success('Device type updated')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to update')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deviceTypesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-types'] })
      toast.success('Device type deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Cannot delete device type')),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newValue.trim() || !newLabel.trim()) return
    createMutation.mutate({
      value: newValue.trim(),
      label: newLabel.trim(),
      position: (deviceTypes?.length ?? 0),
    })
  }

  const startEdit = (dt: DeviceTypeOption) => {
    setEditingId(dt.id)
    setEditLabel(dt.label)
  }

  const saveEdit = (id: number) => {
    if (!editLabel.trim()) return
    updateMutation.mutate({ id, data: { label: editLabel.trim() } })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Device Types</h2>
      <p className="text-xs text-muted-foreground">
        Manage the list of device types available when creating hosts.
      </p>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-1.5 text-left font-medium">Value</th>
              <th className="px-3 py-1.5 text-left font-medium">Label</th>
              <th className="px-3 py-1.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {deviceTypes?.map((dt) => (
              <tr key={dt.id} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5 font-mono text-muted-foreground">{dt.value}</td>
                <td className="px-3 py-1.5">
                  {editingId === dt.id ? (
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={() => saveEdit(dt.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(dt.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="w-full rounded border border-input bg-background px-2 py-0.5 text-xs"
                    />
                  ) : (
                    <span
                      onClick={() => startEdit(dt)}
                      className="cursor-pointer hover:text-primary"
                    >
                      {dt.label}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex gap-0.5 justify-end">
                    <button
                      onClick={() => startEdit(dt)}
                      className="p-0.5 rounded hover:bg-accent"
                      title="Edit label"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(dt.id)}
                      className="p-0.5 rounded hover:bg-destructive/20"
                      title="Delete device type"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Value</label>
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="e.g. ups"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Label</label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. UPS"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || !newValue.trim() || !newLabel.trim()}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </form>
    </section>
  )
}
