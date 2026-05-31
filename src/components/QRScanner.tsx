import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, CheckCircle2, AlertCircle, Keyboard, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose?: () => void;
  placeholder?: string;
}

type ScanStatus = 'scanning' | 'success' | 'error' | 'manual';

export default function QRScanner({ onScan, onClose, placeholder }: QRScannerProps) {
  const { t } = useLanguage();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'qr-reader';
  const [status, setStatus] = useState<ScanStatus>('scanning');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    if (status !== 'scanning') return;

    let html5QrCode: Html5Qrcode;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(regionId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
          ],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdge * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            handleSuccess(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error('Error starting QR scanner:', err);
        try {
          await html5QrCode.start(
            { facingMode: 'user' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              handleSuccess(decodedText);
            },
            () => {}
          );
        } catch (fallbackErr) {
          console.error('Fallback scanner failed:', fallbackErr);
          setStatus('error');
          setErrorMessage(t.common.cameraError || 'Camera access denied or not found');
        }
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [status]);

  const handleSuccess = (decodedText: string) => {
    setStatus('success');
    // Vibrate if possible
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    stopScanner();
    setTimeout(() => {
      onScan(decodedText);
    }, 800);
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping QR scanner:', err);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualValue.trim()) {
      onScan(manualValue.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden relative shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-50 flex items-center justify-between bg-neutral-50/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center shadow-sm">
              {status === 'manual' ? (
                <Keyboard size={24} className="text-orange-600" />
              ) : (
                <Camera size={24} className="text-orange-600" />
              )}
            </div>
            <div>
              <h3 className="font-black text-slate-900 tracking-tight">
                {status === 'manual' ? t.common.enterManually : t.common.scanQR}
              </h3>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                {status === 'manual' ? 'Type the code below' : 'Position QR in frame'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-neutral-100 rounded-2xl transition-colors"
            >
              <X size={20} className="text-neutral-400" />
            </button>
          )}
        </div>

        <div className="aspect-square bg-slate-900 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {status === 'scanning' && (
              <motion.div
                key="scanner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full relative"
              >
                <div id={regionId} className="w-full h-full" />
                {/* Viewfinder Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 border-2 border-white/20 rounded-[2rem] relative">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-orange-500 rounded-tl-2xl" />
                    <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-orange-500 rounded-tr-2xl" />
                    <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-orange-500 rounded-bl-2xl" />
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-orange-500 rounded-br-2xl" />

                    {/* Scanning Line */}
                    <motion.div
                      animate={{ top: ['10%', '90%', '10%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="absolute left-6 right-6 h-0.5 bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,1)]"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-green-500 text-white p-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                >
                  <CheckCircle2 size={80} strokeWidth={1.5} />
                </motion.div>
                <h4 className="text-2xl font-black mt-6 tracking-tight">{t.common.scanSuccess}</h4>
                <p className="mt-2 font-bold text-sm opacity-90 uppercase tracking-widest">
                  Processing your code...
                </p>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-red-500 text-white p-8 text-center"
              >
                <AlertCircle size={80} strokeWidth={1.5} />
                <h4 className="text-2xl font-black mt-6 tracking-tight">{t.common.scanError}</h4>
                <p className="mt-2 font-bold text-sm opacity-90 uppercase tracking-widest">
                  {errorMessage}
                </p>
                <button
                  onClick={() => setStatus('scanning')}
                  className="mt-8 px-8 py-3 bg-white text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"
                >
                  Try Again
                </button>
              </motion.div>
            )}

            {status === 'manual' && (
              <motion.div
                key="manual"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute inset-0 bg-white flex flex-col p-8"
              >
                <form
                  onSubmit={handleManualSubmit}
                  className="flex-1 flex flex-col justify-center space-y-8"
                >
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      {placeholder || 'Enter Code'}
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={manualValue}
                      onChange={(e) => setManualValue(e.target.value)}
                      className="w-full text-4xl font-black text-slate-900 border-b-4 border-orange-50 text-center focus:border-orange-500 outline-none py-6 transition-all placeholder:text-neutral-100"
                      placeholder="00000000"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!manualValue.trim()}
                    className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                  >
                    {t.common.submit}
                    <ArrowRight size={20} />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-8 bg-neutral-50/30">
          {status !== 'manual' ? (
            <button
              onClick={() => setStatus('manual')}
              className="w-full py-4 bg-white border border-neutral-100 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-orange-200 hover:text-orange-600 transition-all flex items-center justify-center gap-3 group shadow-sm"
            >
              <Keyboard size={20} className="text-neutral-400 group-hover:text-orange-500" />
              {t.common.enterManually}
            </button>
          ) : (
            <button
              onClick={() => setStatus('scanning')}
              className="w-full py-4 bg-white border border-neutral-100 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-orange-200 hover:text-orange-600 transition-all flex items-center justify-center gap-3 group shadow-sm"
            >
              <Camera size={20} className="text-neutral-400 group-hover:text-orange-500" />
              Switch to Camera
            </button>
          )}
        </div>
      </motion.div>

      <style>{`
        #qr-reader {
          border: none !important;
        }
        #qr-reader__dashboard {
          display: none !important;
        }
        #qr-reader__status_span {
          display: none !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
    </div>
  );
}
