import QRCodeReact from 'qrcode.react';
import React, { useEffect, useState } from 'react';

export interface QRCodeProps {
  /**
   * The value to encode in the QR code
   */
  value: string;

  /**
   * The size of the QR code in pixels
   */
  size?: number;

  /**
   * The error correction level of the QR code
   * L - Low (7%)
   * M - Medium (15%)
   * Q - Quartile (25%)
   * H - High (30%)
   */
  level?: 'L' | 'M' | 'Q' | 'H';

  /**
   * Whether to include a margin around the QR code
   */
  includeMargin?: boolean;

  /**
   * The background color of the QR code
   */
  bgColor?: string;

  /**
   * The foreground color of the QR code
   */
  fgColor?: string;

  /**
   * CSS class for the QR code
   */
  className?: string;

  /**
   * Image to display in the center of the QR code
   */
  imageSettings?: {
    src: string;
    height: number;
    width: number;
    excavate: boolean;
  };
}

export const QRCode: React.FC<QRCodeProps> = ({
  value,
  size = 256,
  level = 'L',
  includeMargin = false,
  bgColor = '#FFFFFF',
  fgColor = '#000000',
  className = '',
  imageSettings,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only render the QR code on the client side to avoid SSR issues
  if (!isMounted) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${className}`}
        style={{ width: size, height: size }}
      >
        <div
          className="animate-pulse bg-gray-200 rounded"
          style={{ width: size * 0.8, height: size * 0.8 }}
        />
      </div>
    );
  }

  return (
    <QRCodeReact
      value={value}
      size={size}
      level={level}
      includeMargin={includeMargin}
      bgColor={bgColor}
      fgColor={fgColor}
      className={className}
      imageSettings={imageSettings}
    />
  );
};
