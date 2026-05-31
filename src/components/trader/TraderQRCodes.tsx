import React, { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Share2, Store, Package, Printer, Zap, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, cn } from '../../lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  code?: string;
  qrCode?: string;
}

interface TraderQRCodesProps {
  products: Product[];
  traderId: string;
  traderName: string;
  traderTin: string;
  traderPhone?: string;
  traderAddress?: string;
}

export default function TraderQRCodes({
  products,
  traderId,
  traderName,
  traderTin,
  traderPhone,
  traderAddress,
}: TraderQRCodesProps) {
  const { t } = useLanguage();
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomQR, setShowCustomQR] = useState(false);
  const [activeQRProduct, setActiveQRProduct] = useState<Product | null>(null);

  const shopQR = `nexus://pay?traderId=${traderId}&traderName=${encodeURIComponent(traderName)}&tin=${traderTin}${traderPhone ? `&phone=${encodeURIComponent(traderPhone)}` : ''}`;

  const downloadQR = (canvasId: string, name: string) => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `ESOKO_QR_${name.replace(/\s+/g, '_')}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100"
      >
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
            <QRCodeCanvas id="shop-qr" value={shopQR} size={200} level="H" includeMargin={true} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                <Store size={20} />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900">{t.trader.officialShopQR}</h3>
            </div>
            <p className="text-neutral-500 mb-6">{t.trader.shopQRDescription}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <button
                onClick={() => downloadQR('shop-qr', traderName)}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all"
              >
                <Download size={20} /> {t.common.download} PNG
              </button>
              <button
                onClick={() => {
                  const link = `${window.location.origin}/nexus-pay?traderId=${traderId}`;
                  navigator.clipboard.writeText(link);
                  alert('Link copied to clipboard!');
                }}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
              >
                <Zap size={20} /> Copy Nexus Link
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all">
                <Printer size={20} /> {t.common.print}
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all">
                <Share2 size={20} /> {t.common.share}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Dynamic Payment QR */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-orange-500 font-black uppercase tracking-widest text-[10px] mb-2">
                <Zap size={14} /> Instant Payment
              </div>
              <h3 className="text-3xl font-black tracking-tight">Dynamic Payment QR</h3>
              <p className="text-slate-400 text-sm mt-2">
                Generate a QR code for a specific amount. Perfect for custom services or bulk
                orders.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 font-black">
                  RWF
                </span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full pl-16 pr-5 py-5 bg-slate-800 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-slate-600"
                />
              </div>
              <button
                onClick={() => setShowCustomQR(!!customAmount)}
                className="w-full py-5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-orange-900/40"
              >
                Generate Payment QR
              </button>
            </div>
          </div>

          {showCustomQR && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-6 rounded-[2rem] flex flex-col items-center gap-4"
            >
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                <QRCodeCanvas
                  id="custom-payment-qr"
                  value={`nexus://pay?traderId=${traderId}&amount=${customAmount}&traderName=${encodeURIComponent(traderName)}`}
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                  Amount to Pay
                </p>
                <p className="text-xl font-black text-slate-900">
                  RWF {Number(customAmount).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => downloadQR('custom-payment-qr', `Payment_${customAmount}`)}
                className="w-full py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold text-xs hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
              >
                <Download size={16} /> Download PNG
              </button>
            </motion.div>
          )}
        </div>
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl"></div>
      </motion.div>

      {/* Products Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-xl overflow-hidden mt-8">
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Product QR Catalog
            </h3>
            <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">
              Generate dynamic payment links for your inventory
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-neutral-100 dark:divide-neutral-800">
          {products.map((product) => (
            <div
              key={product.id}
              className="p-8 group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all duration-500"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="relative p-4 bg-white rounded-3xl shadow-2xl shadow-neutral-200/50 dark:shadow-none dark:border dark:border-neutral-800 group-hover:scale-105 transition-transform duration-500">
                  <QRCodeCanvas
                    id={`product-qr-${product.id}`}
                    value={`nexus://pay?traderId=${traderId}&productId=${product.id}&amount=${product.price}&traderName=${encodeURIComponent(traderName)}&productName=${encodeURIComponent(product.name)}&tin=${traderTin}${traderPhone ? `&phone=${encodeURIComponent(traderPhone)}` : ''}${traderAddress ? `&addr=${encodeURIComponent(traderAddress)}` : ''}`}
                    size={160}
                    level="H"
                    includeMargin={true}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => downloadQR(`product-qr-${product.id}`, product.name)}
                      className="p-4 bg-orange-600 text-white rounded-full shadow-2xl active:scale-95 transition-transform"
                    >
                      <Download size={24} />
                    </button>
                  </div>
                </div>
                <div className="text-center w-full px-4">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white tracking-tight uppercase truncate">
                    {product.name}
                  </h4>
                  <p className="text-orange-600 font-black text-xs tracking-widest uppercase mt-1">
                    RWF {formatCurrency(product.price || 0)}
                  </p>
                  <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-2">
                    CODE: {product.code || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <Package size={48} className="mx-auto text-neutral-200 mb-4" />
              <p className="text-neutral-400 font-black uppercase tracking-widest text-xs">
                No products found in catalog
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
