'use client';

import React, { useState } from 'react';
import { ExtraFeeItem, Invoice, Property, Room, Tenant } from '@/types/nhatro';
import { ModalDialog } from './ModalDialog';
import { Check, Copy, Printer, QrCode, Users } from 'lucide-react';

interface InvoiceReceiptModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  property: Property | null;
  room: Room | null;
  roomTenants: Tenant[];
}

export function formatVND(val: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(val || 0));
}

export function InvoiceReceiptModal({
  open,
  onClose,
  invoice,
  property,
  room,
  roomTenants,
}: InvoiceReceiptModalProps) {
  const [copied, setCopied] = useState(false);

  if (!invoice || !property) return null;

  const activeTenants = roomTenants.filter((t) => t.isActive);
  const repTenant = activeTenants.find((t) => t.isRepresentative) || activeTenants[0];

  const elecDiff = Math.max(0, invoice.elecNew - invoice.elecOld);
  const waterDiff = Math.max(0, invoice.waterNew - invoice.waterOld);

  let extraFees: ExtraFeeItem[] = [];
  try {
    extraFees = JSON.parse(invoice.extraFeesJson || '[]');
  } catch {
    extraFees = [];
  }

  const remainingToPay = Math.max(0, invoice.totalAmount - (invoice.paymentStatus === 'PARTIAL' ? invoice.paidAmount : 0));

  const cleanAccountNo = property.bankAccountNumber.replace(/\s+/g, '');
  const transferInfo = `PHONG ${invoice.roomNumber} T${invoice.month}_${invoice.year}`;
  const vietQrUrl = `https://img.vietqr.io/image/${property.bankBin || '970436'}-${cleanAccountNo}-compact2.png?amount=${remainingToPay}&addInfo=${encodeURIComponent(
    transferInfo
  )}&accountName=${encodeURIComponent(property.bankAccountHolder)}`;

  const buildZaloText = () => {
    const lines = [
      `📋 PHIẾU BÁO TIỀN TRỌ THÁNG ${invoice.month}/${invoice.year}`,
      `🏠 ${property.name} - PHÒNG ${invoice.roomNumber}`,
      repTenant ? `👤 Người đại diện: ${repTenant.fullName} (${activeTenants.length} người ở)` : `👥 Số người sử dụng: ${invoice.occupantCount} người`,
      `--------------------------`,
      `1. Tiền phòng: ${formatVND(invoice.roomRent)} đ`,
      `2. Tiền điện: (${invoice.elecNew} - ${invoice.elecOld} = ${elecDiff} KW) x ${formatVND(invoice.elecRate)} = ${formatVND(invoice.elecAmount)} đ`,
      invoice.waterMode === 'BY_METER'
        ? `3. Tiền nước (theo đồng hồ): (${invoice.waterNew} - ${invoice.waterOld} = ${waterDiff} m³) x ${formatVND(invoice.waterRate)} = ${formatVND(invoice.waterAmount)} đ`
        : invoice.waterMode === 'PER_PERSON'
        ? `3. Tiền nước (theo đầu người): ${invoice.occupantCount} người x ${formatVND(invoice.waterRate)} = ${formatVND(invoice.waterAmount)} đ`
        : `3. Tiền nước: ${formatVND(invoice.waterAmount)} đ`,
      `4. Tiền rác: ${formatVND(invoice.trashAmount)} đ`,
    ];

    if (invoice.lightingAmount > 0) {
      lines.push(`5. Đèn vệ sinh: ${formatVND(invoice.lightingAmount)} đ`);
    }
    if (invoice.wifiAmount > 0) {
      lines.push(`6. Wifi/Internet: ${formatVND(invoice.wifiAmount)} đ`);
    }
    if (invoice.parkingAmount > 0) {
      lines.push(`7. Phí giữ xe: ${formatVND(invoice.parkingAmount)} đ`);
    }
    for (const ef of extraFees) {
      if (ef.amount > 0) {
        lines.push(`• ${ef.name}: ${formatVND(ef.amount)} đ`);
      }
    }
    if (invoice.previousDebt > 0) {
      lines.push(`• Nợ cũ kỳ trước: +${formatVND(invoice.previousDebt)} đ`);
    }
    if (invoice.discountAmount > 0) {
      lines.push(`• Giảm trừ: -${formatVND(invoice.discountAmount)} đ`);
    }
    if (invoice.note) {
      lines.push(`📌 Ghi chú: ${invoice.note}`);
    }
    lines.push(`--------------------------`);
    lines.push(`💰 TỔNG CỘNG: ${formatVND(invoice.totalAmount)} VNĐ`);
    if (invoice.paymentStatus === 'PARTIAL') {
      lines.push(`✅ Đã thanh toán: ${formatVND(invoice.paidAmount)} VNĐ`);
      lines.push(`❗ Còn lại cần đóng: ${formatVND(remainingToPay)} VNĐ`);
    }
    lines.push(`🏦 TT Chuyển khoản: ${property.bankName} - STK: ${property.bankAccountNumber} (${property.bankAccountHolder})`);
    if (property.paymentNote) {
      lines.push(`ℹ️ ${property.paymentNote}`);
    }
    return lines.join('\n');
  };

  const handleCopyZalo = async () => {
    await navigator.clipboard.writeText(buildZaloText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={`Phiếu Báo Tiền Trọ - Phòng ${invoice.roomNumber} (Tháng ${invoice.month}/${invoice.year})`}
      subtitle={property.address}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="rounded-xl border-2 border-teal-700/20 bg-white p-5 shadow-sm">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="inline-block rounded-full bg-teal-100 px-3 py-0.5 text-xs font-semibold text-teal-800">
                {property.name}
              </span>
              <h3 className="mt-1 text-xl font-extrabold text-slate-900">
                PHIẾU BÁO TIỀN NHÀ TRỌ THÁNG {invoice.month}/{invoice.year}
              </h3>
              <p className="text-xs text-slate-600">{property.address}</p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 rounded-xl border-2 border-teal-600/30 bg-teal-50 px-3.5 py-1.5 text-teal-900">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Phòng</span>
                <span className="text-xl font-black text-teal-950">{invoice.roomNumber}</span>
              </div>
              {invoice.oldRoomNumber && (
                <p className="mt-1 text-xs text-slate-500">Phòng cũ: {invoice.oldRoomNumber}</p>
              )}
            </div>
          </div>

          {/* Room & Tenants summary */}
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3.5 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Users className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                Thành viên trong phòng ({activeTenants.length || invoice.occupantCount} người)
              </div>
              {activeTenants.length > 0 ? (
                <ul className="mt-1.5 space-y-1 text-sm text-slate-800">
                  {activeTenants.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {t.fullName}{' '}
                        {t.isRepresentative && (
                          <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[11px] font-semibold text-teal-800">
                            Đại diện
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-slate-500">{t.phone}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  Số người tính phí: <strong>{invoice.occupantCount} người</strong>
                </p>
              )}
            </div>
            <div className="text-sm sm:border-l sm:border-slate-200 sm:pl-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Thông tin đơn giá áp dụng
              </p>
              <ul className="mt-1.5 space-y-0.5 text-xs text-slate-700">
                <li>• Điện: <strong>{formatVND(invoice.elecRate)} đ/KW</strong> (Theo chỉ số đồng hồ)</li>
                <li>
                  • Nước:{' '}
                  {invoice.waterMode === 'BY_METER' ? (
                    <strong>{formatVND(invoice.waterRate)} đ/m³ (Theo đồng hồ)</strong>
                  ) : invoice.waterMode === 'PER_PERSON' ? (
                    <strong>{formatVND(invoice.waterRate)} đ/người (Theo đầu người)</strong>
                  ) : (
                    <strong>{formatVND(invoice.waterRate)} đ/tháng</strong>
                  )}
                </li>
                <li>• Tiền rác: <strong>{formatVND(invoice.trashAmount)} đ/tháng</strong></li>
                {invoice.lightingAmount > 0 && (
                  <li>• Đèn VS: <strong>{formatVND(invoice.lightingAmount)} đ/tháng</strong></li>
                )}
              </ul>
            </div>
          </div>

          {/* Detailed Fee Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Khoản thu</th>
                  <th className="py-2 px-2">Chi tiết cách tính</th>
                  <th className="py-2 pl-2 text-right">Thành tiền (VNĐ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 pr-2 font-medium text-slate-900">1. Tiền phòng</td>
                  <td className="py-2.5 px-2 text-slate-600">Cố định hàng tháng</td>
                  <td className="py-2.5 pl-2 text-right font-semibold text-slate-900">
                    {formatVND(invoice.roomRent)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-2 font-medium text-slate-900">2. Tiền điện</td>
                  <td className="py-2.5 px-2 text-slate-600">
                    Số cũ: <strong>{invoice.elecOld}</strong> → Số mới: <strong>{invoice.elecNew}</strong> ({elecDiff} KW × {formatVND(invoice.elecRate)}đ)
                  </td>
                  <td className="py-2.5 pl-2 text-right font-semibold text-slate-900">
                    {formatVND(invoice.elecAmount)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-2 font-medium text-slate-900">3. Tiền nước</td>
                  <td className="py-2.5 px-2 text-slate-600">
                    {invoice.waterMode === 'BY_METER' ? (
                      <>
                        Số cũ: <strong>{invoice.waterOld}</strong> → Số mới: <strong>{invoice.waterNew}</strong> ({waterDiff} m³ × {formatVND(invoice.waterRate)}đ)
                      </>
                    ) : invoice.waterMode === 'PER_PERSON' ? (
                      <>
                        Tính theo đầu người: <strong>{invoice.occupantCount} người</strong> × {formatVND(invoice.waterRate)}đ/người
                      </>
                    ) : invoice.waterMode === 'FIXED_PER_ROOM' ? (
                      <>Cố định theo phòng</>
                    ) : (
                      <>Miễn phí / Thu riêng</>
                    )}
                  </td>
                  <td className="py-2.5 pl-2 text-right font-semibold text-slate-900">
                    {formatVND(invoice.waterAmount)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-2 font-medium text-slate-900">4. Tiền rác</td>
                  <td className="py-2.5 px-2 text-slate-600">Vệ sinh môi trường hàng tháng</td>
                  <td className="py-2.5 pl-2 text-right font-semibold text-slate-900">
                    {formatVND(invoice.trashAmount)}
                  </td>
                </tr>
                {(invoice.lightingAmount > 0 || property.lightingRate > 0) && (
                  <tr>
                    <td className="py-2.5 pr-2 font-medium text-slate-900">5. Đèn vệ sinh (Đèn VS)</td>
                    <td className="py-2.5 px-2 text-slate-600">
                      {invoice.lightingAmount > 0 ? 'Đèn chiếu sáng hành lang / khu chung' : 'Miễn thu riêng phòng này'}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-semibold text-slate-900">
                      {formatVND(invoice.lightingAmount)}
                    </td>
                  </tr>
                )}
                {invoice.wifiAmount > 0 && (
                  <tr>
                    <td className="py-2.5 pr-2 font-medium text-slate-900">Wifi / Internet</td>
                    <td className="py-2.5 px-2 text-slate-600">Phí mạng hàng tháng</td>
                    <td className="py-2.5 pl-2 text-right font-semibold text-slate-900">
                      {formatVND(invoice.wifiAmount)}
                    </td>
                  </tr>
                )}
                {invoice.parkingAmount > 0 && (
                  <tr>
                    <td className="py-2.5 pr-2 font-medium text-slate-900">Phí giữ xe</td>
                    <td className="py-2.5 px-2 text-slate-600">{invoice.vehicleCount} xe</td>
                    <td className="py-2.5 pl-2 text-right font-semibold text-slate-900">
                      {formatVND(invoice.parkingAmount)}
                    </td>
                  </tr>
                )}
                {extraFees.map((ef) => (
                  <tr key={ef.id}>
                    <td className="py-2.5 pr-2 font-medium text-slate-900">{ef.name}</td>
                    <td className="py-2.5 px-2 text-slate-600">
                      {ef.quantity} {ef.unit} × {formatVND(ef.unitPrice)}đ
                    </td>
                    <td className="py-2.5 pl-2 text-right font-semibold text-slate-900">
                      {formatVND(ef.amount)}
                    </td>
                  </tr>
                ))}
                {invoice.previousDebt > 0 && (
                  <tr className="bg-amber-50/70">
                    <td className="py-2.5 pr-2 font-medium text-amber-900">Nợ cũ kỳ trước</td>
                    <td className="py-2.5 px-2 text-amber-800">Chuyển sang từ tháng trước</td>
                    <td className="py-2.5 pl-2 text-right font-semibold text-amber-900">
                      +{formatVND(invoice.previousDebt)}
                    </td>
                  </tr>
                )}
                {invoice.discountAmount > 0 && (
                  <tr className="bg-emerald-50/70">
                    <td className="py-2.5 pr-2 font-medium text-emerald-900">Giảm trừ / Khuyến mãi</td>
                    <td className="py-2.5 px-2 text-emerald-800">Hỗ trợ giảm giá</td>
                    <td className="py-2.5 pl-2 text-right font-semibold text-emerald-900">
                      -{formatVND(invoice.discountAmount)}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-teal-600 bg-teal-50/90 text-slate-900">
                  <td colSpan={2} className="px-3 py-3 text-base font-bold uppercase text-teal-950">
                    Tổng cộng thanh toán
                  </td>
                  <td className="px-3 py-3 text-right text-lg font-black text-teal-800">
                    {formatVND(invoice.totalAmount)} đ
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {invoice.excelOriginalTotal !== null &&
            invoice.excelOriginalTotal !== invoice.totalAmount && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
                <strong>Lưu ý đối soát Excel gốc:</strong> Cột Tổng cộng trong file Excel cũ hiển thị{' '}
                <strong>{formatVND(invoice.excelOriginalTotal)} đ</strong> (chênh lệch{' '}
                <strong>{formatVND(Math.abs(invoice.totalAmount - invoice.excelOriginalTotal))} đ</strong> do công thức Excel cũ thiếu cộng cột Đèn VS 25,000đ).
              </div>
            )}

          {invoice.note && (
            <div className="mt-3 rounded-lg bg-slate-100 px-3.5 py-2 text-xs text-slate-700">
              <strong>Ghi chú phòng:</strong> {invoice.note}
            </div>
          )}

          {/* Payment & VietQR Section */}
          <div className="mt-5 grid grid-cols-1 items-center gap-4 border-t border-slate-200 pt-4 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1.5 text-sm">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <QrCode className="h-4 w-4 text-teal-700" aria-hidden="true" />
                Thông tin thanh toán
              </div>
              <p className="text-slate-700">
                Ngân hàng: <strong>{property.bankName}</strong>
              </p>
              <p className="text-slate-700">
                Số tài khoản: <strong className="font-mono text-base text-teal-800">{property.bankAccountNumber}</strong>
              </p>
              <p className="text-slate-700">
                Chủ tài khoản: <strong>{property.bankAccountHolder}</strong>
              </p>
              <p className="text-xs text-slate-600">
                Nội dung CK: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{transferInfo}</code>
              </p>
              {property.paymentNote && (
                <p className="mt-2 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800">
                  {property.paymentNote}
                </p>
              )}
              {property.generalNote && (
                <p className="text-xs italic text-slate-500">{property.generalNote}</p>
              )}
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center">
              <img
                src={vietQrUrl}
                alt={`Mã VietQR thanh toán phòng ${invoice.roomNumber}`}
                width={150}
                height={150}
                loading="lazy"
                className="h-36 w-36 rounded-lg object-contain bg-white p-1"
              />
              <span className="mt-1 text-[11px] font-medium text-slate-600">
                Quét VietQR ({formatVND(remainingToPay)}đ)
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="no-print flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCopyZalo}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-700 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-900 hover:bg-teal-100 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Đã sao chép tin nhắn Zalo!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Sao chép tin nhắn báo Zalo
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            In phiếu / Xuất PDF
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
