import { NextRequest, NextResponse } from 'next/server';
import {
  getAllData,
  getDb,
  createUser,
  updateUser,
  deleteUser,
  findUserByUsernameOrPhone,
  verifyPassword,
  syncFromNeon,
  syncToNeon,
} from '@/lib/db';
import { BillingMode, ExtraFeeItem } from '@/types/nhatro';

async function syncAndReturnAllData() {
  await syncToNeon();
  return NextResponse.json(getAllData());
}

function calcFeeByMode(
  mode: BillingMode,
  rate: number,
  options: { oldIdx?: number; newIdx?: number; occupants: number; vehicles: number; isVacant: boolean }
): number {
  if (options.isVacant || mode === 'FREE' || rate <= 0) return 0;
  switch (mode) {
    case 'BY_METER': {
      const diff = Math.max(0, (options.newIdx ?? 0) - (options.oldIdx ?? 0));
      return diff * rate;
    }
    case 'PER_PERSON':
      return Math.max(0, options.occupants) * rate;
    case 'PER_QUANTITY':
      return Math.max(0, options.vehicles) * rate;
    case 'FIXED_PER_ROOM':
      return rate;
    default:
      return 0;
  }
}

function recalcRoomOccupants(propertyId: number, roomId: number) {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) as cnt FROM tenants WHERE room_id = ? AND is_active = 1')
    .get(roomId) as { cnt: number };
  const activeCount = Number(row.cnt || 0);
  db.prepare('UPDATE rooms SET default_occupants = ?, status = ? WHERE id = ? AND property_id = ?').run(
    activeCount,
    activeCount > 0 ? 'OCCUPIED' : 'VACANT',
    roomId,
    propertyId
  );
  return activeCount;
}

export async function GET() {
  try {
    await syncFromNeon();
    const data = getAllData();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await syncFromNeon();
    const body = await req.json();
    const { action } = body;
    const db = getDb();

    if (action === 'update_property') {
      const p = body.property;
      db.prepare(`
        UPDATE properties SET
          name = ?, address = ?,
          bank_name = ?, bank_bin = ?, bank_account_number = ?, bank_account_holder = ?,
          payment_note = ?, general_note = ?,
          electricity_rate = ?, electricity_mode = ?,
          water_rate = ?, water_mode = ?,
          trash_rate = ?, trash_mode = ?,
          lighting_rate = ?, lighting_mode = ?,
          wifi_rate = ?, wifi_mode = ?,
          parking_rate = ?, parking_mode = ?
        WHERE id = ?
      `).run(
        p.name,
        p.address,
        p.bankName,
        p.bankBin || '970436',
        p.bankAccountNumber,
        p.bankAccountHolder,
        p.paymentNote || '',
        p.generalNote || '',
        Number(p.electricityRate || 0),
        p.electricityMode || 'BY_METER',
        Number(p.waterRate || 0),
        p.waterMode || 'BY_METER',
        Number(p.trashRate || 0),
        p.trashMode || 'FIXED_PER_ROOM',
        Number(p.lightingRate || 0),
        p.lightingMode || 'FIXED_PER_ROOM',
        Number(p.wifiRate || 0),
        p.wifiMode || 'FREE',
        Number(p.parkingRate || 0),
        p.parkingMode || 'FREE',
        Number(p.id)
      );
      return await syncAndReturnAllData();
    }

    if (action === 'create_property') {
      const p = body.property;
      const code = 'NT_' + Date.now();
      const res = db.prepare(`
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
      `).run(
        code,
        p.name,
        p.address || '',
        p.bankName || 'VIETCOMBANK',
        p.bankBin || '970436',
        p.bankAccountNumber || '103 1080 474',
        p.bankAccountHolder || 'Đặng Thị Thu Thảo',
        p.paymentNote || '',
        p.generalNote || '',
        Number(p.electricityRate ?? 4000),
        p.electricityMode || 'BY_METER',
        Number(p.waterRate ?? 25000),
        p.waterMode || 'BY_METER',
        Number(p.trashRate ?? 35000),
        p.trashMode || 'FIXED_PER_ROOM',
        Number(p.lightingRate ?? 25000),
        p.lightingMode || 'FIXED_PER_ROOM',
        Number(p.wifiRate ?? 0),
        p.wifiMode || 'FREE',
        Number(p.parkingRate ?? 0),
        p.parkingMode || 'FREE'
      );
      const newPropId = Number(res.lastInsertRowid);
      const roomCount = Number(p.initialRoomCount || 8);
      const baseRent = Number(p.defaultBaseRent || 1500000);
      const insertRoom = db.prepare(`
        INSERT INTO rooms (property_id, room_number, old_room_number, base_rent, deposit_amount, status, default_occupants)
        VALUES (?, ?, ?, ?, ?, 'VACANT', 0)
      `);
      for (let i = 1; i <= roomCount; i++) {
        insertRoom.run(newPropId, String(i), String(i), baseRent, baseRent);
      }
      return await syncAndReturnAllData();
    }

    if (action === 'upsert_room') {
      const r = body.room;
      const contractImagesStr =
        typeof r.contractImagesJson === 'string'
          ? r.contractImagesJson
          : JSON.stringify(r.contractImagesJson || []);
      if (r.id) {
        db.prepare(`
          UPDATE rooms SET
            room_number = ?, old_room_number = ?, base_rent = ?, deposit_amount = ?,
            contract_start_date = ?, contract_end_date = ?, status = ?,
            water_mode_override = ?, water_rate_override = ?,
            lighting_mode_override = ?, trash_mode_override = ?,
            wifi_mode_override = ?, parking_mode_override = ?,
            current_elec_index = ?, current_water_index = ?,
            default_occupants = ?, note = ?, contract_images_json = ?
          WHERE id = ?
        `).run(
          String(r.roomNumber),
          String(r.oldRoomNumber || ''),
          Number(r.baseRent || 0),
          Number(r.depositAmount || 0),
          String(r.contractStartDate || '2025-01-01'),
          String(r.contractEndDate || '2026-12-31'),
          String(r.status || 'OCCUPIED'),
          String(r.waterModeOverride || ''),
          r.waterRateOverride !== null && r.waterRateOverride !== '' ? Number(r.waterRateOverride) : null,
          String(r.lightingModeOverride || ''),
          String(r.trashModeOverride || ''),
          String(r.wifiModeOverride || ''),
          String(r.parkingModeOverride || ''),
          Number(r.currentElecIndex || 0),
          Number(r.currentWaterIndex || 0),
          Number(r.defaultOccupants || 0),
          String(r.note || ''),
          contractImagesStr,
          Number(r.id)
        );
      } else {
        db.prepare(`
          INSERT INTO rooms (
            property_id, room_number, old_room_number, base_rent, deposit_amount,
            contract_start_date, contract_end_date, status,
            water_mode_override, water_rate_override,
            lighting_mode_override, trash_mode_override,
            wifi_mode_override, parking_mode_override,
            current_elec_index, current_water_index, default_occupants, note, contract_images_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          Number(r.propertyId),
          String(r.roomNumber),
          String(r.oldRoomNumber || ''),
          Number(r.baseRent || 1000000),
          Number(r.depositAmount || 1000000),
          String(r.contractStartDate || '2025-01-01'),
          String(r.contractEndDate || '2026-12-31'),
          String(r.status || 'OCCUPIED'),
          String(r.waterModeOverride || ''),
          r.waterRateOverride !== null && r.waterRateOverride !== '' ? Number(r.waterRateOverride) : null,
          String(r.lightingModeOverride || ''),
          String(r.trashModeOverride || ''),
          String(r.wifiModeOverride || ''),
          String(r.parkingModeOverride || ''),
          Number(r.currentElecIndex || 0),
          Number(r.currentWaterIndex || 0),
          Number(r.defaultOccupants || 1),
          String(r.note || ''),
          contractImagesStr
        );
      }
      return await syncAndReturnAllData();
    }

    if (action === 'upsert_tenant') {
      const t = body.tenant;
      const contractImagesStr =
        typeof t.contractImagesJson === 'string'
          ? t.contractImagesJson
          : JSON.stringify(t.contractImagesJson || []);
      if (t.isRepresentative) {
        db.prepare('UPDATE tenants SET is_representative = 0 WHERE room_id = ?').run(Number(t.roomId));
      }
      if (t.id) {
        db.prepare(`
          UPDATE tenants SET
            room_id = ?, full_name = ?, phone = ?, cccd = ?, birth_year = ?, gender = ?,
            hometown = ?, occupation = ?, vehicle_plate = ?, is_representative = ?,
            move_in_date = ?, move_out_date = ?, temp_residence_status = ?, is_active = ?, notes = ?,
            avatar_url = ?, cccd_front_url = ?, cccd_back_url = ?, contract_images_json = ?
          WHERE id = ?
        `).run(
          Number(t.roomId),
          String(t.fullName),
          String(t.phone || ''),
          String(t.cccd || ''),
          String(t.birthYear || ''),
          String(t.gender || 'Nam'),
          String(t.hometown || ''),
          String(t.occupation || ''),
          String(t.vehiclePlate || ''),
          t.isRepresentative ? 1 : 0,
          String(t.moveInDate || ''),
          String(t.moveOutDate || ''),
          String(t.tempResidenceStatus || 'REGISTERED'),
          t.isActive ? 1 : 0,
          String(t.notes || ''),
          String(t.avatarUrl || ''),
          String(t.cccdFrontUrl || ''),
          String(t.cccdBackUrl || ''),
          contractImagesStr,
          Number(t.id)
        );
      } else {
        db.prepare(`
          INSERT INTO tenants (
            property_id, room_id, full_name, phone, cccd, birth_year, gender,
            hometown, occupation, vehicle_plate, is_representative,
            move_in_date, move_out_date, temp_residence_status, is_active, notes,
            avatar_url, cccd_front_url, cccd_back_url, contract_images_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          Number(t.propertyId),
          Number(t.roomId),
          String(t.fullName),
          String(t.phone || ''),
          String(t.cccd || ''),
          String(t.birthYear || ''),
          String(t.gender || 'Nam'),
          String(t.hometown || ''),
          String(t.occupation || ''),
          String(t.vehiclePlate || ''),
          t.isRepresentative ? 1 : 0,
          String(t.moveInDate || new Date().toISOString().slice(0, 10)),
          String(t.moveOutDate || ''),
          String(t.tempResidenceStatus || 'REGISTERED'),
          t.isActive !== false ? 1 : 0,
          String(t.notes || ''),
          String(t.avatarUrl || ''),
          String(t.cccdFrontUrl || ''),
          String(t.cccdBackUrl || ''),
          contractImagesStr
        );
      }
      recalcRoomOccupants(Number(t.propertyId), Number(t.roomId));
      return await syncAndReturnAllData();
    }

    if (action === 'update_tenant_documents') {
      const { tenantId, avatarUrl, cccdFrontUrl, cccdBackUrl, contractImagesJson } = body;
      const existing = db.prepare('SELECT * FROM tenants WHERE id = ?').get(Number(tenantId)) as Record<string, unknown> | undefined;
      if (!existing) {
        return NextResponse.json({ error: 'Không tìm thấy hồ sơ khách thuê' }, { status: 404 });
      }
      const nextAvatar = avatarUrl !== undefined ? String(avatarUrl) : String(existing.avatar_url || '');
      const nextFront = cccdFrontUrl !== undefined ? String(cccdFrontUrl) : String(existing.cccd_front_url || '');
      const nextBack = cccdBackUrl !== undefined ? String(cccdBackUrl) : String(existing.cccd_back_url || '');
      const nextContracts =
        contractImagesJson !== undefined
          ? typeof contractImagesJson === 'string'
            ? contractImagesJson
            : JSON.stringify(contractImagesJson)
          : String(existing.contract_images_json || '[]');

      db.prepare(`
        UPDATE tenants
        SET avatar_url = ?, cccd_front_url = ?, cccd_back_url = ?, contract_images_json = ?
        WHERE id = ?
      `).run(nextAvatar, nextFront, nextBack, nextContracts, Number(tenantId));
      return await syncAndReturnAllData();
    }

    if (action === 'delete_tenant') {
      const { id, propertyId, roomId } = body;
      db.prepare('DELETE FROM tenants WHERE id = ?').run(Number(id));
      recalcRoomOccupants(Number(propertyId), Number(roomId));
      return await syncAndReturnAllData();
    }

    if (action === 'save_invoice') {
      const inv = body.invoice;
      const isVacant = inv.paymentStatus === 'VACANT';
      const elecOld = Number(inv.elecOld || 0);
      const elecNew = Number(inv.elecNew || 0);
      const elecRate = Number(inv.elecRate || 0);
      const elecAmount = isVacant ? 0 : Math.max(0, elecNew - elecOld) * elecRate;

      const waterMode = (inv.waterMode || 'BY_METER') as BillingMode;
      const waterOld = Number(inv.waterOld || 0);
      const waterNew = Number(inv.waterNew || 0);
      const waterRate = Number(inv.waterRate || 0);
      const occupantCount = isVacant ? 0 : Number(inv.occupantCount ?? 0);
      const vehicleCount = isVacant ? 0 : Number(inv.vehicleCount ?? 0);

      const waterAmount = calcFeeByMode(waterMode, waterRate, {
        oldIdx: waterOld,
        newIdx: waterNew,
        occupants: occupantCount,
        vehicles: vehicleCount,
        isVacant,
      });

      const trashAmount = isVacant ? 0 : Number(inv.trashAmount || 0);
      const lightingAmount = isVacant ? 0 : Number(inv.lightingAmount || 0);
      const wifiAmount = isVacant ? 0 : Number(inv.wifiAmount || 0);
      const parkingAmount = isVacant ? 0 : Number(inv.parkingAmount || 0);

      let extraFees: ExtraFeeItem[] = [];
      try {
        extraFees = typeof inv.extraFeesJson === 'string' ? JSON.parse(inv.extraFeesJson) : inv.extraFeesJson || [];
      } catch {
        extraFees = [];
      }
      const extraFeesAmount = isVacant
        ? 0
        : extraFees.reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const roomRent = isVacant ? 0 : Number(inv.roomRent || 0);
      const previousDebt = isVacant ? 0 : Number(inv.previousDebt || 0);
      const discountAmount = isVacant ? 0 : Number(inv.discountAmount || 0);

      const totalAmount = isVacant
        ? 0
        : Math.max(
            0,
            elecAmount +
              waterAmount +
              trashAmount +
              lightingAmount +
              wifiAmount +
              parkingAmount +
              extraFeesAmount +
              roomRent +
              previousDebt -
              discountAmount
          );

      let paidAmount = Number(inv.paidAmount || 0);
      if (inv.paymentStatus === 'PAID') {
        paidAmount = totalAmount;
      } else if (inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'VACANT') {
        paidAmount = 0;
      }

      db.prepare(`
        UPDATE invoices SET
          occupant_count = ?, vehicle_count = ?,
          elec_old = ?, elec_new = ?, elec_rate = ?, elec_amount = ?,
          water_mode = ?, water_old = ?, water_new = ?, water_rate = ?, water_amount = ?,
          trash_amount = ?, lighting_amount = ?, wifi_amount = ?, parking_amount = ?,
          extra_fees_json = ?, extra_fees_amount = ?,
          room_rent = ?, previous_debt = ?, discount_amount = ?,
          total_amount = ?, payment_status = ?, paid_amount = ?, paid_date = ?, payment_method = ?, note = ?
        WHERE id = ?
      `).run(
        occupantCount,
        vehicleCount,
        elecOld,
        elecNew,
        elecRate,
        elecAmount,
        waterMode,
        waterOld,
        waterNew,
        waterRate,
        waterAmount,
        trashAmount,
        lightingAmount,
        wifiAmount,
        parkingAmount,
        JSON.stringify(extraFees),
        extraFeesAmount,
        roomRent,
        previousDebt,
        discountAmount,
        totalAmount,
        inv.paymentStatus,
        paidAmount,
        inv.paidDate || (inv.paymentStatus === 'PAID' ? new Date().toISOString().slice(0, 10) : ''),
        inv.paymentMethod || 'TRANSFER',
        String(inv.note || ''),
        Number(inv.id)
      );

      // Update latest meter indices on the room if this is non-zero
      if (elecNew > 0) {
        db.prepare('UPDATE rooms SET current_elec_index = MAX(current_elec_index, ?) WHERE id = ?').run(
          elecNew,
          Number(inv.roomId)
        );
      }
      if (waterNew > 0) {
        db.prepare('UPDATE rooms SET current_water_index = MAX(current_water_index, ?) WHERE id = ?').run(
          waterNew,
          Number(inv.roomId)
        );
      }

      return await syncAndReturnAllData();
    }

    if (action === 'record_payment') {
      const { invoiceId, paymentStatus, paidAmount, paymentMethod } = body;
      const row = db.prepare('SELECT total_amount FROM invoices WHERE id = ?').get(Number(invoiceId)) as {
        total_amount: number;
      };
      const total = Number(row?.total_amount || 0);
      const finalPaid =
        paymentStatus === 'PAID'
          ? total
          : paymentStatus === 'UNPAID' || paymentStatus === 'VACANT'
          ? 0
          : Number(paidAmount || 0);
      const paidDate = paymentStatus === 'PAID' || paymentStatus === 'PARTIAL' ? new Date().toISOString().slice(0, 10) : '';

      db.prepare(`
        UPDATE invoices
        SET payment_status = ?, paid_amount = ?, paid_date = ?, payment_method = ?
        WHERE id = ?
      `).run(paymentStatus, finalPaid, paidDate, paymentMethod || 'TRANSFER', Number(invoiceId));

      return await syncAndReturnAllData();
    }

    if (action === 'create_month_sheet') {
      const { propertyId, month, year, carryOverDebt } = body;
      const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(Number(propertyId)) as Record<string, unknown>;
      if (!prop) {
        return NextResponse.json({ error: 'Không tìm thấy khu nhà trọ' }, { status: 404 });
      }

      const rooms = db
        .prepare('SELECT * FROM rooms WHERE property_id = ? ORDER BY CAST(room_number AS INTEGER) ASC')
        .all(Number(propertyId)) as Record<string, unknown>[];

      const sheetCode = `T${month}_${year}`;
      const insertInv = db.prepare(`
        INSERT OR REPLACE INTO invoices (
          property_id, room_id, month, year, sheet_code, occupant_count, vehicle_count,
          elec_old, elec_new, elec_rate, elec_amount,
          water_mode, water_old, water_new, water_rate, water_amount,
          trash_amount, lighting_amount, wifi_amount, parking_amount,
          extra_fees_json, extra_fees_amount, room_rent, previous_debt, discount_amount,
          total_amount, excel_original_total, payment_status, paid_amount, paid_date, payment_method, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const r of rooms) {
        const roomId = Number(r.id);
        const isVacant = String(r.status) === 'VACANT';

        // Count active tenants and vehicles in this room
        const tStats = db
          .prepare(`
            SELECT
              COUNT(*) as occ,
              SUM(CASE WHEN trim(vehicle_plate) != '' THEN 1 ELSE 0 END) as veh
            FROM tenants
            WHERE room_id = ? AND is_active = 1
          `)
          .get(roomId) as { occ: number; veh: number | null };

        const occupants = isVacant ? 0 : Number(tStats.occ || r.default_occupants || 1);
        const vehicles = isVacant ? 0 : Number(tStats.veh ?? occupants);

        // Find most recent previous invoice for this room
        const prevInv = db
          .prepare(`
            SELECT * FROM invoices
            WHERE room_id = ? AND (year < ? OR (year = ? AND month < ?))
            ORDER BY year DESC, month DESC
            LIMIT 1
          `)
          .get(roomId, Number(year), Number(year), Number(month)) as Record<string, unknown> | undefined;

        const elecOld = prevInv ? Number(prevInv.elec_new) : Number(r.current_elec_index || 0);
        const elecNew = elecOld;
        const elecRate = Number(prop.electricity_rate || 4500);
        const elecAmount = 0;

        const waterMode = (String(r.water_mode_override || prop.water_mode || 'BY_METER')) as BillingMode;
        const waterRate =
          r.water_rate_override !== null && r.water_rate_override !== undefined
            ? Number(r.water_rate_override)
            : Number(prop.water_rate || 27000);
        const waterOld = prevInv ? Number(prevInv.water_new) : Number(r.current_water_index || 0);
        const waterNew = waterOld;
        const waterAmount = calcFeeByMode(waterMode, waterRate, {
          oldIdx: waterOld,
          newIdx: waterNew,
          occupants,
          vehicles,
          isVacant,
        });

        const trashMode = (String(r.trash_mode_override || prop.trash_mode || 'FIXED_PER_ROOM')) as BillingMode;
        const trashAmount = calcFeeByMode(trashMode, Number(prop.trash_rate || 0), {
          occupants,
          vehicles,
          isVacant,
        });

        const lightingMode = (String(r.lighting_mode_override || prop.lighting_mode || 'FIXED_PER_ROOM')) as BillingMode;
        const lightingAmount = calcFeeByMode(lightingMode, Number(prop.lighting_rate || 0), {
          occupants,
          vehicles,
          isVacant,
        });

        const wifiMode = (String(r.wifi_mode_override || prop.wifi_mode || 'FREE')) as BillingMode;
        const wifiAmount = calcFeeByMode(wifiMode, Number(prop.wifi_rate || 0), {
          occupants,
          vehicles,
          isVacant,
        });

        const parkingMode = (String(r.parking_mode_override || prop.parking_mode || 'FREE')) as BillingMode;
        const parkingAmount = calcFeeByMode(parkingMode, Number(prop.parking_rate || 0), {
          occupants,
          vehicles,
          isVacant,
        });

        const roomRent = isVacant ? 0 : Number(r.base_rent || 0);
        const prevDebt =
          carryOverDebt && prevInv && String(prevInv.payment_status) !== 'PAID' && String(prevInv.payment_status) !== 'VACANT'
            ? Math.max(0, Number(prevInv.total_amount || 0) - Number(prevInv.paid_amount || 0))
            : 0;

        const totalAmount = isVacant
          ? 0
          : elecAmount + waterAmount + trashAmount + lightingAmount + wifiAmount + parkingAmount + roomRent + prevDebt;

        insertInv.run(
          Number(propertyId),
          roomId,
          Number(month),
          Number(year),
          sheetCode,
          occupants,
          vehicles,
          elecOld,
          elecNew,
          elecRate,
          elecAmount,
          waterMode,
          waterOld,
          waterNew,
          waterRate,
          waterAmount,
          trashAmount,
          lightingAmount,
          wifiAmount,
          parkingAmount,
          '[]',
          0,
          roomRent,
          prevDebt,
          0,
          totalAmount,
          null,
          isVacant ? 'VACANT' : 'UNPAID',
          0,
          '',
          'TRANSFER',
          String(r.note || '')
        );
      }

      return await syncAndReturnAllData();
    }

    if (action === 'sync_occupants_to_sheet') {
      const { propertyId, month, year } = body;
      const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(Number(propertyId)) as Record<string, unknown>;
      const invs = db
        .prepare('SELECT * FROM invoices WHERE property_id = ? AND month = ? AND year = ?')
        .all(Number(propertyId), Number(month), Number(year)) as Record<string, unknown>[];

      for (const inv of invs) {
        const roomId = Number(inv.room_id);
        const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as Record<string, unknown>;
        const tStats = db
          .prepare(`
            SELECT
              COUNT(*) as occ,
              SUM(CASE WHEN trim(vehicle_plate) != '' THEN 1 ELSE 0 END) as veh
            FROM tenants
            WHERE room_id = ? AND is_active = 1
          `)
          .get(roomId) as { occ: number; veh: number | null };

        const occ = Number(tStats.occ || 0);
        const veh = Number(tStats.veh || 0);
        const isVacant = occ === 0 && String(room.status) === 'VACANT';
        const waterMode = String(inv.water_mode) as BillingMode;
        const waterRate = Number(inv.water_rate);
        const waterAmount = calcFeeByMode(waterMode, waterRate, {
          oldIdx: Number(inv.water_old),
          newIdx: Number(inv.water_new),
          occupants: occ,
          vehicles: veh,
          isVacant,
        });

        const wifiMode = String(room.wifi_mode_override || prop.wifi_mode || 'FREE') as BillingMode;
        const wifiAmount = calcFeeByMode(wifiMode, Number(prop.wifi_rate || 0), {
          occupants: occ,
          vehicles: veh,
          isVacant,
        });

        const parkingMode = String(room.parking_mode_override || prop.parking_mode || 'FREE') as BillingMode;
        const parkingAmount = calcFeeByMode(parkingMode, Number(prop.parking_rate || 0), {
          occupants: occ,
          vehicles: veh,
          isVacant,
        });

        const totalAmount = isVacant
          ? 0
          : Math.max(
              0,
              Number(inv.elec_amount) +
                waterAmount +
                Number(inv.trash_amount) +
                Number(inv.lighting_amount) +
                wifiAmount +
                parkingAmount +
                Number(inv.extra_fees_amount) +
                Number(inv.room_rent) +
                Number(inv.previous_debt) -
                Number(inv.discount_amount)
            );

        db.prepare(`
          UPDATE invoices
          SET occupant_count = ?, vehicle_count = ?, water_amount = ?, wifi_amount = ?, parking_amount = ?, total_amount = ?
          WHERE id = ?
        `).run(occ, veh, waterAmount, wifiAmount, parkingAmount, totalAmount, Number(inv.id));
      }

      return await syncAndReturnAllData();
    }

    if (action === 'login') {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json(
          { error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' },
          { status: 400 }
        );
      }
      const userWithHash = findUserByUsernameOrPhone(username);
      if (!userWithHash) {
        return NextResponse.json(
          { error: 'Tài khoản hoặc số điện thoại không tồn tại' },
          { status: 401 }
        );
      }
      if (!verifyPassword(password, userWithHash.passwordHash)) {
        return NextResponse.json(
          { error: 'Mật khẩu không chính xác' },
          { status: 401 }
        );
      }
      const { passwordHash: _, ...safeUser } = userWithHash;
      return NextResponse.json({ success: true, user: safeUser });
    }

    if (action === 'create_user') {
      const u = body.user;
      if (!u.username || !u.password || !u.fullName) {
        return NextResponse.json(
          { error: 'Vui lòng điền tên đăng nhập, mật khẩu và họ tên' },
          { status: 400 }
        );
      }
      try {
        createUser({
          username: u.username,
          password: u.password,
          fullName: u.fullName,
          role: u.role || 'TENANT',
          phone: u.phone,
          email: u.email,
          propertyId: u.propertyId ? Number(u.propertyId) : null,
          roomId: u.roomId ? Number(u.roomId) : null,
          tenantId: u.tenantId ? Number(u.tenantId) : null,
        });
        return await syncAndReturnAllData();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi khi tạo tài khoản';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    if (action === 'update_user') {
      const u = body.user;
      updateUser(Number(u.id), {
        fullName: u.fullName,
        role: u.role,
        phone: u.phone,
        email: u.email,
        propertyId: u.propertyId ? Number(u.propertyId) : null,
        roomId: u.roomId ? Number(u.roomId) : null,
        tenantId: u.tenantId ? Number(u.tenantId) : null,
        newPassword: u.newPassword || undefined,
      });
      return await syncAndReturnAllData();
    }

    if (action === 'delete_user') {
      const { id } = body;
      deleteUser(Number(id));
      return await syncAndReturnAllData();
    }

    return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
