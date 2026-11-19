import React, { useMemo } from 'react';
import { getQrCodeMatrix } from '../utils/consultationQr';

interface QrCodeSvgProps {
  value: string;
  sizePx?: number;
  caption?: string;
  className?: string;
}

export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({
  value,
  sizePx = 96,
  caption,
  className = '',
}) => {
  const matrix = useMemo(() => getQrCodeMatrix(value), [value]);
  const marginModules = 2;
  const totalViewSize = matrix.size + marginModules * 2;

  const rects = useMemo(() => {
    const paths: string[] = [];
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        if (matrix.isDark(r, c)) {
          paths.push(`M${c + marginModules},${r + marginModules}h1v1h-1z`);
        }
      }
    }
    return paths.join('');
  }, [matrix]);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="bg-white border border-neutral-300 p-0.5 shadow-2xs"
        title={value}
      >
        <svg
          width={sizePx}
          height={sizePx}
          viewBox={`0 0 ${totalViewSize} ${totalViewSize}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label="QR Code de vérification consultation, ordre, facture, type de paiement et montant"
        >
          <rect width={totalViewSize} height={totalViewSize} fill="#ffffff" />
          <path d={rects} fill="#000000" />
        </svg>
      </div>
      {caption && (
        <span className="font-sans text-[8.5px] text-neutral-500 mt-1 text-center leading-tight">
          {caption}
        </span>
      )}
    </div>
  );
};
