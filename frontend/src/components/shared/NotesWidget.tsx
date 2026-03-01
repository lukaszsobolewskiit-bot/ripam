/**
 * Generic notes widget — reusable for Site, Project, Host, etc.
 * Pass in the query key, list/create/update/delete functions.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, Check, X, StickyNote, ChevronDown, ChevronRight } from 'lucide-react'

interface Note {
  id: number
  content: string
  created_at: string
  updated_at: string
}

interface NotesWidgetProps {
  queryKey: (string | number)[]
  fetchFn: () => Promise<{ data: Note[] }>
  createFn: (content: string) => Promise<unknown>
  updateFn: (id: number, content: string) => Promise<unknown>
  deleteFn: (id: number) => Promise<unknown>
  label?: string
  defaultOpen?: boolean
}

export function NotesWidget({
  queryKey, fetchFn, createFn, updateFn, deleteFn,
  label = 'Notes', defaultOpen = true,
}: NotesWidgetProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(defaultOpen)
  const [newContent, setNewContent] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [adding, setAdding] = useState(false)

  const { data: notes } = useQuery({
    queryKey,
    queryFn: fetchFn,
    select: (res) => res.data,
  })

  const createMutation = useMutation({
    mutationFn: () => createFn(newContent.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setNewContent('')
      setAdding(false)
      toast.success('Note added')
    },
    onError: (e: unknown) => toast.error(extractApiError(e, 'Failed')),
  })

  const updateMutation = useMutation({
    mutationFn: (id: number) => updateFn(id, editContent.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setEditId(null)
      toast.success('Note updated')
    },
    onError: (e: unknown) => toast.error(extractApiError(e, 'Failed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast.success('Note deleted')
    },
  })

  const noteList = notes ?? []

  return (
    <div>
      {/* Header */}
      <button
        className="flex items-center gap-1.5 w-full group mb-1.5"
        onClick={() => setOpen(o => !o)}
      >
        {open
          ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
          : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <StickyNote className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label} ({noteList.length})
        </span>
        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setAdding(true); setOpen(true) }}
            title="Add note"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </button>

      {open && (
        <div className="space-y-1.5 pl-0.5">
          {/* Existing notes */}
          {noteList.map((note) => (
            <div key={note.id}
              className="group rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 text-xs hover:border-border transition-colors">
              {editId === note.id ? (
                <div className="space-y-1.5">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={3}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.ctrlKey) updateMutation.mutate(note.id)
                      if (e.key === 'Escape') setEditId(null)
                    }}
                  />
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => setEditId(null)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => updateMutation.mutate(note.id)}
                      disabled={!editContent.trim() || updateMutation.isPending}
                      className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <p className="flex-1 whitespace-pre-wrap text-[11px] leading-relaxed">{note.content}</p>
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => { setEditId(note.id); setEditContent(note.content) }}
                      className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => { if (window.confirm('Delete this note?')) deleteMutation.mutate(note.id) }}
                      className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
              {editId !== note.id && (
                <p className="text-[9px] text-muted-foreground/60 mt-1">
                  {new Date(note.updated_at).toLocaleDateString()} {new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ))}

          {/* Add form */}
          {adding ? (
            <div className="rounded-md border border-dashed border-primary/50 bg-primary/5 p-2 space-y-1.5">
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Add a note… (Ctrl+Enter to save)"
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); if (newContent.trim()) createMutation.mutate() }
                  if (e.key === 'Escape') { setAdding(false); setNewContent('') }
                }}
              />
              <div className="flex gap-1 justify-end">
                <button onClick={() => { setAdding(false); setNewContent('') }}
                  className="p-1 rounded border border-border hover:bg-accent text-xs text-muted-foreground">
                  <X className="h-3 w-3" />
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!newContent.trim() || createMutation.isPending}
                  className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            noteList.length === 0 && !adding && (
              <button
                onClick={() => setAdding(true)}
                className="w-full rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add first note
              </button>
            )
          )}
          {noteList.length > 0 && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors pl-1"
            >
              <Plus className="h-3 w-3" /> add note
            </button>
          )}
        </div>
      )}
    </div>
  )
}
