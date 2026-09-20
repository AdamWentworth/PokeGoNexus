import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export const useTradeBoardQrCode = (url: string): string | null => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    if (!url) return () => { active = false; };

    void QRCode.toDataURL(url, {
      color: { dark: '#081418', light: '#ffffff' },
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
    }).then((nextDataUrl) => {
      if (active) setDataUrl(nextDataUrl);
    }).catch(() => {
      if (active) setDataUrl(null);
    });

    return () => { active = false; };
  }, [url]);

  return dataUrl;
};
