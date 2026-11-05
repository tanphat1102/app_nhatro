import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quản Lý Nhà Trọ Thông Minh | Đặng Thị Thu Thảo',
  description:
    'Hệ thống quản lý khu nhà trọ, phòng trọ nhiều thành viên, tính tiền linh hoạt theo đồng hồ hoặc theo đầu người và xuất phiếu báo VietQR.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
