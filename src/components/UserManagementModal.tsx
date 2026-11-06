'use client';

import React, { useState } from 'react';
import { Property, Room, User, UserRole } from '@/types/nhatro';
import { ModalDialog } from './ModalDialog';
import { KeyRound, Plus, Shield, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';

interface UserManagementModalProps {
  open: boolean;
  onClose: () => void;
  users: User[];
  properties: Property[];
  rooms: Room[];
  currentUser: User | null;
  onSaveUser: (data: {
    id?: number;
    username: string;
    fullName: string;
    role: UserRole;
    phone?: string;
    email?: string;
    propertyId?: number | null;
    roomId?: number | null;
    password?: string;
    newPassword?: string;
  }) => Promise<void>;
  onDeleteUser: (id: number) => Promise<void>;
}

export function UserManagementModal({
  open,
  onClose,
  users,
  properties,
  rooms,
  currentUser,
  onSaveUser,
  onDeleteUser,
}: UserManagementModalProps) {
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('TENANT');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123456');
  const [propertyId, setPropertyId] = useState<number | null>(properties[0]?.id ?? null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const filteredUsers = users.filter((u) => (roleFilter === 'ALL' ? true : u.role === roleFilter));

  const startCreate = () => {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setRole('TENANT');
    setPhone('');
    setEmail('');
    setPassword('123456');
    setPropertyId(properties[0]?.id ?? null);
    setRoomId(null);
    setIsCreating(true);
    setMsg('');
  };

  const startEdit = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setFullName(u.fullName);
    setRole(u.role);
    setPhone(u.phone);
    setEmail(u.email);
    setPassword('');
    setPropertyId(u.propertyId);
    setRoomId(u.roomId);
    setIsCreating(true);
    setMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim()) return;
    if (!editingUser && !password) return;
    setLoading(true);
    setMsg('');
    try {
      await onSaveUser({
        id: editingUser?.id,
        username: username.trim(),
        fullName: fullName.trim(),
        role,
        phone: phone.trim(),
        email: email.trim(),
        propertyId: role === 'TENANT' ? propertyId : null,
        roomId: role === 'TENANT' ? roomId : null,
        password: editingUser ? undefined : password,
        newPassword: editingUser && password ? password : undefined,
      });
      setIsCreating(false);
      setEditingUser(null);
    } catch {
      setMsg('Đã xảy ra lỗi khi lưu thông tin tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const propertyRooms = rooms.filter((r) => r.propertyId === propertyId);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Quản Lý Tài Khoản & Phân Quyền Người Dùng"
      subtitle="Thiết lập vai trò Chủ nhà (Admin), Quản lý khu trọ (Manager) và Khách thuê (Tenant)"
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
              Lọc vai trò:
            </span>
            {(
              [
                { val: 'ALL', label: `Tất cả (${users.length})` },
                { val: 'ADMIN', label: '👑 Chủ nhà (Admin)' },
                { val: 'MANAGER', label: '👔 Quản lý (Manager)' },
                { val: 'TENANT', label: '👤 Khách thuê (Tenant)' },
              ] as const
            ).map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => setRoleFilter(item.val)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  roleFilter === item.val
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {!isCreating && (
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Thêm tài khoản mới
            </button>
          )}
        </div>

        {isCreating && (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border-2 border-teal-600/30 bg-teal-50/40 p-4 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-teal-200 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-950">
                {editingUser ? `Chỉnh sửa tài khoản: ${editingUser.username}` : 'Thêm tài khoản người dùng mới'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingUser(null);
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Đóng form
              </button>
            </div>

            {msg && (
              <p className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800">
                {msg}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="um-username" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên đăng nhập *
                </label>
                <input
                  id="um-username"
                  type="text"
                  required
                  disabled={Boolean(editingUser)}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: quanly2 hoặc SĐT..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="um-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên *
                </label>
                <input
                  id="um-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label htmlFor="um-role" className="block text-xs font-semibold text-slate-700 mb-1">
                  Vai trò (Role)
                </label>
                <select
                  id="um-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="ADMIN">👑 ADMIN (Chủ nhà / Toàn quyền)</option>
                  <option value="MANAGER">👔 MANAGER (Quản lý khu trọ)</option>
                  <option value="TENANT">👤 TENANT (Khách thuê phòng)</option>
                </select>
              </div>

              <div>
                <label htmlFor="um-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại
                </label>
                <input
                  id="um-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0908123456"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label htmlFor="um-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email (nếu có)
                </label>
                <input
                  id="um-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="VD: user@email.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label htmlFor="um-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingUser ? 'Đổi mật khẩu mới (bỏ trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo *'}
                </label>
                <input
                  id="um-password"
                  type="text"
                  required={!editingUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-semibold"
                />
              </div>
            </div>

            {role === 'TENANT' && (
              <div className="rounded-xl border border-teal-200 bg-white p-3 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-900">
                  Liên kết Phòng trọ cho Khách thuê:
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="um-prop" className="block text-xs font-semibold text-slate-600 mb-1">
                      Khu nhà trọ
                    </label>
                    <select
                      id="um-prop"
                      value={propertyId ?? ''}
                      onChange={(e) => {
                        const pid = Number(e.target.value);
                        setPropertyId(pid);
                        setRoomId(null);
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="um-room" className="block text-xs font-semibold text-slate-600 mb-1">
                      Phòng trọ
                    </label>
                    <select
                      id="um-room"
                      value={roomId ?? ''}
                      onChange={(e) => setRoomId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-teal-800"
                    >
                      <option value="">-- Chưa gán phòng cụ thể --</option>
                      {propertyRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          Phòng {r.roomNumber} ({r.status === 'OCCUPIED' ? 'Đang ở' : 'Trống'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingUser(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {loading ? 'Đang lưu...' : editingUser ? 'Cập nhật tài khoản' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        )}

        <div className="table-wrapper rounded-xl border border-slate-200">
          <table className="text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-left font-bold uppercase text-slate-600">
                <th className="py-2.5 pl-3 pr-2">Tên đăng nhập</th>
                <th className="py-2.5 px-2">Họ và tên</th>
                <th className="py-2.5 px-2">Vai trò (Role)</th>
                <th className="py-2.5 px-2">Số điện thoại</th>
                <th className="py-2.5 px-2">Phòng liên kết</th>
                <th className="py-2.5 pl-2 pr-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                const propObj = properties.find((p) => p.id === u.propertyId);
                const roomObj = rooms.find((r) => r.id === u.roomId);

                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pl-3 pr-2 font-mono font-bold text-slate-900">
                      {u.username}
                      {isCurrent && (
                        <span className="ml-1.5 rounded-full bg-teal-100 px-1.5 py-0.2 text-[10px] font-bold text-teal-800">
                          (Bạn)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-semibold text-slate-800">{u.fullName}</td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-rose-100 text-rose-800'
                            : u.role === 'MANAGER'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.role === 'ADMIN'
                          ? '👑 Chủ nhà (Admin)'
                          : u.role === 'MANAGER'
                          ? '👔 Quản lý (Manager)'
                          : '👤 Khách thuê'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-slate-600">{u.phone || '—'}</td>
                    <td className="py-2.5 px-2">
                      {roomObj ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-800">
                          P.{roomObj.roomNumber} ({propObj?.name.split('-')[0] || ''})
                        </span>
                      ) : u.role === 'TENANT' ? (
                        <span className="text-slate-400 italic">Chưa gán phòng</span>
                      ) : (
                        <span className="text-slate-400">Toàn bộ khu</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-2 pr-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="font-bold text-teal-700 hover:underline"
                        >
                          Sửa
                        </button>
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Bạn có chắc muốn xóa tài khoản ${u.username}?`)) {
                                onDeleteUser(u.id);
                              }
                            }}
                            className="font-semibold text-rose-600 hover:underline ml-2"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ModalDialog>
  );
}
