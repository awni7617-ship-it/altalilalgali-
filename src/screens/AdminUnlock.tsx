import { useEffect, useState } from 'react'
import { ADMIN_EMAIL, APP } from '../config'
import { adminIsClaimed, canUseAdmin, claimAdmin, isAdminEmail, verifyAdmin } from '../lib/auth'
import { useApp } from '../state/app'
import { Field } from '../components/ui'
import { ChevronLeft, Lock } from '../components/icons'

export function AdminUnlock({ onBack, onUnlocked }: { onBack: () => void; onUnlocked: () => void }) {
  const { setAdmin, notify } = useApp()
  const [claimed, setClaimed] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void adminIsClaimed().then(setClaimed)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!canUseAdmin()) {
      setError('Admin access needs a secure (https) connection.')
      return
    }
    if (!isAdminEmail(email)) {
      setError('That address is not the admin account for this app.')
      return
    }

    setBusy(true)
    try {
      if (claimed) {
        if (await verifyAdmin(email, passcode)) {
          setAdmin(true)
          notify('Admin tools unlocked.')
          onUnlocked()
        } else {
          setError('That passcode is not right.')
        }
      } else {
        if (passcode !== confirm) {
          setError('The two passcodes do not match.')
          return
        }
        await claimAdmin(email, passcode)
        setAdmin(true)
        notify('Admin access is set up.')
        onUnlocked()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scroll">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <h1 className="h2 grow">Admin access</h1>
      </header>

      <div className="pad">
        <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span className="panel-icon">
            <Lock size={19} />
          </span>
          <div>
            <p className="h3">{claimed ? 'Sign in' : `Set up admin on this device`}</p>
            <p className="small" style={{ marginTop: 4 }}>
              {claimed
                ? `Enter the passcode you chose for ${APP.name}.`
                : `Only ${ADMIN_EMAIL} can run ${APP.name}. Choose a passcode and this device becomes your admin device.`}
            </p>
          </div>
        </div>

        <form onSubmit={submit} style={{ marginTop: 20 }}>
          <Field label="Admin email">
            <input
              className={`input${error && !isAdminEmail(email) ? ' field-error' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="you@example.com"
            />
          </Field>

          <Field
            label={claimed ? 'Passcode' : 'Choose a passcode'}
            hint={claimed ? undefined : 'At least 4 characters. You will need it on every device.'}
          >
            <input
              className="input"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              type="password"
              autoComplete={claimed ? 'current-password' : 'new-password'}
              placeholder="••••••"
            />
          </Field>

          {claimed === false && (
            <Field label="Confirm passcode">
              <input
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="••••••"
              />
            </Field>
          )}

          {error && (
            <p className="error-text" style={{ marginBottom: 14 }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary" type="submit" disabled={busy || claimed === null}>
            {busy ? 'Checking…' : claimed ? 'Unlock admin tools' : 'Set up admin access'}
          </button>
        </form>

        <p className="hint" style={{ marginTop: 18 }}>
          This gate keeps the admin tools out of the way on a shared device. It is not a substitute
          for a real sign-in — see the README before putting this in front of the public.
        </p>
      </div>

      <div className="tab-space" />
    </div>
  )
}
