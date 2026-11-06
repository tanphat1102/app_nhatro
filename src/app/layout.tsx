import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sansFont = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Quản Lý Nhà Trọ Thông Minh | Đặng Thị Thu Thảo',
  description:
    'Hệ thống quản lý khu nhà trọ, phòng trọ nhiều thành viên, lưu trữ CCCD & hợp đồng, tính tiền linh hoạt theo đồng hồ hoặc đầu người và xuất phiếu VietQR.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${sansFont.variable} ${monoFont.variable}`}>
      <body className="min-h-screen bg-slate-50/80 text-slate-900 antialiased selection:bg-teal-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
