import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';
import { neon } from '@neondatabase/serverless';
import { BillingMode, Invoice, Property, Room, Tenant, User, UserRole } from '@/types/nhatro';

try {
  dns.setDefaultResultOrder('ipv4first');
  net.setDefaultAutoSelectFamily?.(false);
} catch {
  // ignore
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'nhatro.db');

export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, 'nhatro_salt_2026', 1000, 32, 'sha256').toString('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

let dbInstance: DatabaseSync | null = null;
let localNeonVersion = 0;
let neonSchemaReady = false;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = DELETE;');
  db.exec('PRAGMA foreign_keys = ON;');

  initSchema(db);
  seedIfEmpty(db);
  seedUsersIfEmpty(db);

  dbInstance = db;
  return db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      bank_name TEXT NOT NULL DEFAULT 'VIETCOMBANK',
      bank_bin TEXT NOT NULL DEFAULT '970436',
      bank_account_number TEXT NOT NULL DEFAULT '103 1080 474',
      bank_account_holder TEXT NOT NULL DEFAULT 'Đặng Thị Thu Thảo',
      payment_note TEXT NOT NULL DEFAULT '',
      general_note TEXT NOT NULL DEFAULT '',
      electricity_rate INTEGER NOT NULL DEFAULT 4500,
      electricity_mode TEXT NOT NULL DEFAULT 'BY_METER',
      water_rate INTEGER NOT NULL DEFAULT 27000,
      water_mode TEXT NOT NULL DEFAULT 'BY_METER',
      trash_rate INTEGER NOT NULL DEFAULT 40000,
      trash_mode TEXT NOT NULL DEFAULT 'FIXED_PER_ROOM',
      lighting_rate INTEGER NOT NULL DEFAULT 25000,
      lighting_mode TEXT NOT NULL DEFAULT 'FIXED_PER_ROOM',
      wifi_rate INTEGER NOT NULL DEFAULT 0,
      wifi_mode TEXT NOT NULL DEFAULT 'FREE',
      parking_rate INTEGER NOT NULL DEFAULT 0,
      parking_mode TEXT NOT NULL DEFAULT 'FREE'
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      room_number TEXT NOT NULL,
      old_room_number TEXT NOT NULL DEFAULT '',
      base_rent INTEGER NOT NULL DEFAULT 1000000,
      deposit_amount INTEGER NOT NULL DEFAULT 1000000,
      contract_start_date TEXT NOT NULL DEFAULT '2025-01-01',
      contract_end_date TEXT NOT NULL DEFAULT '2026-12-31',
      status TEXT NOT NULL DEFAULT 'OCCUPIED',
      water_mode_override TEXT NOT NULL DEFAULT '',
      water_rate_override INTEGER,
      lighting_mode_override TEXT NOT NULL DEFAULT '',
      trash_mode_override TEXT NOT NULL DEFAULT '',
      wifi_mode_override TEXT NOT NULL DEFAULT '',
      parking_mode_override TEXT NOT NULL DEFAULT '',
      current_elec_index INTEGER NOT NULL DEFAULT 0,
      current_water_index INTEGER NOT NULL DEFAULT 0,
      default_occupants INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',
      contract_images_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      cccd TEXT NOT NULL DEFAULT '',
      birth_year TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'Nam',
      hometown TEXT NOT NULL DEFAULT '',
      occupation TEXT NOT NULL DEFAULT '',
      vehicle_plate TEXT NOT NULL DEFAULT '',
      is_representative INTEGER NOT NULL DEFAULT 0,
      move_in_date TEXT NOT NULL DEFAULT '2025-01-01',
      move_out_date TEXT NOT NULL DEFAULT '',
      temp_residence_status TEXT NOT NULL DEFAULT 'REGISTERED',
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT '',
      cccd_front_url TEXT NOT NULL DEFAULT '',
      cccd_back_url TEXT NOT NULL DEFAULT '',
      contract_images_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      sheet_code TEXT NOT NULL DEFAULT '',
      occupant_count INTEGER NOT NULL DEFAULT 1,
      vehicle_count INTEGER NOT NULL DEFAULT 0,
      elec_old INTEGER NOT NULL DEFAULT 0,
      elec_new INTEGER NOT NULL DEFAULT 0,
      elec_rate INTEGER NOT NULL DEFAULT 4500,
      elec_amount INTEGER NOT NULL DEFAULT 0,
      water_mode TEXT NOT NULL DEFAULT 'BY_METER',
      water_old INTEGER NOT NULL DEFAULT 0,
      water_new INTEGER NOT NULL DEFAULT 0,
      water_rate INTEGER NOT NULL DEFAULT 27000,
      water_amount INTEGER NOT NULL DEFAULT 0,
      trash_amount INTEGER NOT NULL DEFAULT 0,
      lighting_amount INTEGER NOT NULL DEFAULT 0,
      wifi_amount INTEGER NOT NULL DEFAULT 0,
      parking_amount INTEGER NOT NULL DEFAULT 0,
      extra_fees_json TEXT NOT NULL DEFAULT '[]',
      extra_fees_amount INTEGER NOT NULL DEFAULT 0,
      room_rent INTEGER NOT NULL DEFAULT 0,
      previous_debt INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      excel_original_total INTEGER,
      payment_status TEXT NOT NULL DEFAULT 'PAID',
      paid_amount INTEGER NOT NULL DEFAULT 0,
      paid_date TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'TRANSFER',
      note TEXT NOT NULL DEFAULT '',
      UNIQUE(property_id, room_id, month, year),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'TENANT',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      property_id INTEGER,
      room_id INTEGER,
      tenant_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
    );
  `);

  // Ensure new columns exist on already-created / restored SQLite databases
  const ensureColumn = (table: string, col: string, def: string) => {
    const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!info.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    }
  };
  ensureColumn('rooms', 'contract_images_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('tenants', 'cccd_front_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('tenants', 'cccd_back_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('tenants', 'contract_images_json', "TEXT NOT NULL DEFAULT '[]'");
}

function seedIfEmpty(db: DatabaseSync) {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM properties').get() as { cnt: number };
  if (row.cnt > 0) return;

  const insertProp = db.prepare(`
    INSERT INTO properties (
      code, name, address, bank_name, bank_bin, bank_account_number, bank_account_holder,
      payment_note, general_note,
      electricity_rate, electricity_mode,
      water_rate, water_mode,
      trash_rate, trash_mode,
      lighting_rate, lighting_mode,
      wifi_rate, wifi_mode,
      parking_rate, parking_mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Khu trọ 1: 26 Đường 4, Tăng Nhơn Phú B (Tính nước theo đồng hồ m3, có Đèn VS)
  const prop1Result = insertProp.run(
    'NT_26_DUONG_4',
    'Nhà trọ 26 Đường 4 - Tăng Nhơn Phú B',
    '26 đường 4, Phường Tăng Nhơn Phú B, Quận 9, TP. Thủ Đức',
    'VIETCOMBANK',
    '970436',
    '103 1080 474',
    'Đặng Thị Thu Thảo',
    'Thanh toán chuyển khoản hoặc tiền mặt trước ngày 05 hàng tháng.',
    'Cơ chế tính: Điện theo KW đồng hồ (4,500đ/KW), Nước theo m³ đồng hồ (27,000đ/m³), Rác 40,000đ/phòng, Đèn VS 25,000đ/phòng.',
    4500, 'BY_METER',
    27000, 'BY_METER',
    40000, 'FIXED_PER_ROOM',
    25000, 'FIXED_PER_ROOM',
    0, 'FREE',
    0, 'FREE'
  );
  const prop1Id = Number(prop1Result.lastInsertRowid);

  // Khu trọ 2: 219 Nguyễn Văn Tăng, Long Thạnh Mỹ (Tính nước theo đầu người 30,000đ/người)
  const prop2Result = insertProp.run(
    'NT_219_NVT',
    'Nhà trọ 219 Nguyễn Văn Tăng - Long Thạnh Mỹ',
    '219 Nguyễn Văn Tăng, Phường Long Thạnh Mỹ, TP. Thủ Đức',
    'VIETCOMBANK',
    '970436',
    '103 1080 474',
    'Đặng Thị Thu Thảo',
    'KHÁCH THUÊ VUI LÒNG THANH TOÁN TIỀN MẶT (KỂ TỪ THÁNG 3)',
    'Từ ngày 01/10/2022, chủ nhà không thu 50 nghìn tiền giữ xe, quý khách vui lòng tự bảo quản xe của mình.',
    3500, 'BY_METER',
    30000, 'PER_PERSON',
    30000, 'FIXED_PER_ROOM',
    0, 'FREE',
    0, 'FREE',
    0, 'FREE'
  );
  const prop2Id = Number(prop2Result.lastInsertRowid);

  const insertRoom = db.prepare(`
    INSERT INTO rooms (
      property_id, room_number, old_room_number, base_rent, deposit_amount,
      contract_start_date, contract_end_date, status,
      water_mode_override, water_rate_override, lighting_mode_override,
      current_elec_index, current_water_index, default_occupants, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Rooms for Property 1 (26 Đường 4)
  const prop1RoomsConfig = [
    { num: '1', old: '1', rent: 1000000, status: 'OCCUPIED', elec: 5512, water: 573, occ: 2, lightOver: '', note: '' },
    { num: '2', old: '2', rent: 1000000, status: 'OCCUPIED', elec: 5460, water: 659, occ: 2, lightOver: '', note: '' },
    { num: '3', old: '3', rent: 1000000, status: 'OCCUPIED', elec: 2833, water: 482, occ: 1, lightOver: '', note: '' },
    { num: '4', old: '4', rent: 1000000, status: 'VACANT',   elec: 0,    water: 0,   occ: 0, lightOver: '', note: 'Phòng trống từ T2/2026' },
    { num: '5', old: '',  rent: 1000000, status: 'OCCUPIED', elec: 2913, water: 615, occ: 2, lightOver: '', note: '' },
    { num: '6', old: '',  rent: 1000000, status: 'OCCUPIED', elec: 3902, water: 752, occ: 3, lightOver: '', note: '' },
    { num: '7', old: '',  rent: 1000000, status: 'OCCUPIED', elec: 3543, water: 291, occ: 2, lightOver: '', note: '' },
    { num: '8', old: '',  rent: 1500000, status: 'OCCUPIED', elec: 4567, water: 0,   occ: 2, lightOver: 'FREE', note: '+ TIỀN NƯỚC' },
  ];

  const prop1RoomIds: Record<string, number> = {};
  for (const r of prop1RoomsConfig) {
    const res = insertRoom.run(
      prop1Id, r.num, r.old, r.rent, r.rent,
      '2025-01-01', '2026-12-31', r.status,
      '', null, r.lightOver,
      r.elec, r.water, r.occ, r.note
    );
    prop1RoomIds[r.num] = Number(res.lastInsertRowid);
  }

  // Rooms for Property 2 (219 Nguyễn Văn Tăng)
  const prop2RoomsConfig = [
    { num: '1', old: '1', rent: 2300000, status: 'OCCUPIED', elec: 1817, water: 0, occ: 2, note: '' },
    { num: '2', old: '2', rent: 2400000, status: 'OCCUPIED', elec: 3102, water: 0, occ: 2, note: '' },
    { num: '3', old: '3', rent: 2300000, status: 'OCCUPIED', elec: 2337, water: 0, occ: 2, note: '' },
    { num: '4', old: '4', rent: 2300000, status: 'OCCUPIED', elec: 1811, water: 0, occ: 3, note: 'Tăng từ 2 lên 3 người từ T10/2025' },
    { num: '5', old: '',  rent: 2400000, status: 'OCCUPIED', elec: 5700, water: 0, occ: 3, note: 'Tăng từ 2 lên 3 người từ T10/2025' },
    { num: '6', old: '',  rent: 2500000, status: 'OCCUPIED', elec: 3753, water: 0, occ: 3, note: '' },
    { num: '7', old: '',  rent: 1800000, status: 'OCCUPIED', elec: 571,  water: 0, occ: 2, note: 'Vào ở từ T7/2025 (1 người), T10/2025 thêm 1 người' },
    { num: '8', old: '',  rent: 2500000, status: 'OCCUPIED', elec: 5434, water: 0, occ: 1, note: 'Giảm từ 2 xuống 1 người từ T10/2025' },
  ];

  const prop2RoomIds: Record<string, number> = {};
  for (const r of prop2RoomsConfig) {
    const res = insertRoom.run(
      prop2Id, r.num, r.old, r.rent, r.rent,
      '2025-01-01', '2026-12-31', r.status,
      'PER_PERSON', 30000, 'FREE',
      r.elec, r.water, r.occ, r.note
    );
    prop2RoomIds[r.num] = Number(res.lastInsertRowid);
  }

  // Seed Tenants (Nhiều người trong 1 phòng, mỗi người có đầy đủ thông tin cá nhân)
  const insertTenant = db.prepare(`
    INSERT INTO tenants (
      property_id, room_id, full_name, phone, cccd, birth_year, gender,
      hometown, occupation, vehicle_plate, is_representative,
      move_in_date, move_out_date, temp_residence_status, is_active, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const prop1Tenants = [
    // Phòng 1 (2 người)
    { room: '1', name: 'Nguyễn Văn Hùng', phone: '0908123451', cccd: '079098001231', by: '1998', gender: 'Nam', home: 'Đồng Nai', job: 'Kỹ sư cơ khí - KCN Cao Q9', plate: '60B1-452.19', rep: 1, inDate: '2024-06-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện phòng 1' },
    { room: '1', name: 'Nguyễn Thị Mai', phone: '0908123452', cccd: '079099001232', by: '2000', gender: 'Nữ', home: 'Đồng Nai', job: 'Nhân viên văn phòng', plate: '60B1-881.02', rep: 0, inDate: '2024-06-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Vợ anh Hùng' },
    // Phòng 2 (2 người)
    { room: '2', name: 'Trần Minh Tuấn', phone: '0919234561', cccd: '052097004321', by: '1997', gender: 'Nam', home: 'Bình Định', job: 'Nhân viên kỹ thuật FPT', plate: '77L1-339.10', rep: 1, inDate: '2024-08-15', outDate: '', status: 'REGISTERED', active: 1, note: 'Đóng tiền đúng hạn' },
    { room: '2', name: 'Lê Hoàng Nam', phone: '0919234562', cccd: '052099004322', by: '1999', gender: 'Nam', home: 'Bình Định', job: 'Sinh viên ĐH Sư Phạm Kỹ Thuật', plate: '77L1-112.89', rep: 0, inDate: '2024-09-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Em họ anh Tuấn' },
    // Phòng 3 (1 người)
    { room: '3', name: 'Phạm Thị Thu Hà', phone: '0933345678', cccd: '066196007890', by: '1996', gender: 'Nữ', home: 'Đắk Lắk', job: 'Kế toán viên', plate: '47B2-672.11', rep: 1, inDate: '2024-11-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Hay đi công tác, dùng ít điện nước' },
    // Phòng 4 (Đã trả phòng từ T2/2026)
    { room: '4', name: 'Đặng Quốc Bảo', phone: '0944556677', cccd: '083095003344', by: '1995', gender: 'Nam', home: 'Bến Tre', job: 'Tài xế công nghệ', plate: '71B3-229.45', rep: 1, inDate: '2024-05-01', outDate: '2026-01-30', status: 'EXPIRED', active: 0, note: 'Đã trả phòng cuối T1/2026' },
    // Phòng 5 (2 người)
    { room: '5', name: 'Võ Thành Đạt', phone: '0977112233', cccd: '049201005511', by: '2001', gender: 'Nam', home: 'Quảng Nam', job: 'Lập trình viên', plate: '92D1-554.21', rep: 1, inDate: '2025-01-10', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện phòng 5' },
    { room: '5', name: 'Huỳnh Gia Huy', phone: '0977112234', cccd: '049202005512', by: '2002', gender: 'Nam', home: 'Quảng Nam', job: 'Sinh viên ĐH Giao Thông Vận Tải', plate: '92D1-710.05', rep: 0, inDate: '2025-01-10', outDate: '', status: 'REGISTERED', active: 1, note: 'Ở ghép' },
    // Phòng 6 (3 người)
    { room: '6', name: 'Lý Thanh Tâm', phone: '0988665544', cccd: '091194009981', by: '1994', gender: 'Nam', home: 'Kiên Giang', job: 'Tổ trưởng sản xuất', plate: '68S1-412.88', rep: 1, inDate: '2024-03-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Gia đình 3 người' },
    { room: '6', name: 'Trương Mỹ Linh', phone: '0988665545', cccd: '091196009982', by: '1996', gender: 'Nữ', home: 'Kiên Giang', job: 'Nhân viên siêu thị Coopmart', plate: '68S1-419.01', rep: 0, inDate: '2024-03-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Vợ anh Tâm' },
    { room: '6', name: 'Trương Quốc Khánh', phone: '0988665546', cccd: '091204009983', by: '2004', gender: 'Nam', home: 'Kiên Giang', job: 'Sinh viên CĐ Công Thương', plate: '', rep: 0, inDate: '2025-09-01', outDate: '', status: 'PENDING', active: 1, note: 'Em vợ mới lên ở cùng' },
    // Phòng 7 (2 người)
    { room: '7', name: 'Bùi Thị Ngọc Ánh', phone: '0965432109', cccd: '038200001122', by: '2000', gender: 'Nữ', home: 'Thanh Hóa', job: 'Nhân viên ngân hàng', plate: '36B5-889.12', rep: 1, inDate: '2025-02-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện phòng 7' },
    { room: '7', name: 'Hoàng Thị Thảo', phone: '0965432110', cccd: '040201001123', by: '2001', gender: 'Nữ', home: 'Nghệ An', job: 'Giáo viên mầm non', plate: '37M1-342.19', rep: 0, inDate: '2025-02-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Bạn cùng phòng' },
    // Phòng 8 (2 người)
    { room: '8', name: 'Ngô Minh Quân', phone: '0909887766', cccd: '079092006543', by: '1992', gender: 'Nam', home: 'TP.HCM', job: 'Kinh doanh tự do', plate: '59X3-668.89', rep: 1, inDate: '2024-01-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Phòng lớn 1.5tr, miễn Đèn VS, + Tiền nước riêng' },
    { room: '8', name: 'Đỗ Thu Trang', phone: '0909887767', cccd: '079095006544', by: '1995', gender: 'Nữ', home: 'TP.HCM', job: 'Kinh doanh online', plate: '59X3-125.44', rep: 0, inDate: '2024-01-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Vợ anh Quân' },
  ];

  for (const t of prop1Tenants) {
    insertTenant.run(
      prop1Id, prop1RoomIds[t.room], t.name, t.phone, t.cccd, t.by, t.gender,
      t.home, t.job, t.plate, t.rep, t.inDate, t.outDate, t.status, t.active, t.note
    );
  }

  // Seed Tenants for Property 2 (219 Nguyễn Văn Tăng) matching exact occupant counts in T10/2025:
  // P1: 2, P2: 2, P3: 2, P4: 3, P5: 3, P6: 3, P7: 2, P8: 1 (with 1 moved out after T9/2025)
  const prop2Tenants = [
    // Phòng 1 (2 người)
    { room: '1', name: 'Lê Văn Khoa', phone: '0903111221', cccd: '075098002101', by: '1998', gender: 'Nam', home: 'Đồng Nai', job: 'Kỹ sư phần mềm Samsung', plate: '60F1-129.81', rep: 1, inDate: '2024-02-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện P1' },
    { room: '1', name: 'Lê Văn Khôi', phone: '0903111222', cccd: '075202002102', by: '2002', gender: 'Nam', home: 'Đồng Nai', job: 'Sinh viên ĐH FPT', plate: '60F1-552.10', rep: 0, inDate: '2024-09-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Em trai anh Khoa' },
    // Phòng 2 (2 người)
    { room: '2', name: 'Phan Thanh Tùng', phone: '0918222331', cccd: '082096003201', by: '1996', gender: 'Nam', home: 'Tiền Giang', job: 'Chuyên viên Logistics', plate: '63B9-778.12', rep: 1, inDate: '2023-10-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện P2' },
    { room: '2', name: 'Nguyễn Ngọc Trâm', phone: '0918222332', cccd: '082098003202', by: '1998', gender: 'Nữ', home: 'Tiền Giang', job: 'Nhân viên thiết kế', plate: '63B9-301.44', rep: 0, inDate: '2023-10-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Vợ anh Tùng' },
    // Phòng 3 (2 người)
    { room: '3', name: 'Đinh Công Vinh', phone: '0938333441', cccd: '051099004301', by: '1999', gender: 'Nam', home: 'Quảng Ngãi', job: 'Kỹ thuật viên điện lạnh', plate: '76E1-443.29', rep: 1, inDate: '2024-04-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện P3' },
    { room: '3', name: 'Trần Quốc Toản', phone: '0938333442', cccd: '051199004302', by: '1999', gender: 'Nam', home: 'Quảng Ngãi', job: 'Nhân viên bảo trì', plate: '76E1-612.08', rep: 0, inDate: '2024-04-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Bạn cùng quê' },
    // Phòng 4 (3 người - tăng từ 2 lên 3 vào T10/2025)
    { room: '4', name: 'Vũ Minh Đức', phone: '0972444551', cccd: '036097005401', by: '1997', gender: 'Nam', home: 'Nam Định', job: 'Trưởng ca kho vận', plate: '18B2-901.15', rep: 1, inDate: '2024-01-15', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện P4' },
    { room: '4', name: 'Phạm Thu Phương', phone: '0972444552', cccd: '036099005402', by: '1999', gender: 'Nữ', home: 'Nam Định', job: 'Nhân viên QC KCN Cao', plate: '18B2-415.77', rep: 0, inDate: '2024-01-15', outDate: '', status: 'REGISTERED', active: 1, note: 'Vợ anh Đức' },
    { room: '4', name: 'Vũ Thị Lan Anh', phone: '0972444553', cccd: '036205005403', by: '2005', gender: 'Nữ', home: 'Nam Định', job: 'Sinh viên ĐH Quốc Gia', plate: '', rep: 0, inDate: '2025-10-01', outDate: '', status: 'PENDING', active: 1, note: 'Em gái mới vào ở từ T10/2025 (tăng lên 3 người)' },
    // Phòng 5 (3 người - tăng từ 2 lên 3 vào T10/2025)
    { room: '5', name: 'Hồ Tấn Phát', phone: '0989555661', cccd: '056095006501', by: '1995', gender: 'Nam', home: 'Khánh Hòa', job: 'Kỹ sư xây dựng', plate: '79N2-883.19', rep: 1, inDate: '2024-05-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện P5' },
    { room: '5', name: 'Nguyễn Hoàng Long', phone: '0989555662', cccd: '056098006502', by: '1998', gender: 'Nam', home: 'Khánh Hòa', job: 'Kiến trúc sư', plate: '79N2-221.04', rep: 0, inDate: '2024-05-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Đồng nghiệp' },
    { room: '5', name: 'Trần Nhật Minh', phone: '0989555663', cccd: '056203006503', by: '2003', gender: 'Nam', home: 'Khánh Hòa', job: 'Thực tập sinh kỹ thuật', plate: '79N2-910.55', rep: 0, inDate: '2025-10-01', outDate: '', status: 'PENDING', active: 1, note: 'Mới vào ở ghép từ T10/2025 (tăng lên 3 người)' },
    // Phòng 6 (3 người ổn định từ T6..T10/2025)
    { room: '6', name: 'Đoàn Văn Hậu', phone: '0905666771', cccd: '060093007601', by: '1993', gender: 'Nam', home: 'Bình Thuận', job: 'Quản lý cửa hàng', plate: '86B3-556.12', rep: 1, inDate: '2023-08-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện P6' },
    { room: '6', name: 'Lê Thị Bích Ngọc', phone: '0905666772', cccd: '060095007602', by: '1995', gender: 'Nữ', home: 'Bình Thuận', job: 'Dược sĩ nhà thuốc', plate: '86B3-712.90', rep: 0, inDate: '2023-08-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Vợ anh Hậu' },
    { room: '6', name: 'Lê Thị Bích Thủy', phone: '0905666773', cccd: '060201007603', by: '2001', gender: 'Nữ', home: 'Bình Thuận', job: 'Nhân viên chăm sóc khách hàng', plate: '86B3-109.33', rep: 0, inDate: '2024-02-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Em gái chị Ngọc' },
    // Phòng 7 (2 người - T7..T9: 1 người, T10: thêm 1 người = 2 người)
    { room: '7', name: 'Mai Xuân Trường', phone: '0946777881', cccd: '044200008701', by: '2000', gender: 'Nam', home: 'Quảng Bình', job: 'Chuyên viên IT Helpdesk', plate: '73F1-332.18', rep: 1, inDate: '2025-07-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Thuê mới từ T7/2025' },
    { room: '7', name: 'Mai Xuân Thắng', phone: '0946777882', cccd: '044204008702', by: '2004', gender: 'Nam', home: 'Quảng Bình', job: 'Sinh viên ĐH Hutech', plate: '73F1-609.41', rep: 0, inDate: '2025-10-01', outDate: '', status: 'PENDING', active: 1, note: 'Em ruột vào ở từ T10/2025' },
    // Phòng 8 (1 người đang ở, 1 người đã chuyển đi cuối T9/2025)
    { room: '8', name: 'Trịnh Hoàng Phúc', phone: '0912888991', cccd: '077094009801', by: '1994', gender: 'Nam', home: 'Bà Rịa - Vũng Tàu', job: 'Kỹ sư tự động hóa', plate: '72C1-889.01', rep: 1, inDate: '2024-01-01', outDate: '', status: 'REGISTERED', active: 1, note: 'Đại diện P8 (T10/2025 ở 1 mình)' },
    { room: '8', name: 'Nguyễn Quốc Việt', phone: '0912888992', cccd: '077096009802', by: '1996', gender: 'Nam', home: 'Bà Rịa - Vũng Tàu', job: 'Kỹ sư cầu đường', plate: '72C1-451.22', rep: 0, inDate: '2024-01-01', outDate: '2025-09-30', status: 'EXPIRED', active: 0, note: 'Chuyển công tác cuối T9/2025 (giảm từ 2 xuống 1 người)' },
  ];

  for (const t of prop2Tenants) {
    insertTenant.run(
      prop2Id, prop2RoomIds[t.room], t.name, t.phone, t.cccd, t.by, t.gender,
      t.home, t.job, t.plate, t.rep, t.inDate, t.outDate, t.status, t.active, t.note
    );
  }

  // Seed Invoices from Excel
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      property_id, room_id, month, year, sheet_code, occupant_count, vehicle_count,
      elec_old, elec_new, elec_rate, elec_amount,
      water_mode, water_old, water_new, water_rate, water_amount,
      trash_amount, lighting_amount, wifi_amount, parking_amount,
      extra_fees_json, extra_fees_amount, room_rent, previous_debt, discount_amount,
      total_amount, excel_original_total, payment_status, paid_amount, paid_date, payment_method, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // --- PROPERTY 1: NHÀ TRỌ 26 ĐƯỜNG 4 ---
  // Tháng 12/2025 (Sheet T11_2025) - Khởi tạo chỉ số đầu
  const p1_m12_2025 = [
    { r: '1', occ: 2, eOld: 0, eNew: 5341, eAmt: 24034500, wOld: 0, wNew: 565, wAmt: 15255000, trash: 40000, rent: 1000000, light: 0, origTotal: 40329500, note: 'Bản ghi chốt số đồng hồ gốc T12/2025' },
    { r: '2', occ: 2, eOld: 0, eNew: 5192, eAmt: 23364000, wOld: 0, wNew: 643, wAmt: 17361000, trash: 40000, rent: 1000000, light: 0, origTotal: 41765000, note: 'Bản ghi chốt số đồng hồ gốc T12/2025' },
    { r: '3', occ: 1, eOld: 0, eNew: 2812, eAmt: 12654000, wOld: 0, wNew: 481, wAmt: 12987000, trash: 40000, rent: 1000000, light: 0, origTotal: 26681000, note: 'Bản ghi chốt số đồng hồ gốc T12/2025' },
    { r: '4', occ: 1, eOld: 0, eNew: 0,    eAmt: 0,        wOld: 0, wNew: 0,   wAmt: 0,        trash: 40000, rent: 1000000, light: 0, origTotal: 1040000,  note: '' },
    { r: '5', occ: 2, eOld: 0, eNew: 2757, eAmt: 12406500, wOld: 0, wNew: 600, wAmt: 16200000, trash: 40000, rent: 1000000, light: 0, origTotal: 29646500, note: 'Bản ghi chốt số đồng hồ gốc T12/2025' },
    { r: '6', occ: 3, eOld: 0, eNew: 3808, eAmt: 17136000, wOld: 0, wNew: 716, wAmt: 19332000, trash: 40000, rent: 1000000, light: 0, origTotal: 37508000, note: 'Bản ghi chốt số đồng hồ gốc T12/2025' },
    { r: '7', occ: 2, eOld: 0, eNew: 3362, eAmt: 15129000, wOld: 0, wNew: 289, wAmt: 7803000,  trash: 40000, rent: 1000000, light: 0, origTotal: 23972000, note: 'Bản ghi chốt số đồng hồ gốc T12/2025' },
    { r: '8', occ: 2, eOld: 0, eNew: 4528, eAmt: 20376000, wOld: 0, wNew: 0,   wAmt: 0,        trash: 40000, rent: 1500000, light: 0, origTotal: 21916000, note: 'Bản ghi chốt số đồng hồ gốc T12/2025' },
  ];
  for (const row of p1_m12_2025) {
    const calcTotal = row.eAmt + row.wAmt + row.trash + row.light + row.rent;
    insertInvoice.run(
      prop1Id, prop1RoomIds[row.r], 12, 2025, 'T11_2025', row.occ, row.occ,
      row.eOld, row.eNew, 4500, row.eAmt,
      'BY_METER', row.wOld, row.wNew, 27000, row.wAmt,
      row.trash, row.light, 0, 0, '[]', 0, row.rent, 0, 0,
      calcTotal, row.origTotal, 'PAID', calcTotal, '2025-12-05', 'TRANSFER', row.note
    );
  }

  // Tháng 1/2026 (Sheet T12_2025)
  const p1_m1_2026 = [
    { r: '1', occ: 2, eOld: 5341, eNew: 5413, eAmt: 324000, wOld: 565, wNew: 568, wAmt: 81000,  trash: 40000, rent: 1000000, light: 25000, origTotal: 1470000, note: '' },
    { r: '2', occ: 2, eOld: 5192, eNew: 5321, eAmt: 580500, wOld: 643, wNew: 651, wAmt: 216000, trash: 40000, rent: 1000000, light: 25000, origTotal: 1836500, note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '3', occ: 1, eOld: 2812, eNew: 2821, eAmt: 40500,  wOld: 481, wNew: 481, wAmt: 0,      trash: 40000, rent: 1000000, light: 25000, origTotal: 1080500, note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '4', occ: 1, eOld: 0,    eNew: 0,    eAmt: 0,      wOld: 0,   wNew: 0,   wAmt: 0,      trash: 40000, rent: 1000000, light: 25000, origTotal: 1040000, note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '5', occ: 2, eOld: 2757, eNew: 2832, eAmt: 337500, wOld: 600, wNew: 607, wAmt: 189000, trash: 40000, rent: 1000000, light: 25000, origTotal: 1566500, note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '6', occ: 3, eOld: 3808, eNew: 3845, eAmt: 166500, wOld: 716, wNew: 730, wAmt: 378000, trash: 40000, rent: 1000000, light: 25000, origTotal: 1584500, note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '7', occ: 2, eOld: 3362, eNew: 3434, eAmt: 324000, wOld: 289, wNew: 290, wAmt: 27000,  trash: 40000, rent: 1000000, light: 25000, origTotal: 1391000, note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '8', occ: 2, eOld: 4528, eNew: 4545, eAmt: 76500,  wOld: 0,   wNew: 0,   wAmt: 0,      trash: 40000, rent: 1500000, light: 0,     origTotal: 1616500, note: '' },
  ];
  for (const row of p1_m1_2026) {
    const calcTotal = row.eAmt + row.wAmt + row.trash + row.light + row.rent;
    insertInvoice.run(
      prop1Id, prop1RoomIds[row.r], 1, 2026, 'T12_2025', row.occ, row.occ,
      row.eOld, row.eNew, 4500, row.eAmt,
      'BY_METER', row.wOld, row.wNew, 27000, row.wAmt,
      row.trash, row.light, 0, 0, '[]', 0, row.rent, 0, 0,
      calcTotal, row.origTotal, 'PAID', calcTotal, '2026-01-05', 'TRANSFER', row.note
    );
  }

  // Tháng 2/2026 (Sheet T1_2026)
  const p1_m2_2026 = [
    { r: '1', occ: 2, eOld: 5413, eNew: 5458, eAmt: 202500, wOld: 568, wNew: 571, wAmt: 81000,  trash: 40000, rent: 1000000, light: 25000, origTotal: 1348500, status: 'PAID', note: '' },
    { r: '2', occ: 2, eOld: 5321, eNew: 5401, eAmt: 360000, wOld: 651, wNew: 655, wAmt: 108000, trash: 40000, rent: 1000000, light: 25000, origTotal: 1508000, status: 'PAID', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '3', occ: 1, eOld: 2821, eNew: 2826, eAmt: 22500,  wOld: 481, wNew: 482, wAmt: 27000,  trash: 40000, rent: 1000000, light: 25000, origTotal: 1089500, status: 'PAID', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '4', occ: 0, eOld: 0,    eNew: 0,    eAmt: 0,      wOld: 0,   wNew: 0,   wAmt: 0,      trash: 0,     rent: 0,       light: 0,     origTotal: 0,       status: 'VACANT', note: 'Phòng trống' },
    { r: '5', occ: 2, eOld: 2832, eNew: 2879, eAmt: 211500, wOld: 607, wNew: 611, wAmt: 108000, trash: 40000, rent: 1000000, light: 25000, origTotal: 1359500, status: 'PAID', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '6', occ: 3, eOld: 3845, eNew: 3870, eAmt: 112500, wOld: 730, wNew: 741, wAmt: 297000, trash: 40000, rent: 1000000, light: 25000, origTotal: 1449500, status: 'PAID', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '7', occ: 2, eOld: 3434, eNew: 3481, eAmt: 211500, wOld: 290, wNew: 290, wAmt: 0,      trash: 40000, rent: 1000000, light: 25000, origTotal: 1251500, status: 'PAID', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '8', occ: 2, eOld: 4545, eNew: 4557, eAmt: 54000,  wOld: 0,   wNew: 0,   wAmt: 0,      trash: 40000, rent: 1500000, light: 0,     origTotal: 1594000, status: 'PAID', note: '+ TIỀN NƯỚC' },
  ];
  for (const row of p1_m2_2026) {
    const calcTotal = row.eAmt + row.wAmt + row.trash + row.light + row.rent;
    insertInvoice.run(
      prop1Id, prop1RoomIds[row.r], 2, 2026, 'T1_2026', row.occ, row.occ,
      row.eOld, row.eNew, 4500, row.eAmt,
      'BY_METER', row.wOld, row.wNew, 27000, row.wAmt,
      row.trash, row.light, 0, 0, '[]', 0, row.rent, 0, 0,
      calcTotal, row.origTotal, row.status, calcTotal, row.status === 'PAID' ? '2026-02-05' : '', 'TRANSFER', row.note
    );
  }

  // Tháng 3/2026 (Sheet T2_2026 - Kỳ hiện tại mới nhất của Khu 1)
  const p1_m3_2026 = [
    { r: '1', occ: 2, eOld: 5458, eNew: 5512, eAmt: 243000, wOld: 571, wNew: 573, wAmt: 54000,  trash: 40000, rent: 1000000, light: 25000, origTotal: 1362000, status: 'PAID', note: '' },
    { r: '2', occ: 2, eOld: 5401, eNew: 5460, eAmt: 265500, wOld: 655, wNew: 659, wAmt: 108000, trash: 40000, rent: 1000000, light: 25000, origTotal: 1413500, status: 'PAID', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '3', occ: 1, eOld: 2826, eNew: 2833, eAmt: 31500,  wOld: 482, wNew: 482, wAmt: 0,      trash: 40000, rent: 1000000, light: 25000, origTotal: 1071500, status: 'UNPAID', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '4', occ: 0, eOld: 0,    eNew: 0,    eAmt: 0,      wOld: 0,   wNew: 0,   wAmt: 0,      trash: 0,     rent: 0,       light: 0,     origTotal: 0,       status: 'VACANT', note: 'Phòng trống' },
    { r: '5', occ: 2, eOld: 2879, eNew: 2913, eAmt: 153000, wOld: 611, wNew: 615, wAmt: 108000, trash: 40000, rent: 1000000, light: 25000, origTotal: 1301000, status: 'PAID', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '6', occ: 3, eOld: 3870, eNew: 3902, eAmt: 144000, wOld: 741, wNew: 752, wAmt: 297000, trash: 40000, rent: 1000000, light: 25000, origTotal: 1481000, status: 'PARTIAL', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '7', occ: 2, eOld: 3481, eNew: 3543, eAmt: 279000, wOld: 290, wNew: 291, wAmt: 27000,  trash: 40000, rent: 1000000, light: 25000, origTotal: 1346000, status: 'PAID', note: 'Excel gốc quên cộng 25,000đ Đèn VS' },
    { r: '8', occ: 2, eOld: 4557, eNew: 4567, eAmt: 45000,  wOld: 0,   wNew: 0,   wAmt: 0,      trash: 40000, rent: 1500000, light: 0,     origTotal: 1585000, status: 'UNPAID', note: '+ TIỀN NƯỚC' },
  ];
  for (const row of p1_m3_2026) {
    const calcTotal = row.eAmt + row.wAmt + row.trash + row.light + row.rent;
    const paidAmt = row.status === 'PAID' ? calcTotal : row.status === 'PARTIAL' ? 1000000 : 0;
    insertInvoice.run(
      prop1Id, prop1RoomIds[row.r], 3, 2026, 'T2_2026', row.occ, row.occ,
      row.eOld, row.eNew, 4500, row.eAmt,
      'BY_METER', row.wOld, row.wNew, 27000, row.wAmt,
      row.trash, row.light, 0, 0, '[]', 0, row.rent, 0, 0,
      calcTotal, row.origTotal, row.status, paidAmt, row.status === 'PAID' ? '2026-03-05' : '', 'TRANSFER', row.note
    );
  }

  // --- PROPERTY 2: NHÀ TRỌ 219 NGUYỄN VĂN TĂNG (Tính Nước theo đầu người: 30,000đ/người) ---
  const prop2Sheets: Array<{
    month: number;
    year: number;
    code: string;
    rows: Array<{ r: string; eOld: number; eNew: number; eAmt: number; occ: number; wAmt: number; trash: number; rent: number; total: number; status?: string }>;
  }> = [
    {
      month: 6, year: 2025, code: 'T6_2025',
      rows: [
        { r: '1', eOld: 1411, eNew: 1487, eAmt: 266000, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2656000 },
        { r: '2', eOld: 2789, eNew: 2789, eAmt: 0,      occ: 2, wAmt: 60000, trash: 30000, rent: 2400000, total: 2490000 },
        { r: '3', eOld: 1906, eNew: 1998, eAmt: 322000, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2712000 },
        { r: '4', eOld: 1481, eNew: 1481, eAmt: 0,      occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2390000 },
        { r: '5', eOld: 5400, eNew: 5476, eAmt: 266000, occ: 2, wAmt: 60000, trash: 30000, rent: 2400000, total: 2756000 },
        { r: '6', eOld: 3492, eNew: 3492, eAmt: 0,      occ: 3, wAmt: 90000, trash: 30000, rent: 2500000, total: 2620000 },
        { r: '7', eOld: 449,  eNew: 449,  eAmt: 0,      occ: 0, wAmt: 0,     trash: 0,     rent: 0,       total: 0, status: 'VACANT' },
        { r: '8', eOld: 4748, eNew: 4912, eAmt: 574000, occ: 2, wAmt: 60000, trash: 30000, rent: 2500000, total: 3164000 },
      ]
    },
    {
      month: 7, year: 2025, code: 'T7_2025',
      rows: [
        { r: '1', eOld: 1487, eNew: 1560, eAmt: 255500, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2645500 },
        { r: '2', eOld: 2789, eNew: 2865, eAmt: 266000, occ: 2, wAmt: 60000, trash: 30000, rent: 2400000, total: 2756000 },
        { r: '3', eOld: 1998, eNew: 2083, eAmt: 297500, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2687500 },
        { r: '4', eOld: 1481, eNew: 1481, eAmt: 0,      occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2390000 },
        { r: '5', eOld: 5476, eNew: 5563, eAmt: 304500, occ: 2, wAmt: 60000, trash: 30000, rent: 2400000, total: 2794500 },
        { r: '6', eOld: 3492, eNew: 3549, eAmt: 199500, occ: 3, wAmt: 90000, trash: 30000, rent: 2500000, total: 2819500 },
        { r: '7', eOld: 449,  eNew: 452,  eAmt: 10500,  occ: 1, wAmt: 30000, trash: 30000, rent: 1800000, total: 1870500 },
        { r: '8', eOld: 4912, eNew: 5062, eAmt: 525000, occ: 2, wAmt: 60000, trash: 30000, rent: 2500000, total: 3115000 },
      ]
    },
    {
      month: 8, year: 2025, code: 'T8_2025',
      rows: [
        { r: '1', eOld: 1560, eNew: 1635, eAmt: 262500, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2652500 },
        { r: '2', eOld: 2865, eNew: 2934, eAmt: 241500, occ: 2, wAmt: 60000, trash: 30000, rent: 2400000, total: 2731500 },
        { r: '3', eOld: 2083, eNew: 2159, eAmt: 266000, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2656000 },
        { r: '4', eOld: 1481, eNew: 1569, eAmt: 308000, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2698000 },
        { r: '5', eOld: 5563, eNew: 5599, eAmt: 126000, occ: 2, wAmt: 60000, trash: 30000, rent: 2400000, total: 2616000 },
        { r: '6', eOld: 3549, eNew: 3614, eAmt: 227500, occ: 3, wAmt: 90000, trash: 30000, rent: 2500000, total: 2847500 },
        { r: '7', eOld: 452,  eNew: 473,  eAmt: 73500,  occ: 1, wAmt: 30000, trash: 30000, rent: 1800000, total: 1933500 },
        { r: '8', eOld: 5062, eNew: 5219, eAmt: 549500, occ: 2, wAmt: 60000, trash: 30000, rent: 2500000, total: 3139500 },
      ]
    },
    {
      month: 9, year: 2025, code: 'T9_2025',
      rows: [
        { r: '1', eOld: 1680, eNew: 1681, eAmt: 3500,   occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2393500 },
        { r: '2', eOld: 2934, eNew: 3023, eAmt: 311500, occ: 2, wAmt: 60000, trash: 30000, rent: 2400000, total: 2801500 },
        { r: '3', eOld: 2159, eNew: 2247, eAmt: 308000, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2698000 },
        { r: '4', eOld: 1569, eNew: 1674, eAmt: 367500, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2757500 },
        { r: '5', eOld: 5599, eNew: 5612, eAmt: 45500,  occ: 2, wAmt: 60000, trash: 30000, rent: 2400000, total: 2535500 },
        { r: '6', eOld: 3614, eNew: 3685, eAmt: 248500, occ: 3, wAmt: 90000, trash: 30000, rent: 2500000, total: 2868500 },
        { r: '7', eOld: 479,  eNew: 508,  eAmt: 101500, occ: 1, wAmt: 30000, trash: 30000, rent: 1800000, total: 1961500 },
        { r: '8', eOld: 5219, eNew: 5391, eAmt: 602000, occ: 2, wAmt: 60000, trash: 30000, rent: 2500000, total: 3192000 },
      ]
    },
    {
      month: 10, year: 2025, code: 'T10_2025',
      rows: [
        { r: '1', eOld: 1681, eNew: 1817, eAmt: 476000, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2866000, status: 'PAID' },
        { r: '2', eOld: 3023, eNew: 3102, eAmt: 276500, occ: 2, wAmt: 60000, trash: 30000, rent: 2400000, total: 2766500, status: 'PAID' },
        { r: '3', eOld: 2247, eNew: 2337, eAmt: 315000, occ: 2, wAmt: 60000, trash: 30000, rent: 2300000, total: 2705000, status: 'PAID' },
        { r: '4', eOld: 1674, eNew: 1811, eAmt: 479500, occ: 3, wAmt: 90000, trash: 30000, rent: 2300000, total: 2899500, status: 'UNPAID' },
        { r: '5', eOld: 5612, eNew: 5700, eAmt: 308000, occ: 3, wAmt: 90000, trash: 30000, rent: 2400000, total: 2828000, status: 'PAID' },
        { r: '6', eOld: 3685, eNew: 3753, eAmt: 238000, occ: 3, wAmt: 90000, trash: 30000, rent: 2500000, total: 2858000, status: 'PARTIAL' },
        { r: '7', eOld: 508,  eNew: 571,  eAmt: 220500, occ: 2, wAmt: 60000, trash: 30000, rent: 1800000, total: 2110500, status: 'PAID' },
        { r: '8', eOld: 5434, eNew: 5434, eAmt: 0,      occ: 1, wAmt: 30000, trash: 30000, rent: 2500000, total: 2560000, status: 'UNPAID' },
      ]
    }
  ];

  for (const sheet of prop2Sheets) {
    for (const row of sheet.rows) {
      const st = row.status || 'PAID';
      const paidAmt = st === 'PAID' ? row.total : st === 'PARTIAL' ? 2000000 : 0;
      insertInvoice.run(
        prop2Id, prop2RoomIds[row.r], sheet.month, sheet.year, sheet.code, row.occ, row.occ,
        row.eOld, row.eNew, 3500, row.eAmt,
        'PER_PERSON', 0, 0, 30000, row.wAmt,
        row.trash, 0, 0, 0, '[]', 0, row.rent, 0, 0,
        row.total, row.total, st, paidAmt, st === 'PAID' ? `${sheet.year}-${String(sheet.month).padStart(2, '0')}-05` : '', 'CASH', ''
      );
    }
  }
}

export function seedUsersIfEmpty(db: DatabaseSync) {
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password_hash, full_name, role, phone, email, property_id, room_id, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Admin (Chủ nhà)
  insertUser.run(
    'admin',
    hashPassword('admin123'),
    'Đặng Thị Thu Thảo (Chủ nhà)',
    'ADMIN',
    '0901234567',
    'chutro@nhatro.com',
    null,
    null,
    null
  );

  // 2. Manager (Quản lý)
  insertUser.run(
    'quanly',
    hashPassword('quanly123'),
    'Trần Văn Quản Lý',
    'MANAGER',
    '0909888999',
    'quanly@nhatro.com',
    null,
    null,
    null
  );

  // 3. Khách thuê (Tenants)
  try {
    const tenants = db
      .prepare("SELECT id, property_id, room_id, full_name, phone FROM tenants WHERE length(trim(COALESCE(phone, ''))) > 0")
      .all() as Record<string, unknown>[];
    for (const t of tenants) {
      const phone = String(t.phone || '').trim();
      if (!phone) continue;
      try {
        insertUser.run(
          phone,
          hashPassword('123456'),
          String(t.full_name),
          'TENANT',
          phone,
          '',
          Number(t.property_id),
          Number(t.room_id),
          Number(t.id)
        );
      } catch {
        // Skip duplicate username if any
      }
    }
  } catch (err) {
    console.error('Error seeding tenant users:', err);
  }
}

export function getAllUsers(): User[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, username, full_name, role, phone, email, property_id, room_id, tenant_id, created_at
    FROM users
    ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'MANAGER' THEN 2 ELSE 3 END, id ASC
  `).all() as Record<string, unknown>[];

  return rows.map((u) => ({
    id: Number(u.id),
    username: String(u.username),
    fullName: String(u.full_name),
    role: String(u.role) as UserRole,
    phone: String(u.phone || ''),
    email: String(u.email || ''),
    propertyId: u.property_id !== null ? Number(u.property_id) : null,
    roomId: u.room_id !== null ? Number(u.room_id) : null,
    tenantId: u.tenant_id !== null ? Number(u.tenant_id) : null,
    createdAt: String(u.created_at || ''),
  }));
}

export function findUserByUsernameOrPhone(identifier: string): (User & { passwordHash: string }) | null {
  const db = getDb();
  const clean = identifier.trim();
  const row = db.prepare(`
    SELECT * FROM users
    WHERE username = ? OR (trim(phone) != '' AND phone = ?)
    LIMIT 1
  `).get(clean, clean) as Record<string, unknown> | undefined;

  if (!row) {
    const tenantRow = db.prepare(`
      SELECT * FROM tenants
      WHERE phone = ? AND is_active = 1
      LIMIT 1
    `).get(clean) as Record<string, unknown> | undefined;

    if (tenantRow) {
      const passHash = hashPassword('123456');
      const res = db.prepare(`
        INSERT INTO users (username, password_hash, full_name, role, phone, email, property_id, room_id, tenant_id)
        VALUES (?, ?, ?, 'TENANT', ?, '', ?, ?, ?)
      `).run(
        clean,
        passHash,
        String(tenantRow.full_name),
        clean,
        Number(tenantRow.property_id),
        Number(tenantRow.room_id),
        Number(tenantRow.id)
      );
      return {
        id: Number(res.lastInsertRowid),
        username: clean,
        fullName: String(tenantRow.full_name),
        role: 'TENANT',
        phone: clean,
        email: '',
        propertyId: Number(tenantRow.property_id),
        roomId: Number(tenantRow.room_id),
        tenantId: Number(tenantRow.id),
        createdAt: new Date().toISOString(),
        passwordHash: passHash,
      };
    }
    return null;
  }

  return {
    id: Number(row.id),
    username: String(row.username),
    fullName: String(row.full_name),
    role: String(row.role) as UserRole,
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    propertyId: row.property_id !== null ? Number(row.property_id) : null,
    roomId: row.room_id !== null ? Number(row.room_id) : null,
    tenantId: row.tenant_id !== null ? Number(row.tenant_id) : null,
    createdAt: String(row.created_at || ''),
    passwordHash: String(row.password_hash),
  };
}

export function findUserById(id: number): User | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, username, full_name, role, phone, email, property_id, room_id, tenant_id, created_at
    FROM users WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!row) return null;
  return {
    id: Number(row.id),
    username: String(row.username),
    fullName: String(row.full_name),
    role: String(row.role) as UserRole,
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    propertyId: row.property_id !== null ? Number(row.property_id) : null,
    roomId: row.room_id !== null ? Number(row.room_id) : null,
    tenantId: row.tenant_id !== null ? Number(row.tenant_id) : null,
    createdAt: String(row.created_at || ''),
  };
}

export function createUser(data: {
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  email?: string;
  propertyId?: number | null;
  roomId?: number | null;
  tenantId?: number | null;
}): User {
  const db = getDb();
  const passHash = hashPassword(data.password);
  const res = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, phone, email, property_id, room_id, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.username.trim(),
    passHash,
    data.fullName.trim(),
    data.role,
    (data.phone || '').trim(),
    (data.email || '').trim(),
    data.propertyId ?? null,
    data.roomId ?? null,
    data.tenantId ?? null
  );

  return findUserById(Number(res.lastInsertRowid))!;
}

export function updateUser(
  id: number,
  data: {
    fullName?: string;
    role?: UserRole;
    phone?: string;
    email?: string;
    propertyId?: number | null;
    roomId?: number | null;
    tenantId?: number | null;
    newPassword?: string;
  }
) {
  const db = getDb();
  if (data.newPassword) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(data.newPassword), id);
  }
  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      role = COALESCE(?, role),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      property_id = ?,
      room_id = ?,
      tenant_id = ?
    WHERE id = ?
  `).run(
    data.fullName ?? null,
    data.role ?? null,
    data.phone ?? null,
    data.email ?? null,
    data.propertyId ?? null,
    data.roomId ?? null,
    data.tenantId ?? null,
    id
  );
}

export function deleteUser(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function getAllData() {
  const db = getDb();

  const propertiesRows = db.prepare('SELECT * FROM properties ORDER BY id ASC').all() as Record<string, unknown>[];
  const properties: Property[] = propertiesRows.map((p) => ({
    id: Number(p.id),
    code: String(p.code),
    name: String(p.name),
    address: String(p.address),
    bankName: String(p.bank_name),
    bankBin: String(p.bank_bin),
    bankAccountNumber: String(p.bank_account_number),
    bankAccountHolder: String(p.bank_account_holder),
    paymentNote: String(p.payment_note),
    generalNote: String(p.general_note),
    electricityRate: Number(p.electricity_rate),
    electricityMode: String(p.electricity_mode) as BillingMode,
    waterRate: Number(p.water_rate),
    waterMode: String(p.water_mode) as BillingMode,
    trashRate: Number(p.trash_rate),
    trashMode: String(p.trash_mode) as BillingMode,
    lightingRate: Number(p.lighting_rate),
    lightingMode: String(p.lighting_mode) as BillingMode,
    wifiRate: Number(p.wifi_rate),
    wifiMode: String(p.wifi_mode) as BillingMode,
    parkingRate: Number(p.parking_rate),
    parkingMode: String(p.parking_mode) as BillingMode,
  }));

  const roomsRows = db.prepare('SELECT * FROM rooms ORDER BY property_id ASC, CAST(room_number AS INTEGER) ASC').all() as Record<string, unknown>[];
  const rooms: Room[] = roomsRows.map((r) => ({
    id: Number(r.id),
    propertyId: Number(r.property_id),
    roomNumber: String(r.room_number),
    oldRoomNumber: String(r.old_room_number || ''),
    baseRent: Number(r.base_rent),
    depositAmount: Number(r.deposit_amount),
    contractStartDate: String(r.contract_start_date),
    contractEndDate: String(r.contract_end_date),
    status: String(r.status) as Room['status'],
    waterModeOverride: String(r.water_mode_override || '') as Room['waterModeOverride'],
    waterRateOverride: r.water_rate_override !== null ? Number(r.water_rate_override) : null,
    lightingModeOverride: String(r.lighting_mode_override || '') as Room['lightingModeOverride'],
    trashModeOverride: String(r.trash_mode_override || '') as Room['trashModeOverride'],
    wifiModeOverride: String(r.wifi_mode_override || '') as Room['wifiModeOverride'],
    parkingModeOverride: String(r.parking_mode_override || '') as Room['parkingModeOverride'],
    currentElecIndex: Number(r.current_elec_index),
    currentWaterIndex: Number(r.current_water_index),
    defaultOccupants: Number(r.default_occupants),
    note: String(r.note || ''),
    contractImagesJson: String(r.contract_images_json || '[]'),
  }));

  const tenantsRows = db.prepare('SELECT * FROM tenants ORDER BY property_id ASC, room_id ASC, is_active DESC, is_representative DESC, id ASC').all() as Record<string, unknown>[];
  const tenants: Tenant[] = tenantsRows.map((t) => ({
    id: Number(t.id),
    propertyId: Number(t.property_id),
    roomId: Number(t.room_id),
    fullName: String(t.full_name),
    phone: String(t.phone || ''),
    cccd: String(t.cccd || ''),
    birthYear: String(t.birth_year || ''),
    gender: String(t.gender || 'Nam') as Tenant['gender'],
    hometown: String(t.hometown || ''),
    occupation: String(t.occupation || ''),
    vehiclePlate: String(t.vehicle_plate || ''),
    isRepresentative: Boolean(t.is_representative),
    moveInDate: String(t.move_in_date || ''),
    moveOutDate: String(t.move_out_date || ''),
    tempResidenceStatus: String(t.temp_residence_status || 'REGISTERED') as Tenant['tempResidenceStatus'],
    isActive: Boolean(t.is_active),
    notes: String(t.notes || ''),
    cccdFrontUrl: String(t.cccd_front_url || ''),
    cccdBackUrl: String(t.cccd_back_url || ''),
    contractImagesJson: String(t.contract_images_json || '[]'),
  }));

  const invoicesRows = db.prepare(`
    SELECT i.*, r.room_number, r.old_room_number
    FROM invoices i
    JOIN rooms r ON r.id = i.room_id
    ORDER BY i.year DESC, i.month DESC, CAST(r.room_number AS INTEGER) ASC
  `).all() as Record<string, unknown>[];

  const invoices: Invoice[] = invoicesRows.map((inv) => ({
    id: Number(inv.id),
    propertyId: Number(inv.property_id),
    roomId: Number(inv.room_id),
    roomNumber: String(inv.room_number),
    oldRoomNumber: String(inv.old_room_number || ''),
    month: Number(inv.month),
    year: Number(inv.year),
    sheetCode: String(inv.sheet_code || ''),
    occupantCount: Number(inv.occupant_count),
    vehicleCount: Number(inv.vehicle_count),
    elecOld: Number(inv.elec_old),
    elecNew: Number(inv.elec_new),
    elecRate: Number(inv.elec_rate),
    elecAmount: Number(inv.elec_amount),
    waterMode: String(inv.water_mode) as BillingMode,
    waterOld: Number(inv.water_old),
    waterNew: Number(inv.water_new),
    waterRate: Number(inv.water_rate),
    waterAmount: Number(inv.water_amount),
    trashAmount: Number(inv.trash_amount),
    lightingAmount: Number(inv.lighting_amount),
    wifiAmount: Number(inv.wifi_amount),
    parkingAmount: Number(inv.parking_amount),
    extraFeesJson: String(inv.extra_fees_json || '[]'),
    extraFeesAmount: Number(inv.extra_fees_amount),
    roomRent: Number(inv.room_rent),
    previousDebt: Number(inv.previous_debt),
    discountAmount: Number(inv.discount_amount),
    totalAmount: Number(inv.total_amount),
    excelOriginalTotal: inv.excel_original_total !== null ? Number(inv.excel_original_total) : null,
    paymentStatus: String(inv.payment_status) as Invoice['paymentStatus'],
    paidAmount: Number(inv.paid_amount),
    paidDate: String(inv.paid_date || ''),
    paymentMethod: String(inv.payment_method || 'TRANSFER') as Invoice['paymentMethod'],
    note: String(inv.note || ''),
  }));

  const users = getAllUsers();

  return { properties, rooms, tenants, invoices, users };
}

function getNeonClient() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  return neon(url);
}

async function ensureNeonSchema(sql: NonNullable<ReturnType<typeof getNeonClient>>) {
  if (neonSchemaReady) return;
  await sql.transaction([
    sql`
      CREATE TABLE IF NOT EXISTS nhatro_sync_state (
        id INTEGER PRIMARY KEY,
        version BIGINT NOT NULL DEFAULT 1,
        sqlite_base64 TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    sql`
      CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        bank_bin TEXT NOT NULL,
        bank_account_number TEXT NOT NULL,
        bank_account_holder TEXT NOT NULL,
        payment_note TEXT NOT NULL,
        general_note TEXT NOT NULL,
        electricity_rate INTEGER NOT NULL,
        electricity_mode TEXT NOT NULL,
        water_rate INTEGER NOT NULL,
        water_mode TEXT NOT NULL,
        trash_rate INTEGER NOT NULL,
        trash_mode TEXT NOT NULL,
        lighting_rate INTEGER NOT NULL,
        lighting_mode TEXT NOT NULL,
        wifi_rate INTEGER NOT NULL,
        wifi_mode TEXT NOT NULL,
        parking_rate INTEGER NOT NULL,
        parking_mode TEXT NOT NULL
      )
    `,
    sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY,
        property_id INTEGER NOT NULL,
        room_number TEXT NOT NULL,
        old_room_number TEXT NOT NULL,
        base_rent INTEGER NOT NULL,
        deposit_amount INTEGER NOT NULL,
        contract_start_date TEXT NOT NULL,
        contract_end_date TEXT NOT NULL,
        status TEXT NOT NULL,
        water_mode_override TEXT NOT NULL,
        water_rate_override INTEGER,
        lighting_mode_override TEXT NOT NULL,
        trash_mode_override TEXT NOT NULL,
        wifi_mode_override TEXT NOT NULL,
        parking_mode_override TEXT NOT NULL,
        current_elec_index INTEGER NOT NULL,
        current_water_index INTEGER NOT NULL,
        default_occupants INTEGER NOT NULL,
        note TEXT NOT NULL,
        contract_images_json TEXT NOT NULL DEFAULT '[]'
      )
    `,
    sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS contract_images_json TEXT NOT NULL DEFAULT '[]'`,
    sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY,
        property_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        cccd TEXT NOT NULL,
        birth_year TEXT NOT NULL,
        gender TEXT NOT NULL,
        hometown TEXT NOT NULL,
        occupation TEXT NOT NULL,
        vehicle_plate TEXT NOT NULL,
        is_representative INTEGER NOT NULL,
        move_in_date TEXT NOT NULL,
        move_out_date TEXT NOT NULL,
        temp_residence_status TEXT NOT NULL,
        is_active INTEGER NOT NULL,
        notes TEXT NOT NULL,
        cccd_front_url TEXT NOT NULL DEFAULT '',
        cccd_back_url TEXT NOT NULL DEFAULT '',
        contract_images_json TEXT NOT NULL DEFAULT '[]'
      )
    `,
    sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cccd_front_url TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cccd_back_url TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contract_images_json TEXT NOT NULL DEFAULT '[]'`,
    sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY,
        property_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        sheet_code TEXT NOT NULL,
        occupant_count INTEGER NOT NULL,
        vehicle_count INTEGER NOT NULL,
        elec_old INTEGER NOT NULL,
        elec_new INTEGER NOT NULL,
        elec_rate INTEGER NOT NULL,
        elec_amount INTEGER NOT NULL,
        water_mode TEXT NOT NULL,
        water_old INTEGER NOT NULL,
        water_new INTEGER NOT NULL,
        water_rate INTEGER NOT NULL,
        water_amount INTEGER NOT NULL,
        trash_amount INTEGER NOT NULL,
        lighting_amount INTEGER NOT NULL,
        wifi_amount INTEGER NOT NULL,
        parking_amount INTEGER NOT NULL,
        extra_fees_json TEXT NOT NULL,
        extra_fees_amount INTEGER NOT NULL,
        room_rent INTEGER NOT NULL,
        previous_debt INTEGER NOT NULL,
        discount_amount INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        excel_original_total INTEGER,
        payment_status TEXT NOT NULL,
        paid_amount INTEGER NOT NULL,
        paid_date TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        note TEXT NOT NULL
      )
    `,
    sql`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        property_id INTEGER,
        room_id INTEGER,
        tenant_id INTEGER,
        created_at TEXT NOT NULL
      )
    `,
  ]);
  neonSchemaReady = true;
}

export async function syncFromNeon(): Promise<void> {
  const sql = getNeonClient();
  if (!sql) return;

  try {
    await ensureNeonSchema(sql);
    const meta = await sql`SELECT version FROM nhatro_sync_state WHERE id = 1`;
    if (meta.length === 0) {
      getDb();
      await syncToNeon();
      return;
    }

    const remoteVersion = Number(meta[0].version || 0);
    if (remoteVersion !== localNeonVersion) {
      const full = await sql`SELECT version, sqlite_base64 FROM nhatro_sync_state WHERE id = 1`;
      if (full.length > 0 && full[0].sqlite_base64) {
        if (dbInstance) {
          try {
            dbInstance.close();
          } catch {
            // ignore close error
          }
          dbInstance = null;
        }
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        for (const ext of ['-wal', '-shm']) {
          const p = DB_PATH + ext;
          if (fs.existsSync(p)) {
            fs.unlinkSync(p);
          }
        }
        const buf = Buffer.from(String(full[0].sqlite_base64), 'base64');
        fs.writeFileSync(DB_PATH, buf);
        getDb();
        localNeonVersion = Number(full[0].version);
      }
    }
  } catch (err) {
    console.error('Error syncing from Neon Postgres:', err);
  }
}

export async function syncToNeon(): Promise<void> {
  const sql = getNeonClient();
  if (!sql) return;

  try {
    await ensureNeonSchema(sql);
    const db = getDb();

    // Remove WAL if any so DB_PATH is 100% self-contained
    const walPath = DB_PATH + '-wal';
    if (fs.existsSync(walPath)) {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        db.exec('PRAGMA journal_mode = DELETE;');
      } catch {
        // ignore
      }
    }

    const base64 = fs.readFileSync(DB_PATH).toString('base64');
    const upserted = await sql`
      INSERT INTO nhatro_sync_state (id, version, sqlite_base64, updated_at)
      VALUES (1, 1, ${base64}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        version = nhatro_sync_state.version + 1,
        sqlite_base64 = EXCLUDED.sqlite_base64,
        updated_at = NOW()
      RETURNING version
    `;
    if (upserted.length > 0) {
      localNeonVersion = Number(upserted[0].version);
    }

    // Mirror relational tables into Neon Postgres for SQL Explorer / external queries
    const props = db.prepare('SELECT * FROM properties').all() as Record<string, unknown>[];
    const rooms = db.prepare('SELECT * FROM rooms').all() as Record<string, unknown>[];
    const tenants = db.prepare('SELECT * FROM tenants').all() as Record<string, unknown>[];
    const invoices = db.prepare('SELECT * FROM invoices').all() as Record<string, unknown>[];
    const users = db.prepare('SELECT * FROM users').all() as Record<string, unknown>[];

    const queries = [
      sql`TRUNCATE TABLE properties, rooms, tenants, invoices, users`,
      ...props.map(
        (p) => sql`
          INSERT INTO properties (
            id, code, name, address, bank_name, bank_bin, bank_account_number, bank_account_holder,
            payment_note, general_note, electricity_rate, electricity_mode, water_rate, water_mode,
            trash_rate, trash_mode, lighting_rate, lighting_mode, wifi_rate, wifi_mode, parking_rate, parking_mode
          ) VALUES (
            ${Number(p.id)}, ${String(p.code)}, ${String(p.name)}, ${String(p.address)},
            ${String(p.bank_name)}, ${String(p.bank_bin)}, ${String(p.bank_account_number)}, ${String(p.bank_account_holder)},
            ${String(p.payment_note)}, ${String(p.general_note)},
            ${Number(p.electricity_rate)}, ${String(p.electricity_mode)},
            ${Number(p.water_rate)}, ${String(p.water_mode)},
            ${Number(p.trash_rate)}, ${String(p.trash_mode)},
            ${Number(p.lighting_rate)}, ${String(p.lighting_mode)},
            ${Number(p.wifi_rate)}, ${String(p.wifi_mode)},
            ${Number(p.parking_rate)}, ${String(p.parking_mode)}
          )
        `
      ),
      ...rooms.map(
        (r) => sql`
          INSERT INTO rooms (
            id, property_id, room_number, old_room_number, base_rent, deposit_amount,
            contract_start_date, contract_end_date, status, water_mode_override, water_rate_override,
            lighting_mode_override, trash_mode_override, wifi_mode_override, parking_mode_override,
            current_elec_index, current_water_index, default_occupants, note, contract_images_json
          ) VALUES (
            ${Number(r.id)}, ${Number(r.property_id)}, ${String(r.room_number)}, ${String(r.old_room_number)},
            ${Number(r.base_rent)}, ${Number(r.deposit_amount)}, ${String(r.contract_start_date)}, ${String(r.contract_end_date)},
            ${String(r.status)}, ${String(r.water_mode_override)},
            ${r.water_rate_override !== null ? Number(r.water_rate_override) : null},
            ${String(r.lighting_mode_override)}, ${String(r.trash_mode_override)},
            ${String(r.wifi_mode_override)}, ${String(r.parking_mode_override)},
            ${Number(r.current_elec_index)}, ${Number(r.current_water_index)}, ${Number(r.default_occupants)},
            ${String(r.note || '')}, ${String(r.contract_images_json || '[]')}
          )
        `
      ),
      ...tenants.map(
        (t) => sql`
          INSERT INTO tenants (
            id, property_id, room_id, full_name, phone, cccd, birth_year, gender,
            hometown, occupation, vehicle_plate, is_representative, move_in_date, move_out_date,
            temp_residence_status, is_active, notes, cccd_front_url, cccd_back_url, contract_images_json
          ) VALUES (
            ${Number(t.id)}, ${Number(t.property_id)}, ${Number(t.room_id)}, ${String(t.full_name)},
            ${String(t.phone)}, ${String(t.cccd)}, ${String(t.birth_year)}, ${String(t.gender)},
            ${String(t.hometown)}, ${String(t.occupation)}, ${String(t.vehicle_plate)},
            ${Number(t.is_representative)}, ${String(t.move_in_date)}, ${String(t.move_out_date)},
            ${String(t.temp_residence_status)}, ${Number(t.is_active)}, ${String(t.notes || '')},
            ${String(t.cccd_front_url || '')}, ${String(t.cccd_back_url || '')}, ${String(t.contract_images_json || '[]')}
          )
        `
      ),
      ...invoices.map(
        (i) => sql`
          INSERT INTO invoices (
            id, property_id, room_id, month, year, sheet_code, occupant_count, vehicle_count,
            elec_old, elec_new, elec_rate, elec_amount, water_mode, water_old, water_new, water_rate, water_amount,
            trash_amount, lighting_amount, wifi_amount, parking_amount, extra_fees_json, extra_fees_amount,
            room_rent, previous_debt, discount_amount, total_amount, excel_original_total,
            payment_status, paid_amount, paid_date, payment_method, note
          ) VALUES (
            ${Number(i.id)}, ${Number(i.property_id)}, ${Number(i.room_id)}, ${Number(i.month)}, ${Number(i.year)},
            ${String(i.sheet_code)}, ${Number(i.occupant_count)}, ${Number(i.vehicle_count)},
            ${Number(i.elec_old)}, ${Number(i.elec_new)}, ${Number(i.elec_rate)}, ${Number(i.elec_amount)},
            ${String(i.water_mode)}, ${Number(i.water_old)}, ${Number(i.water_new)}, ${Number(i.water_rate)}, ${Number(i.water_amount)},
            ${Number(i.trash_amount)}, ${Number(i.lighting_amount)}, ${Number(i.wifi_amount)}, ${Number(i.parking_amount)},
            ${String(i.extra_fees_json)}, ${Number(i.extra_fees_amount)}, ${Number(i.room_rent)},
            ${Number(i.previous_debt)}, ${Number(i.discount_amount)}, ${Number(i.total_amount)},
            ${i.excel_original_total !== null ? Number(i.excel_original_total) : null},
            ${String(i.payment_status)}, ${Number(i.paid_amount)}, ${String(i.paid_date)}, ${String(i.payment_method)}, ${String(i.note)}
          )
        `
      ),
      ...users.map(
        (u) => sql`
          INSERT INTO users (
            id, username, password_hash, full_name, role, phone, email, property_id, room_id, tenant_id, created_at
          ) VALUES (
            ${Number(u.id)}, ${String(u.username)}, ${String(u.password_hash)}, ${String(u.full_name)},
            ${String(u.role)}, ${String(u.phone)}, ${String(u.email)},
            ${u.property_id !== null ? Number(u.property_id) : null},
            ${u.room_id !== null ? Number(u.room_id) : null},
            ${u.tenant_id !== null ? Number(u.tenant_id) : null},
            ${String(u.created_at)}
          )
        `
      ),
    ];

    await sql.transaction(queries);
  } catch (err) {
    console.error('Error syncing to Neon Postgres:', err);
  }
}

