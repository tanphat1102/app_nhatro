'use client';

import React, { useEffect, useState } from 'react';
import { BillingMode, Property, Room, Tenant } from '@/types/nhatro';
import { ModalDialog } from './ModalDialog';
import { formatVND } from './InvoiceReceiptModal';
import {
  BadgeCheck,
  Car,
  Edit3,
  FileText,
  MapPin,
  Phone,
  Save,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

interface RoomTenantsModalProps {
  open: boolean;
  onClose: () => void;
  room: Room | null;
  property: Property | null;
  tenants: Tenant[];
  onSaveRoom: (room: Partial<Room>) => Promise<void>;
  onSaveTenant: (tenant: Partial<Tenant>) => Promise<void>;
  onDeleteTenant: (id: number, propertyId: number, roomId: number) => Promise<void>;
}

const emptyTenantForm = (propertyId: number, roomId: number): Partial<Tenant> => ({
  propertyId,
  roomId,
  fullName: '',
  phone: '',
  cccd: '',
  birthYear: '2000',
  gender: 'Nam',
  hometown: '',
  occupation: '',
  vehiclePlate: '',
  isRepresentative: false,
  moveInDate: new Date().toISOString().slice(0, 10),
  moveOutDate: '',
  tempResidenceStatus: 'REGISTERED',
  isActive: true,
  notes: '',
});

export function RoomTenantsModal({
  open,
  onClose,
  room,
  property,
  tenants,
  onSaveRoom,
  onSaveTenant,
  onDeleteTenant,
}: RoomTenantsModalProps) {
  const [activeTab, setActiveTab] = useState<'tenants' | 'room_config'>('tenants');
  const [roomForm, setRoomForm] = useState<Room | null>(null);
  const [editingTenant, setEditingTenant] = useState<Partial<Tenant> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (room) {
      setRoomForm({ ...room });
      setEditingTenant(null);
      setActiveTab('tenants');
    }
  }, [room]);

  if (!room || !roomForm || !property) return null;

  const roomTenants = tenants.filter((t) => t.roomId === room.id);
  const activeTenants = roomTenants.filter((t) => t.isActive);
  const inactiveTenants = roomTenants.filter((t) => !t.isActive);

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveRoom(roomForm);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant || !editingTenant.fullName?.trim()) return;
    setSaving(true);
    try {
      await onSaveTenant(editingTenant);
      setEditingTenant(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={`Phòng ${room.roomNumber} — Quản Lý Thành Viên & Cấu Hình Phòng`}
      subtitle={`${property.name} • Giá thuê: ${formatVND(room.baseRent)}đ/tháng • Đang ở: ${activeTenants.length} người`}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('tenants')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activeTab === 'tenants'
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Danh sách người ở ({activeTenants.length} đang ở)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('room_config')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activeTab === 'room_config'
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Hợp đồng, Tiền cọc & Cơ chế tính phí riêng
            </button>
          </div>

          {activeTab === 'tenants' && !editingTenant && (
            <button
              type="button"
              onClick={() => setEditingTenant(emptyTenantForm(property.id, room.id))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Thêm thành viên vào Phòng {room.roomNumber}
            </button>
          )}
        </div>

        {activeTab === 'tenants' && (
          <div className="space-y-5">
            {/* Add / Edit Tenant Form */}
            {editingTenant && (
              <form
                onSubmit={handleTenantSubmit}
                className="rounded-2xl border-2 border-teal-600/30 bg-teal-50/40 p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-teal-200 pb-2.5">
                  <h3 className="text-sm font-bold text-teal-950">
                    {editingTenant.id
                      ? `Cập nhật hồ sơ: ${editingTenant.fullName}`
                      : `Thêm người ở mới vào Phòng ${room.roomNumber}`}
                  </h3>
                  <span className="text-xs text-teal-800">
                    Tự động cập nhật số đầu người tính tiền nước/dịch vụ
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="t-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                      Họ và tên thành viên *
                    </label>
                    <input
                      id="t-fullname"
                      name="fullName"
                      type="text"
                      required
                      autoComplete="name"
                      value={editingTenant.fullName || ''}
                      onChange={(e) => setEditingTenant({ ...editingTenant, fullName: e.target.value })}
                      placeholder="VD: Nguyễn Văn A"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label htmlFor="t-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                      Số điện thoại (Zalo)
                    </label>
                    <input
                      id="t-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={editingTenant.phone || ''}
                      onChange={(e) => setEditingTenant({ ...editingTenant, phone: e.target.value })}
                      placeholder="VD: 0908123456"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="t-cccd" className="block text-xs font-semibold text-slate-700 mb-1">
                      Số CCCD / Định danh
                    </label>
                    <input
                      id="t-cccd"
                      name="cccd"
                      type="text"
                      inputMode="numeric"
                      autoCorrect="off"
                      spellCheck={false}
                      value={editingTenant.cccd || ''}
                      onChange={(e) => setEditingTenant({ ...editingTenant, cccd: e.target.value })}
                      placeholder="12 chữ số CCCD"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="t-birthyear" className="block text-xs font-semibold text-slate-700 mb-1">
                      Năm sinh
                    </label>
                    <input
                      id="t-birthyear"
                      name="birthYear"
                      type="text"
                      inputMode="numeric"
                      value={editingTenant.birthYear || ''}
                      onChange={(e) => setEditingTenant({ ...editingTenant, birthYear: e.target.value })}
                      placeholder="VD: 1999"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1">Giới tính</span>
                    <div className="flex gap-2 pt-1">
                      {(['Nam', 'Nữ', 'Khác'] as const).map((g) => (
                        <label
                          key={g}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="gender"
                            value={g}
                            checked={editingTenant.gender === g}
                            onChange={() => setEditingTenant({ ...editingTenant, gender: g })}
                            className="accent-teal-700"
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="t-hometown" className="block text-xs font-semibold text-slate-700 mb-1">
                      Quê quán / Thường trú
                    </label>
                    <input
                      id="t-hometown"
                      name="hometown"
                      type="text"
                      value={editingTenant.hometown || ''}
                      onChange={(e) => setEditingTenant({ ...editingTenant, hometown: e.target.value })}
                      placeholder="VD: Đồng Nai, Bình Định..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="t-occupation" className="block text-xs font-semibold text-slate-700 mb-1">
                      Nghề nghiệp / Nơi làm việc - học tập
                    </label>
                    <input
                      id="t-occupation"
                      name="occupation"
                      type="text"
                      value={editingTenant.occupation || ''}
                      onChange={(e) => setEditingTenant({ ...editingTenant, occupation: e.target.value })}
                      placeholder="VD: Kỹ sư KCN Cao, Sinh viên..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="t-plate" className="block text-xs font-semibold text-slate-700 mb-1">
                      Biển số xe (nếu có)
                    </label>
                    <input
                      id="t-plate"
                      name="vehiclePlate"
                      type="text"
                      autoCorrect="off"
                      spellCheck={false}
                      value={editingTenant.vehiclePlate || ''}
                      onChange={(e) => setEditingTenant({ ...editingTenant, vehiclePlate: e.target.value })}
                      placeholder="VD: 59X3-668.89"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="t-movein" className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày vào ở
                    </label>
                    <input
                      id="t-movein"
                      name="moveInDate"
                      type="date"
                      value={editingTenant.moveInDate || ''}
                      onChange={(e) => setEditingTenant({ ...editingTenant, moveInDate: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="t-moveout" className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày chuyển đi (nếu đã rời phòng)
                    </label>
                    <input
                      id="t-moveout"
                      name="moveOutDate"
                      type="date"
                      value={editingTenant.moveOutDate || ''}
                      onChange={(e) =>
                        setEditingTenant({
                          ...editingTenant,
                          moveOutDate: e.target.value,
                          isActive: e.target.value ? false : editingTenant.isActive,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1">Đăng ký tạm trú CA</span>
                    <div className="flex gap-1.5 pt-1">
                      {(
                        [
                          { val: 'REGISTERED', label: 'Đã ĐK' },
                          { val: 'PENDING', label: 'Chờ ĐK' },
                          { val: 'EXPIRED', label: 'Hết hạn' },
                        ] as const
                      ).map((st) => (
                        <label
                          key={st.val}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="tempResidenceStatus"
                            value={st.val}
                            checked={editingTenant.tempResidenceStatus === st.val}
                            onChange={() =>
                              setEditingTenant({ ...editingTenant, tempResidenceStatus: st.val })
                            }
                            className="accent-teal-700"
                          />
                          {st.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingTenant.isRepresentative)}
                        onChange={(e) =>
                          setEditingTenant({ ...editingTenant, isRepresentative: e.target.checked })
                        }
                        className="h-4 w-4 accent-teal-700"
                      />
                      Là người đại diện hợp đồng của phòng
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-teal-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingTenant.isActive)}
                        onChange={(e) =>
                          setEditingTenant({ ...editingTenant, isActive: e.target.checked })
                        }
                        className="h-4 w-4 accent-teal-700"
                      />
                      Đang cư trú (Tính vào số người ở của phòng)
                    </label>
                  </div>
                  <div>
                    <label htmlFor="t-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                      Ghi chú thành viên
                    </label>
                    <input
                      id="t-notes"
                      name="notes"
                      type="text"
                      value={editingTenant.notes || ''}
                      onChange={(e) => setEditingTenant({ ...editingTenant, notes: e.target.value })}
                      placeholder="Ghi chú quan hệ (vợ/chồng, bạn cùng phòng...)"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {saving ? 'Đang lưu...' : 'Lưu thông tin thành viên'}
                  </button>
                </div>
              </form>
            )}

            {/* Active Tenants Cards */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Thành viên đang ở trong phòng ({activeTenants.length} người)
              </h4>
              {activeTenants.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Hiện chưa có thành viên nào đang ở trong Phòng {room.roomNumber}. Nhấn &ldquo;Thêm thành viên&rdquo; để khai báo khách thuê.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeTenants.map((t) => (
                    <article
                      key={t.id}
                      className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${
                        t.isRepresentative
                          ? 'border-teal-600/40 bg-teal-50/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-slate-900">{t.fullName}</h5>
                            {t.isRepresentative && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white">
                                <UserCheck className="h-3 w-3" aria-hidden="true" />
                                Đại diện
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {t.gender} • Sinh năm {t.birthYear || '—'} • {t.occupation || 'Chưa rõ nghề nghiệp'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingTenant({ ...t })}
                            aria-label={`Sửa thông tin ${t.fullName}`}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200/70"
                          >
                            <Edit3 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTenant(t.id, t.propertyId, t.roomId)}
                            aria-label={`Xóa ${t.fullName}`}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                          <span>{t.phone || 'Chưa có SĐT'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <BadgeCheck className="h-3.5 w-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                          <span className="font-mono">{t.cccd || 'Chưa có CCCD'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span>{t.hometown || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="font-mono">{t.vehiclePlate || 'Không có xe'}</span>
                        </div>
                      </dl>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 text-[11px]">
                        <span className="text-slate-500">Vào ở: {t.moveInDate || '—'}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            t.tempResidenceStatus === 'REGISTERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.tempResidenceStatus === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {t.tempResidenceStatus === 'REGISTERED'
                            ? 'Đã ĐK tạm trú'
                            : t.tempResidenceStatus === 'PENDING'
                            ? 'Chờ ĐK tạm trú'
                            : 'Hết hạn tạm trú'}
                        </span>
                      </div>
                      {t.notes && (
                        <p className="mt-1.5 text-[11px] italic text-slate-500">📌 {t.notes}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Former / Moved-out Tenants */}
            {inactiveTenants.length > 0 && (
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Lịch sử thành viên đã chuyển đi ({inactiveTenants.length})
                </h4>
                <div className="space-y-2">
                  {inactiveTenants.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600"
                    >
                      <div>
                        <strong className="text-slate-800">{t.fullName}</strong> ({t.phone}) • CCCD: {t.cccd} • Đã chuyển ra: {t.moveOutDate || '—'} ({t.notes})
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingTenant({ ...t })}
                        className="text-teal-700 font-semibold hover:underline"
                      >
                        Xem / Khôi phục
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'room_config' && (
          <form onSubmit={handleRoomSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="rc-num" className="block text-xs font-semibold text-slate-700 mb-1">
                  Số phòng mới
                </label>
                <input
                  id="rc-num"
                  type="text"
                  value={roomForm.roomNumber}
                  onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label htmlFor="rc-old-num" className="block text-xs font-semibold text-slate-700 mb-1">
                  Số phòng cũ (nếu có)
                </label>
                <input
                  id="rc-old-num"
                  type="text"
                  value={roomForm.oldRoomNumber}
                  onChange={(e) => setRoomForm({ ...roomForm, oldRoomNumber: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="rc-rent" className="block text-xs font-semibold text-slate-700 mb-1">
                  Giá thuê phòng mặc định (VNĐ/tháng)
                </label>
                <input
                  id="rc-rent"
                  type="number"
                  min={0}
                  step={50000}
                  value={roomForm.baseRent}
                  onChange={(e) => setRoomForm({ ...roomForm, baseRent: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-teal-800"
                />
              </div>

              <div>
                <label htmlFor="rc-deposit" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiền đặt cọc hợp đồng (VNĐ)
                </label>
                <input
                  id="rc-deposit"
                  type="number"
                  min={0}
                  step={50000}
                  value={roomForm.depositAmount}
                  onChange={(e) => setRoomForm({ ...roomForm, depositAmount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="rc-start" className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày bắt đầu hợp đồng
                </label>
                <input
                  id="rc-start"
                  type="date"
                  value={roomForm.contractStartDate}
                  onChange={(e) => setRoomForm({ ...roomForm, contractStartDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="rc-end" className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày hết hạn hợp đồng
                </label>
                <input
                  id="rc-end"
                  type="date"
                  value={roomForm.contractEndDate}
                  onChange={(e) => setRoomForm({ ...roomForm, contractEndDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <legend className="px-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                Cơ chế tính tiền riêng cho Phòng {room.roomNumber} (Ghi đè mặc định của khu trọ)
              </legend>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="rc-water-mode" className="block text-xs font-semibold text-slate-700 mb-1">
                    Cơ chế tính Tiền Nước riêng cho phòng này
                  </label>
                  <select
                    id="rc-water-mode"
                    value={roomForm.waterModeOverride}
                    onChange={(e) =>
                      setRoomForm({
                        ...roomForm,
                        waterModeOverride: e.target.value as BillingMode | '',
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Theo mặc định khu trọ ({property.waterMode === 'BY_METER' ? 'Theo đồng hồ m³' : 'Theo đầu người'})</option>
                    <option value="BY_METER">Tính theo chỉ số đồng hồ (m³)</option>
                    <option value="PER_PERSON">Tính theo đầu người đang ở</option>
                    <option value="FIXED_PER_ROOM">Khoán cố định theo phòng</option>
                    <option value="FREE">Miễn phí / Thu riêng (+ TIỀN NƯỚC)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rc-lighting-mode" className="block text-xs font-semibold text-slate-700 mb-1">
                    Cơ chế tính Đèn Vệ Sinh (Đèn VS)
                  </label>
                  <select
                    id="rc-lighting-mode"
                    value={roomForm.lightingModeOverride}
                    onChange={(e) =>
                      setRoomForm({
                        ...roomForm,
                        lightingModeOverride: e.target.value as BillingMode | '',
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Theo mặc định khu trọ ({formatVND(property.lightingRate)}đ/tháng)</option>
                    <option value="FIXED_PER_ROOM">Thu cố định theo phòng</option>
                    <option value="PER_PERSON">Thu theo đầu người</option>
                    <option value="FREE">Miễn thu Đèn VS (0đ - như Phòng 8)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="rc-note" className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú mặc định trên hóa đơn của phòng (VD: + TIỀN NƯỚC)
                </label>
                <input
                  id="rc-note"
                  type="text"
                  value={roomForm.note}
                  onChange={(e) => setRoomForm({ ...roomForm, note: e.target.value })}
                  placeholder="Ghi chú riêng cho phòng này..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </fieldset>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-sm font-bold text-white hover:bg-teal-800"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Lưu cấu hình Phòng {room.roomNumber}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalDialog>
  );
}
