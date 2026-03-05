import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import apiClient from '@/api/client'
import { toast } from 'sonner'
import { Shield, Eye, EyeOff, Lock, Mail, Smartphone, KeyRound, ChevronLeft } from 'lucide-react'
import sobnetLogo from '@/assets/sobnet-logo.svg'

type TwoFAMethod = 'totp' | 'email' | 'sms'

interface AvailableMethods {
  totp: boolean
  email: boolean
  sms: boolean
}

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)

  // 2FA state
  const [need2FA, setNeed2FA]               = useState(false)
  const [methods, setMethods]               = useState<AvailableMethods>({ totp: false, email: false, sms: false })
  const [emailHint, setEmailHint]           = useState('')
  const [phoneHint, setPhoneHint]           = useState('')
  const [selectedMethod, setSelectedMethod] = useState<TwoFAMethod | null>(null)
  const [code, setCode]                     = useState('')
  const [codeError, setCodeError]           = useState('')
  const [codeSending, setCodeSending]       = useState(false)
  const [codeSent, setCodeSent]             = useState(false)

  const navigate    = useNavigate()
  const location    = useLocation()
  const queryClient = useQueryClient()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  useEffect(() => { apiClient.get('/auth/login/') }, [])

  // Count available methods
  const methodCount = [methods.totp, methods.email, methods.sms].filter(Boolean).length
  const onlyOneMethod = methodCount === 1

  // If only one method — auto-select it
  useEffect(() => {
    if (need2FA && onlyOneMethod) {
      if (methods.totp)  setSelectedMethod('totp')
      if (methods.email) setSelectedMethod('email')
      if (methods.sms)   setSelectedMethod('sms')
    }
  }, [need2FA, onlyOneMethod, methods])

  // Auto-send code for email/sms after method selection
  useEffect(() => {
    if (selectedMethod && selectedMethod !== 'totp' && !codeSent) {
      handleSendOtp(selectedMethod)
    }
  }, [selectedMethod])

  const handleSendOtp = async (method: 'email' | 'sms') => {
    setCodeSending(true)
    setCodeError('')
    try {
      await authApi.loginSendOtp(username, password, method)
      setCodeSent(true)
    } catch {
      setCodeError('Nie można wysłać kodu. Spróbuj ponownie.')
    } finally {
      setCodeSending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setCodeError('')
    try {
      const payload: Record<string, string> = { username, password }

      if (need2FA && selectedMethod) {
        if (selectedMethod === 'totp') {
          payload.otp_type  = 'totp'
          payload.totp_code = code
        } else {
          payload.otp_type = selectedMethod
          payload.otp_code = code
        }
      }

      const res  = await authApi.login(username, password,
        selectedMethod === 'totp' ? code : undefined)

      // Actually send full payload via custom call when 2FA active
      const data = res.data as Record<string, unknown>

      if (data.totp_required) {
        const m = (data.methods as AvailableMethods | undefined) ?? { totp: true, email: false, sms: false }
        setMethods(m)
        setEmailHint((data.email_hint as string) || '')
        setPhoneHint((data.phone_hint as string) || '')
        setNeed2FA(true)
        setLoading(false)
        return
      }

      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const errObj = err as { response?: { status?: number; data?: Record<string, unknown> } }
      const errData = errObj?.response?.data
      if (errData?.totp_required) {
        const m = (errData.methods as AvailableMethods | undefined) ?? { totp: true, email: false, sms: false }
        setMethods(m)
        setEmailHint((errData.email_hint as string) || '')
        setPhoneHint((errData.phone_hint as string) || '')
        setNeed2FA(true)
        setCodeError('Nieprawidłowy kod. Spróbuj ponownie.')
      } else if (errObj?.response?.status === 401) {
        if (need2FA) setCodeError('Nieprawidłowy kod 2FA.')
        else toast.error('Nieprawidłowe dane logowania')
      } else {
        toast.error('Błąd połączenia z serwerem')
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle full 2FA login submit (with correct payload)
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMethod || code.length < 6) return
    setLoading(true)
    setCodeError('')
    try {
      const payload: Record<string, string> = {
        username, password, otp_type: selectedMethod,
      }
      if (selectedMethod === 'totp') payload.totp_code = code
      else payload.otp_code = code

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (apiClient as any).post('/auth/login/', payload)
      const data = res.data as Record<string, unknown>
      if (data.totp_required) {
        setCodeError('Nieprawidłowy kod. Spróbuj ponownie.')
        setCode('')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: Record<string, unknown> } }
      const msg = (errObj?.response?.data?.detail as string) ?? 'Nieprawidłowy kod 2FA.'
      setCodeError(msg)
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const METHOD_INFO: Record<TwoFAMethod, { icon: typeof Shield; label: string; desc: string; hint?: string }> = {
    totp:  { icon: KeyRound,    label: 'Aplikacja uwierzytelniająca', desc: 'Google Authenticator, Aegis, Authy…' },
    email: { icon: Mail,        label: 'Email',  desc: emailHint ? `Wyślemy kod na ${emailHint}` : 'Wyślemy kod na Twój adres email', hint: emailHint },
    sms:   { icon: Smartphone,  label: 'SMS',    desc: phoneHint ? `Wyślemy SMS na ${phoneHint}` : 'Wyślemy kod SMS na Twój telefon',  hint: phoneHint },
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card text-card-foreground p-6 shadow-lg">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src={sobnetLogo} alt="SobNet" className="h-20 w-auto" />
          <p className="text-sm text-muted-foreground">IP Address Management</p>
        </div>

        {/* ── Step 1: credentials ─────────────────────────────────────────── */}
        {!need2FA && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="username">Nazwa użytkownika</label>
              <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                required autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="password">Hasło</label>
              <div className="relative">
                <input id="password" type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
                  required />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? 'Logowanie…' : 'Zaloguj się'}
            </button>
          </form>
        )}

        {/* ── Step 2: choose 2FA method ────────────────────────────────────── */}
        {need2FA && !selectedMethod && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Weryfikacja dwuetapowa</p>
                <p className="text-xs text-muted-foreground mt-0.5">Wybierz metodę weryfikacji dla <strong>{username}</strong></p>
              </div>
            </div>
            <div className="space-y-2">
              {(Object.entries(methods) as [TwoFAMethod, boolean][])
                .filter(([, enabled]) => enabled)
                .map(([method]) => {
                  const info = METHOD_INFO[method]
                  return (
                    <button key={method} onClick={() => setSelectedMethod(method)}
                      className="w-full flex items-center gap-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 px-4 py-3 text-left transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <info.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{info.label}</p>
                        <p className="text-xs text-muted-foreground">{info.desc}</p>
                      </div>
                    </button>
                  )
                })}
            </div>
            <button onClick={() => { setNeed2FA(false); setCode(''); setCodeError('') }}
              className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
              <ChevronLeft className="h-3.5 w-3.5" /> Wróć do logowania
            </button>
          </div>
        )}

        {/* ── Step 3: enter code ───────────────────────────────────────────── */}
        {need2FA && selectedMethod && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
              {(() => { const I = METHOD_INFO[selectedMethod].icon; return <I className="h-5 w-5 text-primary shrink-0 mt-0.5" /> })()}
              <div>
                <p className="text-sm font-semibold">{METHOD_INFO[selectedMethod].label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedMethod === 'totp'
                    ? 'Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.'
                    : codeSending
                      ? 'Wysyłanie kodu…'
                      : codeSent
                        ? `Kod wysłany. Sprawdź ${selectedMethod === 'email' ? 'skrzynkę email' : 'SMS'}.`
                        : 'Wysyłanie kodu…'
                  }
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Kod weryfikacyjny</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setCodeError('') }}
                placeholder="000000"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-widest font-mono outline-none focus:ring-2 focus:ring-ring text-lg"
                autoFocus autoComplete="one-time-code"
              />
              {codeError && <p className="text-xs text-destructive mt-1">{codeError}</p>}
            </div>

            {selectedMethod !== 'totp' && (
              <button type="button"
                onClick={() => { setCode(''); setCodeSent(false); handleSendOtp(selectedMethod as 'email'|'sms') }}
                disabled={codeSending}
                className="w-full text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                {codeSending ? 'Wysyłanie…' : 'Wyślij kod ponownie'}
              </button>
            )}

            <button type="submit" disabled={loading || code.length < 6}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? 'Weryfikacja…' : 'Zweryfikuj'}
            </button>

            <button type="button"
              onClick={() => {
                if (methodCount > 1) { setSelectedMethod(null); setCode(''); setCodeError(''); setCodeSent(false) }
                else { setNeed2FA(false); setSelectedMethod(null); setCode(''); setCodeError(''); setCodeSent(false) }
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
              <ChevronLeft className="h-3.5 w-3.5" />
              {methodCount > 1 ? 'Wybierz inną metodę' : 'Wróć do logowania'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
