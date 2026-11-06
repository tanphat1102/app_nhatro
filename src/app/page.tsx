'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { BillingMode, Invoice, Property, Room, Tenant, User, UserRole } from '@/types/nhatro';
import { InvoiceReceiptModal, formatVND } from '@/components/InvoiceReceiptModal';
import { InvoiceEditModal } from '@/components/InvoiceEditModal';
import { RoomTenantsModal } from '@/components/RoomTenantsModal';
import { LoginModal } from '@/components/LoginModal';
import { UserManagementModal } from '@/components/UserManagementModal';
import { TenantPortal } from '@/components/TenantPortal';
import { ModalDialog } from '@/components/ModalDialog';
import { DocumentLightboxModal, LightboxPreviewData } from '@/components/DocumentLightboxModal';
import { parseDocumentImages } from '@/lib/imageUtils';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Building2,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  Edit,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Home,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  Zap,
  Droplets,
} from 'lucide-react';

export default function NhaTroDashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Authentication & Role state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [userManagementModalOpen, setUserManagementModalOpen] = useState(false);
  const [tenantPortalMode, setTenantPortalMode] = useState(true);

  const [selectedPropertyId, setSelectedPropertyId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'billing' | 'rooms_tenants' | 'settings' | 'audit'>('billing');

  // Selected Month/Year for Billing Tab
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tenantSearch, setTenantSearch] = useState<string>('');

  // Modals state
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [managingRoom, setManagingRoom] = useState<Room | null>(null);
  const [newSheetModalOpen, setNewSheetModalOpen] = useState(false);
  const [newPropModalOpen, setNewPropModalOpen] = useState(false);
  const [lightboxPreview, setLightboxPreview] = useState<LightboxPreviewData | null>(null);

  // New Sheet Form
  const [newSheetMonth, setNewSheetMonth] = useState<number>(4);
  const [newSheetYear, setNewSheetYear] = useState<number>(2026);
  const [carryOverDebt, setCarryOverDebt] = useState<boolean>(true);

  // Settings Form
  const [propForm, setPropForm] = useState<Property | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // New Property Form
  const [newPropForm, setNewPropForm] = useState({
    name: '',
    address: '',
    electricityRate: 4000,
    waterMode: 'BY_METER' as BillingMode,
    waterRate: 25000,
    trashRate: 35000,
    lightingRate: 25000,
    initialRoomCount: 8,
    defaultBaseRent: 1500000,
  });

  const billingCaptionId = useId();
  const tenantTableCaptionId = useId();

  const applyData = useCallback((data: {
    properties: Property[];
    rooms: Room[];
    tenants: Tenant[];
    invoices: Invoice[];
    users?: User[];
  }) => {
    setProperties(data.properties);
    setRooms(data.rooms);
    setTenants(data.tenants);
    setInvoices(data.invoices);
    if (data.users) {
      setUsers(data.users);
    }
  }, []);

  const handleSetUser = (u: User | null) => {
    setCurrentUser(u);
    if (u) {
      localStorage.setItem('nhatro_current_user', JSON.stringify(u));
      if (u.role === 'TENANT') {
        setTenantPortalMode(true);
        if (u.propertyId) {
          setSelectedPropertyId(u.propertyId);
        }
      }
    } else {
      localStorage.removeItem('nhatro_current_user');
    }
  };

  useEffect(() => {
    fetch('/api/nhatro')
      .then((res) => res.json())
      .then((data) => {
        applyData(data);
        if (data.users && data.users.length > 0) {
          setUsers(data.users);
          const stored = localStorage.getItem('nhatro_current_user');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const found = data.users.find((u: User) => u.id === parsed.id) || parsed;
              setCurrentUser(found);
            } catch {
              setCurrentUser(data.users[0]);
            }
          } else {
            const admin = data.users.find((u: User) => u.role === 'ADMIN') || data.users[0];
            setCurrentUser(admin);
          }
        }
        if (data.properties?.length > 0) {
          setSelectedPropertyId(data.properties[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [applyData]);

  const currentProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) || properties[0] || null,
    [properties, selectedPropertyId]
  );

  useEffect(() => {
    if (currentProperty) {
      setPropForm({ ...currentProperty });
    }
  }, [currentProperty]);

  const propertyRooms = useMemo(
    () => rooms.filter((r) => r.propertyId === currentProperty?.id),
    [rooms, currentProperty]
  );

  const propertyTenants = useMemo(
    () => tenants.filter((t) => t.propertyId === currentProperty?.id),
    [tenants, currentProperty]
  );

  const propertyInvoices = useMemo(
    () => invoices.filter((inv) => inv.propertyId === currentProperty?.id),
    [invoices, currentProperty]
  );

  // Available periods (month-year) for the selected property
  const availablePeriods = useMemo(() => {
    const map = new Map<string, { month: number; year: number; sheetCode: string }>();
    for (const inv of propertyInvoices) {
      const key = `${inv.month}-${inv.year}`;
      if (!map.has(key)) {
        map.set(key, { month: inv.month, year: inv.year, sheetCode: inv.sheetCode });
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));
  }, [propertyInvoices]);

  useEffect(() => {
    if (availablePeriods.length > 0) {
      const exists = availablePeriods.some((p) => `${p.month}-${p.year}` === selectedPeriod);
      if (!exists) {
        const latest = availablePeriods[0];
        setSelectedPeriod(`${latest.month}-${latest.year}`);
        // Suggest next month for new sheet modal
        const nextM = latest.month === 12 ? 1 : latest.month + 1;
        const nextY = latest.month === 12 ? latest.year + 1 : latest.year;
        setNewSheetMonth(nextM);
        setNewSheetYear(nextY);
      }
    } else {
      setSelectedPeriod('');
    }
  }, [availablePeriods, selectedPeriod]);

  const currentSheetInvoices = useMemo(() => {
    if (!selectedPeriod) return [];
    const [m, y] = selectedPeriod.split('-').map(Number);
    return propertyInvoices
      .filter((inv) => inv.month === m && inv.year === y)
      .filter((inv) => (statusFilter === 'ALL' ? true : inv.paymentStatus === statusFilter))
      .sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));
  }, [propertyInvoices, selectedPeriod, statusFilter]);

  // Summary metrics for current period
  const sheetSummary = useMemo(() => {
    if (!selectedPeriod) {
      return {
        totalRevenue: 0,
        collectedAmount: 0,
        unpaidAmount: 0,
        elecTotal: 0,
        waterTotal: 0,
        trashTotal: 0,
        lightingTotal: 0,
        rentTotal: 0,
        excelOrigSum: 0,
        discrepancyCount: 0,
      };
    }
    const [m, y] = selectedPeriod.split('-').map(Number);
    const allInPeriod = propertyInvoices.filter((inv) => inv.month === m && inv.year === y);
    return allInPeriod.reduce(
      (acc, inv) => {
        acc.totalRevenue += inv.totalAmount;
        acc.collectedAmount += inv.paidAmount;
        acc.unpaidAmount += Math.max(0, inv.totalAmount - inv.paidAmount);
        acc.elecTotal += inv.elecAmount;
        acc.waterTotal += inv.waterAmount;
        acc.trashTotal += inv.trashAmount;
        acc.lightingTotal += inv.lightingAmount;
        acc.rentTotal += inv.roomRent;
        acc.excelOrigSum += inv.excelOriginalTotal ?? inv.totalAmount;
        if (inv.excelOriginalTotal !== null && inv.excelOriginalTotal !== inv.totalAmount) {
          acc.discrepancyCount += 1;
        }
        return acc;
      },
      {
        totalRevenue: 0,
        collectedAmount: 0,
        unpaidAmount: 0,
        elecTotal: 0,
        waterTotal: 0,
        trashTotal: 0,
        lightingTotal: 0,
        rentTotal: 0,
        excelOrigSum: 0,
        discrepancyCount: 0,
      }
    );
  }, [propertyInvoices, selectedPeriod]);

  // API Mutations
  const postAction = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/nhatro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      applyData(data);
    }
    return data;
  };

  const handleQuickPaymentToggle = async (inv: Invoice) => {
    const nextStatus =
      inv.paymentStatus === 'PAID'
        ? 'UNPAID'
        : inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'PARTIAL'
        ? 'PAID'
        : 'VACANT';
    await postAction({
      action: 'record_payment',
      invoiceId: inv.id,
      paymentStatus: nextStatus,
      paidAmount: nextStatus === 'PAID' ? inv.totalAmount : 0,
      paymentMethod: currentProperty?.code === 'NT_219_NVT' ? 'CASH' : 'TRANSFER',
    });
  };

  const handleCreateMonthSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty) return;
    await postAction({
      action: 'create_month_sheet',
      propertyId: currentProperty.id,
      month: newSheetMonth,
      year: newSheetYear,
      carryOverDebt,
    });
    setSelectedPeriod(`${newSheetMonth}-${newSheetYear}`);
    setNewSheetModalOpen(false);
  };

  const handleSyncOccupantsToSheet = async () => {
    if (!currentProperty || !selectedPeriod) return;
    const [m, y] = selectedPeriod.split('-').map(Number);
    await postAction({
      action: 'sync_occupants_to_sheet',
      propertyId: currentProperty.id,
      month: m,
      year: y,
    });
  };

  const handleSaveUser = async (data: {
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
  }) => {
    if (data.id) {
      await postAction({ action: 'update_user', user: data });
    } else {
      await postAction({ action: 'create_user', user: data });
    }
  };

  const handleDeleteUser = async (id: number) => {
    await postAction({ action: 'delete_user', id });
  };

  const handleExportExcel = () => {
    if (!currentProperty || !selectedPeriod) return;
    const [m, y] = selectedPeriod.split('-').map(Number);
    const rows = propertyInvoices
      .filter((inv) => inv.month === m && inv.year === y)
      .sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));

    const isWaterPerPerson = currentProperty.waterMode === 'PER_PERSON';

    const sheetData: (string | number)[][] = [
      [
        '',
        currentProperty.name,
        '',
        '',
        '',
        '',
        '',
        `Điện: VND/KW`,
        '',
        currentProperty.electricityRate,
        `T${m}_${y}`,
      ],
      [
        '',
        'Tháng',
        m,
        '',
        'Năm',
        y,
        '',
        isWaterPerPerson ? 'Nước: VND/người' : 'Nước: VND/m3',
        '',
        currentProperty.waterRate,
      ],
      ['', '', '', '', '', '', '', 'Đèn VS /tháng', '', currentProperty.lightingRate],
      ['', '', '', '', '', '', '', 'Rác: /tháng', '', currentProperty.trashRate],
      [`Địa chỉ nhà trọ: ${currentProperty.address}`],
      [
        `Thanh toán: ${currentProperty.bankName} - STK: ${currentProperty.bankAccountNumber} - ${currentProperty.bankAccountHolder}`,
      ],
      [],
      isWaterPerPerson
        ? [
            'Phòng cũ',
            'Phòng mới',
            'Người ở hiện tại',
            'Điện cũ',
            'Điện mới',
            'Tiền điện',
            'Số người sd',
            'Giá/người',
            'Tiền nước',
            'Tiền Rác',
            'Tiền phòng',
            'Phụ phí / Nợ cũ',
            'Tổng cộng',
            'Trạng thái',
            'Ghi chú',
          ]
        : [
            'Phòng cũ',
            'Phòng',
            'Người ở hiện tại',
            'Điện cũ',
            'Điện mới',
            'Tiền điện',
            'Nước cũ',
            'Nước mới',
            'Tiền nước',
            'Tiền Rác',
            'Tiền phòng',
            'Đèn VS',
            'Tổng cộng',
            'Trạng thái',
            'Ghi chú',
          ],
    ];

    for (const inv of rows) {
      const rTenants = propertyTenants
        .filter((t) => t.roomId === inv.roomId && t.isActive)
        .map((t) => t.fullName)
        .join(', ');

      if (isWaterPerPerson) {
        sheetData.push([
          inv.oldRoomNumber || '',
          inv.roomNumber || '',
          rTenants,
          inv.elecOld,
          inv.elecNew,
          inv.elecAmount,
          inv.occupantCount,
          inv.waterRate,
          inv.waterAmount,
          inv.trashAmount,
          inv.roomRent,
          inv.extraFeesAmount + inv.previousDebt - inv.discountAmount,
          inv.totalAmount,
          inv.paymentStatus === 'PAID'
            ? 'Đã đóng'
            : inv.paymentStatus === 'PARTIAL'
            ? `Đã đóng ${inv.paidAmount}`
            : inv.paymentStatus === 'VACANT'
            ? 'Phòng trống'
            : 'Chưa đóng',
          inv.note,
        ]);
      } else {
        sheetData.push([
          inv.oldRoomNumber || '',
          inv.roomNumber || '',
          rTenants,
          inv.elecOld,
          inv.elecNew,
          inv.elecAmount,
          inv.waterOld,
          inv.waterNew,
          inv.waterAmount,
          inv.trashAmount,
          inv.roomRent,
          inv.lightingAmount,
          inv.totalAmount,
          inv.paymentStatus === 'PAID'
            ? 'Đã đóng'
            : inv.paymentStatus === 'PARTIAL'
            ? `Đã đóng ${inv.paidAmount}`
            : inv.paymentStatus === 'VACANT'
            ? 'Phòng trống'
            : 'Chưa đóng',
          inv.note,
        ]);
      }
    }

    // Totals row
    if (isWaterPerPerson) {
      sheetData.push([
        'TỔNG',
        '',
        '',
        '',
        '',
        sheetSummary.elecTotal,
        '',
        '',
        sheetSummary.waterTotal,
        sheetSummary.trashTotal,
        sheetSummary.rentTotal,
        '',
        sheetSummary.totalRevenue,
        `Đã thu: ${sheetSummary.collectedAmount}`,
        '',
      ]);
    } else {
      sheetData.push([
        'TỔNG',
        '',
        '',
        '',
        '',
        sheetSummary.elecTotal,
        '',
        '',
        sheetSummary.waterTotal,
        sheetSummary.trashTotal,
        sheetSummary.rentTotal,
        sheetSummary.lightingTotal,
        sheetSummary.totalRevenue,
        `Đã thu: ${sheetSummary.collectedAmount}`,
        '',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Thang_${m}_${y}`);
    XLSX.writeFile(wb, `Bang_Tien_Tro_${currentProperty.code}_T${m}_${y}.xlsx`);
  };

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    if (!q) return propertyTenants;
    return propertyTenants.filter(
      (t) =>
        t.fullName.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        t.cccd.toLowerCase().includes(q) ||
        t.hometown.toLowerCase().includes(q) ||
        t.vehiclePlate.toLowerCase().includes(q)
    );
  }, [propertyTenants, tenantSearch]);

  const activeTenantsCount = useMemo(
    () => propertyTenants.filter((t) => t.isActive).length,
    [propertyTenants]
  );

  const occupiedRoomsCount = useMemo(
    () =>
      propertyRooms.filter((r) => {
        const count = propertyTenants.filter((t) => t.roomId === r.id && t.isActive).length;
        return count > 0 || r.status === 'OCCUPIED';
      }).length,
    [propertyRooms, propertyTenants]
  );

  if (loading || !currentProperty) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
        <div className="text-center space-y-2">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600">Đang tải dữ liệu nhà trọ từ hệ thống...</p>
        </div>
      </div>
    );
  }

  const [currMonth, currYear] = selectedPeriod ? selectedPeriod.split('-').map(Number) : [0, 0];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-md">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                  Quản Lý Nhà Trọ Thông Minh
                </h1>
                <span className="hidden sm:inline-block rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-extrabold text-teal-800 border border-teal-200">
                  v2.0 Roles & VietQR
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Chủ nhà: <strong>{currentProperty.bankAccountHolder}</strong> • Vietcombank:{' '}
                <span className="font-mono font-semibold text-teal-800">
                  {currentProperty.bankAccountNumber}
                </span>
              </p>
            </div>
          </div>

          {/* User Auth & Profile Badge */}
          <div className="flex flex-wrap items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 shadow-2xs">
                <div
                  className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold ${
                    currentUser.role === 'ADMIN'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : currentUser.role === 'MANAGER'
                      ? 'bg-sky-100 text-sky-900 border border-sky-300'
                      : 'bg-purple-100 text-purple-900 border border-purple-300'
                  }`}
                >
                  {currentUser.role === 'ADMIN' ? (
                    <>👑 Chủ nhà</>
                  ) : currentUser.role === 'MANAGER' ? (
                    <>👔 Quản lý</>
                  ) : (
                    <>👤 Khách thuê</>
                  )}
                  <span className="font-normal text-slate-400">|</span>
                  <span className="max-w-[120px] truncate">{currentUser.fullName}</span>
                </div>

                {currentUser.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => setUserManagementModalOpen(true)}
                    title="Quản lý tài khoản người dùng"
                    className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
                  >
                    <UserCog className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                    <span>Tài khoản ({users.length})</span>
                  </button>
                )}

                {currentUser.role === 'TENANT' && (
                  <button
                    type="button"
                    onClick={() => setTenantPortalMode(!tenantPortalMode)}
                    className="inline-flex items-center gap-1 rounded-xl bg-purple-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-800 shadow-2xs"
                  >
                    {tenantPortalMode ? 'Xem bảng tổng quan' : 'Cổng Khách thuê'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  title="Đổi vai trò / Đăng nhập khác"
                  className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  <KeyRound className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span className="hidden sm:inline">Đổi vai trò</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSetUser(null);
                    setLoginModalOpen(true);
                  }}
                  title="Đăng xuất"
                  className="rounded-xl p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  aria-label="Đăng xuất"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-800"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Đăng Nhập
              </button>
            )}
          </div>
        </div>

        {/* Property Switcher Bar */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Khu trọ:
            </span>
            {properties.map((prop) => {
              const isSelected = prop.id === currentProperty.id;
              return (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(prop.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Home className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
                  <span>{prop.name}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                      isSelected ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {prop.waterMode === 'BY_METER' ? 'Nước: Đồng hồ m³' : 'Nước: Đầu người'}
                  </span>
                </button>
              );
            })}
            {currentUser?.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => setNewPropModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-xl border border-dashed border-teal-600 px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Thêm khu trọ
              </button>
            )}
          </div>

          {currentUser?.role === 'TENANT' && (
            <div className="text-xs text-purple-700 font-semibold bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
              {tenantPortalMode
                ? 'Đang hiển thị Cổng riêng của bạn'
                : 'Đang xem Bảng tổng quan (Chỉ đọc)'}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        {(!currentUser || currentUser.role !== 'TENANT' || !tenantPortalMode) && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <nav aria-label="Chức năng chính" className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
            {(
              [
                {
                  id: 'billing',
                  label: 'Bảng Tính Tiền Hàng Tháng',
                  icon: FileSpreadsheet,
                  badge: `${availablePeriods.length} kỳ`,
                },
                {
                  id: 'rooms_tenants',
                  label: 'Phòng & Thành Viên Ở',
                  icon: Users,
                  badge: `${activeTenantsCount} người / ${propertyRooms.length} phòng`,
                },
                {
                  id: 'settings',
                  label: 'Cơ Chế Tính Tiền & Đơn Giá',
                  icon: Settings,
                  badge: currentProperty.waterMode === 'BY_METER' ? 'Theo số m³' : 'Theo đầu người',
                },
                {
                  id: 'audit',
                  label: 'Đối Soát & Cải Tiến Excel',
                  icon: Sparkles,
                  badge: 'Phát hiện lệch số',
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? 'border-teal-700 text-teal-800 bg-teal-50/50 rounded-t-xl'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      active ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
        )}
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 space-y-6">
        {currentUser?.role === 'TENANT' && tenantPortalMode ? (
          <TenantPortal
            user={currentUser}
            property={currentProperty}
            room={rooms.find((r) => r.id === currentUser.roomId) || null}
            tenants={tenants}
            invoices={invoices}
            onOpenReceipt={(inv) => setReceiptInvoice(inv)}
            onViewAllBoard={() => setTenantPortalMode(false)}
            onUpdateTenantDocuments={async (payload) => {
              await postAction({ action: 'update_tenant_documents', ...payload });
            }}
          />
        ) : (
          <>
            {currentUser?.role === 'TENANT' && !tenantPortalMode && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-purple-900 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-200 text-purple-900">
                    <UserCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">Chế độ xem Bảng tổng quan (Khách thuê - Chỉ đọc)</h2>
                    <p className="text-xs text-purple-700">
                      Bạn đang xem tổng thể số liệu khu trọ. Nhấn để quay lại Cổng phòng riêng của bạn để xem hóa đơn & quét mã VietQR.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTenantPortalMode(true)}
                  className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-800 transition-colors"
                >
                  ← Quay lại Cổng Khách Thuê
                </button>
              </div>
            )}

            {/* Property Context Banner */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-900">
                      {currentProperty.name}
                    </span>
                    <span className="text-xs text-slate-600">📍 {currentProperty.address}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 pt-1">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-900 border border-amber-200">
                      <Zap className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                      Điện: {formatVND(currentProperty.electricityRate)} đ/KW (Theo đồng hồ)
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-900 border border-sky-200">
                      <Droplets className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                      Nước:{' '}
                      {currentProperty.waterMode === 'BY_METER'
                        ? `${formatVND(currentProperty.waterRate)} đ/m³ (Theo chỉ số đồng hồ)`
                        : currentProperty.waterMode === 'PER_PERSON'
                        ? `${formatVND(currentProperty.waterRate)} đ/người (Theo đầu người trong phòng)`
                        : `${formatVND(currentProperty.waterRate)} đ/phòng`}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                      Rác: {formatVND(currentProperty.trashRate)} đ/tháng
                    </span>
                    {currentProperty.lightingRate > 0 && currentProperty.lightingMode !== 'FREE' && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                        Đèn VS: {formatVND(currentProperty.lightingRate)} đ/tháng
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {currentUser?.role !== 'TENANT' && (
                    <button
                      type="button"
                      onClick={() => setNewSheetModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-800 transition-colors"
                    >
                      <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                      Lập bảng thu tiền tháng mới
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    <Download className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    Xuất Excel (.xlsx)
                  </button>
                </div>
              </div>
            </section>

        {/* TAB 1: BILLING SHEET */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
                  <span>Tổng tiền kỳ {currMonth}/{currYear}</span>
                  <Wallet className="h-4 w-4 text-teal-700" aria-hidden="true" />
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                  {formatVND(sheetSummary.totalRevenue)} đ
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Tiền phòng: {formatVND(sheetSummary.rentTotal)}đ • Điện+Nước:{' '}
                  {formatVND(sheetSummary.elecTotal + sheetSummary.waterTotal)}đ
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-emerald-800">
                  <span>Đã thu trong kỳ</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-800">
                  {formatVND(sheetSummary.collectedAmount)} đ
                </div>
                <p className="mt-1 text-xs text-emerald-700">
                  Nhấn vào nút trạng thái từng phòng để đánh dấu Đã thu nhanh
                </p>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-rose-800">
                  <span>Còn chưa thu / Công nợ</span>
                  <Clock className="h-4 w-4 text-rose-600" aria-hidden="true" />
                </div>
                <div className="mt-2 text-2xl font-black text-rose-700">
                  {formatVND(sheetSummary.unpaidAmount)} đ
                </div>
                <p className="mt-1 text-xs text-rose-700">
                  Tự động chuyển sang kỳ sau nếu chưa đóng đủ
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
                  <span>Mật độ cư trú hiện tại</span>
                  <Users className="h-4 w-4 text-teal-700" aria-hidden="true" />
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                  {activeTenantsCount} người / {occupiedRoomsCount}/{propertyRooms.length} phòng
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Mỗi phòng lưu chi tiết từng thành viên & biển số xe
                </p>
              </div>
            </div>

            {/* Period selector & Actions bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
                  Kỳ thu tiền:
                </span>
                {availablePeriods.map((p) => {
                  const key = `${p.month}-${p.year}`;
                  const active = selectedPeriod === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedPeriod(key)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                        active
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Tháng {p.month}/{p.year}
                      {p.sheetCode && (
                        <span className="ml-1 opacity-75 font-normal">({p.sheetCode})</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncOccupantsToSheet}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Cập nhật số người ở từ Hồ sơ phòng
                </button>
                <select
                  aria-label="Lọc theo trạng thái thanh toán"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="ALL">Tất cả phòng ({propertyRooms.length})</option>
                  <option value="PAID">Đã đóng đủ</option>
                  <option value="UNPAID">Chưa đóng</option>
                  <option value="PARTIAL">Đóng một phần</option>
                  <option value="VACANT">Phòng trống</option>
                </select>
              </div>
            </div>

            {/* Excel Discrepancy Alert if present in this month */}
            {sheetSummary.discrepancyCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-xs text-amber-950">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
                  <div>
                    <strong>Phát hiện sai số công thức từ file Excel gốc (Tháng {currMonth}/{currYear}):</strong>{' '}
                    Có <strong>{sheetSummary.discrepancyCount} phòng</strong> (Phòng 2 đến Phòng 7) trong Excel cũ có ghi cột{' '}
                    <strong>Đèn VS = 25,000đ</strong> nhưng công thức cột Tổng cộng bị quên cộng 25,000đ (lệch tổng cộng{' '}
                    <strong>{formatVND(sheetSummary.totalRevenue - sheetSummary.excelOrigSum)} đ</strong>/tháng). Hệ thống đã tự động tính chuẩn xác!
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className="rounded-lg bg-amber-200/80 px-3 py-1.5 font-bold text-amber-950 hover:bg-amber-300"
                >
                  Xem chi tiết đối soát →
                </button>
              </div>
            )}

            {/* Main Responsive Data Table (following modern-web-guidance responsive-table) */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div
                tabIndex={0}
                role="region"
                aria-labelledby={billingCaptionId}
                className="table-wrapper"
              >
                <table className="text-xs sm:text-sm">
                  <caption
                    id={billingCaptionId}
                    className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600"
                  >
                    Bảng Tính Tiền Trọ — {currentProperty.name} — Tháng {currMonth}/{currYear}
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="py-3 pl-4 pr-2">Phòng</th>
                      <th className="py-3 px-2">Thành viên đang ở</th>
                      <th className="py-3 px-2 text-right">Điện cũ → mới</th>
                      <th className="py-3 px-2 text-right">Tiền điện</th>
                      <th className="py-3 px-2 text-right">
                        {currentProperty.waterMode === 'PER_PERSON'
                          ? 'Số người × Giá'
                          : 'Nước cũ → mới'}
                      </th>
                      <th className="py-3 px-2 text-right">Tiền nước</th>
                      <th className="py-3 px-2 text-right">Tiền rác</th>
                      {(currentProperty.lightingRate > 0 || sheetSummary.lightingTotal > 0) && (
                        <th className="py-3 px-2 text-right">Đèn VS</th>
                      )}
                      <th className="py-3 px-2 text-right">Tiền phòng</th>
                      <th className="py-3 px-2 text-right">Tổng cộng</th>
                      <th className="py-3 px-2 text-center">Trạng thái</th>
                      <th className="py-3 pl-2 pr-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentSheetInvoices.map((inv) => {
                      const roomObj = propertyRooms.find((r) => r.id === inv.roomId) || null;
                      const rTenants = propertyTenants.filter(
                        (t) => t.roomId === inv.roomId && t.isActive
                      );
                      const isVacant = inv.paymentStatus === 'VACANT';
                      const elecConsumed = Math.max(0, inv.elecNew - inv.elecOld);
                      const waterConsumed = Math.max(0, inv.waterNew - inv.waterOld);
                      const hasExcelDiff =
                        inv.excelOriginalTotal !== null &&
                        inv.excelOriginalTotal !== inv.totalAmount;

                      return (
                        <tr
                          key={inv.id}
                          className={`transition-colors hover:bg-slate-50/90 ${
                            isVacant ? 'bg-slate-50/50 text-slate-400' : ''
                          }`}
                        >
                          {/* Sticky Row Header: Room Number */}
                          <th scope="row" className="py-3 pl-4 pr-2 text-left font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
                                {inv.roomNumber}
                              </span>
                              {inv.oldRoomNumber && (
                                <span className="text-[11px] font-normal text-slate-400">
                                  (Cũ: {inv.oldRoomNumber})
                                </span>
                              )}
                            </div>
                          </th>

                          {/* Tenants in Room */}
                          <td className="py-3 px-2">
                            {currentUser?.role !== 'TENANT' ? (
                              <button
                                type="button"
                                onClick={() => roomObj && setManagingRoom(roomObj)}
                                className="group text-left hover:underline"
                              >
                                {rTenants.length > 0 ? (
                                  <div>
                                    <div className="font-semibold text-slate-800 group-hover:text-teal-700">
                                      {rTenants.map((t) => t.fullName).join(', ')}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {rTenants.length} thành viên • Quản lý người ở
                                    </div>
                                  </div>
                                ) : isVacant ? (
                                  <span className="italic text-slate-400">Phòng trống — Thêm khách</span>
                                ) : (
                                  <span className="text-xs text-teal-700 font-semibold">
                                    {inv.occupantCount} người • + Thêm hồ sơ
                                  </span>
                                )}
                              </button>
                            ) : (
                              <div>
                                <div className="font-semibold text-slate-800">
                                  {rTenants.map((t) => t.fullName).join(', ') || (isVacant ? 'Phòng trống' : `${inv.occupantCount} người`)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {rTenants.length} thành viên
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Electricity Index */}
                          <td className="py-3 px-2 text-right font-mono text-xs">
                            {isVacant ? (
                              '—'
                            ) : (
                              <div>
                                <span>
                                  {inv.elecOld} → <strong>{inv.elecNew}</strong>
                                </span>
                                <div className="text-[10px] text-amber-700 font-sans">
                                  ({elecConsumed} KW)
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Electricity Amount */}
                          <td className="py-3 px-2 text-right font-semibold text-slate-800">
                            {isVacant ? '0' : formatVND(inv.elecAmount)}
                          </td>

                          {/* Water Index or Headcount */}
                          <td className="py-3 px-2 text-right text-xs">
                            {isVacant ? (
                              '—'
                            ) : inv.waterMode === 'PER_PERSON' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 font-bold text-sky-900">
                                  {inv.occupantCount} người
                                </span>
                                <div className="text-[10px] text-slate-500">
                                  × {formatVND(inv.waterRate)}đ
                                </div>
                              </div>
                            ) : inv.waterMode === 'BY_METER' ? (
                              <div className="font-mono">
                                <span>
                                  {inv.waterOld} → <strong>{inv.waterNew}</strong>
                                </span>
                                <div className="text-[10px] text-sky-700 font-sans">
                                  ({waterConsumed} m³)
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">Riêng</span>
                            )}
                          </td>

                          {/* Water Amount */}
                          <td className="py-3 px-2 text-right font-semibold text-slate-800">
                            {isVacant ? '0' : formatVND(inv.waterAmount)}
                          </td>

                          {/* Trash Amount */}
                          <td className="py-3 px-2 text-right text-slate-700">
                            {isVacant ? '0' : formatVND(inv.trashAmount)}
                          </td>

                          {/* Lighting Amount */}
                          {(currentProperty.lightingRate > 0 || sheetSummary.lightingTotal > 0) && (
                            <td className="py-3 px-2 text-right text-slate-700">
                              {isVacant ? '0' : formatVND(inv.lightingAmount)}
                            </td>
                          )}

                          {/* Room Rent */}
                          <td className="py-3 px-2 text-right font-semibold text-slate-800">
                            {isVacant ? '0' : formatVND(inv.roomRent)}
                          </td>

                          {/* Total Amount */}
                          <td className="py-3 px-2 text-right">
                            <div className="font-black text-slate-900 text-sm">
                              {formatVND(inv.totalAmount)}
                            </div>
                            {hasExcelDiff && (
                              <div
                                className="text-[10px] font-semibold text-amber-700"
                                title="Số trong file Excel cũ quên cộng 25,000đ Đèn VS"
                              >
                                Excel cũ: {formatVND(inv.excelOriginalTotal || 0)}
                              </div>
                            )}
                            {inv.note && (
                              <div className="text-[10px] font-semibold text-rose-600">
                                {inv.note}
                              </div>
                            )}
                          </td>

                          {/* Payment Status Button */}
                          <td className="py-3 px-2 text-center">
                            {currentUser?.role === 'TENANT' ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                  inv.paymentStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inv.paymentStatus === 'PARTIAL'
                                    ? 'bg-amber-100 text-amber-900'
                                    : inv.paymentStatus === 'VACANT'
                                    ? 'bg-slate-200 text-slate-600'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {inv.paymentStatus === 'PAID'
                                  ? '✓ Đã thu'
                                  : inv.paymentStatus === 'PARTIAL'
                                  ? `Thu 1 phần (${formatVND(inv.paidAmount)})`
                                  : inv.paymentStatus === 'VACANT'
                                  ? 'Phòng trống'
                                  : 'Chưa đóng'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickPaymentToggle(inv)}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                  inv.paymentStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : inv.paymentStatus === 'PARTIAL'
                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                    : inv.paymentStatus === 'VACANT'
                                    ? 'bg-slate-200 text-slate-600'
                                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                }`}
                              >
                                {inv.paymentStatus === 'PAID'
                                  ? '✓ Đã thu'
                                  : inv.paymentStatus === 'PARTIAL'
                                  ? `Thu 1 phần (${formatVND(inv.paidAmount)})`
                                  : inv.paymentStatus === 'VACANT'
                                  ? 'Phòng trống'
                                  : 'Chưa đóng'}
                              </button>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 pl-2 pr-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setReceiptInvoice(inv)}
                                aria-label={`Xem phiếu báo và VietQR Phòng ${inv.roomNumber}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
                              >
                                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                                Phiếu
                              </button>
                              {currentUser?.role !== 'TENANT' && (
                                <button
                                  type="button"
                                  onClick={() => setEditingInvoice(inv)}
                                  aria-label={`Chỉnh sửa hóa đơn Phòng ${inv.roomNumber}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                                >
                                  <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                                  Sửa
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-900 bg-slate-900 text-white font-bold">
                      <td colSpan={3} className="py-3.5 pl-4 pr-2 text-xs uppercase">
                        TỔNG CỘNG KỲ THÁNG {currMonth}/{currYear}
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono">
                        {formatVND(sheetSummary.elecTotal)}
                      </td>
                      <td className="py-3.5 px-2" />
                      <td className="py-3.5 px-2 text-right font-mono">
                        {formatVND(sheetSummary.waterTotal)}
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono">
                        {formatVND(sheetSummary.trashTotal)}
                      </td>
                      {(currentProperty.lightingRate > 0 || sheetSummary.lightingTotal > 0) && (
                        <td className="py-3.5 px-2 text-right font-mono">
                          {formatVND(sheetSummary.lightingTotal)}
                        </td>
                      )}
                      <td className="py-3.5 px-2 text-right font-mono">
                        {formatVND(sheetSummary.rentTotal)}
                      </td>
                      <td className="py-3.5 px-2 text-right text-base font-black text-amber-300">
                        {formatVND(sheetSummary.totalRevenue)} đ
                      </td>
                      <td colSpan={2} className="py-3.5 pl-2 pr-4 text-right text-xs text-emerald-300">
                        Đã thu: {formatVND(sheetSummary.collectedAmount)} đ
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ROOMS & MULTI-TENANT MANAGEMENT */}
        {activeTab === 'rooms_tenants' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Sơ Đồ Phòng & Hồ Sơ Các Thành Viên Trong Phòng
                </h2>
                <p className="text-xs text-slate-600">
                  Mỗi phòng có thể ở nhiều người. Số lượng người đang ở sẽ tự động liên kết với mục &ldquo;Số người sử dụng&rdquo; khi tính tiền nước/dịch vụ theo đầu người.
                </p>
              </div>
            </div>

            {/* Room Cards Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {propertyRooms.map((room) => {
                const rTenants = propertyTenants.filter(
                  (t) => t.roomId === room.id && t.isActive
                );
                const isOccupied = rTenants.length > 0 || room.status === 'OCCUPIED';
                const effectiveWaterMode = room.waterModeOverride || currentProperty.waterMode;
                const roomContracts = parseDocumentImages(room.contractImagesJson);

                return (
                  <article
                    key={room.id}
                    className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition-all hover:shadow-md ${
                      isOccupied
                        ? 'border-slate-200 bg-white'
                        : 'border-dashed border-slate-300 bg-slate-50/70'
                    }`}
                  >
                    <div>
                      {/* Room Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-black ${
                              isOccupied
                                ? 'bg-teal-700 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            P.{room.roomNumber}
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-900">
                              Phòng {room.roomNumber}
                              {room.oldRoomNumber && (
                                <span className="ml-1 text-xs font-normal text-slate-500">
                                  (Cũ: {room.oldRoomNumber})
                                </span>
                              )}
                            </h3>
                            <p className="text-xs font-bold text-teal-800">
                              {formatVND(room.baseRent)} đ/tháng
                            </p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            rTenants.length > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {rTenants.length > 0 ? `${rTenants.length} người ở` : 'Phòng trống'}
                        </span>
                      </div>

                      {/* Billing mechanism & Room Contract badges */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded bg-sky-50 px-2 py-0.5 font-medium text-sky-800 border border-sky-200">
                          {effectiveWaterMode === 'PER_PERSON'
                            ? `Nước: Theo đầu người (${rTenants.length} người)`
                            : effectiveWaterMode === 'BY_METER'
                            ? `Nước: Đồng hồ (${room.currentWaterIndex} m³)`
                            : 'Nước: Riêng'}
                        </span>
                        <span className="rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800 border border-amber-200">
                          Điện hiện tại: {room.currentElecIndex} KW
                        </span>
                        {roomContracts.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxPreview({
                                title: `Hợp Đồng Thuê Phòng ${room.roomNumber} (${currentProperty.name})`,
                                images: roomContracts.map((c) => ({
                                  label: c.title,
                                  dataUrl: c.dataUrl,
                                  uploadedAt: c.uploadedAt,
                                })),
                              })
                            }
                            className="inline-flex items-center gap-1 rounded bg-teal-100 px-2 py-0.5 font-bold text-teal-900 hover:bg-teal-200"
                          >
                            <FileCheck2 className="h-3 w-3" aria-hidden="true" />
                            HĐ phòng: {roomContracts.length} ảnh
                          </button>
                        )}
                        {room.lightingModeOverride === 'FREE' && (
                          <span className="rounded bg-purple-50 px-2 py-0.5 font-medium text-purple-800">
                            Miễn Đèn VS
                          </span>
                        )}
                      </div>

                      {/* Member List inside Room */}
                      <div className="mt-3 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Danh sách thành viên ({rTenants.length}):
                        </div>
                        {rTenants.length === 0 ? (
                          <p className="py-3 text-center text-xs italic text-slate-400">
                            Chưa có người ở
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {rTenants.map((t) => {
                              const tContracts = parseDocumentImages(t.contractImagesJson);
                              const docCount =
                                (t.cccdFrontUrl ? 1 : 0) +
                                (t.cccdBackUrl ? 1 : 0) +
                                tContracts.length;

                              return (
                                <li
                                  key={t.id}
                                  className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs border border-slate-100"
                                >
                                  <div className="flex items-center justify-between font-semibold text-slate-800">
                                    <span>
                                      {t.fullName}
                                      {t.isRepresentative && (
                                        <span className="ml-1 rounded bg-teal-700 px-1 py-0.2 text-[9px] text-white">
                                          Đ.Diện
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-500">
                                      {t.phone}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500">
                                    <span>Quê: {t.hometown || '—'}</span>
                                    {docCount > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const imgs: LightboxPreviewData['images'] = [];
                                          if (t.cccdFrontUrl) {
                                            imgs.push({
                                              label: `CCCD Mặt Trước — ${t.fullName}`,
                                              dataUrl: t.cccdFrontUrl,
                                            });
                                          }
                                          if (t.cccdBackUrl) {
                                            imgs.push({
                                              label: `CCCD Mặt Sau — ${t.fullName}`,
                                              dataUrl: t.cccdBackUrl,
                                            });
                                          }
                                          for (const c of tContracts) {
                                            imgs.push({
                                              label: c.title,
                                              dataUrl: c.dataUrl,
                                              uploadedAt: c.uploadedAt,
                                            });
                                          }
                                          setLightboxPreview({
                                            title: `Hồ Sơ CCCD & Hợp Đồng — ${t.fullName} (Phòng ${room.roomNumber})`,
                                            subtitle: `Số CCCD: ${t.cccd || '—'} • SĐT: ${t.phone || '—'}`,
                                            images: imgs,
                                          });
                                        }}
                                        className="inline-flex items-center gap-1 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 hover:bg-teal-200"
                                      >
                                        <Eye className="h-2.5 w-2.5" aria-hidden="true" />
                                        {docCount} ảnh CCCD/HĐ
                                      </button>
                                    ) : t.vehiclePlate ? (
                                      <span className="font-mono text-slate-600">
                                        🏍️ {t.vehiclePlate}
                                      </span>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">
                        Cọc: {formatVND(room.depositAmount)}đ
                      </span>
                      {currentUser?.role !== 'TENANT' && (
                        <button
                          type="button"
                          onClick={() => setManagingRoom(room)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
                        >
                          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                          Người ở, CCCD & HĐ
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Full Tenant Directory with semantic <search> landmark */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Sổ Quản Lý Hộ Khẩu / Tạm Trú Toàn Khu Trọ ({filteredTenants.length} hồ sơ)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tra cứu nhanh theo Họ tên, SĐT, Số CCCD, Quê quán, Biển số xe và xem/tải ảnh CCCD & Hợp đồng
                  </p>
                </div>

                {/* Semantic <search> element per modern-web-guidance html guide */}
                <search className="w-full sm:w-80">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      aria-label="Tìm kiếm khách thuê theo tên, SĐT, CCCD, biển số xe"
                      autoCorrect="off"
                      spellCheck={false}
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      placeholder="Tìm tên, SĐT, CCCD, biển số xe..."
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:bg-white"
                    />
                  </div>
                </search>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-labelledby={tenantTableCaptionId}
                className="table-wrapper"
              >
                <table className="text-xs">
                  <caption id={tenantTableCaptionId} className="visually-hidden">
                    Danh sách toàn bộ khách thuê và thông tin cá nhân
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-left font-bold uppercase text-slate-600">
                      <th className="py-2.5 pl-3 pr-2">Phòng</th>
                      <th className="py-2.5 px-2">Họ và tên</th>
                      <th className="py-2.5 px-2">SĐT</th>
                      <th className="py-2.5 px-2">Số CCCD</th>
                      <th className="py-2.5 px-2">Ảnh CCCD & Hợp đồng</th>
                      <th className="py-2.5 px-2">Quê quán</th>
                      <th className="py-2.5 px-2">Biển số xe</th>
                      <th className="py-2.5 px-2">Tạm trú CA</th>
                      <th className="py-2.5 pl-2 pr-3 text-right">Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTenants.map((t) => {
                      const rm = propertyRooms.find((r) => r.id === t.roomId);
                      const tContracts = parseDocumentImages(t.contractImagesJson);
                      const rmContracts = parseDocumentImages(rm?.contractImagesJson);
                      const hasCccd = Boolean(t.cccdFrontUrl || t.cccdBackUrl);
                      const totalContracts = tContracts.length + (t.isRepresentative ? rmContracts.length : 0);

                      return (
                        <tr
                          key={t.id}
                          className={!t.isActive ? 'bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}
                        >
                          <th scope="row" className="py-2.5 pl-3 pr-2 font-bold">
                            Phòng {rm?.roomNumber || '?'}
                          </th>
                          <td className="py-2.5 px-2 font-semibold text-slate-900">
                            {t.fullName}{' '}
                            {t.isRepresentative && (
                              <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
                                Đại diện
                              </span>
                            )}
                            {!t.isActive && (
                              <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                                Đã chuyển đi
                              </span>
                            )}
                            <div className="text-[10px] font-normal text-slate-500">
                              {t.birthYear} ({t.gender}) • {t.occupation || '—'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 font-mono">{t.phone || '—'}</td>
                          <td className="py-2.5 px-2 font-mono">{t.cccd || '—'}</td>
                          <td className="py-2.5 px-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {hasCccd || totalContracts > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const imgs: LightboxPreviewData['images'] = [];
                                    if (t.cccdFrontUrl) {
                                      imgs.push({
                                        label: `CCCD Mặt Trước — ${t.fullName}`,
                                        dataUrl: t.cccdFrontUrl,
                                      });
                                    }
                                    if (t.cccdBackUrl) {
                                      imgs.push({
                                        label: `CCCD Mặt Sau — ${t.fullName}`,
                                        dataUrl: t.cccdBackUrl,
                                      });
                                    }
                                    for (const c of tContracts) {
                                      imgs.push({
                                        label: c.title,
                                        dataUrl: c.dataUrl,
                                        uploadedAt: c.uploadedAt,
                                      });
                                    }
                                    if (t.isRepresentative) {
                                      for (const rc of rmContracts) {
                                        imgs.push({
                                          label: rc.title,
                                          dataUrl: rc.dataUrl,
                                          uploadedAt: rc.uploadedAt,
                                        });
                                      }
                                    }
                                    setLightboxPreview({
                                      title: `Hồ Sơ Ảnh CCCD & Hợp Đồng — ${t.fullName}`,
                                      subtitle: `Phòng ${rm?.roomNumber || '?'} • Số CCCD: ${t.cccd || '—'}`,
                                      images: imgs,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-teal-100 px-2 py-1 text-[11px] font-bold text-teal-900 hover:bg-teal-200"
                                >
                                  <Eye className="h-3 w-3" aria-hidden="true" />
                                  {t.cccdFrontUrl && t.cccdBackUrl
                                    ? 'CCCD 2 mặt'
                                    : hasCccd
                                    ? 'CCCD 1 mặt'
                                    : ''}
                                  {hasCccd && totalContracts > 0 ? ' + ' : ''}
                                  {totalContracts > 0 ? `${totalContracts} ảnh HĐ` : ''}
                                </button>
                              ) : currentUser?.role !== 'TENANT' ? (
                                <button
                                  type="button"
                                  onClick={() => rm && setManagingRoom(rm)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                                >
                                  <CreditCard className="h-3 w-3" aria-hidden="true" />
                                  + Tải CCCD / HĐ
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">Chưa có ảnh</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2">{t.hometown || '—'}</td>
                          <td className="py-2.5 px-2 font-mono font-semibold">
                            {t.vehiclePlate || '—'}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                t.tempResidenceStatus === 'REGISTERED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : t.tempResidenceStatus === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {t.tempResidenceStatus === 'REGISTERED'
                                ? 'Đã đăng ký'
                                : t.tempResidenceStatus === 'PENDING'
                                ? 'Chờ ĐK'
                                : 'Hết hạn'}
                            </span>
                          </td>
                          <td className="py-2.5 pl-2 pr-3 text-right">
                            {currentUser?.role !== 'TENANT' ? (
                              <button
                                type="button"
                                onClick={() => rm && setManagingRoom(rm)}
                                className="font-bold text-teal-700 hover:underline"
                              >
                                Tải ảnh / Sửa
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PROPERTY & FLEXIBLE FEE MECHANISM SETTINGS */}
        {activeTab === 'settings' && propForm && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-extrabold text-slate-900">
              Cấu Hình Khu Nhà Trọ & Cơ Chế Tính Các Khoản Tiền
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Thiết lập linh hoạt từng khoản thu theo <strong>Chỉ số đồng hồ (mới - cũ)</strong>,{' '}
              <strong>Theo đầu người đang ở</strong>, <strong>Cố định theo phòng</strong> hoặc{' '}
              <strong>Theo số lượng xe</strong>.
            </p>

            {currentUser?.role === 'TENANT' && (
              <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-3.5 text-xs font-semibold text-purple-900 flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-700 shrink-0" />
                <span>Bạn đang xem cấu hình khu trọ dưới quyền Khách thuê (Chỉ đọc).</span>
              </div>
            )}
            {currentUser?.role === 'MANAGER' && (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-xs font-semibold text-sky-900 flex items-center gap-2">
                <Lock className="h-4 w-4 text-sky-700 shrink-0" />
                <span>Quản lý có thể cập nhật biểu phí, nhưng chỉ Chủ nhà (Admin) mới có quyền chỉnh sửa tài khoản ngân hàng thụ hưởng VietQR.</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingSettings(true);
                try {
                  await postAction({ action: 'update_property', property: propForm });
                } finally {
                  setSavingSettings(false);
                }
              }}
              className="mt-6 space-y-6"
            >
              <fieldset className="rounded-xl border border-slate-200 p-4 space-y-4">
                <legend className="px-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  1. Thông tin khu trọ & Tài khoản nhận tiền (Tự động tạo VietQR)
                </legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pf-name" className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên khu nhà trọ
                    </label>
                    <input
                      id="pf-name"
                      type="text"
                      required
                      disabled={currentUser?.role !== 'ADMIN'}
                      value={propForm.name}
                      onChange={(e) => setPropForm({ ...propForm, name: e.target.value })}
                      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold ${
                        currentUser?.role !== 'ADMIN' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-address" className="block text-xs font-semibold text-slate-700 mb-1">
                      Địa chỉ chi tiết
                    </label>
                    <input
                      id="pf-address"
                      type="text"
                      required
                      disabled={currentUser?.role !== 'ADMIN'}
                      value={propForm.address}
                      onChange={(e) => setPropForm({ ...propForm, address: e.target.value })}
                      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${
                        currentUser?.role !== 'ADMIN' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-bank" className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngân hàng {currentUser?.role !== 'ADMIN' && '(Chỉ Admin đổi)'}
                    </label>
                    <input
                      id="pf-bank"
                      type="text"
                      disabled={currentUser?.role !== 'ADMIN'}
                      value={propForm.bankName}
                      onChange={(e) => setPropForm({ ...propForm, bankName: e.target.value })}
                      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${
                        currentUser?.role !== 'ADMIN' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-acc" className="block text-xs font-semibold text-slate-700 mb-1">
                      Số tài khoản ngân hàng {currentUser?.role !== 'ADMIN' && '(Chỉ Admin đổi)'}
                    </label>
                    <input
                      id="pf-acc"
                      type="text"
                      inputMode="numeric"
                      disabled={currentUser?.role !== 'ADMIN'}
                      value={propForm.bankAccountNumber}
                      onChange={(e) => setPropForm({ ...propForm, bankAccountNumber: e.target.value })}
                      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono font-bold ${
                        currentUser?.role !== 'ADMIN' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-holder" className="block text-xs font-semibold text-slate-700 mb-1">
                      Chủ tài khoản {currentUser?.role !== 'ADMIN' && '(Chỉ Admin đổi)'}
                    </label>
                    <input
                      id="pf-holder"
                      type="text"
                      disabled={currentUser?.role !== 'ADMIN'}
                      value={propForm.bankAccountHolder}
                      onChange={(e) => setPropForm({ ...propForm, bankAccountHolder: e.target.value })}
                      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold ${
                        currentUser?.role !== 'ADMIN' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-paynote" className="block text-xs font-semibold text-slate-700 mb-1">
                      Ghi chú thanh toán (in trên phiếu báo)
                    </label>
                    <input
                      id="pf-paynote"
                      type="text"
                      disabled={currentUser?.role === 'TENANT'}
                      value={propForm.paymentNote}
                      onChange={(e) => setPropForm({ ...propForm, paymentNote: e.target.value })}
                      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${
                        currentUser?.role === 'TENANT' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="rounded-xl border border-slate-200 p-4 space-y-4">
                <legend className="px-2 text-xs font-bold uppercase tracking-wider text-teal-800">
                  2. Cấu hình Cơ chế Tính Tiền & Đơn Giá Mặc Định
                </legend>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Electricity */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3.5 space-y-2">
                    <div className="font-bold text-sm text-amber-950">⚡ Tiền Điện</div>
                    <div>
                      <label htmlFor="pf-elec-mode" className="block text-xs font-medium text-slate-600 mb-1">
                        Cơ chế tính
                      </label>
                      <select
                        id="pf-elec-mode"
                        value={propForm.electricityMode}
                        onChange={(e) =>
                          setPropForm({ ...propForm, electricityMode: e.target.value as BillingMode })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="BY_METER">Theo chỉ số đồng hồ (KW mới - cũ)</option>
                        <option value="PER_PERSON">Khoán theo đầu người</option>
                        <option value="FIXED_PER_ROOM">Khoán cố định theo phòng</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="pf-elec-rate" className="block text-xs font-medium text-slate-600 mb-1">
                        Đơn giá (VNĐ)
                      </label>
                      <input
                        id="pf-elec-rate"
                        type="number"
                        min={0}
                        step={100}
                        value={propForm.electricityRate}
                        onChange={(e) =>
                          setPropForm({ ...propForm, electricityRate: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Water */}
                  <div className="rounded-xl border border-sky-200 bg-sky-50/30 p-3.5 space-y-2">
                    <div className="font-bold text-sm text-sky-950">💧 Tiền Nước</div>
                    <div>
                      <label htmlFor="pf-water-mode" className="block text-xs font-medium text-slate-600 mb-1">
                        Cơ chế tính (Theo số m³ hoặc Đầu người)
                      </label>
                      <select
                        id="pf-water-mode"
                        value={propForm.waterMode}
                        onChange={(e) =>
                          setPropForm({ ...propForm, waterMode: e.target.value as BillingMode })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="BY_METER">Theo chỉ số đồng hồ (m³ mới - cũ)</option>
                        <option value="PER_PERSON">Theo đầu người (Số người ở × Đơn giá)</option>
                        <option value="FIXED_PER_ROOM">Khoán cố định theo phòng</option>
                        <option value="FREE">Miễn phí / Không thu</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="pf-water-rate" className="block text-xs font-medium text-slate-600 mb-1">
                        Đơn giá Nước (VNĐ/{propForm.waterMode === 'PER_PERSON' ? 'người' : 'm³'})
                      </label>
                      <input
                        id="pf-water-rate"
                        type="number"
                        min={0}
                        step={1000}
                        value={propForm.waterRate}
                        onChange={(e) =>
                          setPropForm({ ...propForm, waterRate: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Trash */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="font-bold text-sm text-slate-900">🗑️ Tiền Rác</div>
                    <div>
                      <label htmlFor="pf-trash-mode" className="block text-xs font-medium text-slate-600 mb-1">
                        Cơ chế tính
                      </label>
                      <select
                        id="pf-trash-mode"
                        value={propForm.trashMode}
                        onChange={(e) =>
                          setPropForm({ ...propForm, trashMode: e.target.value as BillingMode })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="FIXED_PER_ROOM">Cố định theo phòng / tháng</option>
                        <option value="PER_PERSON">Theo đầu người / tháng</option>
                        <option value="FREE">Không thu</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="pf-trash-rate" className="block text-xs font-medium text-slate-600 mb-1">
                        Đơn giá Rác (VNĐ)
                      </label>
                      <input
                        id="pf-trash-rate"
                        type="number"
                        min={0}
                        step={5000}
                        value={propForm.trashRate}
                        onChange={(e) =>
                          setPropForm({ ...propForm, trashRate: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Lighting (Đèn VS) */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="font-bold text-sm text-slate-900">💡 Đèn Vệ Sinh (Đèn VS)</div>
                    <div>
                      <label htmlFor="pf-light-mode" className="block text-xs font-medium text-slate-600 mb-1">
                        Cơ chế tính
                      </label>
                      <select
                        id="pf-light-mode"
                        value={propForm.lightingMode}
                        onChange={(e) =>
                          setPropForm({ ...propForm, lightingMode: e.target.value as BillingMode })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="FIXED_PER_ROOM">Cố định theo phòng / tháng</option>
                        <option value="PER_PERSON">Theo đầu người / tháng</option>
                        <option value="FREE">Không thu (0đ)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="pf-light-rate" className="block text-xs font-medium text-slate-600 mb-1">
                        Đơn giá Đèn VS (VNĐ)
                      </label>
                      <input
                        id="pf-light-rate"
                        type="number"
                        min={0}
                        step={5000}
                        value={propForm.lightingRate}
                        onChange={(e) =>
                          setPropForm({ ...propForm, lightingRate: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Wifi */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="font-bold text-sm text-slate-900">📶 Phí Internet / Wifi</div>
                    <div>
                      <label htmlFor="pf-wifi-mode" className="block text-xs font-medium text-slate-600 mb-1">
                        Cơ chế tính
                      </label>
                      <select
                        id="pf-wifi-mode"
                        value={propForm.wifiMode}
                        onChange={(e) =>
                          setPropForm({ ...propForm, wifiMode: e.target.value as BillingMode })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="FREE">Miễn phí / Tự túc (0đ)</option>
                        <option value="FIXED_PER_ROOM">Cố định theo phòng / tháng</option>
                        <option value="PER_PERSON">Tính theo đầu người</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="pf-wifi-rate" className="block text-xs font-medium text-slate-600 mb-1">
                        Đơn giá Wifi (VNĐ)
                      </label>
                      <input
                        id="pf-wifi-rate"
                        type="number"
                        min={0}
                        step={10000}
                        value={propForm.wifiRate}
                        onChange={(e) =>
                          setPropForm({ ...propForm, wifiRate: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Parking */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="font-bold text-sm text-slate-900">🏍️ Phí Giữ Xe</div>
                    <div>
                      <label htmlFor="pf-park-mode" className="block text-xs font-medium text-slate-600 mb-1">
                        Cơ chế tính
                      </label>
                      <select
                        id="pf-park-mode"
                        value={propForm.parkingMode}
                        onChange={(e) =>
                          setPropForm({ ...propForm, parkingMode: e.target.value as BillingMode })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="FREE">Miễn phí giữ xe (0đ)</option>
                        <option value="PER_QUANTITY">Tính theo số lượng xe trong phòng</option>
                        <option value="PER_PERSON">Tính theo đầu người</option>
                        <option value="FIXED_PER_ROOM">Cố định theo phòng</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="pf-park-rate" className="block text-xs font-medium text-slate-600 mb-1">
                        Đơn giá Giữ xe (VNĐ/xe)
                      </label>
                      <input
                        id="pf-park-rate"
                        type="number"
                        min={0}
                        step={10000}
                        value={propForm.parkingRate}
                        onChange={(e) =>
                          setPropForm({ ...propForm, parkingRate: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {currentUser?.role !== 'TENANT' && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {savingSettings ? 'Đang lưu cấu hình...' : 'Lưu Cấu Hình Khu Trọ'}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* TAB 4: EXCEL AUDIT & IMPROVEMENTS */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-6">
              <h2 className="text-lg font-extrabold text-teal-950">
                Báo Cáo Phân Tích, Đối Soát & Cải Tiến Từ Dữ Liệu Excel Thực Tế
              </h2>
              <p className="mt-1 text-sm text-teal-900">
                Khi nạp toàn bộ 9 bảng tính từ file Excel của bạn (4 tháng của{' '}
                <strong>Nhà trọ 26 Đường 4</strong> và 5 tháng của{' '}
                <strong>Nhà trọ 219 Nguyễn Văn Tăng</strong>), hệ thống đã phát hiện và khắc phục tự động các điểm bất cập sau:
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-amber-300 bg-white p-4 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
                    1. Lỗi quên cộng 25,000đ Đèn VS (Khu 26 Đường 4)
                  </div>
                  <p className="mt-2 text-xs text-slate-700 leading-relaxed">
                    Trong các kỳ <code>T12_2025</code> (Tháng 1/2026), <code>T1_2026</code> (Tháng 2/2026) và <code>T2_2026</code> (Tháng 3/2026) tại <strong>Nhà trọ 26 Đường 4</strong>:
                    Chỉ có <strong>Phòng 1</strong> là công thức cột <em>Tổng cộng</em> có cộng cột <em>Đèn VS (25,000đ)</em>. Từ <strong>Phòng 2 đến Phòng 7</strong> đều ghi Đèn VS = 25,000đ nhưng công thức Excel bị sót cột này (làm thất thoát <strong>150,000đ/tháng</strong>).
                  </p>
                </div>

                <div className="rounded-xl border border-rose-300 bg-white p-4 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <ClipboardList className="h-5 w-5 text-rose-600 shrink-0" aria-hidden="true" />
                    2. Lỗi nhảy chỉ số Điện cũ giữa các tháng (Khu 219)
                  </div>
                  <p className="mt-2 text-xs text-slate-700 leading-relaxed">
                    Tại <strong>Nhà trọ 219 Nguyễn Văn Tăng</strong>:
                    <br />• <strong>Phòng 1</strong>: Điện mới Tháng 8/2025 là <code>1635</code> nhưng Điện cũ Tháng 9/2025 nhập là <code>1680</code> (lệch 45 KW = 157,500đ).
                    <br />• <strong>Phòng 7</strong>: Điện mới Tháng 8/2025 là <code>473</code> nhưng Điện cũ Tháng 9/2025 nhập là <code>479</code> (lệch 6 KW).
                    <br />• <strong>Phòng 8</strong>: Điện mới Tháng 9/2025 là <code>5391</code> nhưng Điện cũ Tháng 10/2025 là <code>5434</code> (lệch 43 KW).
                    <br />👉 <strong>Giải pháp:</strong> Khi bấm <em>&ldquo;Lập bảng thu tiền tháng mới&rdquo;</em>, hệ thống tự động lấy <strong>Chỉ số mới tháng trước</strong> làm <strong>Chỉ số cũ tháng sau</strong>!
                  </p>
                </div>

                <div className="rounded-xl border border-teal-300 bg-white p-4 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-teal-900">
                    <Users className="h-5 w-5 text-teal-600 shrink-0" aria-hidden="true" />
                    3. Tự động hóa tính tiền theo đầu người & đồng hồ
                  </div>
                  <p className="mt-2 text-xs text-slate-700 leading-relaxed">
                    • <strong>Khu 26 Đường 4</strong>: Tính Nước theo đồng hồ (<code>27,000đ/m³</code>), riêng Phòng 8 miễn Đèn VS và ghi chú <code>+ TIỀN NƯỚC</code>.
                    <br />• <strong>Khu 219 Nguyễn Văn Tăng</strong>: Tính Nước theo đầu người (<code>30,000đ/người</code>). Khi thêm/bớt thành viên trong phòng (VD: Phòng 4, 5 tăng từ 2 lên 3 người vào T10/2025; Phòng 8 giảm từ 2 xuống 1 người), tiền nước tự động nhân theo đúng số thành viên đang cư trú!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )}
  </main>

      {/* Modals */}
      <InvoiceReceiptModal
        open={Boolean(receiptInvoice)}
        onClose={() => setReceiptInvoice(null)}
        invoice={receiptInvoice}
        property={currentProperty}
        room={propertyRooms.find((r) => r.id === receiptInvoice?.roomId) || null}
        roomTenants={propertyTenants.filter((t) => t.roomId === receiptInvoice?.roomId)}
      />

      <InvoiceEditModal
        open={Boolean(editingInvoice)}
        onClose={() => setEditingInvoice(null)}
        invoice={editingInvoice}
        onSave={async (updated) => {
          await postAction({ action: 'save_invoice', invoice: updated });
        }}
      />

      <RoomTenantsModal
        open={Boolean(managingRoom)}
        onClose={() => setManagingRoom(null)}
        room={rooms.find((r) => r.id === managingRoom?.id) || managingRoom}
        property={currentProperty}
        tenants={propertyTenants}
        onSaveRoom={async (updatedRoom) => {
          await postAction({ action: 'upsert_room', room: updatedRoom });
        }}
        onSaveTenant={async (tenant) => {
          await postAction({ action: 'upsert_tenant', tenant });
        }}
        onDeleteTenant={async (id, propertyId, roomId) => {
          await postAction({ action: 'delete_tenant', id, propertyId, roomId });
        }}
      />

      {/* Create New Monthly Sheet Modal */}
      <ModalDialog
        open={newSheetModalOpen}
        onClose={() => setNewSheetModalOpen(false)}
        title={`Lập Bảng Thu Tiền Tháng Mới — ${currentProperty.name}`}
        subtitle="Tự động kế thừa chỉ số Điện/Nước mới của kỳ trước làm chỉ số cũ, đếm số thành viên đang ở trong từng phòng và chuyển nợ cũ (nếu có)"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateMonthSheet} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ns-month" className="block text-xs font-semibold text-slate-700 mb-1">
                Tháng
              </label>
              <input
                id="ns-month"
                type="number"
                min={1}
                max={12}
                required
                value={newSheetMonth}
                onChange={(e) => setNewSheetMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label htmlFor="ns-year" className="block text-xs font-semibold text-slate-700 mb-1">
                Năm
              </label>
              <input
                id="ns-year"
                type="number"
                min={2020}
                max={2035}
                required
                value={newSheetYear}
                onChange={(e) => setNewSheetYear(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={carryOverDebt}
              onChange={(e) => setCarryOverDebt(e.target.checked)}
              className="h-4 w-4 accent-teal-700"
            />
            Tự động cộng dồn tiền nợ chưa đóng của kỳ trước vào cột &ldquo;Nợ cũ&rdquo;
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewSheetModalOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-teal-700 px-5 py-2 text-xs font-bold text-white hover:bg-teal-800"
            >
              Khởi tạo bảng tháng {newSheetMonth}/{newSheetYear}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Create New Property Modal */}
      <ModalDialog
        open={newPropModalOpen}
        onClose={() => setNewPropModalOpen(false)}
        title="Thêm Khu Nhà Trọ / Chi Nhánh Mới"
        subtitle="Thiết lập nhanh khu trọ mới cùng cơ chế tính điện, nước, rác và số phòng"
        maxWidthClass="max-w-xl"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const data = await postAction({ action: 'create_property', property: newPropForm });
            if (data.properties?.length) {
              setSelectedPropertyId(data.properties[data.properties.length - 1].id);
            }
            setNewPropModalOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="np-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Tên khu nhà trọ *
            </label>
            <input
              id="np-name"
              type="text"
              required
              value={newPropForm.name}
              onChange={(e) => setNewPropForm({ ...newPropForm, name: e.target.value })}
              placeholder="VD: Nhà trọ cơ sở 3 - Thủ Đức"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="np-addr" className="block text-xs font-semibold text-slate-700 mb-1">
              Địa chỉ
            </label>
            <input
              id="np-addr"
              type="text"
              required
              value={newPropForm.address}
              onChange={(e) => setNewPropForm({ ...newPropForm, address: e.target.value })}
              placeholder="Địa chỉ khu nhà trọ..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="np-rooms" className="block text-xs font-semibold text-slate-700 mb-1">
                Số lượng phòng ban đầu
              </label>
              <input
                id="np-rooms"
                type="number"
                min={1}
                max={100}
                value={newPropForm.initialRoomCount}
                onChange={(e) => setNewPropForm({ ...newPropForm, initialRoomCount: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="np-rent" className="block text-xs font-semibold text-slate-700 mb-1">
                Giá thuê mặc định (VNĐ/phòng)
              </label>
              <input
                id="np-rent"
                type="number"
                min={0}
                step={100000}
                value={newPropForm.defaultBaseRent}
                onChange={(e) => setNewPropForm({ ...newPropForm, defaultBaseRent: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="np-wmode" className="block text-xs font-semibold text-slate-700 mb-1">
                Cơ chế tính Tiền Nước
              </label>
              <select
                id="np-wmode"
                value={newPropForm.waterMode}
                onChange={(e) =>
                  setNewPropForm({ ...newPropForm, waterMode: e.target.value as BillingMode })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="BY_METER">Theo đồng hồ (m³)</option>
                <option value="PER_PERSON">Theo đầu người</option>
                <option value="FIXED_PER_ROOM">Cố định theo phòng</option>
              </select>
            </div>
            <div>
              <label htmlFor="np-wrate" className="block text-xs font-semibold text-slate-700 mb-1">
                Đơn giá Nước (VNĐ)
              </label>
              <input
                id="np-wrate"
                type="number"
                min={0}
                step={1000}
                value={newPropForm.waterRate}
                onChange={(e) => setNewPropForm({ ...newPropForm, waterRate: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewPropModalOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-teal-700 px-5 py-2 text-xs font-bold text-white hover:bg-teal-800"
            >
              Tạo Khu Trọ Mới
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Login & Role Switching Modal */}
      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={handleSetUser}
      />

      {/* User Management Modal (Admin only) */}
      <UserManagementModal
        open={userManagementModalOpen}
        onClose={() => setUserManagementModalOpen(false)}
        users={users}
        properties={properties}
        rooms={rooms}
        currentUser={currentUser}
        onSaveUser={handleSaveUser}
        onDeleteUser={handleDeleteUser}
      />

      {/* Document & CCCD Image Lightbox Preview Modal */}
      <DocumentLightboxModal
        preview={lightboxPreview}
        onClose={() => setLightboxPreview(null)}
      />
    </div>
  );
}
