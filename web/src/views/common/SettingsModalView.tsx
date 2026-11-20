import React, { useId, useState } from 'react';
import { Settings, CheckCircle2, LogOut, UserCircle2, CloudOff, CloudUpload, Pencil } from 'lucide-react';
import { Btn, ConfirmDialog, FieldError, FieldLabel, ModalHeader, fieldClass, inputClass, useBackClose } from '../../components/common/ui';

interface SettingsModalViewProps {
  onClose: () => void;
  /** Nombre real de la granja (summary.name). */
  farmName?: string;
  location?: string;
  /** Sesión actual. */
  userEmail?: string;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void | Promise<void>;
  /** Conexión y cambios aún sin subir (para avisar antes de cerrar sesión). */
  online?: boolean;
  pendingSync?: boolean;
  /** Cambia nombre/ubicación de la finca (solo Administrador). Devuelve un mensaje de error o null. */
  onRenameFarm?: (name: string, location?: string) => string | null;
}

/** Texto del aviso al cerrar sesión según el estado de la conexión. */
export function signOutWarning(online = true, pendingSync = false): string {
  if (!online) return 'No hay señal: lo que registraste sin conexión podría no haber subido a la nube todavía. Si cierras sesión ahora, podrías perderlo.';
  if (pendingSync) return 'Todavía se están subiendo cambios a la nube. Espera a ver "Todo guardado" antes de salir.';
  return 'Tendrás que volver a escribir tu correo y contraseña para entrar.';
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="block text-xs font-bold text-slate-600 mb-0.5">{children}</span>;

export const SettingsModalView: React.FC<SettingsModalViewProps> = ({ onClose, farmName, location, userEmail, userName, userRole, onSignOut, online = true, pendingSync = false, onRenameFarm }) => {
  const titleId = useId();
  const nameId = useId();
  const locId = useId();
  const errId = useId();
  const [busy, setBusy] = useState(false);
  const [askSignOut, setAskSignOut] = useState(false);
  const canEditFarm = !!onRenameFarm && userRole === 'Administrador';
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftLoc, setDraftLoc] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const dirty = editing && (draftName.trim() !== (farmName || '').trim() || draftLoc.trim() !== (location || '').trim());
  const { requestClose, confirmDialog } = useBackClose(true, onClose, dirty);

  const startEdit = () => {
    setDraftName(farmName || '');
    setDraftLoc(location || '');
    setNameError(null);
    setEditing(true);
  };
  const saveFarm = () => {
    if (!onRenameFarm) return;
    const err = onRenameFarm(draftName, draftLoc);
    if (err) {
      setNameError(err);
      return;
    }
    setEditing(false);
  };

  const signOut = async () => {
    if (!onSignOut) return;
    setBusy(true);
    try {
      await onSignOut();
    } finally {
      setBusy(false);
      setAskSignOut(false);
    }
  };

  const risky = !online || pendingSync;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3" onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white text-slate-900 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <ModalHeader title="Configuración de la granja" titleId={titleId} icon={<Settings />} onClose={requestClose} />

        <div className="p-4 space-y-3 overflow-y-auto text-sm">
          {editing ? (
            <form
              className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveFarm();
              }}
            >
              <div>
                <FieldLabel htmlFor={nameId}>Nombre de la finca</FieldLabel>
                <input
                  id={nameId}
                  className={fieldClass(!!nameError, 'mt-1')}
                  value={draftName}
                  maxLength={60}
                  autoFocus
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? errId : undefined}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                />
                <FieldError id={errId} error={nameError} />
              </div>
              <div>
                <FieldLabel htmlFor={locId} hint="Opcional">Ubicación</FieldLabel>
                <input id={locId} className={`${inputClass} mt-1`} value={draftLoc} maxLength={100} autoComplete="off" onChange={(e) => setDraftLoc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="secondary" onClick={() => setEditing(false)}>Cancelar</Btn>
                <Btn type="submit">Guardar</Btn>
              </div>
            </form>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <Label>Nombre de la finca</Label>
                <span className="font-bold text-slate-900 text-base break-words">{farmName || 'Sin nombre'}</span>
                {location && <span className="block text-xs text-slate-600">{location}</span>}
              </div>
              {canEditFarm && (
                <Btn variant="secondary" icon={<Pencil className="w-4 h-4" aria-hidden="true" />} onClick={startEdit} aria-label="Cambiar el nombre de la finca">
                  Editar
                </Btn>
              )}
            </div>
          )}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <Label>Rubros</Label>
            <span className="font-semibold text-slate-800">Porcino, Avícola y Bovino</span>
          </div>
          <div className={`p-3 rounded-xl border ${!online ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-200'}`}>
            <Label>Guardado de datos</Label>
            {!online ? (
              <span className="font-semibold text-amber-900 flex items-start gap-1.5">
                <CloudOff className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> Sin señal: lo que registres se guarda en el teléfono y se sube solo al volver la conexión.
              </span>
            ) : pendingSync ? (
              <span className="font-semibold text-sky-900 flex items-start gap-1.5">
                <CloudUpload className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> Subiendo cambios a la nube…
              </span>
            ) : (
              <span className="font-semibold text-emerald-900 flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> Todo guardado en la nube. Se comparte solo con los miembros de la granja.
              </span>
            )}
          </div>

          {userEmail && (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <Label>Sesión</Label>
              <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <UserCircle2 className="w-9 h-9 text-slate-500 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{userName || userEmail}</p>
                  <p className="text-xs text-slate-600 truncate">
                    {userEmail}
                    {userRole ? ` · ${userRole}` : ''}
                  </p>
                </div>
              </div>
              {onSignOut && (
                <Btn variant="secondary" block disabled={busy} onClick={() => setAskSignOut(true)} icon={<LogOut />} className="text-rose-700 border-rose-300">
                  Cerrar sesión
                </Btn>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-200 shrink-0">
          <Btn variant="primary" rubro="general" block size="lg" onClick={requestClose}>
            Listo
          </Btn>
        </div>
      </div>

      {askSignOut && (
        <ConfirmDialog
          title="¿Cerrar sesión?"
          message={<p>{signOutWarning(online, pendingSync)}</p>}
          confirmLabel={risky ? 'Salir de todos modos' : 'Cerrar sesión'}
          danger={risky}
          icon={<LogOut className="w-6 h-6" />}
          onConfirm={() => void signOut()}
          onCancel={() => setAskSignOut(false)}
        />
      )}
      {confirmDialog}
    </div>
  );
};
