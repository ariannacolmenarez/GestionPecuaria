import React, { useState } from 'react';
import { X, UserPlus, Shield, Check, Mail } from 'lucide-react';
import { FarmMember } from '../../types';

interface MembersModalProps {
  members: FarmMember[];
  onClose: () => void;
  onInviteMember: (newMember: FarmMember) => void;
}

export const MembersModal: React.FC<MembersModalProps> = ({
  members,
  onClose,
  onInviteMember,
}) => {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Administrador' | 'Veterinario' | 'Operador' | 'Trabajador'>('Trabajador');
  const [invitedSuccess, setInvitedSuccess] = useState(false);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    const newMember: FarmMember = {
      id: 'm-' + Date.now(),
      name,
      email,
      role,
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 9999999)}?w=120&auto=format&fit=crop&q=80`,
    };

    onInviteMember(newMember);
    setInvitedSuccess(true);
    setName('');
    setEmail('');
    setTimeout(() => {
      setInvitedSuccess(false);
      setShowInviteForm(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div
        id="members-management-dialog"
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Equipo & Miembros de la Granja</h3>
            <p className="text-[11px] text-slate-400">HU-01: Gestión Multiusuario y Roles (RBAC)</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {invitedSuccess && (
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Invitación enviada correctamente.
            </div>
          )}

          {!showInviteForm ? (
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-700">
                Miembros Activos ({members.length})
              </span>
              <button
                onClick={() => setShowInviteForm(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" /> Invitar Miembro
              </button>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Invitar Nuevo Colaborador</span>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nombre Completo:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pedro Valero"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Correo Electrónico:</label>
                <input
                  type="email"
                  required
                  placeholder="pedro@granja.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Rol Asignado:</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                >
                  <option value="Trabajador">Trabajador (Solo lectura de tareas de campo)</option>
                  <option value="Operador">Operador (Registro de consumos, partos y pesos)</option>
                  <option value="Veterinario">Veterinario (Plan Sanitario, recetas y dosis)</option>
                  <option value="Administrador">Administrador (Control total y finanzas)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 py-1.5 border border-slate-300 rounded-lg text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                >
                  Enviar Invitación
                </button>
              </div>
            </form>
          )}

          {/* Members List */}
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">{member.name}</h5>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Mail className="w-2.5 h-2.5" /> {member.email}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    member.role === 'Administrador'
                      ? 'bg-purple-100 text-purple-800'
                      : member.role === 'Veterinario'
                      ? 'bg-blue-100 text-blue-800'
                      : member.role === 'Operador'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50 text-center text-[11px] text-slate-500">
          Autenticación respaldada por Firebase Authentication & Cloud Firestore
        </div>
      </div>
    </div>
  );
};
