/**
 * Puerta de acceso: inicio de sesión / registro con Firebase Auth, verificación de
 * membresía (rol) y subida inicial a la nube de los datos guardados en el teléfono.
 * Solo cuando todo está listo se monta la granja (y sus suscripciones a Firestore).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Eye, EyeOff, Loader2, LogOut, Mail, RefreshCw, ShieldAlert, UploadCloud } from 'lucide-react';
import { auth, authErrorMessage, loginWithEmail, logoutUser, registerWithEmail, sendPasswordEmail } from '../../firebase';
import {
  clearSessionCache,
  resolveAccess,
  subscribeMembers,
  subscribeMyMember,
  type MemberDoc,
} from '../../services/authService';
import { dbService } from '../../services/dbService';

export interface AppSession {
  user: User;
  member: MemberDoc;
  members: MemberDoc[];
  signOut: () => Promise<void>;
  /** Aviso a mostrar al entrar (p. ej. datos subidos a la nube). */
  welcome?: string;
}

type GateState =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | { kind: 'resolving'; user: User }
  | { kind: 'migrating'; user: User }
  | { kind: 'denied'; user: User; email: string }
  | { kind: 'error'; user: User; message: string }
  | { kind: 'ready'; user: User; member: MemberDoc; welcome?: string };

export const AuthGate: React.FC<{ children: (session: AppSession) => React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>({ kind: 'checking' });
  const [members, setMembers] = useState<MemberDoc[]>([]);
  const runId = useRef(0);

  const signOut = useCallback(async () => {
    clearSessionCache();
    await logoutUser().catch(() => undefined);
  }, []);

  const enter = useCallback(async (user: User) => {
    const id = ++runId.current;
    setState({ kind: 'resolving', user });
    try {
      const access = await resolveAccess(user);
      if (id !== runId.current) return;
      if (access.status === 'denied') return setState({ kind: 'denied', user, email: access.email });
      let welcome: string | undefined = access.firstOwner
        ? 'Bienvenido: eres el Administrador de la granja. Ya puedes invitar miembros.'
        : access.joinedByInvitation
          ? `Bienvenido a la granja (${access.member.role}).`
          : undefined;
      if (!dbService.isLocalDataMigrated()) {
        setState({ kind: 'migrating', user });
        const { uploaded } = await dbService.migrateLocalToCloud();
        if (id !== runId.current) return;
        if (uploaded > 0) welcome = `☁️ ${uploaded} registros de este teléfono se subieron a la nube.${welcome ? ` ${welcome}` : ''}`;
      }
      setState({ kind: 'ready', user, member: access.member, welcome });
    } catch (err: any) {
      if (id !== runId.current) return;
      setState({ kind: 'error', user, message: err?.message ? String(err.message) : 'No se pudo conectar con la nube.' });
    }
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          runId.current++;
          setMembers([]);
          setState({ kind: 'signedOut' });
        } else void enter(user);
      }),
    [enter]
  );

  // Con la sesión lista: mi rol en vivo (si me quitan el acceso, se bloquea) y la lista de miembros
  const readyUid = state.kind === 'ready' ? state.user.uid : null;
  useEffect(() => {
    if (!readyUid) return;
    const offMe = subscribeMyMember(readyUid, (m) => {
      setState((s) => {
        if (s.kind !== 'ready' || s.user.uid !== readyUid) return s;
        if (!m) return { kind: 'denied', user: s.user, email: s.user.email || '' };
        return JSON.stringify(m) === JSON.stringify(s.member) ? s : { ...s, member: m };
      });
    });
    const offAll = subscribeMembers(setMembers);
    return () => {
      offMe();
      offAll();
    };
  }, [readyUid]);

  if (state.kind === 'ready') {
    return <>{children({ user: state.user, member: state.member, members: members.length ? members : [state.member], signOut, welcome: state.welcome })}</>;
  }

  return (
    <div className="min-h-screen w-screen bg-gradient-to-b from-emerald-700 to-slate-900 flex items-center justify-center p-4 font-sans text-slate-900 overflow-y-auto">
      <div className="w-full max-w-sm space-y-4 py-6">
        <div className="text-center text-white space-y-2">
          <img src="./favicon.svg" alt="" className="w-20 h-20 mx-auto rounded-3xl shadow-xl" />
          <h1 className="text-2xl font-black">Gestión Pecuaria</h1>
          <p className="text-sm text-emerald-100">Porcino · Avícola · Bovino</p>
        </div>

        {state.kind === 'checking' || state.kind === 'resolving' ? (
          <StatusCard icon={<Loader2 className="w-6 h-6 animate-spin text-emerald-600" />} title={state.kind === 'checking' ? 'Cargando…' : 'Verificando tu acceso a la granja…'} />
        ) : state.kind === 'migrating' ? (
          <StatusCard
            icon={<UploadCloud className="w-6 h-6 text-emerald-600 animate-pulse" />}
            title="Subiendo los datos de este teléfono a la nube…"
            text="Solo pasa la primera vez. No cierres la app."
          />
        ) : state.kind === 'denied' ? (
          <div className="bg-white rounded-2xl p-5 shadow-2xl space-y-3 text-sm">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
            <h2 className="font-bold text-base">Sin acceso a la granja</h2>
            <p className="text-slate-600">
              La cuenta <strong>{state.email}</strong> no tiene una invitación. Pide al Administrador de la granja que te invite con este correo desde{' '}
              <strong>Miembros → Invitar</strong> y vuelve a intentarlo.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => void enter(state.user)} className="min-h-11 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-1.5">
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
              <button onClick={() => void signOut()} className="min-h-11 rounded-xl bg-slate-100 text-slate-800 font-bold flex items-center justify-center gap-1.5">
                <LogOut className="w-4 h-4" /> Salir
              </button>
            </div>
          </div>
        ) : state.kind === 'error' ? (
          <div className="bg-white rounded-2xl p-5 shadow-2xl space-y-3 text-sm">
            <ShieldAlert className="w-8 h-8 text-rose-600" />
            <h2 className="font-bold text-base">No se pudo conectar</h2>
            <p className="text-slate-600">{state.message}</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => void enter(state.user)} className="min-h-11 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-1.5">
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
              <button onClick={() => void signOut()} className="min-h-11 rounded-xl bg-slate-100 text-slate-800 font-bold flex items-center justify-center gap-1.5">
                <LogOut className="w-4 h-4" /> Salir
              </button>
            </div>
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  );
};

const StatusCard: React.FC<{ icon: React.ReactNode; title: string; text?: string }> = ({ icon, title, text }) => (
  <div className="bg-white rounded-2xl p-5 shadow-2xl flex items-start gap-3 text-sm" role="status">
    {icon}
    <div>
      <p className="font-bold">{title}</p>
      {text && <p className="text-slate-500 text-xs mt-0.5">{text}</p>}
    </div>
  </div>
);

const inputCls =
  'w-full h-12 rounded-xl bg-slate-50 border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500';

const LoginForm: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim()) return setError('Escribe tu correo.');
    if (mode === 'register') {
      if (!name.trim()) return setError('Escribe tu nombre.');
      if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
      if (password !== confirm) return setError('Las contraseñas no coinciden.');
    } else if (!password) return setError('Escribe tu contraseña.');
    setBusy(true);
    try {
      if (mode === 'login') await loginWithEmail(email, password);
      else await registerWithEmail(name, email, password);
      // onAuthStateChanged continúa el flujo
    } catch (err: any) {
      if (mode === 'register' && err?.code === 'auth/email-already-in-use') {
        // La cuenta ya existe (p. ej. creada por la invitación): se envía el enlace para crear la contraseña
        await sendPasswordEmail(email).catch(() => undefined);
        setMode('login');
        setInfo(`Ese correo ya tiene una cuenta (la creó tu invitación). Te enviamos un enlace a ${email.trim()} para crear tu contraseña; luego inicia sesión aquí.`);
      } else setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) return setError('Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".');
    setBusy(true);
    try {
      await sendPasswordEmail(email);
      setInfo(`Te enviamos un enlace a ${email.trim()} para crear una nueva contraseña. Revisa también la carpeta de spam.`);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 shadow-2xl space-y-3 text-sm" noValidate>
      <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`min-h-10 rounded-lg text-xs font-bold ${mode === m ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'}`}
          >
            {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        ))}
      </div>

      {mode === 'register' && (
        <p className="text-[11px] text-slate-600 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
          Usa el correo con el que te invitaron. El primer usuario de la granja queda como Administrador.
        </p>
      )}

      {mode === 'register' && (
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Nombre completo</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Ej: Pedro Valero" className={inputCls} />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-700">Correo electrónico</span>
        <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tucorreo@ejemplo.com" className={inputCls} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-700">Contraseña</span>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className={`${inputCls} pr-12`}
          />
          <button
            type="button"
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShow((v) => !v)}
            className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center text-slate-500"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </label>
      {mode === 'register' && (
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-700">Repite la contraseña</span>
          <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputCls} />
        </label>
      )}

      {error && <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">{error}</p>}
      {info && (
        <p role="status" className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex gap-1.5">
          <Mail className="w-4 h-4 shrink-0" /> {info}
        </p>
      )}

      <button type="submit" disabled={busy} className="w-full min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
      </button>
      {mode === 'login' && (
        <button type="button" disabled={busy} onClick={() => void forgot()} className="w-full min-h-10 text-xs font-semibold text-emerald-700">
          ¿Olvidaste tu contraseña?
        </button>
      )}
    </form>
  );
};
