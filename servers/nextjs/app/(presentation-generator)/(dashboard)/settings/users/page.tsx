"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/utils/api";
import { notify } from "@/components/ui/sonner";
import {
  Plus,
  Trash2,
  Users,
  Shield,
  User,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

type UserRole = "admin" | "user";

interface UserEntry {
  username: string;
  role: UserRole;
  display_name: string;
  is_admin?: boolean;
}

interface CreateUserForm {
  username: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  display_name: string;
}

const INITIAL_FORM: CreateUserForm = {
  username: "",
  password: "",
  confirmPassword: "",
  role: "user",
  display_name: "",
};

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/v1/auth/users/"), {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 403) {
          notify.error(
            "Acceso denegado",
            "Solo los administradores pueden gestionar usuarios."
          );
          return;
        }
        throw new Error("Error al cargar usuarios");
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      notify.error("Error", "No se pudo cargar la lista de usuarios.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.username.trim().length < 3) {
      notify.warning("Usuario muy corto", "El nombre de usuario debe tener al menos 3 caracteres.");
      return;
    }
    if (form.password.length < 6) {
      notify.warning("Contraseña muy corta", "La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      notify.warning("Las contraseñas no coinciden", "Verifica que las contraseñas sean iguales.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(getApiUrl("/api/v1/auth/users/"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          display_name: form.display_name.trim() || form.username.trim(),
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        notify.error("No se pudo crear el usuario", payload?.detail || "Error desconocido.");
        return;
      }

      notify.success("Usuario creado", `Se creó el usuario "${form.username.trim()}" correctamente.`);
      setForm(INITIAL_FORM);
      setShowCreateForm(false);
      void fetchUsers();
    } catch (err) {
      notify.error("Error", "No se pudo crear el usuario. Inténtalo de nuevo.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingUser(username);
    try {
      const res = await fetch(getApiUrl(`/api/v1/auth/users/${encodeURIComponent(username)}`), {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const payload = await res.json();
        notify.error("No se pudo eliminar", payload?.detail || "Error al eliminar el usuario.");
        return;
      }

      notify.success("Usuario eliminado", `El usuario "${username}" fue eliminado.`);
      void fetchUsers();
    } catch (err) {
      notify.error("Error", "No se pudo eliminar el usuario.");
    } finally {
      setDeletingUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-syne">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F4F3FF]">
              <Users className="h-5 w-5 text-[#7C51F8]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Gestión de Usuarios</h1>
              <p className="text-sm text-gray-500">Administra los usuarios de esta instancia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchUsers()}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 rounded-lg bg-[#7C51F8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6d46e6] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo usuario
            </button>
          </div>
        </div>

        {/* Create User Form */}
        {showCreateForm && (
          <div className="mb-6 rounded-xl border border-[#D9D6FE] bg-[#F4F3FF]/50 p-6">
            <h2 className="mb-4 font-syne text-sm font-semibold text-gray-900">Crear nuevo usuario</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Nombre de usuario *
                  </label>
                  <input
                    id="new-username"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    placeholder="nombre-usuario"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#7C51F8] focus:ring-2 focus:ring-[#7C51F8]/20"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Nombre para mostrar
                  </label>
                  <input
                    id="new-display-name"
                    value={form.display_name}
                    onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))}
                    placeholder="Nombre Apellido"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#7C51F8] focus:ring-2 focus:ring-[#7C51F8]/20"
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Contraseña *
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 outline-none focus:border-[#7C51F8] focus:ring-2 focus:ring-[#7C51F8]/20"
                      disabled={isCreating}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Confirmar contraseña *
                  </label>
                  <input
                    id="new-confirm-password"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="Repite la contraseña"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#7C51F8] focus:ring-2 focus:ring-[#7C51F8]/20"
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">Rol</label>
                <div className="flex gap-3">
                  {(["user", "admin"] as UserRole[]).map((role) => (
                    <label
                      key={role}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                        form.role === role
                          ? "border-[#7C51F8] bg-[#F4F3FF] text-[#7C51F8]"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        value={role}
                        checked={form.role === role}
                        onChange={() => setForm((p) => ({ ...p, role }))}
                        className="sr-only"
                      />
                      {role === "admin" ? (
                        <Shield className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                      {role === "admin" ? "Administrador" : "Usuario"}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setForm(INITIAL_FORM); }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  disabled={isCreating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 rounded-lg bg-[#7C51F8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6d46e6] disabled:opacity-60 transition-colors"
                >
                  {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isCreating ? "Creando…" : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users List */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[#7C51F8]" />
              <span className="ml-3 text-sm text-gray-500">Cargando usuarios…</span>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No hay usuarios configurados</p>
              <p className="mt-1 text-xs text-gray-400">Crea el primero usando el botón de arriba.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map((user) => (
                <div
                  key={user.username}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        user.role === "admin"
                          ? "bg-[#F4F3FF] text-[#7C51F8]"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {user.role === "admin" ? (
                        <Shield className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        user.role === "admin"
                          ? "bg-[#F4F3FF] text-[#7C51F8]"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {user.role === "admin" ? "Administrador" : "Usuario"}
                    </span>
                    {!user.is_admin && (
                      <button
                        onClick={() => void handleDeleteUser(user.username)}
                        disabled={deletingUser === user.username}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-50 transition-colors"
                        title={`Eliminar usuario ${user.username}`}
                      >
                        {deletingUser === user.username ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {user.is_admin && (
                      <div className="h-8 w-8" aria-hidden="true" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info note */}
        <p className="mt-4 text-center text-xs text-gray-400">
          El administrador principal se configura en la primera ejecución de esta instancia.
        </p>
      </div>
    </div>
  );
}
