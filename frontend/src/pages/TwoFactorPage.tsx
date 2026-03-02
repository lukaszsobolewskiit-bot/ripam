import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import { toast } from 'sonner'
import {
  Shield, ShieldCheck, ShieldOff, Copy, ExternalLink,
  CheckCircle, AlertTriangle, Eye, EyeOff,
} from 'lucide-react'

// Generuje prosty SVG QR-like wizualizację sekretu (nie prawdziwy QR)
function SecretDisplay({ secret, uri }: { secret: string; uri: string }) {
  const [copied, setCopied] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Grupuj sekret co 4 znaki dla czytelności
  const grouped = secret.match(/.{1,4}/g)?.join(' ') ?? secret

  return (
    <div className="space-y-4">
      {/* Klikalny link dla aplikacji mobilnych */}
      <a href={uri}
        className="flex items-center gap-2 w-full rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        title="Otwórz w aplikacji uwierzytelniającej">
        <ExternalLink className="h-4 w-4 shrink-0" />
        <span>Otwórz w aplikacji uwierzytelniającej</span>
      </a>

      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Lub wpisz sekret ręcznie:</p>
        <div className="flex items-center gap-2">
          <code className={`flex-1 text-sm font-mono bg-background rounded border border-border px-2 py-1.5 ${showSecret ? '' : 'blur-sm select-none'}`}>
            {grouped}
          </code>
          <button onClick={() => setShowSecret(v => !v)}
            className="p-1.5 rounded border border-border hover:bg-accent" title="Pokaż/ukryj sekret">
            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button onClick={copy}
            className="p-1.5 rounded border border-border hover:bg-accent" title="Kopiuj">
            {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Aplikacje: Google Authenticator, Aegis, Authy, 1Password, Bitwarden, FreeOTP
        </p>
      </div>
    </div>
  )
}

// ─── Setup 2FA ────────────────────────────────────────────────────────────────

function Setup2FA({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [code, setCode]   = useState('')
  const [error, setError] = useState('')

  const { data: setupData, isLoading } = useQuery({
    queryKey: ['2fa-setup'],
    queryFn: () => authApi.setup2fa(),
    select: r => r.data,
    staleTime: 0,
    gcTime: 0,
  })

  const confirmMut = useMutation({
    mutationFn: () => authApi.confirm2fa(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      qc.removeQueries({ queryKey: ['2fa-setup'] })
      toast.success('2FA zostalo wlaczone!')
      onDone()
    },
    onError: () => setError('Nieprawidlowy kod. Sprawdz czas w aplikacji i sprobuj ponownie.'),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Generowanie sekretu...</div>
  )

  if (!setupData) return null

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Krok 1 — Dodaj konto w aplikacji</h3>
        <p className="text-xs text-muted-foreground">
          Uzyj linku ponizej lub wpisz sekret recznie w aplikacji uwierzytelniajace.
        </p>
      </div>

      <SecretDisplay secret={setupData.secret} uri={setupData.uri} />

      <div className="border-t border-border pt-4 space-y-1">
        <h3 className="text-sm font-semibold">Krok 2 — Potwierdz kodem</h3>
        <p className="text-xs text-muted-foreground">Wpisz 6-cyfrowy kod z aplikacji aby potwierdzic konfiguracje.</p>
      </div>

      <div>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
          placeholder="000000"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-center tracking-widest font-mono text-lg outline-none focus:ring-2 focus:ring-ring"
          autoFocus
          autoComplete="one-time-code"
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>

      <button onClick={() => confirmMut.mutate()} disabled={code.length < 6 || confirmMut.isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {confirmMut.isPending ? 'Weryfikacja...' : 'Wlacz 2FA'}
      </button>
    </div>
  )
}

// ─── Disable 2FA ─────────────────────────────────────────────────────────────

function Disable2FA({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [password, setPassword]   = useState('')
  const [totpCode, setTotpCode]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [error, setError]         = useState('')

  const disableMut = useMutation({
    mutationFn: () => authApi.disable2fa(password, totpCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('2FA zostalo wylaczone')
      onDone()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Blad wylaczania 2FA')
    },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-xs text-destructive">
          Wylaczenie 2FA zmniejsza bezpieczenstwo konta. Upewnij sie, ze masz inne zabezpieczenia.
        </p>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1">Haslo</label>
        <div className="relative">
          <input type={showPwd ? 'text' : 'password'} value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
            autoFocus />
          <button type="button" onClick={() => setShowPwd(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1">Kod 2FA z aplikacji</label>
        <input type="text" inputMode="numeric" maxLength={6} value={totpCode}
          onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setError('') }}
          placeholder="000000"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-center tracking-widest font-mono text-lg outline-none focus:ring-2 focus:ring-ring"
          autoComplete="one-time-code" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={onDone} className="flex-1 rounded border border-border px-3 py-2 text-sm hover:bg-accent">Anuluj</button>
        <button onClick={() => disableMut.mutate()}
          disabled={!password || totpCode.length < 6 || disableMut.isPending}
          className="flex-1 rounded bg-destructive px-3 py-2 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
          {disableMut.isPending ? 'Wylaczanie...' : 'Wylacz 2FA'}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TwoFactorPage() {
  const [mode, setMode] = useState<'view' | 'setup' | 'disable'>('view')

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn:  () => authApi.me(),
    select:   r => r.data,
  })

  const enabled = me?.totp_enabled ?? false

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-emerald-500/15' : 'bg-muted'}`}>
            {enabled
              ? <ShieldCheck className="h-5 w-5 text-emerald-600" />
              : <Shield className="h-5 w-5 text-muted-foreground" />
            }
          </div>
          <div>
            <h1 className="font-semibold">Weryfikacja dwuetapowa (2FA)</h1>
            <p className="text-xs text-muted-foreground">
              {enabled ? 'Aktywna — konto jest zabezpieczone kodem TOTP' : 'Nieaktywna — zalecamy wlaczenie 2FA'}
            </p>
          </div>
          {enabled && (
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700">
              Wlaczona
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {mode === 'view' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Weryfikacja dwuetapowa (TOTP) dodaje dodatkowa warstwe ochrony do Twojego konta.
                Po wlaczeniu, przy kazdym logowaniu bedziez musiez podac 6-cyfrowy kod z aplikacji uwierzytelniajace.
              </p>
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5 text-xs">
                <p className="font-medium">Obslugiwane aplikacje:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Google Authenticator', 'Aegis (Android)', 'Raivo (iOS)', 'Authy', 'Bitwarden', 'FreeOTP'].map(app => (
                    <span key={app} className="px-2 py-0.5 rounded bg-background border border-border">{app}</span>
                  ))}
                </div>
              </div>
              {enabled ? (
                <button onClick={() => setMode('disable')}
                  className="w-full flex items-center justify-center gap-2 rounded-md border border-destructive/50 px-4 py-2 text-sm text-destructive hover:bg-destructive/5">
                  <ShieldOff className="h-4 w-4" /> Wylacz 2FA
                </button>
              ) : (
                <button onClick={() => setMode('setup')}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <ShieldCheck className="h-4 w-4" /> Wlacz 2FA
                </button>
              )}
            </div>
          )}

          {mode === 'setup'   && <Setup2FA   onDone={() => setMode('view')} />}
          {mode === 'disable' && <Disable2FA onDone={() => setMode('view')} />}
        </div>
      </div>
    </div>
  )
}
