'use client';

import React, { useState } from 'react';
import { DocumentImageItem, Invoice, Property, Room, Tenant, User } from '@/types/nhatro';
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
  AlertCircle,
  Building2,
  Camera,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  FileCheck2,
  FileText,
  History,
  Home,
  MessageSquare,
  Printer,
  QrCode,
  Send,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';

interface TenantPortalProps {
  user: User;
  property: Property | null;
  room: Room | null;
  tenants: Tenant[];
  invoices: Invoice[];
  onOpenReceipt: (inv: Invoice) => void;
  onViewAllBoard: () => void;
  onUpdateTenantDocuments?: (payload: {
    tenantId: number;
    avatarUrl?: string;
    cccdFrontUrl?: string;
    cccdBackUrl?: string;
    contractImagesJson?: string;
  }) => Promise<void>;
}

export function TenantPortal({
  user,
  property,
  room,
  tenants,
  invoices,
  onOpenReceipt,
  onViewAllBoard,
  onUpdateTenantDocuments,
}: TenantPortalProps) {
  const [copiedField, setCopiedField] = useState<string>('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string>('');
  const [lightboxPreview, setLightboxPreview] = useState<LightboxPreviewData | null>(null);

  if (!property || !room) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <Home className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="text-base font-bold text-slate-800">
          Tài khoản của bạn chưa được liên kết với phòng trọ cụ thể
        </h3>
        <p className="text-xs text-slate-500">
          Vui lòng liên hệ Chủ nhà (Admin) hoặc Quản lý để gán phòng và cập nhật hồ sơ khách thuê.
        </p>
        <button
          type="button"
          onClick={onViewAllBoard}
          className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800"
        >
          Xem bảng tính tiền chung
        </button>
      </div>
    );
  }

  // Room's invoices sorted newest first
  const roomInvoices = invoices
    .filter((inv) => inv.roomId === room.id)
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

  const latestInvoice = roomInvoices[0] || null;
  const historyInvoices = roomInvoices.slice(1);

  // Room's active tenants
  const roomTenants = tenants.filter((t) => t.roomId === room.id && t.isActive);
  const myTenantProfile =
    roomTenants.find((t) => t.id === user.tenantId) ||
    roomTenants.find((t) => t.phone && t.phone === user.phone) ||
    roomTenants.find((t) => t.isRepresentative) ||
    roomTenants[0] ||
    null;

  const roomContractImages = parseDocumentImages(room.contractImagesJson);
  const myContractImages = parseDocumentImages(myTenantProfile?.contractImagesJson);

  const elecDiff = latestInvoice ? Math.max(0, latestInvoice.elecNew - latestInvoice.elecOld) : 0;
  const waterDiff = latestInvoice ? Math.max(0, latestInvoice.waterNew - latestInvoice.waterOld) : 0;

  const remainingToPay = latestInvoice
    ? Math.max(
        0,
        latestInvoice.totalAmount -
          (latestInvoice.paymentStatus === 'PARTIAL' ? latestInvoice.paidAmount : 0)
      )
    : 0;

  const cleanAccountNo = property.bankAccountNumber.replace(/\s+/g, '');
  const transferInfo = latestInvoice
    ? `PHONG ${room.roomNumber} T${latestInvoice.month}_${latestInvoice.year}`
    : `PHONG ${room.roomNumber}`;

  const vietQrUrl = latestInvoice
    ? `https://img.vietqr.io/image/${property.bankBin || '970436'}-${cleanAccountNo}-compact2.png?amount=${remainingToPay}&addInfo=${encodeURIComponent(
        transferInfo
      )}&accountName=${encodeURIComponent(property.bankAccountHolder)}`
    : '';

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setFeedbackText('');
    setTimeout(() => setFeedbackSent(false), 4000);
  };

  const handleUploadMyAvatar = async (files: FileList | null) => {
    if (!files || files.length === 0 || !myTenantProfile || !onUpdateTenantDocuments) return;
    setUploadingDoc('avatarUrl');
    try {
      const dataUrl = await compressAvatarFile(files[0]);
      await onUpdateTenantDocuments({
        tenantId: myTenantProfile.id,
        avatarUrl: dataUrl,
      });
    } finally {
      setUploadingDoc('');
    }
  };

  const handleUploadMyCccd = async (
    field: 'cccdFrontUrl' | 'cccdBackUrl',
    files: FileList | null
  ) => {
    if (!files || files.length === 0 || !myTenantProfile || !onUpdateTenantDocuments) return;
    setUploadingDoc(field);
    try {
      const dataUrl = await compressImageFile(files[0]);
      await onUpdateTenantDocuments({
        tenantId: myTenantProfile.id,
        [field]: dataUrl,
      });
    } finally {
      setUploadingDoc('');
    }
  };

  const handleUploadMyContract = async (files: FileList | null) => {
    if (!files || files.length === 0 || !myTenantProfile || !onUpdateTenantDocuments) return;
    setUploadingDoc('contract');
    try {
      const added: DocumentImageItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const dataUrl = await compressImageFile(files[i]);
        added.push({
          id: `tp_${Date.now()}_${i}`,
          title: files[i].name.replace(/\.[^/.]+$/, '') || `Hợp đồng / Tạm trú #${myContractImages.length + i + 1}`,
          dataUrl,
          uploadedAt: new Date().toLocaleDateString('vi-VN'),
        });
      }
      const nextList = [...myContractImages, ...added];
      await onUpdateTenantDocuments({
        tenantId: myTenantProfile.id,
        contractImagesJson: JSON.stringify(nextList),
      });
    } finally {
      setUploadingDoc('');
    }
  };

  const myInitial = (myTenantProfile?.fullName || user.fullName || 'K')
    .trim()
    .split(/\s+/)
    .pop()?.[0]
    ?.toUpperCase() || 'K';

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-3xl border border-teal-200/90 bg-gradient-to-br from-teal-50/90 via-emerald-50/70 to-cyan-50/80 p-6 text-slate-900 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {myTenantProfile?.avatarUrl ? (
              <button
                type="button"
                onClick={() =>
                  setLightboxPreview({
                    title: `Ảnh Đại Diện — ${myTenantProfile.fullName}`,
                    images: [
                      {
                        label: `Ảnh Đại Diện (${myTenantProfile.fullName})`,
                        dataUrl: myTenantProfile.avatarUrl,
                      },
                    ],
                  })
                }
                className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-teal-500 shadow-sm"
                title="Nhấn để phóng to ảnh đại diện"
              >
                <img
                  src={myTenantProfile.avatarUrl}
                  alt={`Ảnh đại diện của ${myTenantProfile.fullName}`}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-teal-400 bg-teal-600 text-2xl font-black text-white shadow-sm">
                {myInitial}
              </div>
            )}

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-teal-800 border border-teal-200 shadow-2xs">
                <Building2 className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                {property.name}
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Cổng Thông Tin Phòng {room.roomNumber}
              </h2>
              <p className="text-xs text-slate-600">
                Xin chào, <strong className="text-slate-900">{user.fullName}</strong> • 📍 {property.address}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onViewAllBoard}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-50 shadow-2xs transition-colors"
            >
              <History className="h-4 w-4 text-teal-700" aria-hidden="true" />
              Xem bảng khu trọ
            </button>
          </div>
        </div>

        {/* Room Info Highlights */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-teal-200/80 pt-4 text-xs">
          <div>
            <span className="text-teal-800 font-semibold">Tiền phòng cố định:</span>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">
              {formatVND(room.baseRent)} đ/tháng
            </div>
          </div>
          <div>
            <span className="text-teal-800 font-semibold">Tiền đặt cọc:</span>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">
              {formatVND(room.depositAmount)} đ
            </div>
          </div>
          <div>
            <span className="text-teal-800 font-semibold">Số người đang ở:</span>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">
              {roomTenants.length} thành viên
            </div>
          </div>
          <div>
            <span className="text-teal-800 font-semibold">Thời hạn hợp đồng:</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {room.contractStartDate} → {room.contractEndDate}
            </div>
          </div>
        </div>
      </div>

      {/* Latest Month Invoice & VietQR Payment */}
      {latestInvoice ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Invoice Details Card */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                  Hóa đơn kỳ thu tiền mới nhất
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  Phiếu Báo Tiền Tháng {latestInvoice.month}/{latestInvoice.year}
                </h3>
                <p className="text-xs text-slate-500">
                  Hạn nộp: Trước ngày 05 hàng tháng ({property.paymentNote || 'Chuyển khoản hoặc tiền mặt'})
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    latestInvoice.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : latestInvoice.paymentStatus === 'PARTIAL'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {latestInvoice.paymentStatus === 'PAID' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Đã thanh toán đủ
                    </>
                  ) : latestInvoice.paymentStatus === 'PARTIAL' ? (
                    <>
                      <Wallet className="h-4 w-4 text-amber-600" />
                      Đã đóng 1 phần ({formatVND(latestInvoice.paidAmount)}đ)
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                      Chưa thanh toán
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Detailed Fee Rows */}
            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">1. Tiền phòng:</span>
                <strong className="text-slate-900">{formatVND(latestInvoice.roomRent)} đ</strong>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <div>
                  <span className="text-slate-600">2. Tiền điện:</span>
                  <div className="text-[11px] text-amber-700">
                    Số cũ: {latestInvoice.elecOld} → Số mới: {latestInvoice.elecNew} ({elecDiff} KW × {formatVND(latestInvoice.elecRate)}đ)
                  </div>
                </div>
                <strong className="text-slate-900">{formatVND(latestInvoice.elecAmount)} đ</strong>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <div>
                  <span className="text-slate-600">3. Tiền nước:</span>
                  <div className="text-[11px] text-sky-700">
                    {latestInvoice.waterMode === 'PER_PERSON' ? (
                      <>Tính theo đầu người: {latestInvoice.occupantCount} người × {formatVND(latestInvoice.waterRate)}đ</>
                    ) : latestInvoice.waterMode === 'BY_METER' ? (
                      <>Số cũ: {latestInvoice.waterOld} → Số mới: {latestInvoice.waterNew} ({waterDiff} m³ × {formatVND(latestInvoice.waterRate)}đ)</>
                    ) : (
                      <>Cố định / Miễn phí</>
                    )}
                  </div>
                </div>
                <strong className="text-slate-900">{formatVND(latestInvoice.waterAmount)} đ</strong>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">4. Tiền rác sinh hoạt:</span>
                <strong className="text-slate-900">{formatVND(latestInvoice.trashAmount)} đ</strong>
              </div>

              {latestInvoice.lightingAmount > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">5. Đèn vệ sinh / Hành lang:</span>
                  <strong className="text-slate-900">{formatVND(latestInvoice.lightingAmount)} đ</strong>
                </div>
              )}

              {latestInvoice.wifiAmount > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Wifi / Internet:</span>
                  <strong className="text-slate-900">{formatVND(latestInvoice.wifiAmount)} đ</strong>
                </div>
              )}

              {latestInvoice.parkingAmount > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Phí giữ xe ({latestInvoice.vehicleCount} xe):</span>
                  <strong className="text-slate-900">{formatVND(latestInvoice.parkingAmount)} đ</strong>
                </div>
              )}

              {latestInvoice.previousDebt > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 bg-amber-50/60 px-2 rounded-lg text-amber-900">
                  <span>Nợ cũ kỳ trước chuyển sang:</span>
                  <strong>+{formatVND(latestInvoice.previousDebt)} đ</strong>
                </div>
              )}

              {latestInvoice.discountAmount > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 bg-emerald-50/60 px-2 rounded-lg text-emerald-900">
                  <span>Giảm trừ / Khuyến mãi:</span>
                  <strong>-{formatVND(latestInvoice.discountAmount)} đ</strong>
                </div>
              )}

              {/* Total Row */}
              <div className="flex items-center justify-between rounded-xl border-2 border-teal-200 bg-gradient-to-r from-teal-50/90 via-emerald-50/70 to-white p-3.5 text-slate-900">
                <span className="text-xs uppercase tracking-wider font-bold text-teal-900">
                  {latestInvoice.paymentStatus === 'PARTIAL' ? 'Còn cần thanh toán:' : 'Tổng cộng cần thanh toán:'}
                </span>
                <span className="text-xl font-black text-teal-800">
                  {formatVND(remainingToPay > 0 ? remainingToPay : latestInvoice.totalAmount)} đ
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenReceipt(latestInvoice)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-700 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Xem / In phiếu báo tiền trọ đầy đủ
              </button>
              {latestInvoice.note && (
                <span className="text-xs italic text-slate-500">
                  Ghi chú từ chủ trọ: {latestInvoice.note}
                </span>
              )}
            </div>
          </div>

          {/* Quick VietQR Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <QrCode className="h-5 w-5 text-teal-700" aria-hidden="true" />
                Quét Mã VietQR Thanh Toán
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Mở ứng dụng ngân hàng bất kỳ để quét mã và chuyển tiền tự động.
              </p>
            </div>

            {vietQrUrl && remainingToPay > 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-teal-200 bg-teal-50/40 p-4 text-center">
                <img
                  src={vietQrUrl}
                  alt={`VietQR thanh toán phòng ${room.roomNumber}`}
                  width={180}
                  height={180}
                  className="rounded-xl border border-white bg-white p-1.5 shadow-xs"
                />
                <span className="mt-2 text-xs font-bold text-teal-900">
                  {formatVND(remainingToPay)} VNĐ
                </span>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 p-6 text-center text-xs font-bold text-emerald-800">
                🎉 Phòng của bạn đã hoàn thành tiền trọ kỳ này!
              </div>
            )}

            <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ngân hàng:</span>
                <strong className="text-slate-800">{property.bankName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">STK:</span>
                <div className="flex items-center gap-1 font-mono font-bold text-teal-800">
                  <span>{property.bankAccountNumber}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(cleanAccountNo, 'acc')}
                    aria-label="Sao chép số tài khoản"
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Chủ TK:</span>
                <strong className="text-slate-800">{property.bankAccountHolder}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Nội dung CK:</span>
                <div className="flex items-center gap-1 font-mono font-bold text-slate-800">
                  <span>{transferInfo}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(transferInfo, 'info')}
                    aria-label="Sao chép nội dung chuyển khoản"
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {copiedField && (
                <div className="text-center font-bold text-emerald-700 text-[11px] pt-1">
                  ✓ Đã sao chép vào bộ nhớ tạm!
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Chưa có hóa đơn nào cho phòng này.
        </div>
      )}

      {/* Avatar, CCCD & Rental Contract Upload / Storage Section for Tenant */}
      {myTenantProfile && (
        <div className="rounded-2xl border border-teal-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <FileCheck2 className="h-5 w-5 text-teal-700" aria-hidden="true" />
                Ảnh Đại Diện, Căn Cước Công Dân (CCCD) & Hợp Đồng Phòng {room.roomNumber}
              </h3>
              <p className="text-xs text-slate-500">
                Cập nhật ảnh đại diện cá nhân, hình ảnh CCCD 2 mặt và hợp đồng thuê trọ để phục vụ đăng ký tạm trú Công an.
              </p>
            </div>

            {(myTenantProfile.avatarUrl ||
              myTenantProfile.cccdFrontUrl ||
              myTenantProfile.cccdBackUrl ||
              myContractImages.length > 0 ||
              roomContractImages.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  const imgs: LightboxPreviewData['images'] = [];
                  if (myTenantProfile.avatarUrl) {
                    imgs.push({
                      label: `Ảnh Đại Diện — ${myTenantProfile.fullName}`,
                      dataUrl: myTenantProfile.avatarUrl,
                    });
                  }
                  if (myTenantProfile.cccdFrontUrl) {
                    imgs.push({
                      label: `CCCD Mặt Trước — ${myTenantProfile.fullName}`,
                      dataUrl: myTenantProfile.cccdFrontUrl,
                    });
                  }
                  if (myTenantProfile.cccdBackUrl) {
                    imgs.push({
                      label: `CCCD Mặt Sau — ${myTenantProfile.fullName}`,
                      dataUrl: myTenantProfile.cccdBackUrl,
                    });
                  }
                  for (const c of myContractImages) {
                    imgs.push({ label: c.title, dataUrl: c.dataUrl, uploadedAt: c.uploadedAt });
                  }
                  for (const rc of roomContractImages) {
                    imgs.push({ label: rc.title, dataUrl: rc.dataUrl, uploadedAt: rc.uploadedAt });
                  }
                  setLightboxPreview({
                    title: `Toàn Bộ Hồ Sơ Ảnh, CCCD & Hợp Đồng — Phòng ${room.roomNumber}`,
                    subtitle: `${myTenantProfile.fullName} • Số CCCD: ${myTenantProfile.cccd || '—'}`,
                    images: imgs,
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-800"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                Xem toàn bộ ảnh giấy tờ
              </button>
            )}
          </div>

          {/* Personal Avatar Upload Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
            <div className="flex items-center gap-3.5">
              {myTenantProfile.avatarUrl ? (
                <img
                  src={myTenantProfile.avatarUrl}
                  alt={`Ảnh đại diện của ${myTenantProfile.fullName}`}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full object-cover border-2 border-teal-600 shadow-xs"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-lg font-black text-white">
                  {myInitial}
                </div>
              )}
              <div>
                <label
                  htmlFor="tp-avatar-file"
                  className="block text-xs font-extrabold uppercase tracking-wider text-teal-900 cursor-pointer"
                >
                  👤 Ảnh Đại Diện Của Bạn ({myTenantProfile.fullName})
                </label>
                <p className="text-xs text-slate-500">
                  Hiển thị trên Cổng khách thuê, sơ đồ phòng và danh sách thành viên.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                id="tp-avatar-file"
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadMyAvatar(e.target.files)}
                className="block text-xs text-slate-600 file:mr-2 file:rounded-xl file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-teal-800 cursor-pointer"
              />
              {onUpdateTenantDocuments && (
                <button
                  type="button"
                  onClick={async () => {
                    const sample = generateSampleAvatarDataUrl({
                      fullName: myTenantProfile.fullName,
                      gender: myTenantProfile.gender,
                      roomNumber: room.roomNumber,
                    });
                    await onUpdateTenantDocuments({
                      tenantId: myTenantProfile.id,
                      avatarUrl: sample,
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-teal-300 bg-white px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Avatar mẫu
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* CCCD Front */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="tp-cccd-front"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <CreditCard className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  Ảnh CCCD Mặt Trước
                </label>
                {onUpdateTenantDocuments && (
                  <button
                    type="button"
                    onClick={async () => {
                      const sample = generateSampleDocumentDataUrl('CCCD_FRONT', {
                        fullName: myTenantProfile.fullName,
                        cccd: myTenantProfile.cccd,
                        birthYear: myTenantProfile.birthYear,
                        gender: myTenantProfile.gender,
                        hometown: myTenantProfile.hometown,
                      });
                      await onUpdateTenantDocuments({
                        tenantId: myTenantProfile.id,
                        cccdFrontUrl: sample,
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Ảnh mẫu
                  </button>
                )}
              </div>

              <input
                id="tp-cccd-front"
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadMyCccd('cccdFrontUrl', e.target.files)}
                className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-teal-700 file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-teal-800 cursor-pointer"
              />

              {uploadingDoc === 'cccdFrontUrl' && (
                <p className="text-xs font-semibold text-teal-700">Đang nén và lưu ảnh...</p>
              )}

              {myTenantProfile.cccdFrontUrl ? (
                <div className="space-y-2">
                  <img
                    src={myTenantProfile.cccdFrontUrl}
                    alt={`CCCD mặt trước của ${myTenantProfile.fullName}`}
                    className="h-32 w-full object-contain rounded-lg border border-slate-200 bg-white p-1"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxPreview({
                          title: `CCCD Mặt Trước — ${myTenantProfile.fullName}`,
                          images: [
                            {
                              label: `CCCD Mặt Trước (${myTenantProfile.cccd})`,
                              dataUrl: myTenantProfile.cccdFrontUrl,
                            },
                          ],
                        })
                      }
                      className="font-bold text-teal-700 hover:underline"
                    >
                      Xem phóng to
                    </button>
                    {onUpdateTenantDocuments && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTenantDocuments({
                            tenantId: myTenantProfile.id,
                            cccdFrontUrl: '',
                          })
                        }
                        className="text-rose-600 hover:underline"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white py-6 text-center text-xs text-slate-400">
                  Chưa tải lên CCCD mặt trước
                </div>
              )}
            </div>

            {/* CCCD Back */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="tp-cccd-back"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <CreditCard className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  Ảnh CCCD Mặt Sau
                </label>
                {onUpdateTenantDocuments && (
                  <button
                    type="button"
                    onClick={async () => {
                      const sample = generateSampleDocumentDataUrl('CCCD_BACK', {
                        fullName: myTenantProfile.fullName,
                        cccd: myTenantProfile.cccd,
                      });
                      await onUpdateTenantDocuments({
                        tenantId: myTenantProfile.id,
                        cccdBackUrl: sample,
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Ảnh mẫu
                  </button>
                )}
              </div>

              <input
                id="tp-cccd-back"
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadMyCccd('cccdBackUrl', e.target.files)}
                className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-teal-700 file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-teal-800 cursor-pointer"
              />

              {uploadingDoc === 'cccdBackUrl' && (
                <p className="text-xs font-semibold text-teal-700">Đang nén và lưu ảnh...</p>
              )}

              {myTenantProfile.cccdBackUrl ? (
                <div className="space-y-2">
                  <img
                    src={myTenantProfile.cccdBackUrl}
                    alt={`CCCD mặt sau của ${myTenantProfile.fullName}`}
                    className="h-32 w-full object-contain rounded-lg border border-slate-200 bg-white p-1"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxPreview({
                          title: `CCCD Mặt Sau — ${myTenantProfile.fullName}`,
                          images: [
                            {
                              label: `CCCD Mặt Sau (${myTenantProfile.fullName})`,
                              dataUrl: myTenantProfile.cccdBackUrl,
                            },
                          ],
                        })
                      }
                      className="font-bold text-teal-700 hover:underline"
                    >
                      Xem phóng to
                    </button>
                    {onUpdateTenantDocuments && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTenantDocuments({
                            tenantId: myTenantProfile.id,
                            cccdBackUrl: '',
                          })
                        }
                        className="text-rose-600 hover:underline"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white py-6 text-center text-xs text-slate-400">
                  Chưa tải lên CCCD mặt sau
                </div>
              )}
            </div>

            {/* Contract & Residence Documents */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="tp-contract-files"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  Ảnh Hợp Đồng / Tạm Trú
                </label>
                {onUpdateTenantDocuments && (
                  <button
                    type="button"
                    onClick={async () => {
                      const sampleUrl = generateSampleDocumentDataUrl('CONTRACT', {
                        fullName: myTenantProfile.fullName,
                        cccd: myTenantProfile.cccd,
                        roomNumber: room.roomNumber,
                        propertyName: property.name,
                        baseRent: room.baseRent,
                      });
                      const nextList: DocumentImageItem[] = [
                        ...myContractImages,
                        {
                          id: `tp_sample_${Date.now()}`,
                          title: `Hợp đồng thuê Phòng ${room.roomNumber}`,
                          dataUrl: sampleUrl,
                          uploadedAt: new Date().toLocaleDateString('vi-VN'),
                        },
                      ];
                      await onUpdateTenantDocuments({
                        tenantId: myTenantProfile.id,
                        contractImagesJson: JSON.stringify(nextList),
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    + HĐ mẫu
                  </button>
                )}
              </div>

              <input
                id="tp-contract-files"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleUploadMyContract(e.target.files)}
                className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-slate-900 cursor-pointer"
              />

              {myContractImages.length + roomContractImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[...roomContractImages, ...myContractImages].map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() =>
                        setLightboxPreview({
                          title: doc.title,
                          images: [{ label: doc.title, dataUrl: doc.dataUrl, uploadedAt: doc.uploadedAt }],
                        })
                      }
                      className="group overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 text-left hover:border-teal-600"
                    >
                      <img
                        src={doc.dataUrl}
                        alt={doc.title}
                        className="h-20 w-full object-cover rounded"
                      />
                      <div className="mt-1 truncate text-[10px] font-bold text-slate-700 group-hover:text-teal-700">
                        {doc.title}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white py-6 text-center text-xs text-slate-400">
                  Chưa có ảnh hợp đồng / giấy tạm trú
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Room Members & Incident Report Section */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Room Members */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Users className="h-4 w-4 text-teal-700" aria-hidden="true" />
              Thành Viên Đang Ở Chung Phòng ({roomTenants.length} người)
            </h4>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              Phòng {room.roomNumber}
            </span>
          </div>

          <div className="space-y-2">
            {roomTenants.map((t) => {
              const tInit = t.fullName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() || 'K';
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs"
                >
                  {t.avatarUrl ? (
                    <img
                      src={t.avatarUrl}
                      alt={`Ảnh đại diện của ${t.fullName}`}
                      width={40}
                      height={40}
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-full object-cover border border-teal-500/60"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-black text-teal-800">
                      {tInit}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 font-bold text-slate-900">
                      <span className="truncate">
                        {t.fullName}{' '}
                        {t.isRepresentative && (
                          <span className="rounded bg-teal-700 px-1.5 py-0.2 text-[9px] text-white">
                            Đại diện hợp đồng
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-slate-500 shrink-0">{t.phone}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="truncate">Quê: {t.hometown || '—'}</span>
                      {t.vehiclePlate && (
                        <span className="font-mono text-slate-700 shrink-0">🏍️ {t.vehiclePlate}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>Vào ở: {t.moveInDate || '—'}</span>
                      <span
                        className={`font-semibold ${
                          t.tempResidenceStatus === 'REGISTERED'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {t.tempResidenceStatus === 'REGISTERED' ? '✓ Đã ĐK tạm trú' : 'Chờ ĐK tạm trú'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Maintenance / Incident Report */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <MessageSquare className="h-4 w-4 text-teal-700" aria-hidden="true" />
            Báo Hỏng Thiết Bị / Phản Ánh Tới Chủ Trọ
          </h4>
          <p className="text-xs text-slate-500">
            Gửi yêu cầu sửa chữa (bóng đèn cháy, vòi nước rò rỉ, điều hòa, v.v.) tới chủ nhà và ban quản lý.
          </p>

          <form onSubmit={handleSendFeedback} className="space-y-3 pt-1">
            <label htmlFor="tp-feedback-text" className="visually-hidden">
              Nội dung báo hỏng thiết bị hoặc phản ánh
            </label>
            <textarea
              id="tp-feedback-text"
              rows={3}
              required
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="VD: Bóng đèn nhà vệ sinh phòng 1 bị chớp tắt, nhờ chủ trọ hỗ trợ thay giúp..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-teal-700 focus:outline-hidden"
            />

            {feedbackSent && (
              <p className="rounded-lg bg-emerald-50 p-2 text-xs font-bold text-emerald-800">
                ✓ Đã gửi phản ánh tới chủ nhà thành công! Chúng tôi sẽ kiểm tra và hỗ trợ sớm nhất.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Gửi phản ánh
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Billing History */}
      {historyInvoices.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <History className="h-4 w-4 text-teal-700" aria-hidden="true" />
            Lịch Sử Các Kỳ Thu Tiền Trước Đây Của Phòng {room.roomNumber}
          </h4>

          <div className="table-wrapper rounded-xl border border-slate-200">
            <table className="text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-left font-bold uppercase text-slate-600">
                  <th className="py-2.5 pl-3 pr-2">Kỳ thu tiền</th>
                  <th className="py-2.5 px-2 text-right">Điện (KW)</th>
                  <th className="py-2.5 px-2 text-right">Nước</th>
                  <th className="py-2.5 px-2 text-right">Tiền phòng</th>
                  <th className="py-2.5 px-2 text-right">Tổng tiền</th>
                  <th className="py-2.5 px-2 text-center">Trạng thái</th>
                  <th className="py-2.5 pl-2 pr-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {historyInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pl-3 pr-2 font-bold text-slate-900">
                      Tháng {inv.month}/{inv.year}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {Math.max(0, inv.elecNew - inv.elecOld)} KW ({formatVND(inv.elecAmount)}đ)
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {formatVND(inv.waterAmount)}đ
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {formatVND(inv.roomRent)}đ
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-slate-900">
                      {formatVND(inv.totalAmount)} đ
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          inv.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {inv.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa đóng'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 pr-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenReceipt(inv)}
                        className="font-bold text-teal-700 hover:underline"
                      >
                        Xem phiếu
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DocumentLightboxModal
        preview={lightboxPreview}
        onClose={() => setLightboxPreview(null)}
      />
    </div>
  );
}
