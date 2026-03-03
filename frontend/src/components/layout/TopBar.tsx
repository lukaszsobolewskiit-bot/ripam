import { useState, useRef, useEffect } from 'react'
import { useUIStore } from '@/stores/ui.store'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import {
  Search, Moon, Sun, PanelLeftClose, PanelLeft,
  Network, Map, Table, Users, Settings, LogOut,
  Shield, ShieldCheck, ChevronDown, User as UserIcon, LayoutGrid,
} from 'lucide-react'

// ─── User dropdown menu ───────────────────────────────────────────────────────

function UserMenu({ me }: { me: { username: string; role: string; totp_enabled?: boolean } }) {
  const [open, setOpen]  = useState(false)
  const ref              = useRef<HTMLDivElement>(null)
  const navigate         = useNavigate()
  const qc               = useQueryClient()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const logoutMut = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      qc.clear()
      navigate('/login', { replace: true })
    },
  })

  const initials = me.username.slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
          open ? 'bg-accent' : 'hover:bg-accent',
        )}
      >
        {/* Avatar */}
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
          {initials}
        </div>
        <span className="hidden md:block max-w-[100px] truncate text-xs">{me.username}</span>
        {me.totp_enabled && (
          <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" title="2FA wlaczone" />
        )}
        <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden">
          {/* User info header */}
          <div className="px-3 py-2.5 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{me.username}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{me.role}</p>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); navigate('/2fa') }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
            >
              {me.totp_enabled
                ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                : <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              }
              <span>Weryfikacja 2FA</span>
              {me.totp_enabled
                ? <span className="ml-auto text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">Wl.</span>
                : <span className="ml-auto text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Wyl.</span>
              }
            </button>
          </div>

          <div className="border-t border-border/60 py-1">
            <button
              onClick={() => logoutMut.mutate()}
              disabled={logoutMut.isPending}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-destructive/10 hover:text-destructive transition-colors text-left text-muted-foreground"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>{logoutMut.isPending ? 'Wylogowywanie...' : 'Wyloguj sie'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar() {
  const {
    sidebarOpen, toggleSidebar,
    darkMode, toggleDarkMode, setCommandPaletteOpen,
  } = useUIStore()
  const navigate  = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const location  = useLocation()

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn:  () => authApi.me(),
    select:   (res) => res.data,
  })

  const pathAfterProject = projectId
    ? location.pathname.split(`/projects/${projectId}/`)[1] ?? ''
    : ''
  const activeView = pathAfterProject.startsWith('geo')
    ? 'geo'
    : pathAfterProject.startsWith('table')
      ? 'table'
      : pathAfterProject.startsWith('racks')
        ? 'racks'
        : 'topology'

  const viewButtons: { mode: 'topology' | 'geo' | 'table' | 'racks'; icon: typeof Network; label: string; shortLabel: string }[] = [
    { mode: 'table',    icon: Table,      label: 'Table',    shortLabel: 'Tab'  },
    { mode: 'topology', icon: Network,    label: 'Topology', shortLabel: 'Topo' },
    { mode: 'geo',      icon: Map,        label: 'Geo Map',  shortLabel: 'Geo'  },
    { mode: 'racks',    icon: LayoutGrid, label: 'Racks',    shortLabel: 'Rack' },
  ]

  const handleViewChange = (mode: 'topology' | 'geo' | 'table' | 'racks') => {
    if (!projectId) return
    } else if (mode === 'table') {
      navigate(`/projects/${projectId}/table/network`)
    } else if (mode === 'racks') {
      navigate(`/projects/${projectId}/racks`)
    } else {
      navigate(`/projects/${projectId}/${mode}`)
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-2 md:px-4 gap-1 md:gap-0">
      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        <button onClick={toggleSidebar} className="p-1.5 rounded-md hover:bg-accent" title="Toggle sidebar">
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>
        <button onClick={() => navigate('/')} className="font-semibold text-sm tracking-tight hover:text-primary transition-colors">RIPE-NET</button>
      </div>

      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="md:flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors md:min-w-[240px] hidden"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">Ctrl+K</kbd>
      </button>
      <button onClick={() => setCommandPaletteOpen(true)} className="p-1.5 rounded-md hover:bg-accent md:hidden" title="Search">
        <Search className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
        {projectId && (
          <div className="flex items-center rounded-md border border-border p-0.5 mr-1 md:mr-2">
            {viewButtons.map(({ mode, icon: Icon, label, shortLabel }) => (
              <button key={mode} onClick={() => handleViewChange(mode)}
                className={cn(
                  'flex items-center gap-1 rounded px-1.5 md:px-2 py-1 text-xs transition-colors',
                  activeView === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
                title={label}>
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline md:hidden">{shortLabel}</span>
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>
        )}

        {me?.role === 'admin' && (
          <>
            <button onClick={() => navigate('/users')} className="p-1.5 rounded-md hover:bg-accent" title="Manage Users">
              <Users className="h-4 w-4" />
            </button>
            <button onClick={() => navigate('/settings')} className="p-1.5 rounded-md hover:bg-accent" title="Settings">
              <Settings className="h-4 w-4" />
            </button>
          </>
        )}

        <button onClick={toggleDarkMode} className="p-1.5 rounded-md hover:bg-accent" title="Toggle dark mode">
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* User dropdown */}
        {me && (
          <>
            <button
              onClick={() => {
                if (window.confirm('Wylogować się?')) {
                  import('@/api/endpoints').then(({ authApi }) => {
                    authApi.logout().finally(() => {
                      window.location.href = '/login'
                    })
                  })
                }
              }}
              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
              title="Wyloguj się"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <UserMenu me={me} />
          </>
        )}
      </div>
    </header>
  )
}
