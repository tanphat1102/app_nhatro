'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  BillingMode,
  CustomFeeTemplate,
  ExtraFeeItem,
  Invoice,
  Property,
  Room,
  Tenant,
  User,
  UserRole,
} from '@/types/nhatro';
import { InvoiceReceiptModal, formatVND } from '@/components/InvoiceReceiptModal';
import { InvoiceEditModal } from '@/components/InvoiceEditModal';
import { RoomTenantsModal } from '@/components/RoomTenantsModal';
import { LoginModal } from '@/components/LoginModal';
import { UserManagementModal } from '@/components/UserManagementModal';
import { TenantPortal } from '@/components/TenantPortal';
import { ModalDialog } from '@/components/ModalDialog';
import { DocumentLightboxModal, LightboxPreviewData } from '@/components/DocumentLightboxModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { parseDocumentImages } from '@/lib/imageUtils';
import { getVietnameseGivenNameKey, matchesSearchTokens } from '@/lib/searchUtils';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowUpDown,
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
  Filter,
  Home,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
  Droplets,
} from 'lucide-react';

const QUICK_CUSTOM_FEE_PRESETS: Array<{
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
  { name: 'Truyền hình / Cáp', mode: 'FIXED_PER_ROOM', unit: 'phòng', unitPrice: 50000 },
];

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

  // Selected Month/Year & Search/Filter/Sort for Billing Tab
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [billingSearch, setBillingSearch] = useState<string>('');
  const [billingSort, setBillingSort] = useState<
    'ROOM_ASC' | 'TOTAL_DESC' | 'TOTAL_ASC' | 'UNPAID_DESC' | 'ELEC_DESC' | 'WATER_DESC'
  >('ROOM_ASC');

  // Room Cards Grid Search & Filter (Tab 2)
  const [roomGridFilter, setRoomGridFilter] = useState<
    'ALL' | 'OCCUPIED' | 'VACANT' | 'HAS_CONTRACT' | 'MISSING_CONTRACT'
  >('ALL');
  const [roomGridSearch, setRoomGridSearch] = useState<string>('');

  // Full Tenant Directory Multi-Filter & Sort (Tab 2)
  const [tenantSearch, setTenantSearch] = useState<string>('');
  const [tenantRoomFilter, setTenantRoomFilter] = useState<string>('ALL');
  const [tenantActiveFilter, setTenantActiveFilter] = useState<
    'ALL' | 'ACTIVE' | 'REPRESENTATIVE' | 'MOVED_OUT'
  >('ALL');
  const [tenantTempResFilter, setTenantTempResFilter] = useState<
    'ALL' | 'REGISTERED' | 'PENDING' | 'EXPIRED'
  >('ALL');
  const [tenantDocFilter, setTenantDocFilter] = useState<
    | 'ALL'
    | 'FULL_CCCD'
    | 'MISSING_CCCD'
    | 'HAS_CONTRACT'
    | 'HAS_AVATAR'
    | 'MISSING_AVATAR'
    | 'HAS_VEHICLE'
  >('ALL');
  const [tenantSortBy, setTenantSortBy] = useState<'ROOM_ASC' | 'NAME_ASC' | 'BIRTH_ASC'>('ROOM_ASC');

  // Modals state
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [managingRoom, setManagingRoom] = useState<Room | null>(null);
  const [newSheetModalOpen, setNewSheetModalOpen] = useState(false);
  const [newPropModalOpen, setNewPropModalOpen] = useState(false);
  const [newFeeModalOpen, setNewFeeModalOpen] = useState(false);
  const [lightboxPreview, setLightboxPreview] = useState<LightboxPreviewData | null>(null);

  // New Sheet Form
  const [newSheetMonth, setNewSheetMonth] = useState<number>(4);
  const [newSheetYear, setNewSheetYear] = useState<number>(2026);
  const [carryOverDebt, setCarryOverDebt] = useState<boolean>(true);

  // Add Custom Fee to Current Period Form
  const [newFeeForm, setNewFeeForm] = useState<{
    name: string;
    mode: BillingMode;
    unit: string;
    unitPrice: number;
    customQuantity: number;
    targetScope: 'ALL_OCCUPIED' | 'SELECTED_ROOMS';
    selectedRoomIds: number[];
    saveAsTemplate: boolean;
  }>({
    name: 'Máy giặt chung',
    mode: 'PER_PERSON',
    unit: 'người',
    unitPrice: 50000,
    customQuantity: 1,
    targetScope: 'ALL_OCCUPIED',
    selectedRoomIds: [],
    saveAsTemplate: true,
  });
  const [savingNewFee, setSavingNewFee] = useState(false);

  // Settings Form
  const [propForm, setPropForm] = useState<Property | null>(null);
  const [propCustomTemplates, setPropCustomTemplates] = useState<CustomFeeTemplate[]>([]);
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
  const billingSearchId = useId();
  const billingSortId = useId();
  const roomGridSearchId = useId();
  const tenantTableCaptionId = useId();
  const tenantSearchId = useId();
  const tenantRoomFilterId = useId();
  const tenantTempResFilterId = useId();
  const tenantDocFilterId = useId();
  const tenantSortById = useId();

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

  const currentPropertyCustomTemplates = useMemo<CustomFeeTemplate[]>(() => {
    if (!currentProperty?.customFeeTemplatesJson) return [];
    try {
      const parsed = JSON.parse(currentProperty.customFeeTemplatesJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [currentProperty]);

  useEffect(() => {
    if (currentProperty) {
      setPropForm({ ...currentProperty });
      try {
        const parsed = JSON.parse(currentProperty.customFeeTemplatesJson || '[]');
        setPropCustomTemplates(Array.isArray(parsed) ? parsed : []);
      } catch {
        setPropCustomTemplates([]);
      }
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

  const periodStatusCounts = useMemo(() => {
    if (!selectedPeriod) {
      return { all: 0, paid: 0, unpaid: 0, partial: 0, vacant: 0, excelDiff: 0 };
    }
    const [m, y] = selectedPeriod.split('-').map(Number);
    const inPeriod = propertyInvoices.filter((inv) => inv.month === m && inv.year === y);
    return {
      all: inPeriod.length,
      paid: inPeriod.filter((inv) => inv.paymentStatus === 'PAID').length,
      unpaid: inPeriod.filter((inv) => inv.paymentStatus === 'UNPAID').length,
      partial: inPeriod.filter((inv) => inv.paymentStatus === 'PARTIAL').length,
      vacant: inPeriod.filter((inv) => inv.paymentStatus === 'VACANT').length,
      excelDiff: inPeriod.filter(
        (inv) => inv.excelOriginalTotal !== null && inv.excelOriginalTotal !== inv.totalAmount
      ).length,
    };
  }, [propertyInvoices, selectedPeriod]);

  const currentSheetInvoices = useMemo(() => {
    if (!selectedPeriod) return [];
    const [m, y] = selectedPeriod.split('-').map(Number);
    return propertyInvoices
      .filter((inv) => inv.month === m && inv.year === y)
      .filter((inv) => {
        if (statusFilter === 'ALL') return true;
        if (statusFilter === 'EXCEL_DIFF') {
          return inv.excelOriginalTotal !== null && inv.excelOriginalTotal !== inv.totalAmount;
        }
        return inv.paymentStatus === statusFilter;
      })
      .filter((inv) => {
        if (!billingSearch.trim()) return true;
        const rTenants = propertyTenants.filter((t) => t.roomId === inv.roomId && t.isActive);
        const tenantFields = rTenants.flatMap((t) => [
          t.fullName,
          t.phone,
          t.cccd,
          t.vehiclePlate,
          t.hometown,
        ]);
        let extraFeeNames: string[] = [];
        try {
          const parsed: ExtraFeeItem[] = JSON.parse(inv.extraFeesJson || '[]');
          extraFeeNames = parsed.map((ef) => ef.name);
        } catch {
          extraFeeNames = [];
        }
        return matchesSearchTokens(
          [
            `Phòng ${inv.roomNumber}`,
            `P${inv.roomNumber}`,
            `P.${inv.roomNumber}`,
            inv.roomNumber,
            inv.oldRoomNumber ? `Cũ ${inv.oldRoomNumber}` : '',
            inv.note,
            ...extraFeeNames,
            ...tenantFields,
          ],
          billingSearch
        );
      })
      .sort((a, b) => {
        if (billingSort === 'TOTAL_DESC') return b.totalAmount - a.totalAmount;
        if (billingSort === 'TOTAL_ASC') return a.totalAmount - b.totalAmount;
        if (billingSort === 'UNPAID_DESC') {
          const unpaidA = Math.max(0, a.totalAmount - a.paidAmount);
          const unpaidB = Math.max(0, b.totalAmount - b.paidAmount);
          return unpaidB - unpaidA;
        }
        if (billingSort === 'ELEC_DESC') {
          return Math.max(0, b.elecNew - b.elecOld) - Math.max(0, a.elecNew - a.elecOld);
        }
        if (billingSort === 'WATER_DESC') {
          return b.waterAmount - a.waterAmount;
        }
        return Number(a.roomNumber) - Number(b.roomNumber);
      });
  }, [propertyInvoices, propertyTenants, selectedPeriod, statusFilter, billingSearch, billingSort]);

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
        otherFeesTotal: 0,
        extraFeesTotal: 0,
        hasAnyOtherFees: false,
        periodCustomFeeStats: [] as Array<{ name: string; roomCount: number; totalAmount: number }>,
        rentTotal: 0,
        excelOrigSum: 0,
        discrepancyCount: 0,
      };
    }
    const [m, y] = selectedPeriod.split('-').map(Number);
    const allInPeriod = propertyInvoices.filter((inv) => inv.month === m && inv.year === y);
    const feeStatsMap = new Map<string, { name: string; roomCount: number; totalAmount: number }>();

    const summary = allInPeriod.reduce(
      (acc, inv) => {
        acc.totalRevenue += inv.totalAmount;
        acc.collectedAmount += inv.paidAmount;
        acc.unpaidAmount += Math.max(0, inv.totalAmount - inv.paidAmount);
        acc.elecTotal += inv.elecAmount;
        acc.waterTotal += inv.waterAmount;
        acc.trashTotal += inv.trashAmount;
        acc.lightingTotal += inv.lightingAmount;
        const rowOther =
          inv.wifiAmount +
          inv.parkingAmount +
          inv.extraFeesAmount +
          inv.previousDebt -
          inv.discountAmount;
        acc.otherFeesTotal += rowOther;
        acc.extraFeesTotal += inv.extraFeesAmount;
        if (
          inv.wifiAmount > 0 ||
          inv.parkingAmount > 0 ||
          inv.extraFeesAmount > 0 ||
          inv.previousDebt > 0 ||
          inv.discountAmount > 0
        ) {
          acc.hasAnyOtherFees = true;
        }
        try {
          const parsed: ExtraFeeItem[] = JSON.parse(inv.extraFeesJson || '[]');
          if (parsed.length > 0) {
            acc.hasAnyOtherFees = true;
          }
          for (const ef of parsed) {
            if (!ef?.name) continue;
            const key = ef.name.trim().toLowerCase();
            const existing = feeStatsMap.get(key) || {
              name: ef.name.trim(),
              roomCount: 0,
              totalAmount: 0,
            };
            existing.roomCount += 1;
            existing.totalAmount += Number(ef.amount || 0);
            feeStatsMap.set(key, existing);
          }
        } catch {
          // ignore parse error
        }
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
        otherFeesTotal: 0,
        extraFeesTotal: 0,
        hasAnyOtherFees: false,
        periodCustomFeeStats: [] as Array<{ name: string; roomCount: number; totalAmount: number }>,
        rentTotal: 0,
        excelOrigSum: 0,
        discrepancyCount: 0,
      }
    );
    summary.periodCustomFeeStats = Array.from(feeStatsMap.values());
    return summary;
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

  const handleAddCustomFeeToPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !selectedPeriod || !newFeeForm.name.trim()) return;
    const [m, y] = selectedPeriod.split('-').map(Number);
    setSavingNewFee(true);
    try {
      await postAction({
        action: 'add_custom_fee_to_period',
        propertyId: currentProperty.id,
        month: m,
        year: y,
        fee: {
          name: newFeeForm.name.trim(),
          mode: newFeeForm.mode,
          unit: newFeeForm.unit.trim() || 'tháng',
          unitPrice: Number(newFeeForm.unitPrice || 0),
          customQuantity: Number(newFeeForm.customQuantity || 1),
        },
        targetScope: newFeeForm.targetScope,
        roomIds: newFeeForm.selectedRoomIds,
        saveAsTemplate: newFeeForm.saveAsTemplate,
      });
      setNewFeeModalOpen(false);
    } finally {
      setSavingNewFee(false);
    }
  };

  const handleRemoveCustomFeeFromPeriod = async (feeName: string) => {
    if (!currentProperty || !selectedPeriod) return;
    const [m, y] = selectedPeriod.split('-').map(Number);
    await postAction({
      action: 'remove_custom_fee_from_period',
      propertyId: currentProperty.id,
      month: m,
      year: y,
      feeName,
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

  const roomFilterCounts = useMemo(() => {
    let hasContract = 0;
    let missingContract = 0;
    for (const r of propertyRooms) {
      const rTenants = propertyTenants.filter((t) => t.roomId === r.id && t.isActive);
      const isOccupied = rTenants.length > 0 || r.status === 'OCCUPIED';
      const rContracts = parseDocumentImages(r.contractImagesJson);
      const tContractCount = rTenants.reduce(
        (acc, t) => acc + parseDocumentImages(t.contractImagesJson).length,
        0
      );
      if (rContracts.length + tContractCount > 0) {
        hasContract += 1;
      } else if (isOccupied) {
        missingContract += 1;
      }
    }
    return {
      all: propertyRooms.length,
      occupied: occupiedRoomsCount,
      vacant: Math.max(0, propertyRooms.length - occupiedRoomsCount),
      hasContract,
      missingContract,
    };
  }, [propertyRooms, propertyTenants, occupiedRoomsCount]);

  const filteredRooms = useMemo(() => {
    return propertyRooms.filter((room) => {
      const rTenants = propertyTenants.filter((t) => t.roomId === room.id && t.isActive);
      const isOccupied = rTenants.length > 0 || room.status === 'OCCUPIED';
      const rContracts = parseDocumentImages(room.contractImagesJson);
      const tContractCount = rTenants.reduce(
        (acc, t) => acc + parseDocumentImages(t.contractImagesJson).length,
        0
      );
      const hasAnyContract = rContracts.length + tContractCount > 0;

      if (roomGridFilter === 'OCCUPIED' && !isOccupied) return false;
      if (roomGridFilter === 'VACANT' && isOccupied) return false;
      if (roomGridFilter === 'HAS_CONTRACT' && !hasAnyContract) return false;
      if (roomGridFilter === 'MISSING_CONTRACT' && (!isOccupied || hasAnyContract)) return false;

      if (!roomGridSearch.trim()) return true;
      const occupantFields = rTenants.flatMap((t) => [
        t.fullName,
        t.phone,
        t.cccd,
        t.hometown,
        t.vehiclePlate,
      ]);
      return matchesSearchTokens(
        [
          `Phòng ${room.roomNumber}`,
          `P${room.roomNumber}`,
          `P.${room.roomNumber}`,
          room.roomNumber,
          room.oldRoomNumber ? `Cũ ${room.oldRoomNumber}` : '',
          room.baseRent,
          room.note,
          ...occupantFields,
        ],
        roomGridSearch
      );
    });
  }, [propertyRooms, propertyTenants, roomGridFilter, roomGridSearch]);

  const filteredTenants = useMemo(() => {
    return propertyTenants
      .filter((t) => {
        if (tenantRoomFilter !== 'ALL' && String(t.roomId) !== tenantRoomFilter) {
          return false;
        }
        if (tenantActiveFilter === 'ACTIVE' && !t.isActive) return false;
        if (tenantActiveFilter === 'REPRESENTATIVE' && !t.isRepresentative) return false;
        if (tenantActiveFilter === 'MOVED_OUT' && t.isActive) return false;

        if (tenantTempResFilter !== 'ALL' && t.tempResidenceStatus !== tenantTempResFilter) {
          return false;
        }

        if (tenantDocFilter !== 'ALL') {
          const rm = propertyRooms.find((r) => r.id === t.roomId);
          const tContracts = parseDocumentImages(t.contractImagesJson);
          const rmContracts = parseDocumentImages(rm?.contractImagesJson);
          const totalContracts = tContracts.length + (t.isRepresentative ? rmContracts.length : 0);
          const hasFullCccd = Boolean(t.cccdFrontUrl && t.cccdBackUrl);

          if (tenantDocFilter === 'FULL_CCCD' && !hasFullCccd) return false;
          if (tenantDocFilter === 'MISSING_CCCD' && hasFullCccd) return false;
          if (tenantDocFilter === 'HAS_CONTRACT' && totalContracts === 0) return false;
          if (tenantDocFilter === 'HAS_AVATAR' && !t.avatarUrl) return false;
          if (tenantDocFilter === 'MISSING_AVATAR' && Boolean(t.avatarUrl)) return false;
          if (tenantDocFilter === 'HAS_VEHICLE' && !t.vehiclePlate?.trim()) return false;
        }

        if (!tenantSearch.trim()) return true;
        const rm = propertyRooms.find((r) => r.id === t.roomId);
        return matchesSearchTokens(
          [
            t.fullName,
            t.phone,
            t.cccd,
            t.hometown,
            t.vehiclePlate,
            t.occupation,
            t.birthYear,
            t.gender,
            t.notes,
            rm ? `Phòng ${rm.roomNumber} P${rm.roomNumber} P.${rm.roomNumber}` : '',
            rm?.oldRoomNumber ? `Cũ ${rm.oldRoomNumber}` : '',
          ],
          tenantSearch
        );
      })
      .sort((a, b) => {
        if (tenantSortBy === 'NAME_ASC') {
          return getVietnameseGivenNameKey(a.fullName).localeCompare(
            getVietnameseGivenNameKey(b.fullName)
          );
        }
        if (tenantSortBy === 'BIRTH_ASC') {
          return (Number(a.birthYear) || 9999) - (Number(b.birthYear) || 9999);
        }
        const rmA = propertyRooms.find((r) => r.id === a.roomId);
        const rmB = propertyRooms.find((r) => r.id === b.roomId);
        const numA = Number(rmA?.roomNumber || 999);
        const numB = Number(rmB?.roomNumber || 999);
        if (numA !== numB) return numA - numB;
        if (a.isRepresentative !== b.isRepresentative) return a.isRepresentative ? -1 : 1;
        return a.id - b.id;
      });
  }, [
    propertyTenants,
    propertyRooms,
    tenantRoomFilter,
    tenantActiveFilter,
    tenantTempResFilter,
    tenantDocFilter,
    tenantSearch,
    tenantSortBy,
  ]);

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

  const collectionRate =
    sheetSummary.totalRevenue > 0
      ? Math.min(100, Math.round((sheetSummary.collectedAmount / sheetSummary.totalRevenue) * 100))
      : 0;
  const occupancyRate =
    propertyRooms.length > 0
      ? Math.min(100, Math.round((occupiedRoomsCount / propertyRooms.length) * 100))
      : 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Glassmorphic Header */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl shadow-2xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 text-white shadow-md shadow-teal-900/15 ring-2 ring-teal-500/20">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                  Quản Lý Nhà Trọ Thông Minh
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-teal-50 to-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-teal-800 border border-teal-200/80 shadow-2xs">
                  ✦ Pro Cloud & VietQR
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chủ nhà: <strong className="text-slate-700">{currentProperty.bankAccountHolder}</strong> • Vietcombank:{' '}
                <span className="font-mono font-bold text-teal-700 bg-teal-50/80 px-1.5 py-0.5 rounded">
                  {currentProperty.bankAccountNumber}
                </span>
              </p>
            </div>
          </div>

          {/* Theme Toggle & User Auth Badge */}
          <div className="flex flex-wrap items-center gap-2.5">
            <ThemeToggle />

            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/90 p-1.5 shadow-2xs">
                <div
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold shadow-2xs ${
                    currentUser.role === 'ADMIN'
                      ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-950 border border-amber-300/80'
                      : currentUser.role === 'MANAGER'
                      ? 'bg-gradient-to-r from-sky-100 to-cyan-100 text-sky-950 border border-sky-300/80'
                      : 'bg-gradient-to-r from-purple-100 to-fuchsia-100 text-purple-950 border border-purple-300/80'
                  }`}
                >
                  {currentUser.role === 'ADMIN' ? (
                    <>👑 Chủ nhà</>
                  ) : currentUser.role === 'MANAGER' ? (
                    <>👔 Quản lý</>
                  ) : (
                    <>👤 Khách thuê</>
                  )}
                  <span className="font-normal opacity-40">|</span>
                  <span className="max-w-[130px] truncate">{currentUser.fullName}</span>
                </div>

                {currentUser.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => setUserManagementModalOpen(true)}
                    title="Quản lý tài khoản người dùng"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200/90 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-2xs"
                  >
                    <UserCog className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                    <span>Tài khoản ({users.length})</span>
                  </button>
                )}

                {currentUser.role === 'TENANT' && (
                  <button
                    type="button"
                    onClick={() => setTenantPortalMode(!tenantPortalMode)}
                    className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 px-3 py-1.5 text-xs font-bold text-white hover:from-purple-800 hover:to-indigo-800 shadow-xs transition-all"
                  >
                    {tenantPortalMode ? 'Xem bảng tổng quan' : 'Cổng Khách thuê'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  title="Đổi vai trò / Đăng nhập khác"
                  className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200/90 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
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
                  className="rounded-xl p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  aria-label="Đăng xuất"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-teal-700 hover:to-emerald-700 transition-all"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Đăng Nhập
              </button>
            )}
          </div>
        </div>

        {/* Property Switcher Bar */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 border-t border-slate-100/90 px-4 py-2.5 sm:px-6 bg-slate-50/40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">
              Cơ sở trọ:
            </span>
            {properties.map((prop) => {
              const isSelected = prop.id === currentProperty.id;
              return (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(prop.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xs ring-2 ring-teal-500/25'
                      : 'border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <Home
                    className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                  <span>{prop.name}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      isSelected
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'bg-slate-100 text-slate-600'
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
                className="inline-flex items-center gap-1 rounded-xl border border-dashed border-teal-600/70 bg-teal-50/40 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Thêm khu trọ
              </button>
            )}
          </div>

          {currentUser?.role === 'TENANT' && (
            <div className="text-xs text-purple-800 font-semibold bg-purple-50 px-3 py-1 rounded-xl border border-purple-200">
              {tenantPortalMode
                ? 'Đang hiển thị Cổng riêng của bạn'
                : 'Đang xem Bảng tổng quan (Chỉ đọc)'}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        {(!currentUser || currentUser.role !== 'TENANT' || !tenantPortalMode) && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <nav aria-label="Chức năng chính" className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
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
                  label: 'Phòng & Hồ Sơ Cư Trú',
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
                  className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition-all ${
                    active
                      ? 'border-teal-600 text-teal-900 bg-gradient-to-t from-teal-50/80 to-transparent rounded-t-xl'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 rounded-t-xl'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-teal-600' : 'text-slate-400'}`} aria-hidden="true" />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      active
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-slate-200/80 text-slate-700'
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

            {/* Executive Property Hero Banner */}
            <section className="relative overflow-hidden rounded-3xl border border-teal-200/90 bg-gradient-to-r from-teal-50/90 via-emerald-50/70 to-cyan-50/80 p-5 sm:p-6 text-slate-900 shadow-xs">
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-teal-200 px-3 py-1 text-xs font-extrabold text-teal-900 shadow-2xs">
                      <Home className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
                      {currentProperty.name}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      📍 {currentProperty.address}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 font-semibold text-amber-900 border border-amber-200 shadow-2xs">
                      <Zap className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                      Điện: <strong className="font-mono text-slate-900">{formatVND(currentProperty.electricityRate)}</strong> đ/KW
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 font-semibold text-sky-900 border border-sky-200 shadow-2xs">
                      <Droplets className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                      Nước:{' '}
                      <strong className="font-mono text-slate-900">{formatVND(currentProperty.waterRate)}</strong>{' '}
                      {currentProperty.waterMode === 'BY_METER'
                        ? 'đ/m³ (Đồng hồ)'
                        : currentProperty.waterMode === 'PER_PERSON'
                        ? 'đ/người (Đầu người)'
                        : 'đ/phòng'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 font-medium text-slate-700 border border-slate-200 shadow-2xs">
                      Rác: <strong className="font-mono text-slate-900">{formatVND(currentProperty.trashRate)}</strong> đ/tháng
                    </span>
                    {currentProperty.lightingRate > 0 && currentProperty.lightingMode !== 'FREE' && (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 font-medium text-slate-700 border border-slate-200 shadow-2xs">
                        Đèn VS: <strong className="font-mono text-slate-900">{formatVND(currentProperty.lightingRate)}</strong> đ/tháng
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {currentUser?.role !== 'TENANT' && (
                    <button
                      type="button"
                      onClick={() => setNewSheetModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:from-teal-700 hover:to-emerald-700 transition-all"
                    >
                      <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                      Lập bảng thu tiền tháng mới
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-teal-300 bg-white px-4 py-2.5 text-xs font-bold text-teal-900 shadow-2xs hover:bg-teal-50 transition-all"
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
              {/* Card 1: Total Revenue */}
              <div className="group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Tổng thu kỳ {currMonth}/{currYear}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 border border-teal-100">
                    <Wallet className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-black tracking-tight text-slate-900 font-mono">
                  {formatVND(sheetSummary.totalRevenue)} <span className="text-sm font-bold text-slate-500">đ</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Tiền phòng: <strong className="text-slate-700 font-mono">{formatVND(sheetSummary.rentTotal)}đ</strong> • Điện+Nước:{' '}
                  <strong className="text-slate-700 font-mono">{formatVND(sheetSummary.elecTotal + sheetSummary.waterTotal)}đ</strong>
                </p>
              </div>

              {/* Card 2: Collected Amount + Progress Bar */}
              <div className="group relative overflow-hidden rounded-3xl border border-emerald-200/90 bg-gradient-to-br from-white via-emerald-50/30 to-emerald-50/70 p-5 shadow-xs transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                    Đã thu trong kỳ ({collectionRate}%)
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-black tracking-tight text-emerald-800 font-mono">
                  {formatVND(sheetSummary.collectedAmount)} <span className="text-sm font-bold text-emerald-600">đ</span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-emerald-200/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-emerald-700">
                  Nhấn nút trạng thái từng phòng để gạch nợ 1 chạm
                </p>
              </div>

              {/* Card 3: Unpaid / Receivables */}
              <div className="group relative overflow-hidden rounded-3xl border border-rose-200/90 bg-gradient-to-br from-white via-rose-50/30 to-rose-50/70 p-5 shadow-xs transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800">
                    Còn chưa thu / Công nợ
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100/80 text-rose-700 border border-rose-200">
                    <Clock className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-black tracking-tight text-rose-700 font-mono">
                  {formatVND(sheetSummary.unpaidAmount)} <span className="text-sm font-bold text-rose-500">đ</span>
                </div>
                <p className="mt-2 text-xs text-rose-700">
                  {sheetSummary.unpaidAmount === 0
                    ? '🎉 Tuyệt vời! Đã thu đủ 100% các phòng trong kỳ'
                    : 'Tự động theo dõi & đối soát công nợ từng phòng'}
                </p>
              </div>

              {/* Card 4: Occupancy Density + Progress Bar */}
              <div className="group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Mật độ lấp đầy ({occupancyRate}%)
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 border border-sky-100">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                  {activeTenantsCount} người{' '}
                  <span className="text-sm font-bold text-slate-500">
                    ({occupiedRoomsCount}/{propertyRooms.length} phòng)
                  </span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-500 transition-all duration-500"
                    style={{ width: `${occupancyRate}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Lưu đầy đủ CCCD 2 mặt, Hợp đồng & biển số xe
                </p>
              </div>
            </div>

            {/* Period selector & Smart Search / Filter / Sort Panel */}
            <search
              aria-label="Tìm kiếm, lọc trạng thái và sắp xếp bảng tính tiền hàng tháng"
              className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-4"
            >
              {/* Row 1: Period Selector + Sync Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mr-1">
                    Kỳ thu tiền:
                  </span>
                  {availablePeriods.map((p) => {
                    const key = `${p.month}-${p.year}`;
                    const active = selectedPeriod === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedPeriod(key)}
                        className={`rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
                          active
                            ? 'bg-gradient-to-r from-teal-700 to-emerald-700 text-white shadow-sm'
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

                {currentUser?.role !== 'TENANT' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewFeeForm((prev) => ({
                          ...prev,
                          selectedRoomIds: propertyRooms
                            .filter((r) => r.status !== 'VACANT')
                            .map((r) => r.id),
                        }));
                        setNewFeeModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Thêm khoản thu mới
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncOccupantsToSheet}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-sky-200 bg-sky-50/80 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
                      Đồng bộ số người ở từ Hồ sơ phòng
                    </button>
                  </div>
                )}
              </div>

              {/* Active Custom Fees in Current Period */}
              {sheetSummary.periodCustomFeeStats.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200/80 bg-indigo-50/60 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-indigo-900">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                      Khoản thu mở rộng đang áp dụng kỳ {currMonth}/{currYear}:
                    </span>
                    {sheetSummary.periodCustomFeeStats.map((stat) => (
                      <span
                        key={stat.name}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-950 shadow-2xs"
                      >
                        <button
                          type="button"
                          onClick={() => setBillingSearch(stat.name)}
                          className="hover:underline"
                          title={`Bấm để lọc các phòng có khoản thu "${stat.name}"`}
                        >
                          {stat.name}: <span className="text-indigo-700 font-mono">{formatVND(stat.totalAmount)}đ</span>{' '}
                          <span className="text-[10px] font-normal text-slate-500">({stat.roomCount} phòng)</span>
                        </button>
                        {currentUser?.role !== 'TENANT' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomFeeFromPeriod(stat.name)}
                            aria-label={`Gỡ khoản thu ${stat.name} khỏi kỳ ${currMonth}/${currYear}`}
                            title={`Gỡ khoản thu "${stat.name}" khỏi tất cả phòng trong kỳ này`}
                            className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs font-extrabold text-indigo-900">
                    Tổng thu phụ phí: {formatVND(sheetSummary.extraFeesTotal)} đ
                  </span>
                </div>
              )}

              {/* Row 2: Search Input + Status Filter Pills + Sort Selector */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
                {/* Search input with explicit label and IME-safe Enter check */}
                <div className="lg:col-span-5">
                  <label
                    htmlFor={billingSearchId}
                    className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-600"
                  >
                    Tìm nhanh phòng / người ở / SĐT / khoản thu (hỗ trợ gõ không dấu)
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id={billingSearchId}
                      type="search"
                      name="billing_q"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={billingSearch}
                      onChange={(e) => setBillingSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
                            return;
                          }
                        }
                      }}
                      placeholder="VD: P2, nguyen van, 090, may giat, thang may..."
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50/80 py-2.5 pl-10 pr-9 text-xs font-medium text-slate-800 focus:border-teal-600 focus:bg-white"
                    />
                    {billingSearch && (
                      <button
                        type="button"
                        onClick={() => setBillingSearch('')}
                        aria-label="Xóa từ khóa tìm kiếm bảng thu tiền"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sort Selector */}
                <div className="lg:col-span-3">
                  <label
                    htmlFor={billingSortId}
                    className="mb-1.5 flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-600"
                  >
                    <ArrowUpDown className="h-3 w-3 text-teal-700" aria-hidden="true" />
                    Sắp xếp theo
                  </label>
                  <select
                    id={billingSortId}
                    name="billing_sort"
                    value={billingSort}
                    onChange={(e) =>
                      setBillingSort(
                        e.target.value as
                          | 'ROOM_ASC'
                          | 'TOTAL_DESC'
                          | 'TOTAL_ASC'
                          | 'UNPAID_DESC'
                          | 'ELEC_DESC'
                          | 'WATER_DESC'
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700"
                  >
                    <option value="ROOM_ASC">Số phòng (1 → {propertyRooms.length})</option>
                    <option value="TOTAL_DESC">Tổng tiền (Cao → Thấp)</option>
                    <option value="TOTAL_ASC">Tổng tiền (Thấp → Cao)</option>
                    <option value="UNPAID_DESC">Còn chưa thu (Cao → Thấp)</option>
                    <option value="ELEC_DESC">Điện tiêu thụ (KW cao → thấp)</option>
                    <option value="WATER_DESC">Tiền nước (Cao → Thấp)</option>
                  </select>
                </div>

                {/* Live Filter Status & Reset */}
                <div className="lg:col-span-4 flex flex-wrap items-center justify-between lg:justify-end gap-2">
                  <div
                    aria-live="polite"
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <Filter className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                    <span>
                      Hiển thị <strong>{currentSheetInvoices.length}</strong> / {periodStatusCounts.all} phòng
                    </span>
                  </div>
                  {(statusFilter !== 'ALL' || billingSearch.trim() !== '' || billingSort !== 'ROOM_ASC') && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('ALL');
                        setBillingSearch('');
                        setBillingSort('ROOM_ASC');
                      }}
                      className="inline-flex items-center gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Đặt lại lọc
                    </button>
                  )}
                </div>
              </div>

              {/* Row 3: Quick Status Filter Pills with Live Counts */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 mr-1">Lọc nhanh trạng thái:</span>
                {(
                  [
                    {
                      id: 'ALL',
                      label: `Tất cả (${periodStatusCounts.all})`,
                      activeClass: 'bg-teal-700 text-white border-teal-700',
                    },
                    {
                      id: 'PAID',
                      label: `✓ Đã thu đủ (${periodStatusCounts.paid})`,
                      activeClass: 'bg-emerald-700 text-white border-emerald-700',
                    },
                    {
                      id: 'UNPAID',
                      label: `⏳ Chưa đóng (${periodStatusCounts.unpaid})`,
                      activeClass: 'bg-rose-700 text-white border-rose-700',
                    },
                    {
                      id: 'PARTIAL',
                      label: `◐ Thu 1 phần (${periodStatusCounts.partial})`,
                      activeClass: 'bg-amber-600 text-white border-amber-600',
                    },
                    {
                      id: 'VACANT',
                      label: `○ Phòng trống (${periodStatusCounts.vacant})`,
                      activeClass: 'bg-slate-600 text-white border-slate-600',
                    },
                    ...(periodStatusCounts.excelDiff > 0
                      ? [
                          {
                            id: 'EXCEL_DIFF',
                            label: `⚠️ Lệch Excel (${periodStatusCounts.excelDiff})`,
                            activeClass: 'bg-amber-800 text-white border-amber-800',
                          },
                        ]
                      : []),
                  ] as const
                ).map((pill) => {
                  const isPressed = statusFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      aria-pressed={isPressed}
                      onClick={() => setStatusFilter(pill.id)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                        isPressed
                          ? `${pill.activeClass} shadow-2xs`
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </search>

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
                      {sheetSummary.hasAnyOtherFees && (
                        <th className="py-3 px-2 text-right text-indigo-800">Khoản thu khác</th>
                      )}
                      <th className="py-3 px-2 text-right">Tiền phòng</th>
                      <th className="py-3 px-2 text-right">Tổng cộng</th>
                      <th className="py-3 px-2 text-center">Trạng thái</th>
                      <th className="py-3 pl-2 pr-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentSheetInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-10 text-center text-slate-500">
                          <div className="mx-auto max-w-md space-y-2">
                            <p className="text-sm font-bold text-slate-700">
                              Không tìm thấy phòng hoặc hóa đơn nào khớp với bộ lọc hiện tại
                            </p>
                            <p className="text-xs text-slate-500">
                              Từ khóa: &ldquo;{billingSearch || '—'}&rdquo; • Trạng thái: {statusFilter}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setStatusFilter('ALL');
                                setBillingSearch('');
                                setBillingSort('ROOM_ASC');
                              }}
                              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Hiển thị lại tất cả phòng
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
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

                      let parsedExtraFees: ExtraFeeItem[] = [];
                      try {
                        parsedExtraFees = JSON.parse(inv.extraFeesJson || '[]');
                      } catch {
                        parsedExtraFees = [];
                      }
                      const rowOtherTotal =
                        inv.wifiAmount +
                        inv.parkingAmount +
                        inv.extraFeesAmount +
                        inv.previousDebt -
                        inv.discountAmount;

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
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal-700 text-xs font-black text-white shadow-2xs">
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
                                className="group flex items-center gap-2.5 text-left hover:underline"
                              >
                                {rTenants.length > 0 && (
                                  <div className="flex -space-x-1.5 shrink-0">
                                    {rTenants.slice(0, 3).map((t) => {
                                      const init =
                                        t.fullName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() || 'K';
                                      return t.avatarUrl ? (
                                        <img
                                          key={t.id}
                                          src={t.avatarUrl}
                                          alt={`Ảnh đại diện của ${t.fullName}`}
                                          width={28}
                                          height={28}
                                          loading="lazy"
                                          className="h-7 w-7 rounded-full object-cover ring-2 ring-white"
                                        />
                                      ) : (
                                        <span
                                          key={t.id}
                                          className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-[10px] font-black text-teal-800 ring-2 ring-white"
                                        >
                                          {init}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {rTenants.length > 0 ? (
                                  <div>
                                    <div className="font-semibold text-slate-800 group-hover:text-teal-700">
                                      {rTenants.map((t) => t.fullName).join(', ')}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {rTenants.length} thành viên • Quản lý người ở & ảnh
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
                              <div className="flex items-center gap-2.5">
                                {rTenants.length > 0 && (
                                  <div className="flex -space-x-1.5 shrink-0">
                                    {rTenants.slice(0, 3).map((t) => {
                                      const init =
                                        t.fullName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() || 'K';
                                      return t.avatarUrl ? (
                                        <img
                                          key={t.id}
                                          src={t.avatarUrl}
                                          alt={`Ảnh đại diện của ${t.fullName}`}
                                          width={28}
                                          height={28}
                                          loading="lazy"
                                          className="h-7 w-7 rounded-full object-cover ring-2 ring-white"
                                        />
                                      ) : (
                                        <span
                                          key={t.id}
                                          className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-[10px] font-black text-teal-800 ring-2 ring-white"
                                        >
                                          {init}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-slate-800">
                                    {rTenants.map((t) => t.fullName).join(', ') || (isVacant ? 'Phòng trống' : `${inv.occupantCount} người`)}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {rTenants.length} thành viên
                                  </div>
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

                          {/* Other / Custom Fees Column */}
                          {sheetSummary.hasAnyOtherFees && (
                            <td className="py-3 px-2 text-right">
                              {isVacant || rowOtherTotal === 0 ? (
                                <span className="text-slate-400">0</span>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-indigo-800">
                                    {formatVND(rowOtherTotal)}
                                  </div>
                                  <div className="flex flex-wrap justify-end gap-1">
                                    {inv.wifiAmount > 0 && (
                                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                                        Wifi: {formatVND(inv.wifiAmount)}
                                      </span>
                                    )}
                                    {inv.parkingAmount > 0 && (
                                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                                        Xe: {formatVND(inv.parkingAmount)}
                                      </span>
                                    )}
                                    {parsedExtraFees.map((ef) => (
                                      <span
                                        key={ef.id}
                                        className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800"
                                      >
                                        {ef.name}: {formatVND(ef.amount)}
                                      </span>
                                    ))}
                                    {inv.previousDebt > 0 && (
                                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                                        Nợ cũ: +{formatVND(inv.previousDebt)}
                                      </span>
                                    )}
                                    {inv.discountAmount > 0 && (
                                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                        Giảm: -{formatVND(inv.discountAmount)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
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
                    <tr className="border-t-2 border-teal-600 bg-gradient-to-r from-teal-50 via-emerald-50/80 to-teal-50 text-slate-900 font-bold">
                      <td colSpan={3} className="py-3.5 pl-4 pr-2 text-xs uppercase text-teal-950">
                        TỔNG CỘNG KỲ THÁNG {currMonth}/{currYear}
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono text-slate-900">
                        {formatVND(sheetSummary.elecTotal)}
                      </td>
                      <td className="py-3.5 px-2" />
                      <td className="py-3.5 px-2 text-right font-mono text-slate-900">
                        {formatVND(sheetSummary.waterTotal)}
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono text-slate-900">
                        {formatVND(sheetSummary.trashTotal)}
                      </td>
                      {(currentProperty.lightingRate > 0 || sheetSummary.lightingTotal > 0) && (
                        <td className="py-3.5 px-2 text-right font-mono text-slate-900">
                          {formatVND(sheetSummary.lightingTotal)}
                        </td>
                      )}
                      {sheetSummary.hasAnyOtherFees && (
                        <td className="py-3.5 px-2 text-right font-mono text-indigo-800">
                          {formatVND(sheetSummary.otherFeesTotal)}
                        </td>
                      )}
                      <td className="py-3.5 px-2 text-right font-mono text-slate-900">
                        {formatVND(sheetSummary.rentTotal)}
                      </td>
                      <td className="py-3.5 px-2 text-right text-base font-black text-teal-900">
                        {formatVND(sheetSummary.totalRevenue)} đ
                      </td>
                      <td colSpan={2} className="py-3.5 pl-2 pr-4 text-right text-xs text-emerald-800">
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
            {/* Room Grid Header + Semantic <search> Filter Bar */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Sơ Đồ Phòng & Hồ Sơ Các Thành Viên Trong Phòng
                  </h2>
                  <p className="text-xs text-slate-600">
                    Mỗi phòng có thể ở nhiều người. Số lượng người đang ở sẽ tự động liên kết với mục &ldquo;Số người sử dụng&rdquo; khi tính tiền nước/dịch vụ theo đầu người.
                  </p>
                </div>
                <div
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-50 border border-teal-200/80 px-3.5 py-1.5 text-xs font-bold text-teal-900"
                >
                  <Filter className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                  <span>
                    Hiển thị <strong>{filteredRooms.length}</strong> / {propertyRooms.length} phòng
                  </span>
                </div>
              </div>

              <search
                aria-label="Tìm và lọc sơ đồ phòng"
                className="flex flex-wrap items-end justify-between gap-3 pt-1 border-t border-slate-100"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">
                    Lọc phòng:
                  </span>
                  {(
                    [
                      { id: 'ALL', label: `Tất cả (${roomFilterCounts.all})` },
                      { id: 'OCCUPIED', label: `Đang có người (${roomFilterCounts.occupied})` },
                      { id: 'VACANT', label: `Phòng trống (${roomFilterCounts.vacant})` },
                      { id: 'HAS_CONTRACT', label: `Đã có ảnh HĐ (${roomFilterCounts.hasContract})` },
                      {
                        id: 'MISSING_CONTRACT',
                        label: `Chưa tải ảnh HĐ (${roomFilterCounts.missingContract})`,
                      },
                    ] as const
                  ).map((pill) => {
                    const active = roomGridFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setRoomGridFilter(pill.id)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? 'border-teal-700 bg-teal-700 text-white shadow-2xs'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
                  <div className="w-full sm:w-72">
                    <label
                      htmlFor={roomGridSearchId}
                      className="mb-1 block text-[11px] font-bold text-slate-600"
                    >
                      Tìm phòng / người trong phòng (không dấu)
                    </label>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id={roomGridSearchId}
                        type="search"
                        name="room_grid_q"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={roomGridSearch}
                        onChange={(e) => setRoomGridSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
                              return;
                            }
                          }
                        }}
                        placeholder="VD: P3, nguyen, 091, 65B1..."
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-8 pr-8 text-xs focus:border-teal-600 focus:bg-white"
                      />
                      {roomGridSearch && (
                        <button
                          type="button"
                          onClick={() => setRoomGridSearch('')}
                          aria-label="Xóa tìm kiếm sơ đồ phòng"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {(roomGridFilter !== 'ALL' || roomGridSearch.trim() !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setRoomGridFilter('ALL');
                        setRoomGridSearch('');
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Xóa lọc
                    </button>
                  )}
                </div>
              </search>
            </div>

            {/* Room Cards Grid */}
            {filteredRooms.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
                <p className="text-sm font-bold text-slate-700">
                  Không có phòng nào khớp với điều kiện lọc hiện tại
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRoomGridFilter('ALL');
                    setRoomGridSearch('');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Hiển thị lại tất cả {propertyRooms.length} phòng
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {filteredRooms.map((room) => {
                const rTenants = propertyTenants.filter(
                  (t) => t.roomId === room.id && t.isActive
                );
                const isOccupied = rTenants.length > 0 || room.status === 'OCCUPIED';
                const effectiveWaterMode = room.waterModeOverride || currentProperty.waterMode;
                const roomContracts = parseDocumentImages(room.contractImagesJson);

                return (
                  <article
                    key={room.id}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                      isOccupied
                        ? 'border-slate-200/90 bg-white'
                        : 'border-dashed border-slate-300 bg-slate-50/75'
                    }`}
                  >
                    {/* Top Status Accent Bar */}
                    <div
                      className={`h-1.5 w-full ${
                        isOccupied
                          ? 'bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500'
                          : 'bg-slate-300'
                      }`}
                    />

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Room Header */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-11 w-11 items-center justify-center rounded-2xl text-base font-black shadow-2xs ${
                                isOccupied
                                  ? 'bg-gradient-to-br from-teal-600 to-emerald-700 text-white'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              P.{room.roomNumber}
                            </span>
                            <div>
                              <h3 className="font-extrabold text-slate-900">
                                Phòng {room.roomNumber}
                                {room.oldRoomNumber && (
                                  <span className="ml-1 text-xs font-normal text-slate-500">
                                    (Cũ: {room.oldRoomNumber})
                                  </span>
                                )}
                              </h3>
                              <p className="text-xs font-extrabold text-teal-700 font-mono">
                                {formatVND(room.baseRent)} đ/tháng
                              </p>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              rTenants.length > 0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/70'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {rTenants.length > 0 ? `${rTenants.length} người ở` : 'Phòng trống'}
                          </span>
                        </div>

                        {/* Billing mechanism & Room Contract badges */}
                        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
                          <span className="rounded-lg bg-sky-50 px-2 py-0.5 font-semibold text-sky-800 border border-sky-200/80">
                            {effectiveWaterMode === 'PER_PERSON'
                              ? `Nước: Đầu người (${rTenants.length})`
                              : effectiveWaterMode === 'BY_METER'
                              ? `Nước: Đồng hồ (${room.currentWaterIndex} m³)`
                              : 'Nước: Riêng'}
                          </span>
                          <span className="rounded-lg bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 border border-amber-200/80 font-mono">
                            ⚡ {room.currentElecIndex} KW
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
                              className="inline-flex items-center gap-1 rounded-lg bg-teal-100 px-2 py-0.5 font-bold text-teal-900 hover:bg-teal-200 transition-colors"
                            >
                              <FileCheck2 className="h-3 w-3" aria-hidden="true" />
                              HĐ phòng: {roomContracts.length} ảnh
                            </button>
                          )}
                          {room.lightingModeOverride === 'FREE' && (
                            <span className="rounded-lg bg-purple-50 px-2 py-0.5 font-semibold text-purple-800">
                              Miễn Đèn VS
                            </span>
                          )}
                        </div>

                        {/* Member List inside Room */}
                        <div className="mt-3 space-y-2">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Danh sách thành viên ({rTenants.length}):
                          </div>
                          {rTenants.length === 0 ? (
                            <p className="py-4 text-center text-xs italic text-slate-400 bg-slate-100/60 rounded-2xl">
                              Chưa có người ở
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {rTenants.map((t) => {
                                const tContracts = parseDocumentImages(t.contractImagesJson);
                                const docCount =
                                  (t.avatarUrl ? 1 : 0) +
                                  (t.cccdFrontUrl ? 1 : 0) +
                                  (t.cccdBackUrl ? 1 : 0) +
                                  tContracts.length;
                                const avatarChar =
                                  t.fullName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() || 'K';

                                return (
                                  <li
                                    key={t.id}
                                    className="rounded-xl bg-slate-50/90 px-2.5 py-2 text-xs border border-slate-100 hover:border-teal-200/80 transition-colors"
                                  >
                                    <div className="flex items-center justify-between gap-1.5 font-bold text-slate-800">
                                      <div className="flex items-center gap-2 min-w-0">
                                        {t.avatarUrl ? (
                                          <img
                                            src={t.avatarUrl}
                                            alt={`Ảnh đại diện ${t.fullName}`}
                                            width={28}
                                            height={28}
                                            loading="lazy"
                                            className="h-7 w-7 shrink-0 rounded-full object-cover border border-teal-500/60"
                                          />
                                        ) : (
                                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[11px] font-black text-teal-800">
                                            {avatarChar}
                                          </span>
                                        )}
                                        <span className="truncate">{t.fullName}</span>
                                        {t.isRepresentative && (
                                          <span className="shrink-0 rounded-md bg-teal-700 px-1.5 py-0.2 text-[9px] font-bold text-white">
                                            Đ.Diện
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                                        {t.phone}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between pl-9 text-[11px] text-slate-500">
                                      <span className="truncate">Quê: {t.hometown || '—'}</span>
                                      {docCount > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const imgs: LightboxPreviewData['images'] = [];
                                            if (t.avatarUrl) {
                                              imgs.push({
                                                label: `Ảnh Đại Diện — ${t.fullName}`,
                                                dataUrl: t.avatarUrl,
                                              });
                                            }
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
                                              title: `Hồ Sơ Ảnh & Hợp Đồng — ${t.fullName} (Phòng ${room.roomNumber})`,
                                              subtitle: `Số CCCD: ${t.cccd || '—'} • SĐT: ${t.phone || '—'}`,
                                              images: imgs,
                                            });
                                          }}
                                          className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 hover:bg-teal-200 shrink-0"
                                        >
                                          <Eye className="h-2.5 w-2.5" aria-hidden="true" />
                                          {docCount} ảnh hồ sơ
                                        </button>
                                      ) : t.vehiclePlate ? (
                                        <span className="font-mono text-slate-600 shrink-0">
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
                        <span className="text-[11px] font-medium text-slate-500 font-mono">
                          Cọc: {formatVND(room.depositAmount)}đ
                        </span>
                        {currentUser?.role !== 'TENANT' && (
                          <button
                            type="button"
                            onClick={() => setManagingRoom(room)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:from-teal-800 hover:to-emerald-800 transition-all"
                          >
                            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                            Người ở, CCCD & HĐ
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
              </div>
            )}

            {/* Full Tenant Directory with semantic <search> landmark and multi-dimensional filters */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Sổ Quản Lý Hộ Khẩu / Tạm Trú Toàn Khu Trọ
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hỗ trợ tìm kiếm tiếng Việt có dấu hoặc không dấu (VD: &ldquo;nguyen van&rdquo;, &ldquo;dong thap&rdquo;, &ldquo;p2&rdquo;, &ldquo;65b1&rdquo;) kết hợp bộ lọc đa chiều
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    aria-live="polite"
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-800"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                    <span>
                      Đang hiển thị <strong>{filteredTenants.length}</strong> / {propertyTenants.length} hồ sơ
                    </span>
                  </div>

                  {(tenantSearch.trim() !== '' ||
                    tenantRoomFilter !== 'ALL' ||
                    tenantActiveFilter !== 'ALL' ||
                    tenantTempResFilter !== 'ALL' ||
                    tenantDocFilter !== 'ALL' ||
                    tenantSortBy !== 'ROOM_ASC') && (
                    <button
                      type="button"
                      onClick={() => {
                        setTenantSearch('');
                        setTenantRoomFilter('ALL');
                        setTenantActiveFilter('ALL');
                        setTenantTempResFilter('ALL');
                        setTenantDocFilter('ALL');
                        setTenantSortBy('ROOM_ASC');
                      }}
                      className="inline-flex items-center gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Đặt lại tất cả bộ lọc
                    </button>
                  )}
                </div>
              </div>

              {/* Semantic <search> landmark enclosing all Tenant Directory search & filter controls */}
              <search
                aria-label="Tra cứu và lọc danh sách khách thuê toàn khu trọ"
                className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-3"
              >
                {/* Row 1: Quick Residence Status Toggle Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">
                    Trạng thái cư trú:
                  </span>
                  {(
                    [
                      { id: 'ALL', label: `Tất cả (${propertyTenants.length})` },
                      { id: 'ACTIVE', label: `Đang ở (${activeTenantsCount})` },
                      {
                        id: 'REPRESENTATIVE',
                        label: `Đại diện phòng (${propertyTenants.filter((t) => t.isRepresentative).length})`,
                      },
                      {
                        id: 'MOVED_OUT',
                        label: `Đã chuyển đi (${propertyTenants.filter((t) => !t.isActive).length})`,
                      },
                    ] as const
                  ).map((pill) => {
                    const active = tenantActiveFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTenantActiveFilter(pill.id)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? 'border-teal-700 bg-teal-700 text-white shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>

                {/* Row 2: Multi-field Search + Room Filter + Temp Residence + Doc Filter + Sort */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  {/* Keyword Search */}
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label
                      htmlFor={tenantSearchId}
                      className="mb-1 block text-[11px] font-bold text-slate-600"
                    >
                      Từ khóa (Tên, SĐT, CCCD, Quê quán, Biển số, Nghề nghiệp)
                    </label>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id={tenantSearchId}
                        type="search"
                        name="tenant_q"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={tenantSearch}
                        onChange={(e) => setTenantSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
                              return;
                            }
                          }
                        }}
                        placeholder="Gõ có dấu hoặc không dấu: nguyen van, can tho, 65B1..."
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs focus:border-teal-600"
                      />
                      {tenantSearch && (
                        <button
                          type="button"
                          onClick={() => setTenantSearch('')}
                          aria-label="Xóa từ khóa tìm kiếm khách thuê"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Room Filter */}
                  <div className="lg:col-span-2">
                    <label
                      htmlFor={tenantRoomFilterId}
                      className="mb-1 block text-[11px] font-bold text-slate-600"
                    >
                      Theo phòng
                    </label>
                    <select
                      id={tenantRoomFilterId}
                      name="tenant_room"
                      value={tenantRoomFilter}
                      onChange={(e) => setTenantRoomFilter(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700"
                    >
                      <option value="ALL">Tất cả phòng ({propertyRooms.length})</option>
                      {propertyRooms.map((r) => (
                        <option key={r.id} value={String(r.id)}>
                          Phòng {r.roomNumber}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Police Temporary Residence Filter */}
                  <div className="lg:col-span-2">
                    <label
                      htmlFor={tenantTempResFilterId}
                      className="mb-1 block text-[11px] font-bold text-slate-600"
                    >
                      Tạm trú Công an
                    </label>
                    <select
                      id={tenantTempResFilterId}
                      name="tenant_temp_res"
                      value={tenantTempResFilter}
                      onChange={(e) =>
                        setTenantTempResFilter(
                          e.target.value as 'ALL' | 'REGISTERED' | 'PENDING' | 'EXPIRED'
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700"
                    >
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="REGISTERED">✓ Đã đăng ký CA</option>
                      <option value="PENDING">⏳ Chờ đăng ký CA</option>
                      <option value="EXPIRED">⚠️ Hết hạn / Chưa ĐK</option>
                    </select>
                  </div>

                  {/* Document & Vehicle Completeness Filter */}
                  <div className="lg:col-span-2">
                    <label
                      htmlFor={tenantDocFilterId}
                      className="mb-1 block text-[11px] font-bold text-slate-600"
                    >
                      Hồ sơ Ảnh & Xe
                    </label>
                    <select
                      id={tenantDocFilterId}
                      name="tenant_doc_filter"
                      value={tenantDocFilter}
                      onChange={(e) =>
                        setTenantDocFilter(
                          e.target.value as
                            | 'ALL'
                            | 'FULL_CCCD'
                            | 'MISSING_CCCD'
                            | 'HAS_CONTRACT'
                            | 'HAS_AVATAR'
                            | 'MISSING_AVATAR'
                            | 'HAS_VEHICLE'
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700"
                    >
                      <option value="ALL">Tất cả hồ sơ</option>
                      <option value="FULL_CCCD">✓ Đủ CCCD 2 mặt</option>
                      <option value="MISSING_CCCD">⚠️ Thiếu ảnh CCCD</option>
                      <option value="HAS_CONTRACT">📄 Có ảnh Hợp đồng</option>
                      <option value="HAS_AVATAR">👤 Đã có Avatar</option>
                      <option value="MISSING_AVATAR">○ Chưa có Avatar</option>
                      <option value="HAS_VEHICLE">🏍️ Có đăng ký xe máy</option>
                    </select>
                  </div>

                  {/* Sort Order */}
                  <div className="lg:col-span-2">
                    <label
                      htmlFor={tenantSortById}
                      className="mb-1 block text-[11px] font-bold text-slate-600"
                    >
                      Sắp xếp danh sách
                    </label>
                    <select
                      id={tenantSortById}
                      name="tenant_sort"
                      value={tenantSortBy}
                      onChange={(e) =>
                        setTenantSortBy(e.target.value as 'ROOM_ASC' | 'NAME_ASC' | 'BIRTH_ASC')
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700"
                    >
                      <option value="ROOM_ASC">Theo số phòng (1 → N)</option>
                      <option value="NAME_ASC">Theo tên (A → Z)</option>
                      <option value="BIRTH_ASC">Theo năm sinh (Lớn → Nhỏ)</option>
                    </select>
                  </div>
                </div>
              </search>

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
                      <th className="py-2.5 px-2">Ảnh Hồ sơ (Avatar / CCCD / HĐ)</th>
                      <th className="py-2.5 px-2">Quê quán</th>
                      <th className="py-2.5 px-2">Biển số xe</th>
                      <th className="py-2.5 px-2">Tạm trú CA</th>
                      <th className="py-2.5 pl-2 pr-3 text-right">Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-500">
                          <div className="mx-auto max-w-md space-y-2">
                            <p className="text-sm font-bold text-slate-700">
                              Không tìm thấy hồ sơ khách thuê nào phù hợp với bộ lọc
                            </p>
                            <p className="text-xs text-slate-500">
                              Bạn có thể gõ tên không dấu, số điện thoại, biển số xe hoặc nhấn đặt lại bộ lọc bên dưới.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setTenantSearch('');
                                setTenantRoomFilter('ALL');
                                setTenantActiveFilter('ALL');
                                setTenantTempResFilter('ALL');
                                setTenantDocFilter('ALL');
                                setTenantSortBy('ROOM_ASC');
                              }}
                              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Hiển thị lại toàn bộ ({propertyTenants.length} hồ sơ)
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {filteredTenants.map((t) => {
                      const rm = propertyRooms.find((r) => r.id === t.roomId);
                      const tContracts = parseDocumentImages(t.contractImagesJson);
                      const rmContracts = parseDocumentImages(rm?.contractImagesJson);
                      const hasCccd = Boolean(t.cccdFrontUrl || t.cccdBackUrl);
                      const hasAvatar = Boolean(t.avatarUrl);
                      const totalContracts = tContracts.length + (t.isRepresentative ? rmContracts.length : 0);
                      const avatarChar =
                        t.fullName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() || 'K';

                      return (
                        <tr
                          key={t.id}
                          className={!t.isActive ? 'bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}
                        >
                          <th scope="row" className="py-2.5 pl-3 pr-2 font-bold">
                            Phòng {rm?.roomNumber || '?'}
                          </th>
                          <td className="py-2.5 px-2 font-semibold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              {t.avatarUrl ? (
                                <img
                                  src={t.avatarUrl}
                                  alt={`Ảnh đại diện ${t.fullName}`}
                                  width={36}
                                  height={36}
                                  loading="lazy"
                                  className="h-9 w-9 shrink-0 rounded-full object-cover border border-teal-500/60 shadow-2xs"
                                />
                              ) : (
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-black text-teal-800">
                                  {avatarChar}
                                </span>
                              )}
                              <div>
                                <div>
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
                                </div>
                                <div className="text-[10px] font-normal text-slate-500">
                                  {t.birthYear} ({t.gender}) • {t.occupation || '—'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 font-mono">{t.phone || '—'}</td>
                          <td className="py-2.5 px-2 font-mono">{t.cccd || '—'}</td>
                          <td className="py-2.5 px-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {hasAvatar || hasCccd || totalContracts > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const imgs: LightboxPreviewData['images'] = [];
                                    if (t.avatarUrl) {
                                      imgs.push({
                                        label: `Ảnh Đại Diện — ${t.fullName}`,
                                        dataUrl: t.avatarUrl,
                                      });
                                    }
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
                                      title: `Hồ Sơ Ảnh Đại Diện, CCCD & Hợp Đồng — ${t.fullName}`,
                                      subtitle: `Phòng ${rm?.roomNumber || '?'} • Số CCCD: ${t.cccd || '—'}`,
                                      images: imgs,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-teal-100 px-2 py-1 text-[11px] font-bold text-teal-900 hover:bg-teal-200"
                                >
                                  <Eye className="h-3 w-3" aria-hidden="true" />
                                  {[
                                    hasAvatar ? 'Avatar' : '',
                                    t.cccdFrontUrl && t.cccdBackUrl
                                      ? 'CCCD 2 mặt'
                                      : hasCccd
                                      ? 'CCCD 1 mặt'
                                      : '',
                                    totalContracts > 0 ? `${totalContracts} ảnh HĐ` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' + ')}
                                </button>
                              ) : currentUser?.role !== 'TENANT' ? (
                                <button
                                  type="button"
                                  onClick={() => rm && setManagingRoom(rm)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                                >
                                  <CreditCard className="h-3 w-3" aria-hidden="true" />
                                  + Tải Avatar / CCCD
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
                  await postAction({
                    action: 'update_property',
                    property: {
                      ...propForm,
                      customFeeTemplatesJson: JSON.stringify(propCustomTemplates),
                    },
                  });
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

              {/* Fieldset 3: Unlimited Custom Fee Templates */}
              <fieldset className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-4">
                <legend className="px-2 text-xs font-bold uppercase tracking-wider text-indigo-800">
                  3. Danh Mục Các Khoản Thu Mới / Dịch Vụ Mở Rộng ({propCustomTemplates.length})
                </legend>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-600">
                    Tự do tạo thêm các khoản thu định kỳ mới (VD: <strong>Máy giặt chung</strong>, <strong>Thang máy</strong>, <strong>Vệ sinh hành lang</strong>, <strong>Camera an ninh</strong>, <strong>Sạc xe điện</strong>...). Các khoản thu bật <em>&ldquo;Mặc định thu&rdquo;</em> sẽ tự động đưa vào hóa đơn khi lập kỳ tháng mới.
                  </p>
                  {currentUser?.role !== 'TENANT' && (
                    <button
                      type="button"
                      onClick={() =>
                        setPropCustomTemplates((prev) => [
                          ...prev,
                          {
                            id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                            name: 'Khoản thu mới',
                            mode: 'FIXED_PER_ROOM',
                            unit: 'phòng',
                            unitPrice: 50000,
                            defaultActive: true,
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Thêm khoản thu mới
                    </button>
                  )}
                </div>

                {/* Quick Preset Buttons */}
                {currentUser?.role !== 'TENANT' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-indigo-900 mr-1">Thêm nhanh mẫu phổ biến:</span>
                    {QUICK_CUSTOM_FEE_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          if (
                            propCustomTemplates.some(
                              (t) => t.name.trim().toLowerCase() === preset.name.toLowerCase()
                            )
                          ) {
                            return;
                          }
                          setPropCustomTemplates((prev) => [
                            ...prev,
                            {
                              id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                              name: preset.name,
                              mode: preset.mode,
                              unit: preset.unit,
                              unitPrice: preset.unitPrice,
                              defaultActive: true,
                            },
                          ]);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-900 hover:bg-indigo-100 transition-colors"
                      >
                        <Sparkles className="h-3 w-3 text-indigo-600" aria-hidden="true" />
                        + {preset.name} ({formatVND(preset.unitPrice)}đ/{preset.unit})
                      </button>
                    ))}
                  </div>
                )}

                {propCustomTemplates.length > 0 ? (
                  <div className="space-y-2.5">
                    {propCustomTemplates.map((tpl, idx) => (
                      <div
                        key={tpl.id}
                        className="grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs sm:grid-cols-12 sm:items-center"
                      >
                        <div className="sm:col-span-3">
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-500">
                            Tên khoản thu mới
                          </label>
                          <input
                            type="text"
                            aria-label="Tên khoản thu mẫu"
                            disabled={currentUser?.role === 'TENANT'}
                            value={tpl.name}
                            onChange={(e) =>
                              setPropCustomTemplates((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                              )
                            }
                            placeholder="VD: Máy giặt chung"
                            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-500">
                            Cơ chế tính
                          </label>
                          <select
                            aria-label="Cơ chế tính khoản thu mẫu"
                            disabled={currentUser?.role === 'TENANT'}
                            value={tpl.mode}
                            onChange={(e) => {
                              const nextMode = e.target.value as BillingMode;
                              const nextUnit =
                                nextMode === 'PER_PERSON'
                                  ? 'người'
                                  : nextMode === 'PER_QUANTITY'
                                  ? 'xe'
                                  : 'phòng';
                              setPropCustomTemplates((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, mode: nextMode, unit: nextUnit } : item
                                )
                              );
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                          >
                            <option value="FIXED_PER_ROOM">Cố định theo phòng / tháng</option>
                            <option value="PER_PERSON">Theo đầu người đang ở</option>
                            <option value="PER_QUANTITY">Theo số lượng (xe / lượt)</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-500">
                            Đơn giá (VNĐ)
                          </label>
                          <input
                            type="number"
                            aria-label="Đơn giá khoản thu mẫu"
                            min={0}
                            step={5000}
                            disabled={currentUser?.role === 'TENANT'}
                            value={tpl.unitPrice}
                            onChange={(e) =>
                              setPropCustomTemplates((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, unitPrice: Number(e.target.value) } : item
                                )
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-indigo-900"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-500">
                            Đơn vị
                          </label>
                          <input
                            type="text"
                            aria-label="Đơn vị tính"
                            disabled={currentUser?.role === 'TENANT'}
                            value={tpl.unit}
                            onChange={(e) =>
                              setPropCustomTemplates((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, unit: e.target.value } : item))
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 sm:col-span-3 sm:justify-end sm:pt-4">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              disabled={currentUser?.role === 'TENANT'}
                              checked={tpl.defaultActive !== false}
                              onChange={(e) =>
                                setPropCustomTemplates((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, defaultActive: e.target.checked } : item
                                  )
                                )
                              }
                              className="h-3.5 w-3.5 accent-indigo-600"
                            />
                            <span>Mặc định thu</span>
                          </label>
                          {currentUser?.role !== 'TENANT' && selectedPeriod && (
                            <button
                              type="button"
                              onClick={async () => {
                                const [m, y] = selectedPeriod.split('-').map(Number);
                                await postAction({
                                  action: 'add_custom_fee_to_period',
                                  propertyId: currentProperty.id,
                                  month: m,
                                  year: y,
                                  fee: {
                                    name: tpl.name,
                                    mode: tpl.mode,
                                    unit: tpl.unit,
                                    unitPrice: tpl.unitPrice,
                                    customQuantity: 1,
                                  },
                                  targetScope: 'ALL_OCCUPIED',
                                  saveAsTemplate: true,
                                });
                              }}
                              title={`Áp dụng khoản thu "${tpl.name}" vào tất cả phòng đang ở của kỳ ${currMonth}/${currYear}`}
                              className="rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-800 hover:bg-indigo-100"
                            >
                              + Áp vào T{currMonth}
                            </button>
                          )}
                          {currentUser?.role !== 'TENANT' && (
                            <button
                              type="button"
                              onClick={() =>
                                setPropCustomTemplates((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label={`Xóa khoản thu mẫu ${tpl.name}`}
                              className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-800"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-indigo-200 bg-white/80 p-4 text-center text-xs text-slate-500">
                    Chưa có khoản thu mở rộng nào được lưu mặc định. Bấm các nút gợi ý phía trên (Máy giặt, Thang máy, Vệ sinh...) hoặc bấm <strong>+ Thêm khoản thu mới</strong> để tạo.
                  </div>
                )}
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
        customFeeTemplates={currentPropertyCustomTemplates}
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

      {/* Add Custom Fee to Current Period Modal */}
      <ModalDialog
        open={newFeeModalOpen}
        onClose={() => setNewFeeModalOpen(false)}
        title={`Thêm Khoản Thu Mới Vào Kỳ Tháng ${currMonth}/${currYear}`}
        subtitle={`Áp dụng nhanh khoản thu mới cho các phòng tại ${currentProperty.name} và tự động cộng vào Tổng tiền hóa đơn`}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleAddCustomFeeToPeriod} className="space-y-4">
          {/* Quick Preset Chips */}
          <div>
            <span className="mb-1.5 block text-xs font-bold text-slate-700">
              Chọn nhanh khoản thu mẫu phổ biến:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                ...currentPropertyCustomTemplates.map((t) => ({
                  name: t.name,
                  mode: t.mode,
                  unit: t.unit,
                  unitPrice: t.unitPrice,
                })),
                ...QUICK_CUSTOM_FEE_PRESETS.filter(
                  (p) =>
                    !currentPropertyCustomTemplates.some(
                      (t) => t.name.trim().toLowerCase() === p.name.toLowerCase()
                    )
                ),
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() =>
                    setNewFeeForm((prev) => ({
                      ...prev,
                      name: preset.name,
                      mode: preset.mode,
                      unit: preset.unit,
                      unitPrice: preset.unitPrice,
                    }))
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    newFeeForm.name.trim().toLowerCase() === preset.name.toLowerCase()
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {preset.name} ({formatVND(preset.unitPrice)}đ/{preset.unit})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="nf-name" className="mb-1 block text-xs font-semibold text-slate-700">
                Tên khoản thu mới *
              </label>
              <input
                id="nf-name"
                type="text"
                required
                value={newFeeForm.name}
                onChange={(e) => setNewFeeForm({ ...newFeeForm, name: e.target.value })}
                placeholder="VD: Máy giặt chung, Thang máy..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="nf-mode" className="mb-1 block text-xs font-semibold text-slate-700">
                Cơ chế tính tiền
              </label>
              <select
                id="nf-mode"
                value={newFeeForm.mode}
                onChange={(e) => {
                  const nextMode = e.target.value as BillingMode;
                  const nextUnit =
                    nextMode === 'PER_PERSON'
                      ? 'người'
                      : nextMode === 'PER_QUANTITY'
                      ? 'xe'
                      : 'phòng';
                  setNewFeeForm({ ...newFeeForm, mode: nextMode, unit: nextUnit });
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                <option value="FIXED_PER_ROOM">Cố định theo phòng (1 × Đơn giá)</option>
                <option value="PER_PERSON">Theo đầu người (Số người ở × Đơn giá)</option>
                <option value="PER_QUANTITY">Theo số lượng / xe (SL × Đơn giá)</option>
              </select>
            </div>

            <div>
              <label htmlFor="nf-price" className="mb-1 block text-xs font-semibold text-slate-700">
                Đơn giá (VNĐ) *
              </label>
              <input
                id="nf-price"
                type="number"
                min={0}
                step={5000}
                required
                value={newFeeForm.unitPrice}
                onChange={(e) => setNewFeeForm({ ...newFeeForm, unitPrice: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-indigo-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="nf-unit" className="mb-1 block text-xs font-semibold text-slate-700">
                  Đơn vị tính
                </label>
                <input
                  id="nf-unit"
                  type="text"
                  value={newFeeForm.unit}
                  onChange={(e) => setNewFeeForm({ ...newFeeForm, unit: e.target.value })}
                  placeholder="phòng / người"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {newFeeForm.mode === 'PER_QUANTITY' && (
                <div>
                  <label htmlFor="nf-qty" className="mb-1 block text-xs font-semibold text-slate-700">
                    Số lượng
                  </label>
                  <input
                    id="nf-qty"
                    type="number"
                    min={1}
                    value={newFeeForm.customQuantity}
                    onChange={(e) =>
                      setNewFeeForm({ ...newFeeForm, customQuantity: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Scope Selection */}
          <fieldset className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
            <legend className="px-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              Phạm vi phòng áp dụng trong kỳ Tháng {currMonth}/{currYear}
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                  newFeeForm.targetScope === 'ALL_OCCUPIED'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="targetScope"
                  checked={newFeeForm.targetScope === 'ALL_OCCUPIED'}
                  onChange={() => setNewFeeForm({ ...newFeeForm, targetScope: 'ALL_OCCUPIED' })}
                  className="accent-indigo-600"
                />
                Tất cả phòng đang có người ở ({occupiedRoomsCount} phòng)
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                  newFeeForm.targetScope === 'SELECTED_ROOMS'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="targetScope"
                  checked={newFeeForm.targetScope === 'SELECTED_ROOMS'}
                  onChange={() => setNewFeeForm({ ...newFeeForm, targetScope: 'SELECTED_ROOMS' })}
                  className="accent-indigo-600"
                />
                Chọn từng phòng cụ thể ({newFeeForm.selectedRoomIds.length} phòng)
              </label>
            </div>

            {newFeeForm.targetScope === 'SELECTED_ROOMS' && (
              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                {propertyRooms.map((rm) => {
                  const checked = newFeeForm.selectedRoomIds.includes(rm.id);
                  return (
                    <label
                      key={rm.id}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                        checked
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const nextIds = e.target.checked
                            ? [...newFeeForm.selectedRoomIds, rm.id]
                            : newFeeForm.selectedRoomIds.filter((id) => id !== rm.id);
                          setNewFeeForm({ ...newFeeForm, selectedRoomIds: nextIds });
                        }}
                        className="accent-indigo-600"
                      />
                      Phòng {rm.roomNumber}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs font-semibold text-indigo-950">
            <input
              type="checkbox"
              checked={newFeeForm.saveAsTemplate}
              onChange={(e) => setNewFeeForm({ ...newFeeForm, saveAsTemplate: e.target.checked })}
              className="h-4 w-4 accent-indigo-600"
            />
            Lưu khoản thu này vào Danh mục mặc định của khu trọ để tự động áp dụng cho các tháng sau
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewFeeModalOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingNewFee}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {savingNewFee
                ? 'Đang áp dụng...'
                : `Áp dụng vào Kỳ Tháng ${currMonth}/${currYear}`}
            </button>
          </div>
        </form>
      </ModalDialog>

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
