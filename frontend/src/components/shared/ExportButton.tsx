/**
 * ExportButton — przycisk eksportu do PDF / XLSX używany we wszystkich zakładkach.
 * Pokazuje dropdown z dwoma opcjami, pobiera plik przez Blob API.
 */
import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, FileSpreadsheet, FileText, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExportButtonProps {
  onExcelFn: () => Promise<{ data: Blob }>
  onPdfFn:   () => Promise<{ data: Blob }>
  fileBaseName: string   // np. "MójProjekt-table"
  className?: string
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ExportButton({ onExcelFn, onPdfFn, fileBaseName, className }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Zamknij dropdown po kliknięciu poza
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const excelMut = useMutation({
    mutationFn: onExcelFn,
    onSuccess: (res) => {
      downloadBlob(res.data, `${fileBaseName}.xlsx`)
      toast.success('Pobrano plik Excel')
      setOpen(false)
    },
    onError: () => toast.error('Błąd eksportu Excel'),
  })

  const pdfMut = useMutation({
    mutationFn: onPdfFn,
    onSuccess: (res) => {
      downloadBlob(res.data, `${fileBaseName}.pdf`)
      toast.success('Pobrano plik PDF')
      setOpen(false)
    },
    onError: () => toast.error('Błąd eksportu PDF'),
  })

  const loading = excelMut.isPending || pdfMut.isPending

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className={cn(
          'flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs',
          'text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        title="Eksportuj"
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Download className="h-3.5 w-3.5" />
        }
        <span className="hidden sm:inline">Eksport</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
          <button
            onClick={() => excelMut.mutate()}
            disabled={excelMut.isPending}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Pobierz Excel (.xlsx)</span>
            {excelMut.isPending && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
          </button>
          <div className="h-px bg-border" />
          <button
            onClick={() => pdfMut.mutate()}
            disabled={pdfMut.isPending}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left disabled:opacity-50"
          >
            <FileText className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span>Pobierz PDF</span>
            {pdfMut.isPending && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
          </button>
        </div>
      )}
    </div>
  )
}
