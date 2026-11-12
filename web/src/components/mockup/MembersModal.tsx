/**
 * Miembros de la granja (Firebase): lista con roles, invitaciones pendientes e
 * invitación de nuevos miembros. La invitación envía un correo real de Firebase para
 * que el invitado cree su contraseña, y se puede compartir por WhatsApp o correo.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { X, UserPlus, Check, Mail, Copy, MessageCircle, Send, Trash2, Loader2, LogOut, Clock } from 'lucide-react';
import {
  MEMBER_ROLES,
  cancelInvitation,
  changeMemberRole,
  initialsAvatar,
  invitationMessage,
  inviteMember,
  removeMember,
  resendInvitation,
  subscribeInvitations,
  type InvitationDoc,
  type MemberDoc,
  type MemberRole,
} from '../../services/authService';

interface MembersModalProps {
  /** Miembro con la sesión iniciada. */
  me: MemberDoc;
  members: MemberDoc[];
  farmName: string;
  onClose: () => void;
  onSignOut: () => void | Promise<void>;
  notify?: (msg: string) => void;
}

const ROLE_CHIP: Record<MemberRole, string> = {
  Administrador: 'bg-purple-100 text-purple-800',
  Veterinario: 'bg-blue-100 text-blue-800',
  Operador: 'bg-emerald-100 text-emerald-800',
  Trabajador: 'bg-slate-200 text-slate-700',
};

const field = 'w-full h-10 px-3 border border-slate-300 rounded-xl text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500';

/** Abre un enlace externo (WhatsApp / correo): en Android lo maneja el sistema. */
function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}

const SharePanel: React.FC<{ inv: Pick<InvitationDoc, 'name' | 'email' | 'role'>; farmName: string; notify?: (m: string) => void }> = ({ inv, farmName, notify }) => {
  const text = invitationMessage(inv, farmName);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify?.('No se pudo copiar el texto.');
    }
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      <button type="button" onClick={() => openExternal(`https://wa.me/?text=${encodeURIComponent(text)}`)} className="min-h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1">
        <MessageCircle className="w-4 h-4" /> WhatsApp
      </button>
      <button
        type="button"
        onClick={() => openExternal(`mailto:${inv.email}?subject=${encodeURIComponent(`Invitación a ${farmName}`)}&body=${encodeURIComponent(text)}`)}
        className="min-h-10 rounded-xl bg-sky-600 text-white text-xs font-bold flex items-center justify-center gap-1"
      >
        <Mail className="w-4 h-4" /> Correo
      </button>
      <button type="button" onClick={() => void copy()} className="min-h-10 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-1">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
};

export const MembersModal: React.FC<MembersModalProps> = ({ me, members, farmName, onClose, onSignOut, notify }) => {
  const isAdmin = me.role === 'Administrador';
  const [invitations, setInvitations] = useState<InvitationDoc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('Trabajador');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ inv: InvitationDoc; emailSent: boolean } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MemberDoc | null>(null);

  useEffect(() => (isAdmin ? subscribeInvitations(setInvitations) : undefined), [isAdmin]);
  const pending = useMemo(() => invitations.filter((i) => i.status === 'pendiente'), [invitations]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('invite');
    const res = await inviteMember({ name, email, role }, me, members);
    setBusy(null);
    if ('error' in res) return setError(res.error);
    setSent({ inv: res.invitation, emailSent: res.emailSent });
    setShowForm(false);
    setName('');
    setEmail('');
    setRole('Trabajador');
  };

  const run = async (key: string, fn: () => Promise<{ ok: true } | { ok: false; error: string } | void>, okMsg?: string) => {
    setError(null);
    setBusy(key);
    try {
      const r = await fn();
      if (r && 'error' in r) setError(r.error);
      else if (okMsg) notify?.(okMsg);
    } catch (err: any) {
      setError(`No se pudo completar (${err?.code || 'sin conexión'}).`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div id="members-management-dialog" role="dialog" aria-modal="true" aria-label="Miembros" className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-base">Equipo y miembros</h3>
            <p className="text-[11px] text-slate-400">{farmName}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-sm">
          {error && <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">{error}</p>}

          {sent && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Invitación creada para {sent.inv.name}
              </p>
              <p className="text-[11px] text-emerald-900">
                {sent.emailSent
                  ? `Le llegará a ${sent.inv.email} un correo para crear su contraseña (puede caer en spam). Compártele también las instrucciones:`
                  : `No se pudo enviar el correo automático. Comparte las instrucciones: podrá entrar con "Crear cuenta" usando ${sent.inv.email}.`}
              </p>
              <SharePanel inv={sent.inv} farmName={farmName} notify={notify} />
              <button type="button" onClick={() => setSent(null)} className="w-full min-h-9 text-xs font-semibold text-emerald-800">
                Listo
              </button>
            </div>
          )}

          {isAdmin && !showForm && !sent && (
            <button
              onClick={() => {
                setError(null);
                setShowForm(true);
              }}
              className="w-full min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" /> Invitar miembro
            </button>
          )}

          {isAdmin && showForm && (
            <form onSubmit={submit} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5" noValidate>
              <p className="font-bold text-slate-800">Invitar a un colaborador</p>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">Nombre completo</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pedro Valero" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">Correo electrónico</span>
                <input type="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pedro@correo.com" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-600">Rol</span>
                <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} className={field}>
                  {MEMBER_ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label} — {r.hint}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="min-h-10 border border-slate-300 rounded-xl text-slate-700 font-semibold">
                  Cancelar
                </button>
                <button type="submit" disabled={busy === 'invite'} className="min-h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {busy === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
                </button>
              </div>
            </form>
          )}

          <p className="text-xs font-bold text-slate-700">Miembros ({members.length})</p>
          <ul className="space-y-2">
            {members.map((m) => {
              const self = m.uid === me.uid;
              return (
                <li key={m.uid} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <img src={initialsAvatar(m.name)} alt="" className="w-9 h-9 rounded-full shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs truncate">
                        {m.name} {self && <span className="text-slate-500 font-normal">(tú)</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{m.email}</p>
                    </div>
                    {!isAdmin || self ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ROLE_CHIP[m.role] || ROLE_CHIP.Trabajador}`}>{m.role}</span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Quitar a ${m.name}`}
                        onClick={() => setConfirmRemove(m)}
                        className="w-10 h-10 rounded-xl text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {isAdmin && !self && (
                    <select
                      aria-label={`Rol de ${m.name}`}
                      value={m.role}
                      disabled={busy === `role_${m.uid}`}
                      onChange={(e) => void run(`role_${m.uid}`, () => changeMemberRole(m.uid, e.target.value as MemberRole, me, members), 'Rol actualizado.')}
                      className={`${field} h-9 text-xs`}
                    >
                      {MEMBER_ROLES.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {confirmRemove?.uid === m.uid && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                      <p className="text-[11px] text-rose-800 font-semibold">¿Quitar el acceso de {m.name} a la granja?</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setConfirmRemove(null)} className="min-h-9 bg-white border border-slate-300 rounded-lg text-xs font-bold">
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={busy === `rm_${m.uid}`}
                          onClick={() => void run(`rm_${m.uid}`, () => removeMember(m.uid, me), `${m.name} ya no tiene acceso.`).then(() => setConfirmRemove(null))}
                          className="min-h-9 bg-rose-600 text-white rounded-lg text-xs font-bold disabled:opacity-60"
                        >
                          Quitar acceso
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {isAdmin && pending.length > 0 && (
            <>
              <p className="text-xs font-bold text-slate-700 pt-1">Invitaciones pendientes ({pending.length})</p>
              <ul className="space-y-2">
                {pending.map((inv) => (
                  <li key={inv.id} className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs truncate">{inv.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {inv.email} · {inv.role}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Cancelar invitación de ${inv.name}`}
                        disabled={busy === `cancel_${inv.id}`}
                        onClick={() => void run(`cancel_${inv.id}`, () => cancelInvitation(inv.email), 'Invitación cancelada.')}
                        className="w-10 h-10 rounded-xl text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <SharePanel inv={inv} farmName={farmName} notify={notify} />
                    <button
                      type="button"
                      disabled={busy === `resend_${inv.id}`}
                      onClick={() => void run(`resend_${inv.id}`, () => resendInvitation(inv.email), `Correo reenviado a ${inv.email}.`)}
                      className="w-full min-h-9 text-xs font-semibold text-amber-800 flex items-center justify-center gap-1"
                    >
                      {busy === `resend_${inv.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Reenviar correo para crear contraseña
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!isAdmin && <p className="text-[11px] text-slate-500">Solo un Administrador puede invitar o quitar miembros.</p>}
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <p className="text-[11px] text-slate-500 truncate">
            Sesión: <strong>{me.email}</strong> · {me.role}
          </p>
          <button type="button" onClick={() => void onSignOut()} className="min-h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </div>
      </div>
    </div>
  );
};
