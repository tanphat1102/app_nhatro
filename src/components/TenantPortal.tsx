'use client';

import React, { useState } from 'react';
import { Invoice, Property, Room, Tenant, User } from '@/types/nhatro';
import { formatVND } from './InvoiceReceiptModal';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  Droplets,
  FileText,
  History,
  Home,
  MessageSquare,
  Printer,
  QrCode,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

interface TenantPortalProps {
  user: User;
  property: Property | null;
  room: Room | null;
  tenants: Tenant[];
  invoices: Invoice[];
  onOpenReceipt: (inv: Invoice) => void;
  onViewAllBoard: () => void;
}

export function TenantPortal({
  user,
  property,
  room,
  tenants,
  invoices,
  onOpenReceipt,
  onViewAllBoard,
}: TenantPortalProps) {
  const [copiedField, setCopiedField] = useState<string>('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-800 via-teal-900 to-slate-900 p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-200 border border-teal-400/30">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {property.name}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Cổng Thông Tin Phòng {room.roomNumber}
            </h2>
            <p className="text-xs text-teal-200/80">
              Xin chào, <strong>{user.fullName}</strong> • 📍 {property.address}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onViewAllBoard}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 backdrop-blur transition-colors"
            >
              <History className="h-4 w-4" aria-hidden="true" />
              Xem bảng khu trọ
            </button>
          </div>
        </div>

        {/* Room Info Highlights */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-white/10 pt-4 text-xs">
          <div>
            <span className="text-teal-300 font-medium">Tiền phòng cố định:</span>
            <div className="text-base font-extrabold text-white mt-0.5">
              {formatVND(room.baseRent)} đ/tháng
            </div>
          </div>
          <div>
            <span className="text-teal-300 font-medium">Tiền đặt cọc:</span>
            <div className="text-base font-extrabold text-white mt-0.5">
              {formatVND(room.depositAmount)} đ
            </div>
          </div>
          <div>
            <span className="text-teal-300 font-medium">Số người đang ở:</span>
            <div className="text-base font-extrabold text-white mt-0.5">
              {roomTenants.length} thành viên
            </div>
          </div>
          <div>
            <span className="text-teal-300 font-medium">Thời hạn hợp đồng:</span>
            <div className="text-sm font-bold text-white mt-0.5">
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
              <div className="flex items-center justify-between rounded-xl bg-slate-900 p-3.5 text-white">
                <span className="text-xs uppercase tracking-wider font-bold">
                  {latestInvoice.paymentStatus === 'PARTIAL' ? 'Còn cần thanh toán:' : 'Tổng cộng cần thanh toán:'}
                </span>
                <span className="text-xl font-black text-amber-300">
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
            {roomTenants.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>
                    {t.fullName}{' '}
                    {t.isRepresentative && (
                      <span className="rounded bg-teal-700 px-1.5 py-0.2 text-[9px] text-white">
                        Đại diện hợp đồng
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-slate-500">{t.phone}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Quê: {t.hometown || '—'}</span>
                  {t.vehiclePlate && (
                    <span className="font-mono text-slate-700">🏍️ {t.vehiclePlate}</span>
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
            ))}
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
            <textarea
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
    </div>
  );
}
