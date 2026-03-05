import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { backupApi, deviceTypesApi, manufacturersApi, deviceModelsApi, portTemplatesApi, patchPanelsApi, patchPanelPortsApi, patchPanelConnectionsApi, panelPortTemplatesApi, panelPortTemplateEntriesApi, authApi } from '@/api/endpoints'
import { extractApiError, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Download, Upload, AlertTriangle, Trash2, Plus, Pencil, ChevronDown, ChevronRight, Package, Layers, Shield, ShieldCheck, KeyRound, Mail, Smartphone, Eye, EyeOff } from 'lucide-react'
import type { DeviceTypeOption, Manufacturer, DeviceModel, PortTemplate, PortType, PatchPanel, PatchPanelPort, PanelPortTemplate, PanelPortTemplateEntry } from '@/types'

const PORT_TYPE_OPTIONS: { value: PortType; label: string }[] = [
  { value: 'rj45', label: 'RJ45' },
  { value: 'sfp', label: 'SFP' },
  { value: 'sfp+', label: 'SFP+' },
  { value: 'qsfp', label: 'QSFP' },
  { value: 'usb', label: 'USB' },
  { value: 'serial', label: 'Serial' },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'catalog' | 'patch' | 'templates' | 'backup' | 'security'>('general')
  const navigate = useNavigate()
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
      a.download = `sobnet-backup-${new Date().toISOString().slice(0, 10)}.json`
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
        {(['general', 'catalog', 'patch', 'backup', 'security'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'catalog' ? 'Device Catalog' : tab === 'patch' ? 'Patch Panels' : tab === 'security' ? 'Bezpieczeństwo' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <DeviceTypesSection />
      )}

      {activeTab === 'catalog' && (
        <DeviceCatalogSection />
      )}

      {activeTab === 'patch' && (
        <PatchPanelSection />
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

      {activeTab === 'security' && (
        <SecuritySection navigate={navigate} />
      )}
    </div>
  )
}

// ─── Security Section ─────────────────────────────────────────────────────────

function SecuritySection({ navigate }: { navigate: (path: string) => void }) {
  const qc = useQueryClient()
  const [oldPw, setOldPw]     = useState('')
  const [newPw, setNewPw]     = useState('')
  const [newPw2, setNewPw2]   = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    select: r => r.data,
  })

  const changePwMut = useMutation({
    mutationFn: () => authApi.changePassword(oldPw, newPw),
    onSuccess: () => {
      toast.success('Hasło zostało zmienione')
      setOldPw(''); setNewPw(''); setNewPw2('')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Błąd zmiany hasła')
    },
  })

  const canSubmit = oldPw.length > 0 && newPw.length >= 8 && newPw === newPw2

  return (
    <div className="space-y-6 max-w-xl">
      {/* Zmiana hasła */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Zmiana hasła</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Obecne hasło</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPw}
                onChange={e => setOldPw(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm pr-9"
              />
              <button type="button" onClick={() => setShowOld(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showOld ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Nowe hasło <span className="text-[10px]">(min. 8 znaków)</span></label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm pr-9"
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Powtórz nowe hasło</label>
            <input
              type="password"
              value={newPw2}
              onChange={e => setNewPw2(e.target.value)}
              placeholder="••••••••"
              className={cn(
                "w-full rounded border bg-background px-3 py-1.5 text-sm",
                newPw2 && newPw !== newPw2 ? 'border-destructive' : 'border-input'
              )}
            />
            {newPw2 && newPw !== newPw2 && (
              <p className="text-[11px] text-destructive mt-1">Hasła nie są identyczne</p>
            )}
          </div>
          <button
            onClick={() => changePwMut.mutate()}
            disabled={!canSubmit || changePwMut.isPending}
            className="flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {changePwMut.isPending ? 'Zapisywanie…' : 'Zmień hasło'}
          </button>
        </div>
      </section>

      {/* Dwuskładnikowe uwierzytelnianie */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Uwierzytelnianie dwuskładnikowe (2FA)</h3>
          </div>
          {me?.totp_enabled
            ? <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center gap-1"><ShieldCheck className="h-3 w-3"/>Aktywne</span>
            : <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Nieaktywne</span>
          }
        </div>
        <p className="text-xs text-muted-foreground">
          Zabezpiecz konto za pomocą aplikacji uwierzytelniającej (TOTP), e-maila lub SMS.
        </p>
        <button
          onClick={() => navigate('/2fa')}
          className="flex items-center gap-2 rounded border border-border px-4 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <Shield className="h-3.5 w-3.5" />
          Zarządzaj ustawieniami 2FA
          <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
        </button>
      </section>
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

// ─── Patch Panel Section ──────────────────────────────────────────────────────

// Grouped for the select dropdown
const MEDIA_TYPE_OPTIONS: { value: string; label: string; group: string }[] = [
  // Copper
  { value: 'copper',      label: 'Copper — RJ45',        group: 'Copper' },
  { value: 'copper_rj11', label: 'Copper — RJ11',        group: 'Copper' },
  { value: 'copper_coax', label: 'Copper — Coax (BNC/F)',group: 'Copper' },
  // Fiber SM
  { value: 'fiber_lc_sm', label: 'Fiber SM — LC',        group: 'Fiber SM' },
  { value: 'fiber_sc_sm',  label: 'Fiber SM — SC',        group: 'Fiber SM' },
  { value: 'fiber_sc_apc', label: 'Fiber SM — SC/APC',    group: 'Fiber SM' },
  { value: 'fiber_sc_upc', label: 'Fiber SM — SC/UPC',    group: 'Fiber SM' },
  { value: 'fiber_st_sm', label: 'Fiber SM — ST',        group: 'Fiber SM' },
  { value: 'fiber_fc_sm', label: 'Fiber SM — FC',        group: 'Fiber SM' },
  { value: 'fiber_e2000', label: 'Fiber SM — E2000',     group: 'Fiber SM' },
  { value: 'fiber_lsh',   label: 'Fiber SM — LSH/E2000', group: 'Fiber SM' },
  // Fiber MM
  { value: 'fiber_lc_mm',  label: 'Fiber MM — LC',        group: 'Fiber MM' },
  { value: 'fiber_lc_apc', label: 'Fiber MM — LC/APC',    group: 'Fiber MM' },
  { value: 'fiber_sc_mm', label: 'Fiber MM — SC',        group: 'Fiber MM' },
  { value: 'fiber_st_mm', label: 'Fiber MM — ST',        group: 'Fiber MM' },
  { value: 'fiber_fc_mm', label: 'Fiber MM — FC',        group: 'Fiber MM' },
  // MTP/MPO
  { value: 'fiber_mpo12', label: 'Fiber MTP/MPO-12',     group: 'MTP/MPO' },
  { value: 'fiber_mpo24', label: 'Fiber MTP/MPO-24',     group: 'MTP/MPO' },
  { value: 'fiber_mtp',   label: 'Fiber MTP (generic)',  group: 'MTP/MPO' },
  // Pre-terminated
  { value: 'fiber_pretm', label: 'Fiber Pre-terminated', group: 'Pre-term' },
  // Other
  { value: 'hdmi',        label: 'HDMI',                 group: 'Other' },
  { value: 'displayport', label: 'DisplayPort',          group: 'Other' },
  { value: 'keystone',    label: 'Keystone',             group: 'Other' },
  { value: 'blank_1u',    label: 'Blank 1U',             group: 'Other' },
  { value: 'mixed',       label: 'Mixed / Keystone',     group: 'Other' },
]

const MEDIA_COLORS: Record<string, string> = {
  copper: '#3b82f6', copper_rj11: '#60a5fa', copper_coax: '#93c5fd',
  fiber_lc_sm: '#f59e0b', fiber_sc_sm: '#fbbf24', fiber_st_sm: '#fcd34d',
  fiber_fc_sm: '#fde68a', fiber_e2000: '#f97316', fiber_lsh: '#fb923c',
  fiber_lc_mm: '#a855f7', fiber_sc_mm: '#c084fc', fiber_st_mm: '#d8b4fe', fiber_fc_mm: '#e9d5ff',
  fiber_mpo12: '#ec4899', fiber_mpo24: '#f472b6', fiber_mtp: '#fb7185',
  fiber_pretm: '#34d399',
  fiber_sc_apc: '#10b981', fiber_sc_upc: '#34d399',
  fiber_lc_apc: '#6ee7b7',
  mixed: '#8b5cf6',
  hdmi: '#6b7280', displayport: '#9ca3af', keystone: '#d1d5db', blank_1u: '#e5e7eb',
}

function PatchPanelSection() {
  const queryClient = useQueryClient()
  const [expandedPanel, setExpandedPanel] = useState<number | null>(null)
  const [addPanelFor, setAddPanelFor] = useState<string | null>(null)
  const [editPanelId, setEditPanelId] = useState<number | null>(null)
  const [addingPortTo, setAddingPortTo] = useState<number | null>(null)
  const [newPortLabel, setNewPortLabel] = useState('')
  const [newPortNumber, setNewPortNumber] = useState<number>(1)

  // Form state
  const [newName, setNewName] = useState('')
  const [newMedia, setNewMedia] = useState('copper')
  const [newPortCount, setNewPortCount] = useState(24)
  const [newLocation, setNewLocation] = useState('')
  const [editName, setEditName] = useState('')
  const [editMedia, setEditMedia] = useState('copper')
  const [editLocation, setEditLocation] = useState('')

  const { data: panels } = useQuery({
    queryKey: ['patch-panels-settings'],
    queryFn: () => patchPanelsApi.list(),
    select: (res) => res.data,
  })

  const createPanel = useMutation({
    mutationFn: (data: Partial<PatchPanel>) => patchPanelsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels-settings'] })
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      setAddPanelFor(null)
      setNewName(''); setNewMedia('copper'); setNewPortCount(24); setNewLocation('')
      toast.success('Patch panel added')
    },
    onError: () => toast.error('Failed to create patch panel'),
  })

  const updatePanel = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PatchPanel> }) => patchPanelsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels-settings'] })
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      setEditPanelId(null)
      toast.success('Patch panel updated')
    },
  })

  const deletePanel = useMutation({
    mutationFn: (id: number) => patchPanelsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels-settings'] })
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      toast.success('Patch panel deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Cannot delete')),
  })

  const addPort = useMutation({
    mutationFn: ({ panelId, portNumber, label }: { panelId: number; portNumber: number; label: string }) =>
      patchPanelPortsApi.create({ panel: panelId, port_number: portNumber, label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels-settings'] })
      setAddingPortTo(null)
      setNewPortLabel('')
      toast.success('Port added')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Cannot add port')),
  })

  const deletePort = useMutation({
    mutationFn: (portId: number) => patchPanelPortsApi.delete(portId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels-settings'] })
      toast.success('Port removed')
    },
  })

  const panelList = panels ?? []
  const isMixed = (media: string) => media === 'mixed' || media === 'keystone'

  const mediaBadge = (media: string) => {
    const color = MEDIA_COLORS[media] ?? '#6b7280'
    const label = MEDIA_TYPE_OPTIONS.find(o => o.value === media)?.label ?? media
    return { color, label }
  }

  const renderMediaSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded border border-input bg-background px-2 py-1 text-xs">
      {Object.entries(
        MEDIA_TYPE_OPTIONS.reduce((acc, o) => {
          ;(acc[o.group] ??= []).push(o); return acc
        }, {} as Record<string, typeof MEDIA_TYPE_OPTIONS>)
      ).map(([group, opts]) => (
        <optgroup key={group} label={group}>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </optgroup>
      ))}
    </select>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Patch Panels</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Manage physical patch panels. For Keystone / Mixed panels you can add ports individually with custom labels.
      </p>

      {/* Add panel form */}
      {addPanelFor !== null ? (
        <div className="rounded-lg border border-dashed border-border p-4 space-y-3 bg-muted/10">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">New Patch Panel</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. PP-01" autoFocus
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">Media type *</label>
              {renderMediaSelect(newMedia, setNewMedia)}
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">
                {isMixed(newMedia) ? 'Initial port count (optional)' : 'Port count'}
              </label>
              <input type="number" min={0} max={96} value={newPortCount}
                onChange={e => setNewPortCount(Number(e.target.value))}
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">Location (optional)</label>
              <input value={newLocation} onChange={e => setNewLocation(e.target.value)}
                placeholder="e.g. Rack A, U3"
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
            </div>
          </div>
          {isMixed(newMedia) && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1">
              Mixed/Keystone panel — you can add ports individually after creating the panel.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => createPanel.mutate({ name: newName.trim(), media_type: newMedia as PatchPanel['media_type'], port_count: newPortCount, location: newLocation.trim() })}
              disabled={!newName.trim() || createPanel.isPending}
              className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">
              <Plus className="h-3 w-3" /> Add Panel
            </button>
            <button onClick={() => setAddPanelFor(null)}
              className="rounded border border-border px-3 py-1 text-xs hover:bg-accent">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddPanelFor('new')}
          className="flex items-center gap-1.5 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add Patch Panel
        </button>
      )}

      {/* Panel list */}
      <div className="space-y-2">
        {panelList.length === 0 && (
          <p className="text-xs text-muted-foreground italic py-2">No patch panels defined yet.</p>
        )}
        {panelList.map(panel => {
          const { color, label } = mediaBadge(panel.media_type)
          const usedCount = panel.ports.filter(p => p.device_port_info).length
          const isKeystone = isMixed(panel.media_type)

          return (
            <div key={panel.id} className="rounded-md border border-border overflow-hidden">
              {/* Panel header */}
              {editPanelId === panel.id ? (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-32 rounded border border-input bg-background px-2 py-0.5 text-xs" />
                  <div className="w-40">{renderMediaSelect(editMedia, setEditMedia)}</div>
                  <input value={editLocation} onChange={e => setEditLocation(e.target.value)}
                    placeholder="Location"
                    className="w-28 rounded border border-input bg-background px-2 py-0.5 text-xs" />
                  <button
                    onClick={() => updatePanel.mutate({ id: panel.id, data: { name: editName, media_type: editMedia as PatchPanel['media_type'], location: editLocation } })}
                    disabled={updatePanel.isPending}
                    className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50">Save</button>
                  <button onClick={() => setEditPanelId(null)}
                    className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/10">
                  <button onClick={() => setExpandedPanel(expandedPanel === panel.id ? null : panel.id)}
                    className="flex items-center gap-2 flex-1 text-left min-w-0">
                    {expandedPanel === panel.id
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <span className="w-6 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: color + '44', border: `1.5px solid ${color}` }} />
                    <span className="text-sm font-medium">{panel.name}</span>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0">{label}</span>
                    {panel.location && <span className="text-[10px] text-muted-foreground">{panel.location}</span>}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {panel.port_count}p · {usedCount} used
                    </span>
                  </button>
                  <button
                    onClick={() => { setEditPanelId(panel.id); setEditName(panel.name); setEditMedia(panel.media_type); setEditLocation(panel.location || '') }}
                    className="p-0.5 rounded hover:bg-accent" title="Edit">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => { if (window.confirm(`Delete "${panel.name}"?`)) deletePanel.mutate(panel.id) }}
                    className="p-0.5 rounded hover:bg-destructive/20" title="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Expanded port view */}
              {expandedPanel === panel.id && (
                <div className="px-4 pb-4 pt-3 bg-background space-y-3">

                  {/* Utilization bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${panel.port_count > 0 ? Math.round((usedCount / panel.port_count) * 100) : 0}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {usedCount}/{panel.port_count} used
                    </span>
                  </div>

                  {/* Port grid */}
                  {!isKeystone ? (
                    // Standard panel: fixed grid
                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(panel.port_count, 24)}, minmax(0, 1fr))` }}>
                      {panel.ports.map(port => {
                        const occ = !!port.device_port_info
                        return (
                          <div key={port.id}
                            className={`flex flex-col items-center gap-0.5 p-1 rounded border text-[8px] text-center ${occ ? 'border-border bg-muted/20' : 'border-dashed border-border/30'}`}
                            title={occ ? `${port.device_port_info?.host_name} / ${port.device_port_info?.device_port_name}` : port.label || `Port ${port.port_number}`}>
                            <span className="font-mono text-muted-foreground">{port.label || port.port_number}</span>
                            <div className="w-5 h-3 rounded-sm"
                              style={{ backgroundColor: occ ? color + '55' : '#6b728022', border: `1px solid ${occ ? color : '#6b728040'}` }} />
                            {occ && <span className="font-medium truncate w-full text-center">{port.device_port_info?.host_name?.split('.')[0]}</span>}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    // Keystone/Mixed panel: list view with individual port management
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Ports ({panel.ports.length})</span>
                        <button
                          onClick={() => {
                            setAddingPortTo(panel.id)
                            const maxPort = panel.ports.length > 0 ? Math.max(...panel.ports.map(p => p.port_number)) : 0
                            setNewPortNumber(maxPort + 1)
                            setNewPortLabel('')
                          }}
                          className="flex items-center gap-1 rounded border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                          <Plus className="h-2.5 w-2.5" /> Add port
                        </button>
                      </div>

                      {panel.ports.map(port => {
                        const occ = !!port.device_port_info
                        return (
                          <div key={port.id}
                            className="group flex items-center gap-2 rounded border border-border/60 bg-muted/10 px-2 py-1.5 hover:border-border transition-colors">
                            <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[8px] font-mono text-muted-foreground"
                              style={{ backgroundColor: color + '22', border: `1px solid ${color + '66'}` }}>
                              {port.port_number}
                            </div>
                            <span className="text-xs font-medium flex-1">{port.label || `Port ${port.port_number}`}</span>
                            {occ ? (
                              <span className="text-[10px] text-muted-foreground">
                                {port.device_port_info?.host_name} / {port.device_port_info?.device_port_name}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/50">free</span>
                            )}
                            {!occ && (
                              <button
                                onClick={() => { if (window.confirm(`Delete port "${port.label || port.port_number}"?`)) deletePort.mutate(port.id) }}
                                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all">
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        )
                      })}

                      {/* Add port form */}
                      {addingPortTo === panel.id && (
                        <div className="rounded border border-dashed border-primary/40 bg-primary/5 p-2 space-y-2 mt-1">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground block mb-0.5">Port number</label>
                              <input type="number" value={newPortNumber}
                                onChange={e => setNewPortNumber(Number(e.target.value))}
                                className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground block mb-0.5">Label (e.g. SC/APC-1, Room 101)</label>
                              <input value={newPortLabel}
                                onChange={e => setNewPortLabel(e.target.value)}
                                placeholder="e.g. SC/APC-1"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') addPort.mutate({ panelId: panel.id, portNumber: newPortNumber, label: newPortLabel })
                                  if (e.key === 'Escape') setAddingPortTo(null)
                                }}
                                className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
                            </div>
                          </div>
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => setAddingPortTo(null)}
                              className="px-2 py-1 rounded border border-border text-xs hover:bg-accent">Cancel</button>
                            <button
                              onClick={() => addPort.mutate({ panelId: panel.id, portNumber: newPortNumber, label: newPortLabel })}
                              disabled={addPort.isPending}
                              className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">
                              <Plus className="h-3 w-3" /> Add
                            </button>
                          </div>
                        </div>
                      )}

                      {panel.ports.length === 0 && addingPortTo !== panel.id && (
                        <p className="text-[10px] text-muted-foreground py-2 text-center">
                          No ports yet — click "Add port" to add keystone ports individually.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Szablony konfiguracji portów ─────────────────────────────────────────────

const PORT_TEMPLATE_MEDIA: { value: string; label: string; color: string }[] = [
  { value: 'fiber_sc_apc', label: 'Fiber SM — SC/APC', color: '#10b981' },
  { value: 'fiber_sc_upc', label: 'Fiber SM — SC/UPC', color: '#34d399' },
  { value: 'fiber_sc_sm',  label: 'Fiber SM — SC',     color: '#fbbf24' },
  { value: 'fiber_lc_sm',  label: 'Fiber SM — LC',     color: '#f59e0b' },
  { value: 'fiber_st_sm',  label: 'Fiber SM — ST',     color: '#fcd34d' },
  { value: 'fiber_fc_sm',  label: 'Fiber SM — FC',     color: '#fde68a' },
  { value: 'fiber_lc_mm',  label: 'Fiber MM — LC',     color: '#a855f7' },
  { value: 'fiber_lc_apc', label: 'Fiber MM — LC/APC', color: '#6ee7b7' },
  { value: 'fiber_sc_mm',  label: 'Fiber MM — SC',     color: '#c084fc' },
  { value: 'fiber_mpo12',  label: 'Fiber MPO-12',      color: '#ec4899' },
  { value: 'fiber_mpo24',  label: 'Fiber MPO-24',      color: '#f472b6' },
  { value: 'fiber_mtp',    label: 'Fiber MTP',         color: '#fb7185' },
  { value: 'copper',       label: 'Copper — RJ45',     color: '#3b82f6' },
  { value: 'copper_rj11',  label: 'Copper — RJ11',     color: '#60a5fa' },
  { value: 'copper_coax',  label: 'Copper — Coax',     color: '#93c5fd' },
  { value: 'other',        label: 'Inne',              color: '#9ca3af' },
]

function PortTemplateSection() {
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [addingTemplate, setAddingTemplate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  // Entry form
  const [addingEntry, setAddingEntry] = useState<number | null>(null) // template id
  const [entryCount, setEntryCount] = useState(4)
  const [entryMedia, setEntryMedia] = useState('fiber_sc_apc')
  const [entryFace, setEntryFace] = useState<'front' | 'back'>('front')
  const [entryPrefix, setEntryPrefix] = useState('')

  const { data: templates } = useQuery({
    queryKey: ['panel-port-templates'],
    queryFn: () => panelPortTemplatesApi.list(),
    select: r => r.data,
  })

  const createTemplate = useMutation({
    mutationFn: () => panelPortTemplatesApi.create({ name: newName.trim(), description: newDesc.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-port-templates'] })
      setAddingTemplate(false); setNewName(''); setNewDesc('')
      toast.success('Szablon utworzony')
    },
    onError: () => toast.error('Błąd tworzenia szablonu'),
  })

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => panelPortTemplatesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['panel-port-templates'] }); toast.success('Szablon usunięty') },
  })

  const addEntry = useMutation({
    mutationFn: (templateId: number) => panelPortTemplateEntriesApi.create({
      template: templateId, count: entryCount,
      media_type: entryMedia, face: entryFace,
      label_prefix: entryPrefix.trim(),
      sort_order: (templates?.find(t => t.id === templateId)?.entries.length ?? 0),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-port-templates'] })
      setAddingEntry(null); setEntryCount(4); setEntryMedia('fiber_sc_apc'); setEntryFace('front'); setEntryPrefix('')
      toast.success('Wpis dodany')
    },
    onError: () => toast.error('Błąd dodawania wpisu'),
  })

  const deleteEntry = useMutation({
    mutationFn: (id: number) => panelPortTemplateEntriesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['panel-port-templates'] }); toast.success('Wpis usunięty') },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Szablony konfiguracji portów</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Zdefiniuj gotowe zestawy portów dla patch paneli — np. <strong>4×FO SC/APC + 8×FO SC/UPC</strong>. 
        Szablon pojawi się jako opcja przy tworzeniu nowego panelu.
      </p>

      {/* Formularz nowego szablonu */}
      {addingTemplate ? (
        <div className="rounded-lg border border-dashed border-border p-4 space-y-3 bg-muted/10">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nowy szablon</p>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Nazwa szablonu *</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
              placeholder="np. 4×FO SC/APC + 8×FO SC/UPC"
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Opis (opcjonalny)</label>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Opis zastosowania szablonu…"
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createTemplate.mutate()} disabled={!newName.trim() || createTemplate.isPending}
              className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">
              <Plus className="h-3 w-3" /> Utwórz
            </button>
            <button onClick={() => setAddingTemplate(false)} className="rounded border border-border px-3 py-1 text-xs hover:bg-accent">Anuluj</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingTemplate(true)}
          className="flex items-center gap-1.5 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
          <Plus className="h-3.5 w-3.5" /> Nowy szablon
        </button>
      )}

      {/* Lista szablonów */}
      <div className="space-y-2">
        {(!templates || templates.length === 0) && (
          <p className="text-xs text-muted-foreground italic py-2">Brak szablonów portów.</p>
        )}
        {(templates ?? []).map(tpl => (
          <div key={tpl.id} className="rounded-md border border-border overflow-hidden">
            {/* Nagłówek szablonu */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/10">
              <button onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)}
                className="flex items-center gap-2 flex-1 text-left min-w-0">
                {expandedId === tpl.id
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                <span className="text-sm font-medium">{tpl.name}</span>
                {tpl.summary && tpl.summary !== '—' && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate">{tpl.summary}</span>
                )}
              </button>
              <button onClick={() => { if (window.confirm(`Usunąć szablon "${tpl.name}"?`)) deleteTemplate.mutate(tpl.id) }}
                className="p-0.5 rounded hover:bg-destructive/20 shrink-0" title="Usuń szablon">
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Wpisy szablonu */}
            {expandedId === tpl.id && (
              <div className="px-4 pb-4 pt-2 bg-background space-y-2 border-t border-border/30">
                {/* Tabela wpisów */}
                {tpl.entries.length > 0 && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[2rem_1fr_3rem_4rem_auto] gap-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                      <span>Ile</span><span>Typ złącza</span><span>Strona</span><span>Prefix</span><span></span>
                    </div>
                    {tpl.entries.map(entry => {
                      const media = PORT_TEMPLATE_MEDIA.find(m => m.value === entry.media_type)
                      return (
                        <div key={entry.id}
                          className="group grid grid-cols-[2rem_1fr_3rem_4rem_auto] gap-2 items-center rounded-md bg-muted/20 hover:bg-muted/40 px-2 py-1.5 text-xs transition-colors">
                          <span className="font-bold text-foreground">{entry.count}×</span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: media?.color ?? '#94a3b8' }} />
                            <span className="truncate">{entry.media_display.split('—').pop()?.trim() ?? entry.media_type}</span>
                          </span>
                          <span className={cn(
                            'text-[10px] rounded px-1 py-0.5 text-center font-medium',
                            entry.face === 'front' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600',
                          )}>{entry.face_display}</span>
                          <span className="font-mono text-muted-foreground truncate">{entry.label_prefix || '—'}</span>
                          <button onClick={() => deleteEntry.mutate(entry.id)}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all">
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Podsumowanie */}
                {tpl.entries.length > 0 && (
                  <div className="flex items-center gap-2 py-1 px-1 text-[10px] text-muted-foreground">
                    <span>Razem:</span>
                    <span className="font-semibold text-foreground">
                      {tpl.entries.reduce((s, e) => s + e.count, 0)} portów
                    </span>
                    <span className="ml-2 text-muted-foreground/60">{tpl.summary}</span>
                  </div>
                )}

                {/* Formularz nowego wpisu */}
                {addingEntry === tpl.id ? (
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2 mt-1">
                    <p className="text-[10px] font-semibold text-muted-foreground">Dodaj grupę portów</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Liczba portów</label>
                        <input type="number" min={1} max={48} value={entryCount}
                          onChange={e => setEntryCount(Number(e.target.value))}
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Strona montażu</label>
                        <div className="flex gap-1">
                          {(['front', 'back'] as const).map(f => (
                            <button key={f} onClick={() => setEntryFace(f)}
                              className={cn(
                                'flex-1 rounded border py-1 text-[10px] transition-colors',
                                entryFace === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent',
                              )}>
                              {f === 'front' ? 'Przód' : 'Tył'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">Typ złącza</label>
                      <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto">
                        {PORT_TEMPLATE_MEDIA.map(m => (
                          <button key={m.value} onClick={() => setEntryMedia(m.value)}
                            className={cn(
                              'flex items-center gap-1.5 rounded px-2 py-1.5 text-[10px] text-left border transition-colors',
                              entryMedia === m.value
                                ? 'border-primary bg-primary/10 text-primary font-medium'
                                : 'border-border hover:bg-muted/40',
                            )}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                            {m.label.split('—').pop()?.trim()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix etykiety (opcjonalny, np. FO-)</label>
                      <input value={entryPrefix} onChange={e => setEntryPrefix(e.target.value)}
                        placeholder="np. FO- → FO-1, FO-2…"
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
                    </div>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setAddingEntry(null)} className="px-2 py-1 rounded border border-border text-xs hover:bg-accent">Anuluj</button>
                      <button onClick={() => addEntry.mutate(tpl.id)} disabled={addEntry.isPending}
                        className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">
                        <Plus className="h-3 w-3" /> Dodaj grupę
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAddingEntry(tpl.id); setEntryCount(4); setEntryMedia('fiber_sc_apc'); setEntryFace('front'); setEntryPrefix('') }}
                    className="w-full flex items-center justify-center gap-1.5 rounded border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                    <Plus className="h-3 w-3" /> Dodaj grupę portów
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
