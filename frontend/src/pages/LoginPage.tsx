import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import apiClient from '@/api/client'
import { toast } from 'sonner'
import { Shield, Eye, EyeOff, Lock } from 'lucide-react'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [needTotp, setNeedTotp]   = useState(false)
  const [totpCode, setTotpCode]   = useState('')
  const [totpError, setTotpError] = useState('')

  const navigate    = useNavigate()
  const location    = useLocation()
  const queryClient = useQueryClient()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  useEffect(() => { apiClient.get('/auth/login/') }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTotpError('')
    try {
      const res  = await authApi.login(username, password, needTotp ? totpCode : undefined)
      const data = res.data as Record<string, unknown>
      if (data.totp_required) {
        setNeedTotp(true)
        setLoading(false)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const errObj = err as { response?: { status?: number; data?: Record<string, unknown> } }
      const errStatus = errObj?.response?.status
      const errData   = errObj?.response?.data
      if (errData?.totp_required) {
        setNeedTotp(true)
        setTotpError('Nieprawidlowy kod 2FA. Sprobuj ponownie.')
      } else if (errStatus === 401) {
        if (needTotp) {
          setTotpError('Nieprawidlowy kod 2FA.')
        } else {
          toast.error('Nieprawidlowe dane logowania')
        }
      } else {
        toast.error('Blad polaczenia z serwerem')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-card text-card-foreground p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Lock className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-xl font-bold">RIPE-NET</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">IP Address Management</p>

        {!needTotp ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="username">Nazwa uzytkownika</label>
              <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                required autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="password">Haslo</label>
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
              {loading ? 'Logowanie...' : 'Zaloguj sie'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Weryfikacja dwuetapowa</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Otworz aplikacje uwierzytelniajaca i wpisz 6-cyfrowy kod dla konta <strong>{username}</strong>.
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="totp">Kod weryfikacyjny</label>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setTotpError('') }}
                placeholder="000000"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-widest font-mono outline-none focus:ring-2 focus:ring-ring text-lg"
                autoFocus
                autoComplete="one-time-code"
              />
              {totpError && <p className="text-xs text-destructive mt-1">{totpError}</p>}
            </div>
            <button type="submit" disabled={loading || totpCode.length < 6}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? 'Weryfikacja...' : 'Zweryfikuj'}
            </button>
            <button type="button" onClick={() => { setNeedTotp(false); setTotpCode(''); setTotpError('') }}
              className="w-full text-sm text-muted-foreground hover:text-foreground">
              Wróc do logowania
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
