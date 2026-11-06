export type BillingMode =
  | 'BY_METER'       // Tính theo chỉ số đồng hồ: (Số mới - Số cũ) * Đơn giá
  | 'PER_PERSON'     // Tính theo đầu người: Số người ở * Đơn giá
  | 'FIXED_PER_ROOM' // Cố định theo phòng/tháng
  | 'PER_QUANTITY'   // Tính theo số lượng (số xe, số lượt...): Số lượng * Đơn giá
  | 'FREE';          // Miễn phí / Không thu (0đ)

export interface ExtraFeeItem {
  id: string;
  name: string;
  mode: BillingMode;
  unit: string;
  unitPrice: number;
  quantity: number;
  amount: number;
}

export interface Property {
  id: number;
  code: string;
  name: string;
  address: string;
  bankName: string;
  bankBin: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  paymentNote: string;
  generalNote: string;
  electricityRate: number;
  electricityMode: BillingMode;
  waterRate: number;
  waterMode: BillingMode;
  trashRate: number;
  trashMode: BillingMode;
  lightingRate: number;
  lightingMode: BillingMode;
  wifiRate: number;
  wifiMode: BillingMode;
  parkingRate: number;
  parkingMode: BillingMode;
}

export interface Room {
  id: number;
  propertyId: number;
  roomNumber: string;
  oldRoomNumber: string;
  baseRent: number;
  depositAmount: number;
  contractStartDate: string;
  contractEndDate: string;
  status: 'OCCUPIED' | 'VACANT' | 'MAINTENANCE';
  waterModeOverride: BillingMode | '';
  waterRateOverride: number | null;
  lightingModeOverride: BillingMode | '';
  trashModeOverride: BillingMode | '';
  wifiModeOverride: BillingMode | '';
  parkingModeOverride: BillingMode | '';
  currentElecIndex: number;
  currentWaterIndex: number;
  defaultOccupants: number;
  note: string;
}

export interface Tenant {
  id: number;
  propertyId: number;
  roomId: number;
  fullName: string;
  phone: string;
  cccd: string;
  birthYear: string;
  gender: 'Nam' | 'Nữ' | 'Khác';
  hometown: string;
  occupation: string;
  vehiclePlate: string;
  isRepresentative: boolean;
  moveInDate: string;
  moveOutDate: string;
  tempResidenceStatus: 'REGISTERED' | 'PENDING' | 'EXPIRED';
  isActive: boolean;
  notes: string;
}

export interface Invoice {
  id: number;
  propertyId: number;
  roomId: number;
  roomNumber?: string;
  oldRoomNumber?: string;
  month: number;
  year: number;
  sheetCode: string;
  occupantCount: number;
  vehicleCount: number;
  elecOld: number;
  elecNew: number;
  elecRate: number;
  elecAmount: number;
  waterMode: BillingMode;
  waterOld: number;
  waterNew: number;
  waterRate: number;
  waterAmount: number;
  trashAmount: number;
  lightingAmount: number;
  wifiAmount: number;
  parkingAmount: number;
  extraFeesJson: string;
  extraFeesAmount: number;
  roomRent: number;
  previousDebt: number;
  discountAmount: number;
  totalAmount: number;
  excelOriginalTotal: number | null;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'VACANT';
  paidAmount: number;
  paidDate: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  note: string;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'TENANT';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  phone: string;
  email: string;
  propertyId: number | null;
  roomId: number | null;
  tenantId: number | null;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  token?: string;
}

