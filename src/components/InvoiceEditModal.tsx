'use client';

import React, { useEffect, useState } from 'react';
import { BillingMode, CustomFeeTemplate, ExtraFeeItem, Invoice } from '@/types/nhatro';
import { ModalDialog } from './ModalDialog';
import { formatVND } from './InvoiceReceiptModal';
import { Plus, Save, Sparkles, Trash2 } from 'lucide-react';

interface InvoiceEditModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  customFeeTemplates?: CustomFeeTemplate[];
  onSave: (updated: Invoice) => Promise<void>;
}

const DEFAULT_FEE_PRESETS: Array<{
  name: string;
  mode: BillingMode;
  unit: string;
  unitPrice: number;
}> = [
  { name: 'Máy giặt chung', mode: 'PER_PERSON', unit: 'người', unitPrice: 50000 },
  { name: 'Thang máy', mode: 'FIXED_PER_ROOM', unit: 'phòng', unitPrice: 100000 },
  { name: 'Vệ sinh hành lang', mode: 'FIXED_PER_ROOM', unit: 'phòng', unitPrice: 30000 },
  { name: 'Camera an ninh', mode: 'FIXED_PER_ROOM', unit: 'phòng', unitPrice: 20000 },
  { name: 'Sạc xe điện', mode: 'PER_QUANTITY', unit: 'xe', unitPrice: 150000 },
  { name: 'Sửa chữa / Vật tư', mode: 'FIXED_PER_ROOM', unit: 'lần', unitPrice: 100000 },
];

export function InvoiceEditModal({
  open,
  onClose,
  invoice,
  customFeeTemplates = [],
  onSave,
}: InvoiceEditModalProps) {
  const [form, setForm] = useState<Invoice | null>(null);
  const [extraFees, setExtraFees] = useState<ExtraFeeItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setForm({ ...invoice });
      try {
        setExtraFees(JSON.parse(invoice.extraFeesJson || '[]'));
      } catch {
        setExtraFees([]);
      }
    }
  }, [invoice]);

  if (!form) return null;

  const isVacant = form.paymentStatus === 'VACANT';
  const elecDiff = Math.max(0, Number(form.elecNew || 0) - Number(form.elecOld || 0));
  const elecAmount = isVacant ? 0 : elecDiff * Number(form.elecRate || 0);

  const waterDiff = Math.max(0, Number(form.waterNew || 0) - Number(form.waterOld || 0));
  const waterAmount = isVacant
    ? 0
    : form.waterMode === 'BY_METER'
    ? waterDiff * Number(form.waterRate || 0)
    : form.waterMode === 'PER_PERSON'
    ? Number(form.occupantCount || 0) * Number(form.waterRate || 0)
    : form.waterMode === 'FIXED_PER_ROOM'
    ? Number(form.waterRate || 0)
    : 0;

  const extraFeesTotal = isVacant
    ? 0
    : extraFees.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const liveTotal = isVacant
    ? 0
    : Math.max(
        0,
        elecAmount +
          waterAmount +
          Number(form.trashAmount || 0) +
          Number(form.lightingAmount || 0) +
          Number(form.wifiAmount || 0) +
          Number(form.parkingAmount || 0) +
          extraFeesTotal +
          Number(form.roomRent || 0) +
          Number(form.previousDebt || 0) -
          Number(form.discountAmount || 0)
      );

  const addExtraFee = (preset?: { name: string; mode: BillingMode; unit: string; unitPrice: number }) => {
    const mode = preset?.mode || 'FIXED_PER_ROOM';
    const unitPrice = preset?.unitPrice ?? 50000;
    const quantity =
      mode === 'PER_PERSON'
        ? Math.max(1, Number(form.occupantCount || 1))
        : mode === 'PER_QUANTITY'
        ? Math.max(1, Number(form.vehicleCount || 1))
        : 1;
    const unit =
      preset?.unit ||
      (mode === 'PER_PERSON' ? 'người' : mode === 'PER_QUANTITY' ? 'lượt' : 'phòng');
    setExtraFees((prev) => [
      ...prev,
      {
        id: 'ef_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: preset?.name || 'Khoản thu mới',
        mode,
        unit,
        unitPrice,
        quantity,
        amount: quantity * unitPrice,
      },
    ]);
  };

  const updateExtraFee = (idx: number, patch: Partial<ExtraFeeItem>) => {
    setExtraFees((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, ...patch };
        if (patch.mode) {
          if (patch.mode === 'FIXED_PER_ROOM') {
            next.quantity = 1;
            next.unit = 'phòng';
          } else if (patch.mode === 'PER_PERSON') {
            next.quantity = Math.max(1, Number(form.occupantCount || 1));
            next.unit = 'người';
          } else if (patch.mode === 'PER_QUANTITY') {
            next.unit = next.unit === 'phòng' || next.unit === 'người' ? 'lượt' : next.unit || 'lượt';
          }
        }
        next.amount = Math.max(0, Number(next.quantity ?? 1)) * Math.max(0, Number(next.unitPrice ?? 0));
        return next;
      })
    );
  };

  const removeExtraFee = (idx: number) => {
    setExtraFees((prev) => prev.filter((_, i) => i !== idx));
  };

  // Merge property templates + default presets without duplicates by name
  const mergedPresets = [
    ...customFeeTemplates.map((t) => ({
      name: t.name,
      mode: t.mode,
      unit: t.unit,
      unitPrice: t.unitPrice,
      isPropertyTemplate: true,
    })),
    ...DEFAULT_FEE_PRESETS.filter(
      (d) => !customFeeTemplates.some((t) => t.name.trim().toLowerCase() === d.name.toLowerCase())
    ).map((d) => ({ ...d, isPropertyTemplate: false })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        elecAmount,
        waterAmount,
        extraFeesJson: JSON.stringify(extraFees),
        extraFeesAmount: extraFeesTotal,
        totalAmount: liveTotal,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={`Chỉnh Sửa Hóa Đơn - Phòng ${form.roomNumber} (Tháng ${form.month}/${form.year})`}
      subtitle="Tự động tính tiền điện, nước (theo số đồng hồ hoặc theo đầu người), các khoản phụ phí và công nợ"
      maxWidthClass="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Status (Radio group as recommended by modern-web-guidance forms) */}
        <fieldset className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <legend className="px-2 text-xs font-bold uppercase tracking-wider text-slate-600">
            Trạng thái phòng & Thanh toán
          </legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {(
              [
                { val: 'PAID', label: 'Đã thu đủ' },
                { val: 'UNPAID', label: 'Chưa đóng' },
                { val: 'PARTIAL', label: 'Đóng một phần' },
                { val: 'VACANT', label: 'Phòng trống (0đ)' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.val}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  form.paymentStatus === opt.val
                    ? 'border-teal-700 bg-teal-50 text-teal-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="paymentStatus"
                  value={opt.val}
                  checked={form.paymentStatus === opt.val}
                  onChange={() =>
                    setForm({
                      ...form,
                      paymentStatus: opt.val,
                      paidAmount: opt.val === 'PAID' ? liveTotal : opt.val === 'UNPAID' ? 0 : form.paidAmount,
                    })
                  }
                  className="accent-teal-700"
                />
                {opt.label}
              </label>
            ))}
          </div>

          {form.paymentStatus === 'PARTIAL' && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="inv-paid-amount" className="block text-xs font-semibold text-slate-700 mb-1">
                  Số tiền khách đã thanh toán trước (VNĐ)
                </label>
                <input
                  id="inv-paid-amount"
                  name="paidAmount"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.paidAmount}
                  onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                  Còn nợ lại: {formatVND(Math.max(0, liveTotal - form.paidAmount))} đ (sẽ tự động gợi ý cộng vào kỳ sau)
                </p>
              </div>
            </div>
          )}
        </fieldset>

        {/* Occupants & Base Rent */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="inv-occupants" className="block text-xs font-semibold text-slate-700 mb-1">
              Số người đang ở (Đầu người)
            </label>
            <input
              id="inv-occupants"
              name="occupantCount"
              type="number"
              min={0}
              value={form.occupantCount}
              onChange={(e) => {
                const nextOcc = Number(e.target.value);
                setForm({ ...form, occupantCount: nextOcc });
                setExtraFees((prev) =>
                  prev.map((ef) =>
                    ef.mode === 'PER_PERSON'
                      ? {
                          ...ef,
                          quantity: Math.max(0, nextOcc),
                          amount: Math.max(0, nextOcc) * Number(ef.unitPrice || 0),
                        }
                      : ef
                  )
                );
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label htmlFor="inv-vehicles" className="block text-xs font-semibold text-slate-700 mb-1">
              Số lượng xe
            </label>
            <input
              id="inv-vehicles"
              name="vehicleCount"
              type="number"
              min={0}
              value={form.vehicleCount}
              onChange={(e) => setForm({ ...form, vehicleCount: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="inv-room-rent" className="block text-xs font-semibold text-slate-700 mb-1">
              Tiền phòng (VNĐ/tháng)
            </label>
            <input
              id="inv-room-rent"
              name="roomRent"
              type="number"
              min={0}
              step={50000}
              value={form.roomRent}
              onChange={(e) => setForm({ ...form, roomRent: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-teal-800"
            />
          </div>
        </div>

        {/* Electricity section */}
        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-2 text-xs font-bold uppercase tracking-wider text-amber-700">
            1. Tiền Điện — Thành tiền: {formatVND(elecAmount)} đ ({elecDiff} KW)
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="inv-elec-old" className="block text-xs font-semibold text-slate-700 mb-1">
                Chỉ số Điện cũ (KW)
              </label>
              <input
                id="inv-elec-old"
                name="elecOld"
                type="number"
                min={0}
                value={form.elecOld}
                onChange={(e) => setForm({ ...form, elecOld: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="inv-elec-new" className="block text-xs font-semibold text-slate-700 mb-1">
                Chỉ số Điện mới (KW)
              </label>
              <input
                id="inv-elec-new"
                name="elecNew"
                type="number"
                min={0}
                value={form.elecNew}
                onChange={(e) => setForm({ ...form, elecNew: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label htmlFor="inv-elec-rate" className="block text-xs font-semibold text-slate-700 mb-1">
                Đơn giá Điện (VNĐ/KW)
              </label>
              <input
                id="inv-elec-rate"
                name="elecRate"
                type="number"
                min={0}
                step={100}
                value={form.elecRate}
                onChange={(e) => setForm({ ...form, elecRate: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </fieldset>

        {/* Water section with flexible billing mode */}
        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-2 text-xs font-bold uppercase tracking-wider text-sky-700">
            2. Tiền Nước — Thành tiền: {formatVND(waterAmount)} đ
          </legend>
          <div className="mb-3">
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Cơ chế tính tiền nước cho phòng này:
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { val: 'BY_METER', label: 'Theo đồng hồ (m³)' },
                  { val: 'PER_PERSON', label: 'Theo đầu người' },
                  { val: 'FIXED_PER_ROOM', label: 'Cố định / phòng' },
                  { val: 'FREE', label: 'Miễn phí / Riêng' },
                ] as const
              ).map((m) => (
                <label
                  key={m.val}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold ${
                    form.waterMode === m.val
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="waterMode"
                    value={m.val}
                    checked={form.waterMode === m.val}
                    onChange={() =>
                      setForm({
                        ...form,
                        waterMode: m.val,
                        waterRate:
                          m.val === 'PER_PERSON' && form.waterRate === 27000
                            ? 30000
                            : m.val === 'BY_METER' && form.waterRate === 30000
                            ? 27000
                            : form.waterRate,
                      })
                    }
                    className="accent-sky-600"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {form.waterMode === 'BY_METER' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="inv-water-old" className="block text-xs font-semibold text-slate-700 mb-1">
                  Chỉ số Nước cũ (m³)
                </label>
                <input
                  id="inv-water-old"
                  name="waterOld"
                  type="number"
                  min={0}
                  value={form.waterOld}
                  onChange={(e) => setForm({ ...form, waterOld: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="inv-water-new" className="block text-xs font-semibold text-slate-700 mb-1">
                  Chỉ số Nước mới (m³)
                </label>
                <input
                  id="inv-water-new"
                  name="waterNew"
                  type="number"
                  min={0}
                  value={form.waterNew}
                  onChange={(e) => setForm({ ...form, waterNew: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label htmlFor="inv-water-rate" className="block text-xs font-semibold text-slate-700 mb-1">
                  Đơn giá Nước (VNĐ/m³)
                </label>
                <input
                  id="inv-water-rate"
                  name="waterRate"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.waterRate}
                  onChange={(e) => setForm({ ...form, waterRate: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {form.waterMode === 'PER_PERSON' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="inv-water-rate-person" className="block text-xs font-semibold text-slate-700 mb-1">
                  Đơn giá Nước theo người (VNĐ/người/tháng)
                </label>
                <input
                  id="inv-water-rate-person"
                  name="waterRatePerson"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.waterRate}
                  onChange={(e) => setForm({ ...form, waterRate: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  Đang tính: <strong>{form.occupantCount} người</strong> ×{' '}
                  <strong>{formatVND(form.waterRate)} đ</strong> = <strong>{formatVND(waterAmount)} đ</strong>
                </p>
              </div>
            </div>
          )}

          {form.waterMode === 'FIXED_PER_ROOM' && (
            <div>
              <label htmlFor="inv-water-fixed" className="block text-xs font-semibold text-slate-700 mb-1">
                Mức thu Nước khoán theo phòng (VNĐ/tháng)
              </label>
              <input
                id="inv-water-fixed"
                name="waterRateFixed"
                type="number"
                min={0}
                step={1000}
                value={form.waterRate}
                onChange={(e) => setForm({ ...form, waterRate: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </fieldset>

        {/* Standard utility fees & Debt/Discount */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="inv-trash" className="block text-xs font-semibold text-slate-700 mb-1">
              Tiền rác (VNĐ)
            </label>
            <input
              id="inv-trash"
              name="trashAmount"
              type="number"
              min={0}
              step={5000}
              value={form.trashAmount}
              onChange={(e) => setForm({ ...form, trashAmount: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="inv-lighting" className="block text-xs font-semibold text-slate-700 mb-1">
              Đèn VS (VNĐ)
            </label>
            <input
              id="inv-lighting"
              name="lightingAmount"
              type="number"
              min={0}
              step={5000}
              value={form.lightingAmount}
              onChange={(e) => setForm({ ...form, lightingAmount: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="inv-wifi" className="block text-xs font-semibold text-slate-700 mb-1">
              Wifi / Mạng (VNĐ)
            </label>
            <input
              id="inv-wifi"
              name="wifiAmount"
              type="number"
              min={0}
              step={10000}
              value={form.wifiAmount}
              onChange={(e) => setForm({ ...form, wifiAmount: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="inv-parking" className="block text-xs font-semibold text-slate-700 mb-1">
              Giữ xe (VNĐ)
            </label>
            <input
              id="inv-parking"
              name="parkingAmount"
              type="number"
              min={0}
              step={10000}
              value={form.parkingAmount}
              onChange={(e) => setForm({ ...form, parkingAmount: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="inv-prev-debt" className="block text-xs font-semibold text-amber-800 mb-1">
              Nợ cũ tháng trước cộng dồn (VNĐ)
            </label>
            <input
              id="inv-prev-debt"
              name="previousDebt"
              type="number"
              min={0}
              step={10000}
              value={form.previousDebt}
              onChange={(e) => setForm({ ...form, previousDebt: Number(e.target.value) })}
              className="w-full rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="inv-discount" className="block text-xs font-semibold text-emerald-800 mb-1">
              Giảm trừ / Khấu trừ (VNĐ)
            </label>
            <input
              id="inv-discount"
              name="discountAmount"
              type="number"
              min={0}
              step={10000}
              value={form.discountAmount}
              onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })}
              className="w-full rounded-lg border border-emerald-300 bg-emerald-50/40 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="inv-note" className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú hóa đơn (VD: + TIỀN NƯỚC)
            </label>
            <input
              id="inv-note"
              name="note"
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Ghi chú riêng..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Custom Extra Fees */}
        <fieldset className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
          <legend className="px-2 text-xs font-bold uppercase tracking-wider text-indigo-800">
            Các khoản thu mới / Phụ phí mở rộng ({extraFees.length})
          </legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-600">
              Chọn nhanh khoản thu mẫu hoặc bấm <strong>+ Thêm khoản thu</strong> để tự đặt tên &amp; cơ chế tính:
            </span>
            <button
              type="button"
              onClick={() => addExtraFee()}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Thêm khoản thu mới
            </button>
          </div>

          {/* 1-click preset chips */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {mergedPresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => addExtraFee(preset)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  preset.isPropertyTemplate
                    ? 'border-indigo-300 bg-indigo-100/80 text-indigo-900 hover:bg-indigo-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800'
                }`}
              >
                <Sparkles className="h-3 w-3 text-indigo-600" aria-hidden="true" />
                + {preset.name} ({formatVND(preset.unitPrice)}đ/{preset.unit})
              </button>
            ))}
          </div>

          {extraFees.length > 0 ? (
            <div className="mt-3.5 space-y-2.5">
              {extraFees.map((ef, idx) => (
                <div
                  key={ef.id}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:grid-cols-12 sm:items-center"
                >
                  <div className="sm:col-span-3">
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-500">
                      Tên khoản thu
                    </label>
                    <input
                      type="text"
                      aria-label="Tên khoản thu"
                      value={ef.name}
                      onChange={(e) => updateExtraFee(idx, { name: e.target.value })}
                      placeholder="VD: Máy giặt chung"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-500">
                      Cơ chế tính
                    </label>
                    <select
                      aria-label="Cơ chế tính khoản thu"
                      value={ef.mode || 'FIXED_PER_ROOM'}
                      onChange={(e) => updateExtraFee(idx, { mode: e.target.value as BillingMode })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-800"
                    >
                      <option value="FIXED_PER_ROOM">Trọn gói / Phòng</option>
                      <option value="PER_PERSON">Theo đầu người ({form.occupantCount} người)</option>
                      <option value="PER_QUANTITY">Theo số lượng / lượt</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:col-span-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-500">
                        SL
                      </label>
                      <input
                        type="number"
                        aria-label="Số lượng"
                        min={0}
                        disabled={ef.mode === 'FIXED_PER_ROOM'}
                        value={ef.quantity}
                        onChange={(e) => updateExtraFee(idx, { quantity: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-500">
                        Đơn vị
                      </label>
                      <input
                        type="text"
                        aria-label="Đơn vị tính"
                        value={ef.unit || 'tháng'}
                        onChange={(e) => updateExtraFee(idx, { unit: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-500">
                      Đơn giá (VNĐ)
                    </label>
                    <input
                      type="number"
                      aria-label="Đơn giá"
                      min={0}
                      step={5000}
                      value={ef.unitPrice}
                      onChange={(e) => updateExtraFee(idx, { unitPrice: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 sm:col-span-2 sm:justify-end sm:pt-4">
                    <div className="text-right text-xs font-extrabold text-indigo-900">
                      {formatVND(ef.amount)}đ
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExtraFee(idx)}
                      aria-label={`Xóa khoản thu ${ef.name}`}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-800"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg bg-indigo-100/70 px-3 py-2 text-xs font-bold text-indigo-950">
                <span>Tổng các khoản thu mới / phụ phí mở rộng:</span>
                <span>{formatVND(extraFeesTotal)} VNĐ</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-indigo-200 bg-white/70 px-3 py-2.5 text-center text-xs text-slate-500">
              Chưa có khoản thu phụ nào cho phòng này. Bấm các nút gợi ý phía trên hoặc &ldquo;Thêm khoản thu mới&rdquo; để bổ sung.
            </p>
          )}
        </fieldset>

        {/* Summary & Save */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-teal-200 bg-gradient-to-r from-teal-50/90 via-emerald-50/70 to-white p-4 text-slate-900 shadow-xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Tổng cộng sau tính toán
            </span>
            <div className="text-2xl font-black text-teal-900">{formatVND(liveTotal)} VNĐ</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Đang lưu...' : 'Lưu hóa đơn phòng'}
            </button>
          </div>
        </div>
      </form>
    </ModalDialog>
  );
}
