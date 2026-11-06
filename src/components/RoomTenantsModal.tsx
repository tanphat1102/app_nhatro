'use client';

import React, { useEffect, useState } from 'react';
import { BillingMode, DocumentImageItem, Property, Room, Tenant } from '@/types/nhatro';
import { ModalDialog } from './ModalDialog';
import { formatVND } from './InvoiceReceiptModal';
import { DocumentLightboxModal, LightboxPreviewData } from './DocumentLightboxModal';
import {
  compressAvatarFile,
  compressImageFile,
  generateSampleAvatarDataUrl,
  generateSampleDocumentDataUrl,
  parseDocumentImages,
} from '@/lib/imageUtils';
import {
  BadgeCheck,
  Camera,
  Car,
  CreditCard,
  Edit3,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  ImagePlus,
  MapPin,
  Phone,
  Save,
  Sparkles,
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
  avatarUrl: '',
  cccdFrontUrl: '',
  cccdBackUrl: '',
  contractImagesJson: '[]',
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
  const [uploadingField, setUploadingField] = useState<string>('');
  const [lightboxPreview, setLightboxPreview] = useState<LightboxPreviewData | null>(null);

  useEffect(() => {
    if (room) {
      setRoomForm({
        ...room,
        contractImagesJson: room.contractImagesJson || '[]',
      });
      setEditingTenant(null);
      setActiveTab('tenants');
    }
  }, [room]);

  if (!room || !roomForm || !property) return null;

  const roomTenants = tenants.filter((t) => t.roomId === room.id);
  const activeTenants = roomTenants.filter((t) => t.isActive);
  const inactiveTenants = roomTenants.filter((t) => !t.isActive);
  const roomContractImages = parseDocumentImages(roomForm.contractImagesJson);

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

  const handleUploadTenantAvatar = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !editingTenant) return;
    setUploadingField('avatarUrl');
    try {
      const dataUrl = await compressAvatarFile(fileList[0]);
      setEditingTenant((prev) => (prev ? { ...prev, avatarUrl: dataUrl } : prev));
    } finally {
      setUploadingField('');
    }
  };

  const handleUploadTenantSingleImage = async (
    field: 'cccdFrontUrl' | 'cccdBackUrl',
    fileList: FileList | null
  ) => {
    if (!fileList || fileList.length === 0 || !editingTenant) return;
    setUploadingField(field);
    try {
      const dataUrl = await compressImageFile(fileList[0]);
      setEditingTenant((prev) => (prev ? { ...prev, [field]: dataUrl } : prev));
    } finally {
      setUploadingField('');
    }
  };

  const handleUploadTenantContractImages = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !editingTenant) return;
    setUploadingField('tenantContracts');
    try {
      const currentList = parseDocumentImages(editingTenant.contractImagesJson);
      const added: DocumentImageItem[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const dataUrl = await compressImageFile(file);
        added.push({
          id: `tc_${Date.now()}_${i}`,
          title: file.name.replace(/\.[^/.]+$/, '') || `Trang hợp đồng ${currentList.length + i + 1}`,
          dataUrl,
          uploadedAt: new Date().toLocaleDateString('vi-VN'),
        });
      }
      const nextList = [...currentList, ...added];
      setEditingTenant((prev) =>
        prev ? { ...prev, contractImagesJson: JSON.stringify(nextList) } : prev
      );
    } finally {
      setUploadingField('');
    }
  };

  const handleRemoveTenantContractImage = (docId: string) => {
    if (!editingTenant) return;
    const currentList = parseDocumentImages(editingTenant.contractImagesJson);
    const nextList = currentList.filter((item) => item.id !== docId);
    setEditingTenant({
      ...editingTenant,
      contractImagesJson: JSON.stringify(nextList),
    });
  };

  const handleUploadRoomContractImages = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingField('roomContracts');
    try {
      const currentList = parseDocumentImages(roomForm.contractImagesJson);
      const added: DocumentImageItem[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const dataUrl = await compressImageFile(file);
        added.push({
          id: `rc_${Date.now()}_${i}`,
          title: file.name.replace(/\.[^/.]+$/, '') || `Hợp đồng P.${room.roomNumber} - Trang ${currentList.length + i + 1}`,
          dataUrl,
          uploadedAt: new Date().toLocaleDateString('vi-VN'),
        });
      }
      const nextList = [...currentList, ...added];
      setRoomForm({
        ...roomForm,
        contractImagesJson: JSON.stringify(nextList),
      });
    } finally {
      setUploadingField('');
    }
  };

  const handleRemoveRoomContractImage = (docId: string) => {
    const currentList = parseDocumentImages(roomForm.contractImagesJson);
    const nextList = currentList.filter((item) => item.id !== docId);
    setRoomForm({
      ...roomForm,
      contractImagesJson: JSON.stringify(nextList),
    });
  };

  const openTenantDocumentsLightbox = (t: Tenant) => {
    const images: LightboxPreviewData['images'] = [];
    if (t.avatarUrl) {
      images.push({
        label: `Ảnh Đại Diện Chân Dung — ${t.fullName}`,
        dataUrl: t.avatarUrl,
      });
    }
    if (t.cccdFrontUrl) {
      images.push({
        label: `CCCD Mặt Trước — ${t.fullName} (${t.cccd || 'Chưa nhập số'})`,
        dataUrl: t.cccdFrontUrl,
      });
    }
    if (t.cccdBackUrl) {
      images.push({
        label: `CCCD Mặt Sau — ${t.fullName}`,
        dataUrl: t.cccdBackUrl,
      });
    }
    const contracts = parseDocumentImages(t.contractImagesJson);
    for (const c of contracts) {
      images.push({
        label: `${c.title} — ${t.fullName}`,
        dataUrl: c.dataUrl,
        uploadedAt: c.uploadedAt,
      });
    }
    setLightboxPreview({
      title: `Hồ Sơ Ảnh & Giấy Tờ — ${t.fullName} (Phòng ${room.roomNumber})`,
      subtitle: `Số CCCD: ${t.cccd || 'Chưa cập nhật'} • SĐT: ${t.phone || '—'} • Quê quán: ${t.hometown || '—'}`,
      images,
    });
  };

  const editingTenantContracts = editingTenant
    ? parseDocumentImages(editingTenant.contractImagesJson)
    : [];

  return (
    <>
      <ModalDialog
        open={open}
        onClose={onClose}
        title={`Phòng ${room.roomNumber} — Quản Lý Thành Viên, CCCD & Hợp Đồng`}
        subtitle={`${property.name} • Giá thuê: ${formatVND(room.baseRent)}đ/tháng • Đang ở: ${activeTenants.length} người`}
        maxWidthClass="max-w-4xl"
      >
        <div className="space-y-5">
          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex flex-wrap gap-2">
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
                Danh sách người ở & Ảnh CCCD ({activeTenants.length})
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
                Hợp đồng phòng ({roomContractImages.length} ảnh), Tiền cọc & Phí riêng
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
                  className="rounded-2xl border-2 border-teal-600/30 bg-teal-50/40 p-5 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200 pb-2.5">
                    <h3 className="text-sm font-bold text-teal-950">
                      {editingTenant.id
                        ? `Cập nhật hồ sơ & hình ảnh: ${editingTenant.fullName}`
                        : `Thêm người ở mới vào Phòng ${room.roomNumber}`}
                    </h3>
                    <span className="text-xs text-teal-800">
                      Hỗ trợ ảnh đại diện chân dung, CCCD 2 mặt & hợp đồng (tự động nén WebP dung lượng nhẹ)
                    </span>
                  </div>

                  {/* Avatar Photo Uploader Card */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-white p-4 shadow-2xs">
                    <div className="flex items-center gap-4">
                      {editingTenant.avatarUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxPreview({
                              title: `Ảnh Đại Diện — ${editingTenant.fullName || 'Khách thuê'}`,
                              images: [
                                {
                                  label: `Ảnh Đại Diện Chân Dung (${editingTenant.fullName || 'Khách thuê'})`,
                                  dataUrl: editingTenant.avatarUrl!,
                                },
                              ],
                            })
                          }
                          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-teal-600 shadow-sm"
                          title="Nhấn để phóng to ảnh đại diện"
                        >
                          <img
                            src={editingTenant.avatarUrl}
                            alt={`Ảnh đại diện của ${editingTenant.fullName || 'khách thuê'}`}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </button>
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-teal-300 bg-teal-50 text-2xl font-black text-teal-700">
                          {(editingTenant.fullName || 'K').trim().split(/\s+/).pop()?.[0]?.toUpperCase() || 'K'}
                        </div>
                      )}

                      <div className="space-y-1">
                        <label
                          htmlFor="t-avatar-file"
                          className="block text-xs font-extrabold uppercase tracking-wider text-teal-900 cursor-pointer"
                        >
                          👤 Ảnh Đại Diện Chân Dung (Avatar Người Ở)
                        </label>
                        <p className="text-xs text-slate-500">
                          Tự động căn giữa vuông 320×320px sắc nét để hiển thị trên sơ đồ phòng & danh bạ.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <input
                            id="t-avatar-file"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleUploadTenantAvatar(e.target.files)}
                            className="block text-xs text-slate-600 file:mr-2 file:rounded-xl file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-teal-800 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const sampleAvatar = generateSampleAvatarDataUrl({
                                fullName: editingTenant.fullName || 'Khách Thuê',
                                gender: editingTenant.gender || 'Nam',
                                roomNumber: room.roomNumber,
                              });
                              setEditingTenant({ ...editingTenant, avatarUrl: sampleAvatar });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
                          >
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            Tạo avatar mẫu
                          </button>
                          {editingTenant.avatarUrl && (
                            <button
                              type="button"
                              onClick={() => setEditingTenant({ ...editingTenant, avatarUrl: '' })}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Xóa avatar
                            </button>
                          )}
                        </div>
                        {uploadingField === 'avatarUrl' && (
                          <p className="text-xs font-semibold text-teal-700">Đang cắt vuông & nén ảnh đại diện...</p>
                        )}
                      </div>
                    </div>
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

                  {/* CCCD & Contract Image Upload Section */}
                  <fieldset className="rounded-xl border border-teal-300 bg-white p-4 space-y-4">
                    <legend className="px-2 text-xs font-bold uppercase tracking-wider text-teal-900">
                      📸 Lưu Trữ Ảnh Căn Cước Công Dân (CCCD) & Hợp Đồng Của Thành Viên
                    </legend>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* CCCD Front */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="t-cccd-front"
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                          >
                            <CreditCard className="h-4 w-4 text-teal-700" aria-hidden="true" />
                            1. Ảnh CCCD Mặt Trước
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const sample = generateSampleDocumentDataUrl('CCCD_FRONT', {
                                fullName: editingTenant.fullName || 'Nguyễn Văn A',
                                cccd: editingTenant.cccd || '079099001234',
                                birthYear: editingTenant.birthYear || '1999',
                                gender: editingTenant.gender || 'Nam',
                                hometown: editingTenant.hometown || 'TP.HCM',
                              });
                              setEditingTenant({ ...editingTenant, cccdFrontUrl: sample });
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                          >
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            Tạo ảnh mẫu
                          </button>
                        </div>

                        <input
                          id="t-cccd-front"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadTenantSingleImage('cccdFrontUrl', e.target.files)}
                          className="block w-full text-xs text-slate-600 file:mr-2.5 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-teal-800 cursor-pointer"
                        />

                        {uploadingField === 'cccdFrontUrl' && (
                          <p className="text-xs text-teal-700 font-semibold">Đang nén và tải ảnh...</p>
                        )}

                        {editingTenant.cccdFrontUrl ? (
                          <div className="space-y-2">
                            <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                              <img
                                src={editingTenant.cccdFrontUrl}
                                alt={`CCCD mặt trước của ${editingTenant.fullName || 'khách thuê'}`}
                                className="h-32 w-full object-contain rounded"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setLightboxPreview({
                                    title: `CCCD Mặt Trước — ${editingTenant.fullName || 'Khách thuê'}`,
                                    images: [
                                      {
                                        label: `CCCD Mặt Trước (${editingTenant.cccd || 'Chưa nhập số'})`,
                                        dataUrl: editingTenant.cccdFrontUrl!,
                                      },
                                    ],
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline"
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                Phóng to
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTenant({ ...editingTenant, cccdFrontUrl: '' })}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Xóa ảnh
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-5 text-center text-[11px] text-slate-400">
                            Chưa có ảnh CCCD mặt trước
                          </div>
                        )}
                      </div>

                      {/* CCCD Back */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="t-cccd-back"
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                          >
                            <CreditCard className="h-4 w-4 text-teal-700" aria-hidden="true" />
                            2. Ảnh CCCD Mặt Sau
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const sample = generateSampleDocumentDataUrl('CCCD_BACK', {
                                fullName: editingTenant.fullName || 'Nguyễn Văn A',
                                cccd: editingTenant.cccd || '079099001234',
                              });
                              setEditingTenant({ ...editingTenant, cccdBackUrl: sample });
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                          >
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            Tạo ảnh mẫu
                          </button>
                        </div>

                        <input
                          id="t-cccd-back"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadTenantSingleImage('cccdBackUrl', e.target.files)}
                          className="block w-full text-xs text-slate-600 file:mr-2.5 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-teal-800 cursor-pointer"
                        />

                        {uploadingField === 'cccdBackUrl' && (
                          <p className="text-xs text-teal-700 font-semibold">Đang nén và tải ảnh...</p>
                        )}

                        {editingTenant.cccdBackUrl ? (
                          <div className="space-y-2">
                            <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                              <img
                                src={editingTenant.cccdBackUrl}
                                alt={`CCCD mặt sau của ${editingTenant.fullName || 'khách thuê'}`}
                                className="h-32 w-full object-contain rounded"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setLightboxPreview({
                                    title: `CCCD Mặt Sau — ${editingTenant.fullName || 'Khách thuê'}`,
                                    images: [
                                      {
                                        label: `CCCD Mặt Sau (${editingTenant.fullName || ''})`,
                                        dataUrl: editingTenant.cccdBackUrl!,
                                      },
                                    ],
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline"
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                Phóng to
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTenant({ ...editingTenant, cccdBackUrl: '' })}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Xóa ảnh
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-5 text-center text-[11px] text-slate-400">
                            Chưa có ảnh CCCD mặt sau
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tenant Contract / Residence Images */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor="t-contract-files"
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                        >
                          <FileCheck2 className="h-4 w-4 text-teal-700" aria-hidden="true" />
                          3. Ảnh Hợp Đồng Thuê / Giấy Xác Nhận Tạm Trú CT01 ({editingTenantContracts.length} trang)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const sampleUrl = generateSampleDocumentDataUrl('CONTRACT', {
                              fullName: editingTenant.fullName || 'Nguyễn Văn A',
                              cccd: editingTenant.cccd || '079099001234',
                              roomNumber: room.roomNumber,
                              propertyName: property.name,
                              baseRent: room.baseRent,
                            });
                            const nextList: DocumentImageItem[] = [
                              ...editingTenantContracts,
                              {
                                id: `tc_sample_${Date.now()}`,
                                title: `Hợp đồng thuê Phòng ${room.roomNumber} - ${editingTenant.fullName || 'Khách thuê'}`,
                                dataUrl: sampleUrl,
                                uploadedAt: new Date().toLocaleDateString('vi-VN'),
                              },
                            ];
                            setEditingTenant({
                              ...editingTenant,
                              contractImagesJson: JSON.stringify(nextList),
                            });
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                        >
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          + Tạo hợp đồng mẫu
                        </button>
                      </div>

                      <input
                        id="t-contract-files"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleUploadTenantContractImages(e.target.files)}
                        className="block w-full text-xs text-slate-600 file:mr-2.5 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-slate-900 cursor-pointer"
                      />

                      {editingTenantContracts.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
                          {editingTenantContracts.map((doc) => (
                            <div
                              key={doc.id}
                              className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5 shadow-2xs"
                            >
                              <img
                                src={doc.dataUrl}
                                alt={doc.title}
                                className="h-24 w-full object-cover rounded border border-slate-100"
                              />
                              <div className="truncate text-[11px] font-semibold text-slate-700" title={doc.title}>
                                {doc.title}
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightboxPreview({
                                      title: doc.title,
                                      images: [{ label: doc.title, dataUrl: doc.dataUrl, uploadedAt: doc.uploadedAt }],
                                    })
                                  }
                                  className="font-bold text-teal-700 hover:underline"
                                >
                                  Xem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTenantContractImage(doc.id)}
                                  className="text-rose-600 hover:underline"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </fieldset>

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
                      {saving ? 'Đang lưu...' : 'Lưu hồ sơ & hình ảnh'}
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
                    {activeTenants.map((t) => {
                      const tContracts = parseDocumentImages(t.contractImagesJson);
                      const hasCccdPhotos = Boolean(t.cccdFrontUrl || t.cccdBackUrl);
                      const totalDocs =
                        (t.avatarUrl ? 1 : 0) +
                        (t.cccdFrontUrl ? 1 : 0) +
                        (t.cccdBackUrl ? 1 : 0) +
                        tContracts.length;
                      const avatarInitial =
                        t.fullName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() || 'K';

                      return (
                        <article
                          key={t.id}
                          className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${
                            t.isRepresentative
                              ? 'border-teal-600/40 bg-teal-50/30'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              {t.avatarUrl ? (
                                <button
                                  type="button"
                                  onClick={() => openTenantDocumentsLightbox(t)}
                                  className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-teal-600/80 shadow-xs"
                                  title={`Xem ảnh đại diện & hồ sơ của ${t.fullName}`}
                                >
                                  <img
                                    src={t.avatarUrl}
                                    alt={`Ảnh đại diện của ${t.fullName}`}
                                    width={48}
                                    height={48}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingTenant({ ...t })}
                                  title="Nhấn để tải ảnh đại diện cho thành viên này"
                                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-emerald-700 text-base font-black text-white shadow-xs hover:opacity-90"
                                >
                                  {avatarInitial}
                                </button>
                              )}

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h5 className="font-bold text-slate-900 truncate">{t.fullName}</h5>
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
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditingTenant({ ...t })}
                                aria-label={`Sửa thông tin và tải ảnh cho ${t.fullName}`}
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

                          {/* Document Thumbnails & Quick Upload Bar */}
                          <div className="mt-3 rounded-lg border border-slate-200/80 bg-white/90 p-2.5 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold ${
                                    hasCccdPhotos
                                      ? 'bg-teal-100 text-teal-900'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  <CreditCard className="h-3 w-3" aria-hidden="true" />
                                  {t.cccdFrontUrl && t.cccdBackUrl
                                    ? 'CCCD: Đủ 2 mặt'
                                    : t.cccdFrontUrl || t.cccdBackUrl
                                    ? 'CCCD: 1 mặt'
                                    : 'Chưa có ảnh CCCD'}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold ${
                                    tContracts.length > 0
                                      ? 'bg-sky-100 text-sky-900'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  <FileCheck2 className="h-3 w-3" aria-hidden="true" />
                                  {tContracts.length > 0
                                    ? `HĐ/Tạm trú: ${tContracts.length} ảnh`
                                    : 'Chưa có ảnh HĐ'}
                                </span>
                              </div>

                              {totalDocs > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openTenantDocumentsLightbox(t)}
                                  className="inline-flex items-center gap-1 font-bold text-teal-700 hover:underline"
                                >
                                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                  Xem ảnh ({totalDocs})
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingTenant({ ...t })}
                                  className="inline-flex items-center gap-1 font-bold text-amber-700 hover:underline"
                                >
                                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                                  + Tải ảnh CCCD/HĐ
                                </button>
                              )}
                            </div>

                            {totalDocs > 0 && (
                              <div className="flex items-center gap-2 overflow-x-auto pt-1">
                                {t.cccdFrontUrl && (
                                  <button
                                    type="button"
                                    onClick={() => openTenantDocumentsLightbox(t)}
                                    className="group relative shrink-0 overflow-hidden rounded border border-slate-200"
                                    title="Xem CCCD Mặt trước"
                                  >
                                    <img
                                      src={t.cccdFrontUrl}
                                      alt={`CCCD mặt trước ${t.fullName}`}
                                      className="h-12 w-20 object-cover transition-transform group-hover:scale-105"
                                    />
                                    <span className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-[9px] font-bold text-white text-center py-0.5">
                                      Mặt trước
                                    </span>
                                  </button>
                                )}
                                {t.cccdBackUrl && (
                                  <button
                                    type="button"
                                    onClick={() => openTenantDocumentsLightbox(t)}
                                    className="group relative shrink-0 overflow-hidden rounded border border-slate-200"
                                    title="Xem CCCD Mặt sau"
                                  >
                                    <img
                                      src={t.cccdBackUrl}
                                      alt={`CCCD mặt sau ${t.fullName}`}
                                      className="h-12 w-20 object-cover transition-transform group-hover:scale-105"
                                    />
                                    <span className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-[9px] font-bold text-white text-center py-0.5">
                                      Mặt sau
                                    </span>
                                  </button>
                                )}
                                {tContracts.map((doc, idx) => (
                                  <button
                                    key={doc.id}
                                    type="button"
                                    onClick={() => openTenantDocumentsLightbox(t)}
                                    className="group relative shrink-0 overflow-hidden rounded border border-slate-200"
                                    title={doc.title}
                                  >
                                    <img
                                      src={doc.dataUrl}
                                      alt={doc.title}
                                      className="h-12 w-16 object-cover transition-transform group-hover:scale-105"
                                    />
                                    <span className="absolute bottom-0 inset-x-0 bg-teal-900/80 text-[9px] font-bold text-white text-center py-0.5">
                                      HĐ #{idx + 1}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

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
                      );
                    })}
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

              {/* Room Rental Contract Images Upload Section */}
              <fieldset className="rounded-xl border border-teal-300 bg-teal-50/40 p-4 space-y-3">
                <legend className="px-2 text-xs font-bold uppercase tracking-wider text-teal-900">
                  📄 Hình Ảnh Hợp Đồng Thuê Phòng {room.roomNumber} (Bản chụp các trang có chữ ký)
                </legend>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="rc-contract-files"
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <ImagePlus className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    Chọn ảnh chụp hợp đồng thuê phòng (Hỗ trợ chọn nhiều trang cùng lúc)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const rep = activeTenants.find((t) => t.isRepresentative) || activeTenants[0];
                      const sampleUrl = generateSampleDocumentDataUrl('CONTRACT', {
                        fullName: rep?.fullName || `Đại diện Phòng ${room.roomNumber}`,
                        cccd: rep?.cccd || '079099001234',
                        roomNumber: room.roomNumber,
                        propertyName: property.name,
                        baseRent: roomForm.baseRent,
                      });
                      const nextList: DocumentImageItem[] = [
                        ...roomContractImages,
                        {
                          id: `rc_sample_${Date.now()}`,
                          title: `Hợp đồng thuê Phòng ${room.roomNumber} - Trang ${roomContractImages.length + 1}`,
                          dataUrl: sampleUrl,
                          uploadedAt: new Date().toLocaleDateString('vi-VN'),
                        },
                      ];
                      setRoomForm({
                        ...roomForm,
                        contractImagesJson: JSON.stringify(nextList),
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-teal-300 px-2.5 py-1 text-xs font-bold text-teal-800 hover:bg-teal-100"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    + Tạo trang hợp đồng mẫu
                  </button>
                </div>

                <input
                  id="rc-contract-files"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleUploadRoomContractImages(e.target.files)}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3.5 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-teal-800 cursor-pointer"
                />

                {uploadingField === 'roomContracts' && (
                  <p className="text-xs font-semibold text-teal-800">Đang nén và xử lý ảnh hợp đồng...</p>
                )}

                {roomContractImages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
                    Chưa có ảnh chụp hợp đồng nào cho Phòng {room.roomNumber}. Hãy tải ảnh từ máy/điện thoại hoặc nhấn &ldquo;+ Tạo trang hợp đồng mẫu&rdquo;.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
                    {roomContractImages.map((doc) => (
                      <div
                        key={doc.id}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs space-y-2"
                      >
                        <img
                          src={doc.dataUrl}
                          alt={doc.title}
                          className="h-32 w-full object-cover rounded-lg border border-slate-100"
                        />
                        <div className="truncate text-xs font-bold text-slate-800" title={doc.title}>
                          {doc.title}
                        </div>
                        <div className="text-[10px] text-slate-400">Ngày tải: {doc.uploadedAt}</div>
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxPreview({
                                title: doc.title,
                                subtitle: `${property.name} • Phòng ${room.roomNumber}`,
                                images: [{ label: doc.title, dataUrl: doc.dataUrl, uploadedAt: doc.uploadedAt }],
                              })
                            }
                            className="inline-flex items-center gap-1 font-bold text-teal-700 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Xem lớn
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRoomContractImage(doc.id)}
                            className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>

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
                  Lưu cấu hình & hợp đồng Phòng {room.roomNumber}
                </button>
              </div>
            </form>
          )}
        </div>
      </ModalDialog>

      <DocumentLightboxModal
        preview={lightboxPreview}
        onClose={() => setLightboxPreview(null)}
      />
    </>
  );
}
