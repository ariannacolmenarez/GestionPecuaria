/**
 * ============================================================================
 * MIEMBROS E INVITACIONES (Firebase Auth + Firestore)
 * ============================================================================
 * - farms/{farmId}/members/{uid}: miembros con acceso (rol).
 * - farms/{farmId}/invitations/{correo}: invitaciones pendientes / aceptadas / canceladas.
 * Reglas de acceso al iniciar sesión:
 *   1) Ya es miembro → entra con su rol.
 *   2) La granja aún no tiene miembros → el primer usuario queda como Administrador.
 *   3) Tiene una invitación pendiente a su correo → se acepta y entra con el rol invitado.
 *   4) Si no → sin acceso (debe pedir una invitación).
 */
import { collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, createInvitedAccount } from '../firebase';
import { FARM_ID } from './dbService';
import { nowISO } from '../utils/dates';

export type MemberRole = 'Administrador' | 'Veterinario' | 'Operador' | 'Trabajador';
export const MEMBER_ROLES: { key: MemberRole; label: string; hint: string }[] = [
  { key: 'Administrador', label: 'Administrador', hint: 'Control total, finanzas e invitaciones' },
  { key: 'Veterinario', label: 'Veterinario', hint: 'Plan sanitario, recetas y dosis' },
  { key: 'Operador', label: 'Operador', hint: 'Registro de consumos, partos y pesos' },
  { key: 'Trabajador', label: 'Trabajador', hint: 'Tareas de campo' },
];

export interface MemberDoc {
  id: string; // uid
  uid: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
  invitedBy?: string;
}

export interface InvitationDoc {
  id: string; // correo en minúsculas
  email: string;
  name: string;
  role: MemberRole;
  status: 'pendiente' | 'aceptada' | 'cancelada';
  createdAt: string;
  invitedBy: string;
  invitedByName?: string;
  acceptedAt?: string;
}

export type AccessResult =
  | { status: 'ok'; member: MemberDoc; firstOwner?: boolean; joinedByInvitation?: boolean }
  | { status: 'denied'; email: string };

const SESSION_CACHE_KEY = 'pecuario_session_member_v1';

const membersCol = (farmId: string) => collection(db, 'farms', farmId, 'members');
const memberRef = (farmId: string, uid: string) => doc(db, 'farms', farmId, 'members', uid);
const invitationRef = (farmId: string, email: string) => doc(db, 'farms', farmId, 'invitations', email.trim().toLowerCase());

const isRole = (r: unknown): r is MemberRole => MEMBER_ROLES.some((x) => x.key === r);
const displayName = (user: User, fallback?: string) => (user.displayName || fallback || (user.email || '').split('@')[0] || 'Miembro').trim();

/** Avatar con iniciales (SVG en data URI). */
export function initialsAvatar(name: string): string {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => (w[0] || '').toUpperCase())
      .join('') || '?';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' fill='#10b981'/><text x='50%' y='50%' dy='.35em' text-anchor='middle' font-family='sans-serif' font-size='48' fill='#ffffff'>${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function cacheMember(m: MemberDoc | null) {
  try {
    if (m) localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(m));
    else localStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // sin localStorage
  }
}
function cachedMember(uid: string): MemberDoc | null {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    const m = raw ? (JSON.parse(raw) as MemberDoc) : null;
    return m && m.uid === uid ? m : null;
  } catch {
    return null;
  }
}

/** Decide si el usuario autenticado tiene acceso a la granja (y con qué rol). */
export async function resolveAccess(user: User, farmId: string = FARM_ID): Promise<AccessResult> {
  const email = (user.email || '').toLowerCase();
  try {
    const mine = await getDoc(memberRef(farmId, user.uid));
    if (mine.exists()) {
      const m = mine.data() as MemberDoc;
      cacheMember(m);
      return { status: 'ok', member: m };
    }

    // Primer usuario de la granja → Administrador
    const any = await getDocs(query(membersCol(farmId), limit(1)));
    if (any.empty) {
      const owner: MemberDoc = { id: user.uid, uid: user.uid, name: displayName(user), email, role: 'Administrador', joinedAt: nowISO() };
      await setDoc(memberRef(farmId, user.uid), owner);
      cacheMember(owner);
      return { status: 'ok', member: owner, firstOwner: true };
    }

    // Invitación pendiente a su correo
    if (email) {
      const inv = await getDoc(invitationRef(farmId, email));
      const data = inv.exists() ? (inv.data() as InvitationDoc) : null;
      if (data && data.status === 'pendiente') {
        const m: MemberDoc = {
          id: user.uid,
          uid: user.uid,
          name: displayName(user, data.name),
          email,
          role: isRole(data.role) ? data.role : 'Trabajador',
          joinedAt: nowISO(),
          invitedBy: data.invitedBy,
        };
        await setDoc(memberRef(farmId, user.uid), m);
        await updateDoc(invitationRef(farmId, email), { status: 'aceptada', acceptedAt: nowISO() }).catch(() => undefined);
        cacheMember(m);
        return { status: 'ok', member: m, joinedByInvitation: true };
      }
    }
    cacheMember(null);
    return { status: 'denied', email };
  } catch (err) {
    // Sin conexión: se usa el último acceso verificado en este teléfono
    const cached = cachedMember(user.uid);
    if (cached) return { status: 'ok', member: cached };
    throw err;
  }
}

export function clearSessionCache() {
  cacheMember(null);
}

/** Miembros de la granja en tiempo real. */
export function subscribeMembers(onUpdate: (list: MemberDoc[]) => void, farmId: string = FARM_ID): () => void {
  return onSnapshot(
    membersCol(farmId),
    (snap) => {
      const list: MemberDoc[] = [];
      snap.forEach((d) => list.push(d.data() as MemberDoc));
      list.sort((a, b) => (a.joinedAt || '').localeCompare(b.joinedAt || ''));
      onUpdate(list);
    },
    (err) => console.warn('Miembros sin conexión:', err)
  );
}

/** Mi registro de miembro en tiempo real (null si me quitaron el acceso). */
export function subscribeMyMember(uid: string, onUpdate: (m: MemberDoc | null) => void, farmId: string = FARM_ID): () => void {
  return onSnapshot(
    memberRef(farmId, uid),
    (snap) => {
      // Solo se considera "quitado" con datos confirmados por el servidor
      const fromCache = snap.metadata.fromCache;
      const m = snap.exists() ? (snap.data() as MemberDoc) : null;
      if (!m && fromCache) return;
      cacheMember(m);
      onUpdate(m);
    },
    (err) => console.warn('Sesión sin conexión:', err)
  );
}

/** Invitaciones de la granja en tiempo real (se muestran las pendientes). */
export function subscribeInvitations(onUpdate: (list: InvitationDoc[]) => void, farmId: string = FARM_ID): () => void {
  return onSnapshot(
    collection(db, 'farms', farmId, 'invitations'),
    (snap) => {
      const list: InvitationDoc[] = [];
      snap.forEach((d) => list.push(d.data() as InvitationDoc));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onUpdate(list);
    },
    (err) => console.warn('Invitaciones sin conexión:', err)
  );
}

export interface InviteInput {
  name: string;
  email: string;
  role: MemberRole;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registra la invitación y envía el correo de Firebase para que el invitado cree su contraseña.
 * emailSent=false si el correo no pudo enviarse (la invitación queda igual registrada y se puede compartir).
 */
export async function inviteMember(
  input: InviteInput,
  by: MemberDoc,
  existingMembers: MemberDoc[],
  farmId: string = FARM_ID
): Promise<{ ok: true; invitation: InvitationDoc; emailSent: boolean; emailError?: string } | { ok: false; error: string }> {
  if (by.role !== 'Administrador') return { ok: false, error: 'Solo un Administrador puede invitar miembros.' };
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: 'Escribe el nombre del invitado.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'El correo no es válido.' };
  if (!isRole(input.role)) return { ok: false, error: 'Elige un rol.' };
  if (existingMembers.some((m) => (m.email || '').toLowerCase() === email)) return { ok: false, error: 'Esa persona ya es miembro de la granja.' };

  const invitation: InvitationDoc = {
    id: email,
    email,
    name,
    role: input.role,
    status: 'pendiente',
    createdAt: nowISO(),
    invitedBy: by.uid,
    invitedByName: by.name,
  };
  try {
    await setDoc(invitationRef(farmId, email), invitation);
  } catch (err: any) {
    return { ok: false, error: `No se pudo guardar la invitación (${err?.code || 'sin conexión'}).` };
  }
  try {
    await createInvitedAccount(email);
    return { ok: true, invitation, emailSent: true };
  } catch (err: any) {
    return { ok: true, invitation, emailSent: false, emailError: err?.code || String(err) };
  }
}

/** Reenvía el correo para crear la contraseña. */
export async function resendInvitation(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await createInvitedAccount(email);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: `No se pudo enviar el correo (${err?.code || 'sin conexión'}).` };
  }
}

export async function cancelInvitation(email: string, farmId: string = FARM_ID): Promise<void> {
  await updateDoc(invitationRef(farmId, email), { status: 'cancelada' });
}

export async function removeMember(uid: string, by: MemberDoc, farmId: string = FARM_ID): Promise<{ ok: true } | { ok: false; error: string }> {
  if (by.role !== 'Administrador') return { ok: false, error: 'Solo un Administrador puede quitar miembros.' };
  if (uid === by.uid) return { ok: false, error: 'No puedes quitarte a ti mismo.' };
  try {
    const snap = await getDoc(memberRef(farmId, uid));
    const email = snap.exists() ? (snap.data() as MemberDoc).email : '';
    await deleteDoc(memberRef(farmId, uid));
    // La invitación aceptada se cancela para que no vuelva a entrar sin una nueva invitación
    if (email) await updateDoc(invitationRef(farmId, email), { status: 'cancelada' }).catch(() => undefined);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: `No se pudo quitar el acceso (${err?.code || 'sin conexión'}).` };
  }
}

export async function changeMemberRole(
  uid: string,
  role: MemberRole,
  by: MemberDoc,
  members: MemberDoc[],
  farmId: string = FARM_ID
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (by.role !== 'Administrador') return { ok: false, error: 'Solo un Administrador puede cambiar roles.' };
  const admins = members.filter((m) => m.role === 'Administrador');
  if (role !== 'Administrador' && admins.length === 1 && admins[0].uid === uid) {
    return { ok: false, error: 'La granja debe tener al menos un Administrador.' };
  }
  try {
    await updateDoc(memberRef(farmId, uid), { role });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: `No se pudo cambiar el rol (${err?.code || 'sin conexión'}).` };
  }
}

/** Texto para compartir la invitación por WhatsApp / correo. */
export function invitationMessage(inv: Pick<InvitationDoc, 'name' | 'email' | 'role'>, farmName: string): string {
  return [
    `Hola ${inv.name}, te invito a la granja "${farmName}" en la app Gestión Pecuaria como ${inv.role}.`,
    '',
    `1) Revisa tu correo ${inv.email}: te llegó un enlace para crear tu contraseña (revisa también la carpeta de spam).`,
    '2) Abre la app Gestión Pecuaria e inicia sesión con ese correo y tu contraseña.',
    `   Si no te llegó el correo, en la app elige "Crear cuenta" con ${inv.email}.`,
  ].join('\n');
}
