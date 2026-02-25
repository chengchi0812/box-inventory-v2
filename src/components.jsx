import { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';
import { compressImage, getQRCodeUrl } from './utils';

// ─── Photo Capture ───
export function PhotoCapture({ photo, onCapture, onRemove }) {
  const ref = useRef(null);
  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onCapture(await compressImage(f));
    e.target.value = '';
  };

  if (photo) {
    return (
      <div className="photo-preview">
        <img src={photo} alt="物品照片" />
        <button className="photo-remove" onClick={onRemove}><Icons.X /></button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
      <button className="photo-capture-btn" onClick={() => ref.current?.click()}>
        <Icons.Camera /><span>拍照 / 選擇圖片</span>
      </button>
    </div>
  );
}

// ─── Lightbox ───
export function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}><Icons.X /></button>
      <img src={src} alt="放大圖片" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ─── QR Code Display ───
export function QRCodeDisplay({ boxId, boxName, baseUrl }) {
  const url = `${baseUrl}?box=${boxId}`;
  const qrUrl = getQRCodeUrl(url, 250);
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = getQRCodeUrl(url, 400);
    a.download = `QR-${boxName}.svg`;
    a.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div onClick={() => setShowFull(!showFull)} className="qr-container">
        <img
          src={qrUrl}
          alt="QR Code"
          style={{ width: showFull ? 250 : 140, height: showFull ? 250 : 140, borderRadius: 8, transition: 'all 0.2s' }}
        />
      </div>
      <div className="qr-actions">
        <button className="qr-action-btn" onClick={handleDownload}>
          <Icons.Download /> 下載
        </button>
        <button className="qr-action-btn" onClick={handleCopy}>
          📋 {copied ? '已複製！' : '複製連結'}
        </button>
      </div>
      <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>點擊 QR Code 可放大 · 列印後貼在箱子上</p>
    </div>
  );
}

// ─── QR Scanner ───
export function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [errMsg, setErrMsg] = useState('');
  const scanningRef = useRef(true);

  useEffect(() => {
    let animFrame;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus('scanning');

          if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const scan = async () => {
              if (!scanningRef.current) return;
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes.length > 0) {
                  scanningRef.current = false;
                  onScan(codes[0].rawValue);
                  return;
                }
              } catch {}
              animFrame = requestAnimationFrame(scan);
            };
            scan();
          } else {
            setStatus('no_detector');
          }
        }
      } catch (err) {
        setStatus('error');
        setErrMsg(err.message || '無法存取相機');
      }
    };
    startCamera();
    return () => {
      scanningRef.current = false;
      cancelAnimationFrame(animFrame);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="scanner-overlay">
      <div className="scanner-header">
        <button className="back-btn" onClick={onClose}><Icons.Back /></button>
        <span style={{ color: '#fff', fontSize: 17, fontWeight: 600 }}>掃描 QR Code</span>
      </div>

      <div className="scanner-body">
        <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {status === 'scanning' && (
          <div className="scanner-frame-wrap">
            <div className="scanner-frame">
              <div className="corner tl" /><div className="corner tr" />
              <div className="corner bl" /><div className="corner br" />
              <div className="scan-line" />
            </div>
          </div>
        )}

        {status === 'starting' && (
          <div className="scanner-msg"><p>正在啟動相機...</p></div>
        )}

        {status === 'error' && (
          <div className="scanner-msg">
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>無法存取相機</p>
            <p className="hint">{errMsg}</p>
            <p className="hint" style={{ marginTop: 8 }}>請確認已授權相機權限</p>
          </div>
        )}

        {status === 'no_detector' && (
          <div className="scanner-bottom-msg">
            <p style={{ color: '#F59E0B', fontWeight: 600, marginBottom: 8 }}>此瀏覽器不支援自動 QR 偵測</p>
            <p className="hint">建議使用 Chrome 89+ 或手機內建相機掃描</p>
          </div>
        )}
      </div>

      <div className="scanner-footer">
        <p className="hint">將 QR Code 對準框內即可自動辨識</p>
      </div>
    </div>
  );
}

// ─── Toast ───
export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast" style={{ background: toast.type === 'warn' ? '#F59E0B' : '#10B981' }}>
      {toast.msg}
    </div>
  );
}
