import { DocumentImageItem } from '@/types/nhatro';

export function parseDocumentImages(jsonStr: string | undefined | null): DocumentImageItem[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item.dataUrl === 'string' && item.dataUrl.length > 0);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Compress an uploaded image file on the client using HTML5 Canvas.
 * Resizes max width/height to 1280px and encodes as WebP (or JPEG fallback) at 0.80 quality,
 * turning 5-10MB phone photos into ~60-110KB Data URLs for instant database & Neon sync.
 */
export async function compressImageFile(file: File, maxDimension = 1280, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file hình ảnh'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          let compressed = canvas.toDataURL('image/webp', quality);
          if (!compressed.startsWith('data:image/webp')) {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(compressed);
        } catch {
          resolve(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Generates a realistic sample CCCD or Rental Contract image using Canvas
 * so landlords/tenants can also test previewing & storing with 1 click.
 */
export function generateSampleDocumentDataUrl(
  type: 'CCCD_FRONT' | 'CCCD_BACK' | 'CONTRACT',
  meta: {
    fullName?: string;
    cccd?: string;
    birthYear?: string;
    gender?: string;
    hometown?: string;
    roomNumber?: string;
    propertyName?: string;
    baseRent?: number;
  }
): string {
  const canvas = document.createElement('canvas');
  if (type === 'CONTRACT') {
    canvas.width = 720;
    canvas.height = 960;
  } else {
    canvas.width = 760;
    canvas.height = 480;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (type === 'CCCD_FRONT') {
    // Card background
    const grad = ctx.createLinearGradient(0, 0, 760, 480);
    grad.addColorStop(0, '#ecfdf5');
    grad.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 760, 480);

    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 736, 456);

    // Header
    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 430, 56);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Độc lập - Tự do - Hạnh phúc', 430, 80);

    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('CĂN CƯỚC CÔNG DÂN', 430, 118);

    // Chip & Portrait placeholder
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(55, 95, 76, 58);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.strokeRect(55, 95, 76, 58);

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(45, 175, 165, 220);
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('ẢNH CHÂN DUNG', 127, 290);

    // Details
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(`Số: ${meta.cccd || '079099001234'}`, 245, 165);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Họ và tên / Full name:', 245, 210);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText((meta.fullName || 'NGUYỄN VĂN KHÁCH').toUpperCase(), 245, 242);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`Năm sinh: ${meta.birthYear || '1999'}          Giới tính: ${meta.gender || 'Nam'}`, 245, 286);
    ctx.fillText(`Quốc tịch: Việt Nam`, 245, 322);
    ctx.fillText(`Quê quán: ${meta.hometown || 'TP. Hồ Chí Minh'}`, 245, 360);
    ctx.fillText(`Nơi thường trú: ${meta.hometown || 'TP. Thủ Đức, TP.HCM'}`, 245, 398);
  } else if (type === 'CCCD_BACK') {
    const grad = ctx.createLinearGradient(0, 0, 760, 480);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 760, 480);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 736, 456);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Đặc điểm nhận dạng: Nốt ruồi C 1cm sau cánh mũi phải', 45, 68);
    ctx.font = '18px sans-serif';
    ctx.fillText('Ngày cấp: 15/06/2023 — Cục Cảnh sát QLHC về TTXH', 45, 110);

    // Fingerprint boxes
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(45, 145, 170, 150);
    ctx.strokeRect(235, 145, 170, 150);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    ctx.fillText('Ngón trỏ trái', 85, 225);
    ctx.fillText('Ngón trỏ phải', 275, 225);

    // MRZ lines
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`IDVNM${(meta.cccd || '079099001234').padEnd(15, '<')}<<<<<<<<<<`, 45, 365);
    ctx.fillText(`9901015M2901012VNM<<<<<<<<<<<8`, 45, 400);
    ctx.fillText(`NGUYEN<<VAN<KHACH<<<<<<<<<<<<<`, 45, 435);
  } else {
    // CONTRACT
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 720, 960);
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 680, 920);

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 360, 65);
    ctx.font = '15px sans-serif';
    ctx.fillText('Độc lập - Tự do - Hạnh phúc', 360, 90);
    ctx.fillText('---o0o---', 360, 112);

    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('HỢP ĐỒNG THUÊ PHÒNG TRỌ', 360, 160);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = '16px sans-serif';
    const lines = [
      `Khu nhà trọ: ${meta.propertyName || 'Nhà trọ TP. Thủ Đức'}`,
      `Phòng cho thuê: Phòng số ${meta.roomNumber || '1'}`,
      `Bên cho thuê (Bên A): Bà Đặng Thị Thu Thảo`,
      `Bên thuê phòng (Bên B): ${meta.fullName || 'Khách đại diện phòng'}`,
      `Số CCCD Bên B: ${meta.cccd || '079099001234'}`,
      `Giá thuê thỏa thuận: ${(meta.baseRent || 1500000).toLocaleString('vi-VN')} VNĐ / tháng`,
      `Hình thức thanh toán: Chuyển khoản VietQR hoặc tiền mặt trước ngày 05`,
      ``,
      `CAM KẾT CHUNG:`,
      `1. Bên B sử dụng phòng đúng mục đích để ở, giữ gìn vệ sinh chung.`,
      `2. Cung cấp đầy đủ CCCD để đăng ký tạm trú theo quy định Công an.`,
      `3. Thanh toán tiền phòng, điện, nước, rác đầy đủ hàng tháng.`,
      `4. Thông báo trước 30 ngày khi chấm dứt hợp đồng thuê phòng.`,
    ];
    let y = 220;
    for (const line of lines) {
      ctx.font = line.startsWith('CAM KẾT') || line.startsWith('Phòng cho thuê') ? 'bold 17px sans-serif' : '16px sans-serif';
      ctx.fillText(line, 55, y);
      y += 38;
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('ĐẠI DIỆN BÊN THUÊ (BÊN B)', 190, 760);
    ctx.fillText('ĐẠI DIỆN CHỦ NHÀ (BÊN A)', 520, 760);

    ctx.fillStyle = '#0f766e';
    ctx.font = 'italic 20px serif';
    ctx.fillText(meta.fullName || 'Đã ký tên', 190, 825);
    ctx.fillText('Đặng Thị Thu Thảo', 520, 825);
  }

  return canvas.toDataURL('image/webp', 0.85);
}
