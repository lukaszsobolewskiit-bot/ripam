/**
 * TwoFactorPage — zarządzanie 2FA (TOTP + Email + SMS) per użytkownik.
 * Dostępna z Settings → Security lub bezpośrednio z /settings
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import { toast } from 'sonner'
import {
  Shield, ShieldCheck, ShieldOff, Copy, ExternalLink,
  CheckCircle, AlertTriangle, Eye, EyeOff,
  KeyRound, Mail, Smartphone, ChevronRight, Loader2,
} from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SecretDisplay({ secret, uri }: { secret: string; uri: string }) {
  const [copied, setCopied] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const grouped = secret.match(/.{1,4}/g)?.join(' ') ?? secret
  const copy = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="space-y-3">
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
            className="p-1.5 rounded border border-border hover:bg-accent">
            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button onClick={copy} className="p-1.5 rounded border border-border hover:bg-accent">
            {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">Google Authenticator · Aegis · Authy · Bitwarden · FreeOTP</p>
      </div>
    </div>
  )
}

function OTPInput({ value, onChange, error, autoFocus }: {
  value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean
}) {
  return (
    <div>
      <input
        type="text" inputMode="numeric" maxLength={6} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="000000"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-center tracking-widest font-mono text-lg outline-none focus:ring-2 focus:ring-ring"
        autoComplete="one-time-code"
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}

function PasswordInput({ value, onChange, label = 'Hasło', autoFocus }: {
  value: string; onChange: (v: string) => void; label?: string; autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus}
          className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <button type="button" onClick={() => setShow(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

// ─── TOTP Section ─────────────────────────────────────────────────────────────

function TOTPSection({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'view' | 'setup' | 'disable'>('view')
  const [code, setCode]         = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')

  const { data: setupData, isLoading: setupLoading } = useQuery({
    queryKey: ['2fa-totp-setup'],
    queryFn: () => authApi.setup2fa(),
    select: r => r.data,
    enabled: mode === 'setup',
    staleTime: 0, gcTime: 0,
  })

  const enableMut = useMutation({
    mutationFn: () => authApi.confirm2fa(code),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', 'me'] }); toast.success('TOTP 2FA włączony!'); setMode('view'); setCode('') },
    onError: () => setError('Nieprawidłowy kod'),
  })

  const disableMut = useMutation({
    mutationFn: () => authApi.disable2fa(password, code),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', 'me'] }); toast.success('TOTP 2FA wyłączony'); setMode('view'); setCode(''); setPassword('') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Błąd wyłączania')
    },
  })

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-emerald-500/15' : 'bg-muted'}`}>
          <KeyRound className={`h-4 w-4 ${enabled ? 'text-emerald-600' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Aplikacja TOTP</p>
          <p className="text-xs text-muted-foreground">Google Authenticator, Aegis, Authy…</p>
        </div>
        {enabled
          ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">Włączony</span>
          : <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Wyłączony</span>
        }
      </div>

      <div className="px-4 py-4">
        {mode === 'view' && (
          <div className="flex gap-2">
            {!enabled
              ? <button onClick={() => { setMode('setup'); setError(''); setCode('') }}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                  <ShieldCheck className="h-4 w-4" /> Włącz TOTP
                </button>
              : <button onClick={() => { setMode('disable'); setError(''); setCode(''); setPassword('') }}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/5">
                  <ShieldOff className="h-4 w-4" /> Wyłącz TOTP
                </button>
            }
          </div>
        )}

        {mode === 'setup' && (
          <div className="space-y-4">
            {setupLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Generowanie sekretu…</div>}
            {setupData && (
              <>
                <p className="text-xs text-muted-foreground">Dodaj konto w aplikacji uwierzytelniającej, a następnie potwierdź kodem.</p>
                <SecretDisplay secret={setupData.secret} uri={setupData.uri} />
                <OTPInput value={code} onChange={v => { setCode(v); setError('') }} error={error} autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => setMode('view')} className="rounded border border-border px-3 py-2 text-sm hover:bg-accent">Anuluj</button>
                  <button onClick={() => enableMut.mutate()} disabled={code.length < 6 || enableMut.isPending}
                    className="flex-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
                    {enableMut.isPending ? 'Weryfikacja…' : 'Włącz TOTP'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'disable' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> Wyłączenie 2FA zmniejsza bezpieczeństwo konta.
            </div>
            <PasswordInput value={password} onChange={setPassword} autoFocus />
            <OTPInput value={code} onChange={v => { setCode(v); setError('') }} error={error} />
            <div className="flex gap-2">
              <button onClick={() => setMode('view')} className="rounded border border-border px-3 py-2 text-sm hover:bg-accent">Anuluj</button>
              <button onClick={() => disableMut.mutate()} disabled={!password || code.length < 6 || disableMut.isPending}
                className="flex-1 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground disabled:opacity-50">
                {disableMut.isPending ? 'Wyłączanie…' : 'Wyłącz TOTP'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Email 2FA Section ────────────────────────────────────────────────────────

function Email2FASection({ enabled, email }: { enabled: boolean; email: string }) {
  const qc = useQueryClient()
  const [mode, setMode]     = useState<'view' | 'setup' | 'disable'>('view')
  const [code, setCode]     = useState('')
  const [password, setPass] = useState('')
  const [error, setError]   = useState('')
  const [sent, setSent]     = useState(false)

  const sendMut = useMutation({
    mutationFn: () => authApi.email2faSetup('send'),
    onSuccess: () => { setSent(true); toast.success('Kod wysłany na email') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Nie można wysłać emaila')
    },
  })

  const confirmMut = useMutation({
    mutationFn: () => authApi.email2faSetup('confirm', code),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', 'me'] }); toast.success('Email 2FA włączony!'); setMode('view'); setCode(''); setSent(false) },
    onError: () => setError('Nieprawidłowy lub wygasły kod'),
  })

  const disableMut = useMutation({
    mutationFn: () => authApi.email2faDisable(password),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', 'me'] }); toast.success('Email 2FA wyłączony'); setMode('view'); setPass('') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Błąd')
    },
  })

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-emerald-500/15' : 'bg-muted'}`}>
          <Mail className={`h-4 w-4 ${enabled ? 'text-emerald-600' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Email (kod OTP)</p>
          <p className="text-xs text-muted-foreground">{email || 'Brak emaila na koncie'}</p>
        </div>
        {enabled
          ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">Włączony</span>
          : <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Wyłączony</span>
        }
      </div>

      <div className="px-4 py-4">
        {mode === 'view' && (
          <div className="flex gap-2">
            {!enabled
              ? <button onClick={() => { setMode('setup'); setError(''); setCode(''); setSent(false) }}
                  disabled={!email}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  title={!email ? 'Uzupełnij adres email w profilu' : ''}>
                  <ShieldCheck className="h-4 w-4" /> Włącz Email 2FA
                </button>
              : <button onClick={() => { setMode('disable'); setError(''); setPass('') }}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/5">
                  <ShieldOff className="h-4 w-4" /> Wyłącz Email 2FA
                </button>
            }
          </div>
        )}

        {mode === 'setup' && (
          <div className="space-y-4">
            {!sent ? (
              <>
                <p className="text-xs text-muted-foreground">Wyślemy 6-cyfrowy kod na <strong>{email}</strong>, który potwierdzi aktywację.</p>
                <div className="flex gap-2">
                  <button onClick={() => setMode('view')} className="rounded border border-border px-3 py-2 text-sm hover:bg-accent">Anuluj</button>
                  <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending}
                    className="flex-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
                    {sendMut.isPending ? 'Wysyłanie…' : 'Wyślij kod'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Wpisz kod z emaila wysłanego na <strong>{email}</strong>.</p>
                <OTPInput value={code} onChange={v => { setCode(v); setError('') }} error={error} autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => { setSent(false); setCode('') }} className="rounded border border-border px-3 py-2 text-sm hover:bg-accent">Wyślij ponownie</button>
                  <button onClick={() => confirmMut.mutate()} disabled={code.length < 6 || confirmMut.isPending}
                    className="flex-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
                    {confirmMut.isPending ? 'Weryfikacja…' : 'Potwierdź'}
                  </button>
                </div>
              </>
            )}
            {error && !sent && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {mode === 'disable' && (
          <div className="space-y-4">
            <PasswordInput value={password} onChange={p => { setPass(p); setError('') }} autoFocus />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setMode('view')} className="rounded border border-border px-3 py-2 text-sm hover:bg-accent">Anuluj</button>
              <button onClick={() => disableMut.mutate()} disabled={!password || disableMut.isPending}
                className="flex-1 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground disabled:opacity-50">
                {disableMut.isPending ? 'Wyłączanie…' : 'Wyłącz Email 2FA'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SMS 2FA Section ──────────────────────────────────────────────────────────

function SMS2FASection({ enabled, phone }: { enabled: boolean; phone: string }) {
  const qc = useQueryClient()
  const [mode, setMode]         = useState<'view' | 'setup' | 'disable'>('view')
  const [step, setStep]         = useState<'phone' | 'verify'>('phone')
  const [newPhone, setNewPhone] = useState(phone)
  const [code, setCode]         = useState('')
  const [password, setPass]     = useState('')
  const [error, setError]       = useState('')

  const setPhoneMut = useMutation({
    mutationFn: () => authApi.sms2faSetup('set_phone', { phone: newPhone }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', 'me'] }); sendMut.mutate() },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Błąd zapisu numeru')
    },
  })

  const sendMut = useMutation({
    mutationFn: () => authApi.sms2faSetup('send'),
    onSuccess: () => { setStep('verify'); toast.success('Kod SMS wysłany') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Nie można wysłać SMS')
    },
  })

  const confirmMut = useMutation({
    mutationFn: () => authApi.sms2faSetup('confirm', { code }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', 'me'] }); toast.success('SMS 2FA włączony!'); setMode('view'); setCode(''); setStep('phone') },
    onError: () => setError('Nieprawidłowy lub wygasły kod'),
  })

  const disableMut = useMutation({
    mutationFn: () => authApi.sms2faDisable(password),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth', 'me'] }); toast.success('SMS 2FA wyłączony'); setMode('view'); setPass('') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Błąd')
    },
  })

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-emerald-500/15' : 'bg-muted'}`}>
          <Smartphone className={`h-4 w-4 ${enabled ? 'text-emerald-600' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">SMS (kod OTP)</p>
          <p className="text-xs text-muted-foreground">{phone || 'Brak numeru telefonu'}</p>
        </div>
        {enabled
          ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">Włączony</span>
          : <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Wyłączony</span>
        }
      </div>

      <div className="px-4 py-4">
        {mode === 'view' && (
          <div className="flex gap-2">
            {!enabled
              ? <button onClick={() => { setMode('setup'); setStep('phone'); setError(''); setCode('') }}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                  <ShieldCheck className="h-4 w-4" /> Włącz SMS 2FA
                </button>
              : <button onClick={() => { setMode('disable'); setError(''); setPass('') }}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/5">
                  <ShieldOff className="h-4 w-4" /> Wyłącz SMS 2FA
                </button>
            }
          </div>
        )}

        {mode === 'setup' && step === 'phone' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Podaj numer telefonu (format międzynarodowy, np. +48600000000).</p>
            <div>
              <label className="text-xs font-medium block mb-1">Numer telefonu</label>
              <input value={newPhone} onChange={e => { setNewPhone(e.target.value); setError('') }} autoFocus
                placeholder="+48600000000"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring font-mono" />
              {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMode('view')} className="rounded border border-border px-3 py-2 text-sm hover:bg-accent">Anuluj</button>
              <button onClick={() => setPhoneMut.mutate()} disabled={!newPhone.trim() || setPhoneMut.isPending || sendMut.isPending}
                className="flex-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
                {(setPhoneMut.isPending || sendMut.isPending) ? 'Wysyłanie…' : 'Wyślij SMS'}
              </button>
            </div>
          </div>
        )}

        {mode === 'setup' && step === 'verify' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Wpisz kod z SMS wysłanego na <strong>{newPhone}</strong>.</p>
            <OTPInput value={code} onChange={v => { setCode(v); setError('') }} error={error} autoFocus />
            <div className="flex gap-2">
              <button onClick={() => { setStep('phone'); setCode('') }} className="rounded border border-border px-3 py-2 text-sm hover:bg-accent">Zmień numer</button>
              <button onClick={() => confirmMut.mutate()} disabled={code.length < 6 || confirmMut.isPending}
                className="flex-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
                {confirmMut.isPending ? 'Weryfikacja…' : 'Potwierdź'}
              </button>
            </div>
          </div>
        )}

        {mode === 'disable' && (
          <div className="space-y-4">
            <PasswordInput value={password} onChange={p => { setPass(p); setError('') }} autoFocus />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setMode('view')} className="rounded border border-border px-3 py-2 text-sm hover:bg-accent">Anuluj</button>
              <button onClick={() => disableMut.mutate()} disabled={!password || disableMut.isPending}
                className="flex-1 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground disabled:opacity-50">
                {disableMut.isPending ? 'Wyłączanie…' : 'Wyłącz SMS 2FA'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main 2FA Page ─────────────────────────────────────────────────────────────

export function TwoFactorPage() {
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn:  () => authApi.me(),
    select:   r => r.data,
  })

  const activeCount = [me?.totp_enabled, me?.email_2fa_enabled, me?.sms_2fa_enabled].filter(Boolean).length
  const anyEnabled  = activeCount > 0

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${anyEnabled ? 'bg-emerald-500/15' : 'bg-muted'}`}>
          {anyEnabled ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div>
          <h1 className="text-base font-bold">Weryfikacja dwuetapowa (2FA)</h1>
          <p className="text-xs text-muted-foreground">
            {anyEnabled
              ? `${activeCount} metoda${activeCount > 1 ? ' aktywne' : ' aktywna'} — konto jest zabezpieczone`
              : 'Żadna metoda nie jest aktywna — zalecamy włączenie 2FA'
            }
          </p>
        </div>
        {anyEnabled && (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700">
            Aktywne
          </span>
        )}
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Jak działa 2FA?</p>
        <p>Po włączeniu, przy każdym logowaniu zostaniesz poproszony o dodatkowy kod weryfikacyjny. Możesz aktywować kilka metod jednocześnie i wybierać między nimi przy logowaniu.</p>
      </div>

      {/* Methods */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          Dostępne metody
          {me && <span className="text-xs font-normal text-muted-foreground">({activeCount}/3 aktywnych)</span>}
        </h2>
        {me && (
          <>
            <TOTPSection  enabled={me.totp_enabled} />
            <Email2FASection enabled={me.email_2fa_enabled} email={me.email || ''} />
            <SMS2FASection   enabled={me.sms_2fa_enabled}   phone={me.phone_number || ''} />
          </>
        )}
      </div>

      {/* Backup info */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs space-y-1">
        <p className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> Ważne — kody zapasowe
        </p>
        <p className="text-muted-foreground">
          Jeśli stracisz dostęp do wszystkich metod 2FA, skontaktuj się z administratorem systemu,
          który może wyłączyć 2FA z poziomu panelu użytkowników.
        </p>
      </div>
    </div>
  )
}
