'use client';

import React from 'react';
import { ModalDialog } from './ModalDialog';
import { Download, ExternalLink, FileCheck2 } from 'lucide-react';

export interface LightboxPreviewData {
  title: string;
  subtitle?: string;
  images: Array<{
    label: string;
    dataUrl: string;
    uploadedAt?: string;
  }>;
}

interface DocumentLightboxModalProps {
  preview: LightboxPreviewData | null;
  onClose: () => void;
}

export function DocumentLightboxModal({ preview, onClose }: DocumentLightboxModalProps) {
  if (!preview) return null;

  const handleDownload = (dataUrl: string, label: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    const safeName = label
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    a.download = `${safeName || 'tai-lieu-nha-tro'}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <ModalDialog
      open={Boolean(preview)}
      onClose={onClose}
      title={preview.title}
      subtitle={preview.subtitle || 'Hồ sơ lưu trữ hình ảnh Căn cước công dân (CCCD) & Hợp đồng thuê trọ'}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-6">
        {preview.images.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Chưa có hình ảnh nào được tải lên cho mục này.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {preview.images.map((item, idx) => (
              <figure
                key={idx}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <figcaption className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <FileCheck2 className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.uploadedAt && (
                      <span className="text-xs font-normal text-slate-500">
                        ({item.uploadedAt})
                      </span>
                    )}
                  </figcaption>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(item.dataUrl, item.label)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Download className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                      Tải ảnh về máy
                    </button>
                    <a
                      href={item.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Mở kích thước gốc
                    </a>
                  </div>
                </div>

                <div className="flex justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                  <img
                    src={item.dataUrl}
                    alt={item.label}
                    className="max-h-[540px] w-auto object-contain rounded-lg"
                  />
                </div>
              </figure>
            ))}
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
