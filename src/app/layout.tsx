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
    <html lang="vi" suppressHydrationWarning className={`${sansFont.variable} ${monoFont.variable}`}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
  const saved = localStorage.getItem("color-scheme") ?? "light";
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.content = saved;
  const resolved = saved === "dark" || (saved === "light dark" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
} catch {}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased selection:bg-teal-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
