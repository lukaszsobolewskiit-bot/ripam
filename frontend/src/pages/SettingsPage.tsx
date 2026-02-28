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

  // Add manufacturer form
  const [newMfgName, setNewMfgName] = useState('')
  const [newMfgDesc, setNewMfgDesc] = useState('')

  // Add model form (per manufacturer)
  const [addModelFor, setAddModelFor] = useState<number | null>(null)
  const [newModelName, setNewModelName] = useState('')
  const [newModelType, setNewModelType] = useState('')

  // Add port form (per model)
  const [addPortFor, setAddPortFor] = useState<number | null>(null)
  const [newPortName, setNewPortName] = useState('')
  const [newPortType, setNewPortType] = useState<PortType>('rj45')

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] })
      setAddPortFor(null)
      setNewPortName('')
      setNewPortType('rj45')
      toast.success('Port added')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to add port')),
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
            {/* Manufacturer row */}
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
                <span className="text-xs text-muted-foreground">({mfg.model_count} models)</span>
              </button>
              <button
                onClick={() => deleteMfg.mutate(mfg.id)}
                className="p-0.5 rounded hover:bg-destructive/20"
                title="Delete manufacturer"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Models */}
            {expandedManufacturer === mfg.id && (
              <div className="px-3 pb-3 space-y-2 pt-2">
                {mfg.device_models?.map((model) => (
                  <div key={model.id} className="rounded border border-border overflow-hidden ml-4">
                    {/* Model row */}
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
                            {model.device_type}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          ({model.port_templates?.length ?? 0} ports)
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setAddPortFor(addPortFor === model.id ? null : model.id)
                          setExpandedModel(model.id)
                        }}
                        className="p-0.5 rounded hover:bg-accent"
                        title="Add port"
                      >
                        <Plus className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => deleteModel.mutate(model.id)}
                        className="p-0.5 rounded hover:bg-destructive/20"
                        title="Delete model"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Ports list */}
                    {expandedModel === model.id && (
                      <div className="px-3 pb-2 pt-1 space-y-1 bg-muted/10 ml-4">
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

                        {/* Add port form */}
                        {addPortFor === model.id && (
                          <div className="flex items-end gap-2 pt-2 border-t border-border/50">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Port name</label>
                              <input
                                value={newPortName}
                                onChange={(e) => setNewPortName(e.target.value)}
                                placeholder="e.g. ether1"
                                className="w-28 rounded border border-input bg-background px-2 py-0.5 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Type</label>
                              <select
                                value={newPortType}
                                onChange={(e) => setNewPortType(e.target.value as PortType)}
                                className="rounded border border-input bg-background px-2 py-0.5 text-xs"
                              >
                                {PORT_TYPE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => {
                                if (!newPortName.trim()) return
                                createPort.mutate({
                                  device_model: model.id,
                                  name: newPortName.trim(),
                                  port_type: newPortType,
                                  position: model.port_templates?.length ?? 0,
                                })
                              }}
                              disabled={createPort.isPending || !newPortName.trim()}
                              className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
                            >
                              <Plus className="h-3 w-3" />
                              Add
                            </button>
                            <button
                              onClick={() => setAddPortFor(null)}
                              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add model form */}
                {addModelFor === mfg.id ? (
                  <div className="ml-4 flex items-end gap-2 pt-1">
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
                      <label className="text-[10px] text-muted-foreground">Device type (optional)</label>
                      <input
                        value={newModelType}
                        onChange={(e) => setNewModelType(e.target.value)}
                        placeholder="e.g. router"
                        className="w-24 rounded border border-input bg-background px-2 py-1 text-xs"
                      />
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


// ─── Device Types Section ─────────────────────────────────────────────────────

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
