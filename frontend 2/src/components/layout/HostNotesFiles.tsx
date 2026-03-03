import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hostNotesApi, hostFilesApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import type { HostNote, HostFile } from '@/types'
import { Plus, Pencil, Trash2, Check, X, Upload, Download, File, FileText, StickyNote, ChevronDown, ChevronRight } from 'lucide-react'

interface HostNotesFilesProps {
  hostId: number
}

export function HostNotesFiles({ hostId }: HostNotesFilesProps) {
  const [notesOpen, setNotesOpen] = useState(true)
  const [filesOpen, setFilesOpen] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [editNoteId, setEditNoteId] = useState<number | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: notes } = useQuery({
    queryKey: ['host-notes', hostId],
    queryFn: () => hostNotesApi.list({ host: String(hostId) }),
    select: (res) => res.data,
  })

  const { data: files } = useQuery({
    queryKey: ['host-files', hostId],
    queryFn: () => hostFilesApi.list({ host: String(hostId) }),
    select: (res) => res.data,
  })

  const createNote = useMutation({
    mutationFn: () => hostNotesApi.create({ host: hostId, content: newNote.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-notes', hostId] })
      setNewNote('')
      toast.success('Note added')
    },
    onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to add note')),
  })

  const updateNote = useMutation({
    mutationFn: (id: number) => hostNotesApi.update(id, { content: editNoteContent.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-notes', hostId] })
      setEditNoteId(null)
      toast.success('Note updated')
    },
  })

  const deleteNote = useMutation({
    mutationFn: (id: number) => hostNotesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-notes', hostId] })
      toast.success('Note deleted')
    },
  })

  const uploadFile = useMutation({
    mutationFn: (file: File) => hostFilesApi.upload(hostId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-files', hostId] })
      toast.success('File uploaded')
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to upload file')),
  })

  const deleteFile = useMutation({
    mutationFn: (id: number) => hostFilesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-files', hostId] })
      toast.success('File deleted')
    },
  })

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div className="space-y-3">
      {/* ── Notes ── */}
      <div>
        <button
          onClick={() => setNotesOpen((v) => !v)}
          className="flex items-center gap-1.5 w-full text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1.5 hover:text-foreground transition-colors"
        >
          {notesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <StickyNote className="h-3 w-3" />
          Notes ({notes?.length ?? 0})
        </button>

        {notesOpen && (
          <div className="space-y-2">
            {notes?.map((note: HostNote) => (
              <div key={note.id} className="rounded border border-border bg-muted/20 p-2 text-xs group">
                {editNoteId === note.id ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editNoteContent}
                      onChange={(e) => setEditNoteContent(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full rounded border border-input bg-background px-2 py-1 text-xs resize-none"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => updateNote.mutate(note.id)}
                        disabled={!editNoteContent.trim() || updateNote.isPending}
                        className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditNoteId(null)}
                        className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="whitespace-pre-wrap break-words">{note.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatDate(note.created_at)}</p>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditNoteId(note.id); setEditNoteContent(note.content) }}
                        className="p-0.5 rounded hover:bg-accent"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Delete note?')) deleteNote.mutate(note.id) }}
                        className="p-0.5 rounded hover:bg-destructive/20"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add note */}
            <div className="space-y-1">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                placeholder="Add a note..."
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey && newNote.trim()) {
                    e.preventDefault()
                    createNote.mutate()
                  }
                }}
              />
              <button
                onClick={() => createNote.mutate()}
                disabled={!newNote.trim() || createNote.isPending}
                className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                {createNote.isPending ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Files ── */}
      <div>
        <button
          onClick={() => setFilesOpen((v) => !v)}
          className="flex items-center gap-1.5 w-full text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1.5 hover:text-foreground transition-colors"
        >
          {filesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <File className="h-3 w-3" />
          Files ({files?.length ?? 0})
        </button>

        {filesOpen && (
          <div className="space-y-2">
            {files?.map((file: HostFile) => (
              <div key={file.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs group">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" title={file.name}>{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatSize(file.size)} · {formatDate(file.created_at)}</p>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {file.url && (
                    <a
                      href={file.url}
                      download={file.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-0.5 rounded hover:bg-accent"
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  )}
                  <button
                    onClick={() => { if (window.confirm(`Delete file "${file.name}"?`)) deleteFile.mutate(file.id) }}
                    className="p-0.5 rounded hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              </div>
            ))}

            {/* Upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadFile.mutate(file)
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadFile.isPending}
                className="flex items-center gap-1.5 rounded border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors w-full justify-center"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadFile.isPending ? 'Uploading...' : 'Upload File'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
