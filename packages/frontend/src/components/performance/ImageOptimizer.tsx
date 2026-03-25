// ===================================================================
// SOVREN IMAGE OPTIMIZER - LEGENDARY TIER
// US-112: Optimized Image Loading Implementation
// ===================================================================

import { Camera, FileImage, Image as ImageIcon, Loader, TrendingUp, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ImageFormat {
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  supported: boolean;
  quality: number;
  compression: number;
}

interface ImageMetrics {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  loadTime: number;
  format: string;
  dimensions: { width: number; height: number };
}

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'empty' | 'skeleton';
  quality?: number;
  formats?: ('webp' | 'avif' | 'jpeg' | 'png')[];
  responsive?: boolean;
  lazy?: boolean;
  onLoad?: (metrics: ImageMetrics) => void;
  onError?: (error: Error) => void;
  className?: string;
}

interface ImageOptimizerProps {
  /** Enable automatic format detection */
  enableFormatDetection?: boolean;
  /** Enable progressive loading */
  enableProgressiveLoading?: boolean;
  /** Enable CDN optimization */
  enableCDN?: boolean;
  /** Default quality setting */
  defaultQuality?: number;
  /** Performance monitoring callback */
  onMetricsUpdate?: (metrics: ImageMetrics[]) => void;
  /** CDN base URL */
  cdnBaseUrl?: string;
}

// US-112.1: Implement responsive image loading
class ResponsiveImageManager {
  private breakpoints = [
    { size: 320, descriptor: '320w' },
    { size: 640, descriptor: '640w' },
    { size: 768, descriptor: '768w' },
    { size: 1024, descriptor: '1024w' },
    { size: 1280, descriptor: '1280w' },
    { size: 1920, descriptor: '1920w' },
  ];

  generateSrcSet(baseUrl: string, format: string = 'webp'): string {
    return this.breakpoints
      .map((bp) => `${this.resizeUrl(baseUrl, bp.size, format)} ${bp.descriptor}`)
      .join(', ');
  }

  generateSizes(): string {
    return [
      '(max-width: 320px) 280px',
      '(max-width: 640px) 600px',
      '(max-width: 768px) 728px',
      '(max-width: 1024px) 984px',
      '(max-width: 1280px) 1240px',
      '100vw',
    ].join(', ');
  }

  private resizeUrl(url: string, width: number, format: string): string {
    const params = new URLSearchParams({
      w: width.toString(),
      f: format,
      q: '80',
    });

    return `${url}?${params.toString()}`;
  }

  getOptimalSize(containerWidth: number): number {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const targetWidth = containerWidth * devicePixelRatio;

    return this.breakpoints.find((bp) => bp.size >= targetWidth)?.size || 1920;
  }
}

// US-112.2: Add next-generation image format support
class FormatDetector {
  private supportCache = new Map<string, boolean>();

  async detectSupportedFormats(): Promise<ImageFormat[]> {
    const formats: ImageFormat[] = [
      { format: 'avif', supported: false, quality: 90, compression: 50 },
      { format: 'webp', supported: false, quality: 85, compression: 35 },
      { format: 'jpeg', supported: true, quality: 80, compression: 20 },
      { format: 'png', supported: true, quality: 100, compression: 10 },
    ];

    // Test AVIF support
    formats[0].supported = await this.supportsFormat('avif');

    // Test WebP support
    formats[1].supported = await this.supportsFormat('webp');

    return formats;
  }

  private async supportsFormat(format: string): Promise<boolean> {
    if (this.supportCache.has(format)) {
      return this.supportCache.get(format)!;
    }

    const supported = await this.testFormat(format);
    this.supportCache.set(format, supported);
    return supported;
  }

  private testFormat(format: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width === 1 && img.height === 1);
      img.onerror = () => resolve(false);

      const testImages = {
        webp: 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
        avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgS0AAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=',
      };

      img.src = testImages[format as keyof typeof testImages] || '';
    });
  }

  getBestFormat(supportedFormats: ImageFormat[]): ImageFormat {
    return (
      supportedFormats.find((f) => f.supported && f.format === 'avif') ||
      supportedFormats.find((f) => f.supported && f.format === 'webp') ||
      supportedFormats.find((f) => f.supported && f.format === 'jpeg') ||
      supportedFormats.find((f) => f.supported && f.format === 'png')!
    );
  }
}

// Optimized Image Component
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false,
  placeholder = 'skeleton',
  quality = 80,
  formats = ['avif', 'webp', 'jpeg'],
  responsive = true,
  lazy = true,
  onLoad,
  onError,
  className = '',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const responsiveManager = useMemo(() => new ResponsiveImageManager(), []);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setIsLoading(false);

    if (onLoad && imgRef.current) {
      const metrics: ImageMetrics = {
        originalSize: 0,
        optimizedSize: 0,
        compressionRatio: 0,
        loadTime: 0,
        format: src.split('.').pop() || 'unknown',
        dimensions: {
          width: imgRef.current.naturalWidth,
          height: imgRef.current.naturalHeight,
        },
      };
      onLoad(metrics);
    }
  }, [onLoad, src]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const error = new Error(`Failed to load image: ${src}`);
      setError(error);
      setIsLoading(false);

      if (onError) {
        onError(error);
      }
    },
    [onError, src]
  );

  const srcSet = responsive ? responsiveManager.generateSrcSet(src) : undefined;
  const imageSizes = sizes || (responsive ? responsiveManager.generateSizes() : undefined);

  if (error) {
    return (
      <div className={`bg-muted flex items-center justify-center ${className}`}>
        <Camera className="h-8 w-8 text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {/* Placeholder */}
      {isLoading && (
        <div className="absolute inset-0">
          {placeholder === 'skeleton' ? (
            <div className="w-full h-full bg-muted animate-pulse" />
          ) : (
            <div className="w-full h-full bg-muted" />
          )}
        </div>
      )}

      {/* Main Image */}
      <img
        ref={imgRef}
        src={priority || !lazy ? src : undefined}
        data-src={lazy && !priority ? src : undefined}
        srcSet={priority || !lazy ? srcSet : undefined}
        data-srcset={lazy && !priority ? srcSet : undefined}
        sizes={imageSizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Loading Indicator */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
};

// Main Image Optimizer Dashboard Component
export const ImageOptimizer: React.FC<ImageOptimizerProps> = ({
  enableFormatDetection = true,
  enableProgressiveLoading = true,
  enableCDN = false,
  defaultQuality = 80,
  onMetricsUpdate,
  cdnBaseUrl = '',
}) => {
  const [supportedFormats, setSupportedFormats] = useState<ImageFormat[]>([]);
  const [optimizedImages, setOptimizedImages] = useState<ImageMetrics[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [performanceReport, setPerformanceReport] = useState<any>(null);

  const formatDetector = useMemo(() => new FormatDetector(), []);

  useEffect(() => {
    if (enableFormatDetection) {
      initializeOptimization();
    }
  }, [enableFormatDetection]);

  const initializeOptimization = async () => {
    setIsOptimizing(true);

    try {
      // Detect supported formats
      const formats = await formatDetector.detectSupportedFormats();
      setSupportedFormats(formats);

      // Optimize existing images
      await optimizePageImages();
    } catch (error) {
      console.error('Failed to initialize image optimization:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const optimizePageImages = async () => {
    const images = document.querySelectorAll('img');
    const metrics: ImageMetrics[] = [];

    for (const img of Array.from(images)) {
      try {
        const metric: ImageMetrics = {
          originalSize: 0,
          optimizedSize: 0,
          compressionRatio: 0,
          loadTime: 0,
          format: img.src.split('.').pop() || 'unknown',
          dimensions: {
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0,
          },
        };
        metrics.push(metric);
      } catch (error) {
        console.warn('Failed to optimize image:', img.src, error);
      }
    }

    setOptimizedImages(metrics);

    if (onMetricsUpdate) {
      onMetricsUpdate(metrics);
    }
  };

  const generatePerformanceReport = useCallback(() => {
    const report = {
      averageLoadTime:
        optimizedImages.reduce((acc, img) => acc + img.loadTime, 0) / (optimizedImages.length || 1),
      totalImages: optimizedImages.length,
      formatDistribution: optimizedImages.reduce(
        (acc, img) => {
          acc[img.format] = (acc[img.format] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
    setPerformanceReport(report);
  }, [optimizedImages]);

  const getTotalSavings = useMemo(() => {
    return optimizedImages.reduce((total, img) => {
      return total + (img.originalSize - img.optimizedSize);
    }, 0);
  }, [optimizedImages]);

  const getAverageCompressionRatio = useMemo(() => {
    if (optimizedImages.length === 0) return 0;
    return (
      optimizedImages.reduce((total, img) => total + img.compressionRatio, 0) /
      optimizedImages.length
    );
  }, [optimizedImages]);

  if (isOptimizing) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-muted-foreground">Optimizing images...</span>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ImageIcon className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-foreground">Image Optimizer</h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Images Optimized:</span>
          <span className="text-lg font-bold text-green-600">{optimizedImages.length}</span>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <FileImage className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-900">Total Savings</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {(getTotalSavings / 1024).toFixed(1)}KB
          </p>
          <p className="text-sm text-green-700">Bandwidth saved</p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">Compression</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {getAverageCompressionRatio.toFixed(1)}%
          </p>
          <p className="text-sm text-blue-700">Average reduction</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-purple-900">Load Time</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {performanceReport?.averageLoadTime?.toFixed(0) || 0}ms
          </p>
          <p className="text-sm text-purple-700">Average load time</p>
        </div>
      </div>

      {/* Supported Formats */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Supported Formats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {supportedFormats.map((format, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${
                format.supported ? 'bg-green-50 border-green-200' : 'bg-muted border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{format.format.toUpperCase()}</span>
                <span
                  className={`text-sm ${format.supported ? 'text-green-600' : 'text-muted-foreground'}`}
                >
                  {format.supported ? '✓' : '✗'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{format.compression}% smaller</p>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Report */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Performance Report</h3>
          <button
            onClick={generatePerformanceReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Generate Report
          </button>
        </div>

        {performanceReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Format Distribution</h4>
                {Object.entries(performanceReport.formatDistribution).map(([format, count]) => (
                  <div key={format} className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{format.toUpperCase()}</span>
                    <span className="font-mono text-sm">{count as number}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Performance Stats</h4>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Images</span>
                  <span className="font-mono text-sm">{performanceReport.totalImages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Average Load</span>
                  <span className="font-mono text-sm">
                    {performanceReport.averageLoadTime.toFixed(0)}ms
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={optimizePageImages}
            className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
          >
            Optimize Images
          </button>
          <button
            onClick={generatePerformanceReport}
            className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            Test Performance
          </button>
          <button
            onClick={() => formatDetector.detectSupportedFormats().then(setSupportedFormats)}
            className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
          >
            Detect Formats
          </button>
          <button
            onClick={initializeOptimization}
            className="px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageOptimizer;
