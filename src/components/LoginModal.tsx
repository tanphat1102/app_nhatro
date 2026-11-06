'use client';

import React, { useState } from 'react';
import { User } from '@/types/nhatro';
import { ModalDialog } from './ModalDialog';
import { Eye, EyeOff, KeyRound, LogIn, ShieldAlert, Sparkles, UserCheck, Users, Zap } from 'lucide-react';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (userVal?: string, passVal?: string) => {
    const u = userVal ?? username;
    const p = passVal ?? password;
    if (!u.trim() || !p) {
      setErrorMsg('Vui lòng nhập đầy đủ tên đăng nhập / SĐT và mật khẩu.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/nhatro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username: u.trim(), password: p }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Đăng nhập không thành công.');
      } else if (data.user) {
        onSuccess(data.user);
        onClose();
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    handleLogin(u, p);
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Đăng Nhập Hệ Thống Quản Lý Nhà Trọ"
      subtitle="Đăng nhập theo phân quyền Chủ nhà, Quản lý hoặc Khách thuê phòng"
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-6">
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="login-username" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Tên đăng nhập hoặc Số điện thoại
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              autoCorrect="off"
              spellCheck={false}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="VD: admin, quanly hoặc SĐT khách thuê..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-teal-700 focus:outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-semibold text-slate-900 focus:border-teal-700 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-teal-800 disabled:opacity-50 transition-colors"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
          </button>
        </form>

        {/* 1-Click Quick Demo Login Presets */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Đăng nhập nhanh 1 chạm theo vai trò (Dùng thử & Kiểm thử)
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* Admin Preset */}
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="flex flex-col items-start rounded-xl border border-teal-200 bg-white p-2.5 text-left hover:border-teal-600 hover:bg-teal-50/50 transition-all shadow-2xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-[11px] text-white font-bold">
                  👑
                </span>
                <span className="text-xs font-bold text-slate-900">Chủ nhà (Admin)</span>
              </div>
              <span className="mt-1 text-[11px] text-slate-500">
                Toàn quyền: cấu hình giá, STK ngân hàng, tài khoản
              </span>
              <span className="mt-1 font-mono text-[10px] text-teal-800 font-semibold">
                admin / admin123
              </span>
            </button>

            {/* Manager Preset */}
            <button
              type="button"
              onClick={() => handleQuickLogin('quanly', 'quanly123')}
              className="flex flex-col items-start rounded-xl border border-sky-200 bg-white p-2.5 text-left hover:border-sky-600 hover:bg-sky-50/50 transition-all shadow-2xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[11px] text-white font-bold">
                  👔
                </span>
                <span className="text-xs font-bold text-slate-900">Quản lý khu trọ</span>
              </div>
              <span className="mt-1 text-[11px] text-slate-500">
                Ghi điện nước, thu tiền, hồ sơ khách thuê
              </span>
              <span className="mt-1 font-mono text-[10px] text-sky-800 font-semibold">
                quanly / quanly123
              </span>
            </button>

            {/* Tenant Preset 1 */}
            <button
              type="button"
              onClick={() => handleQuickLogin('0908123451', '123456')}
              className="flex flex-col items-start rounded-xl border border-amber-200 bg-white p-2.5 text-left hover:border-amber-600 hover:bg-amber-50/50 transition-all shadow-2xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-[11px] text-white font-bold">
                  👤
                </span>
                <span className="text-xs font-bold text-slate-900">Khách thuê (P.1 - 26 Đường 4)</span>
              </div>
              <span className="mt-1 text-[11px] text-slate-500">
                Nguyễn Văn Hùng • Quét VietQR, xem hóa đơn phòng
              </span>
              <span className="mt-1 font-mono text-[10px] text-amber-800 font-semibold">
                0908123451 / 123456
              </span>
            </button>

            {/* Tenant Preset 2 */}
            <button
              type="button"
              onClick={() => handleQuickLogin('0903111221', '123456')}
              className="flex flex-col items-start rounded-xl border border-purple-200 bg-white p-2.5 text-left hover:border-purple-600 hover:bg-purple-50/50 transition-all shadow-2xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[11px] text-white font-bold">
                  👤
                </span>
                <span className="text-xs font-bold text-slate-900">Khách thuê (P.1 - 219 NVT)</span>
              </div>
              <span className="mt-1 text-[11px] text-slate-500">
                Lê Văn Khoa • Tính nước theo đầu người
              </span>
              <span className="mt-1 font-mono text-[10px] text-purple-800 font-semibold">
                0903111221 / 123456
              </span>
            </button>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}
