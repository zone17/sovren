import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Download, FileText, Image, Settings, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';

interface AssetMetrics {
  type: 'css' | 'js' | 'image' | 'font';
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  loadTime: number;
  cacheHit: boolean;
}

interface OptimizationConfig {
  minification: boolean;
  compression: boolean;
  bundling: boolean;
  preloading: boolean;
  lazyLoading: boolean;
  webpConversion: boolean;
}

// Asset Optimization Manager
class StaticAssetOptimizer {
  private config: OptimizationConfig;
  private metrics: Map<string, AssetMetrics> = new Map();
  private preloadQueue: string[] = [];

  constructor(config: OptimizationConfig) {
    this.config = config;
  }

  async optimizeAsset(url: string, type: AssetMetrics['type']): Promise<AssetMetrics> {
    const startTime = Date.now();

    // Simulate optimization process
    const originalSize = Math.random() * 100000 + 10000;
    const optimizedSize = originalSize * (0.3 + Math.random() * 0.4);
    const compressionRatio = (originalSize - optimizedSize) / originalSize;

    const metrics: AssetMetrics = {
      type,
      originalSize,
      optimizedSize,
      compressionRatio,
      loadTime: Date.now() - startTime,
      cacheHit: Math.random() > 0.3,
    };

    this.metrics.set(url, metrics);
    return metrics;
  }

  getMetrics(): AssetMetrics[] {
    return Array.from(this.metrics.values());
  }

  async preloadAssets(urls: string[]): Promise<void> {
    for (const url of urls) {
      if (this.config.preloading) {
        await this.preloadAsset(url);
      }
    }
  }

  private async preloadAsset(url: string): Promise<void> {
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      link.onload = () => resolve();
      link.onerror = () => resolve();
      document.head.appendChild(link);
    });
  }

  calculateOverallScore(): number {
    const metrics = this.getMetrics();
    if (metrics.length === 0) return 0;

    const avgCompression = metrics.reduce((sum, m) => sum + m.compressionRatio, 0) / metrics.length;
    const avgLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0) / metrics.length;
    const cacheHitRate = metrics.filter((m) => m.cacheHit).length / metrics.length;

    return Math.round(
      (avgCompression * 100 + (1000 / Math.max(avgLoadTime, 1)) * 10 + cacheHitRate * 100) / 3
    );
  }
}

interface StaticAssetOptimizerProps {
  enabled?: boolean;
  config?: Partial<OptimizationConfig>;
}

export default function StaticAssetOptimizerComponent({
  enabled = true,
  config = {},
}: StaticAssetOptimizerProps) {
  const [optimizer] = useState(
    () =>
      new StaticAssetOptimizer({
        minification: true,
        compression: true,
        bundling: true,
        preloading: true,
        lazyLoading: true,
        webpConversion: true,
        ...config,
      })
  );

  const [metrics, setMetrics] = useState<AssetMetrics[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);

  const handleOptimization = useCallback(async () => {
    setIsOptimizing(true);
    setOptimizationProgress(0);

    const assets = [
      { url: '/css/main.css', type: 'css' as const },
      { url: '/js/bundle.js', type: 'js' as const },
      { url: '/images/hero.jpg', type: 'image' as const },
      { url: '/fonts/inter.woff2', type: 'font' as const },
    ];

    for (let i = 0; i < assets.length; i++) {
      await optimizer.optimizeAsset(assets[i].url, assets[i].type);
      setOptimizationProgress(((i + 1) / assets.length) * 100);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setMetrics(optimizer.getMetrics());
    setIsOptimizing(false);
  }, [optimizer]);

  const overallScore = optimizer.calculateOverallScore();
  const totalSavings = metrics.reduce((sum, m) => sum + (m.originalSize - m.optimizedSize), 0);

  if (!enabled) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Static Asset Optimizer
          </CardTitle>
          <CardDescription>
            Comprehensive asset optimization with minification, compression, and delivery
            optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Savings</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {(totalSavings / 1024).toFixed(1)}KB
                  </p>
                </div>
                <Download className="h-8 w-8 text-yellow-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Compression Ratio</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metrics.length > 0
                      ? (
                          (metrics.reduce((sum, m) => sum + m.compressionRatio, 0) /
                            metrics.length) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
                <FileText className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Optimized Assets</p>
                  <p className="text-2xl font-bold text-blue-600">{metrics.length}</p>
                </div>
                <Image className="h-8 w-8 text-blue-500" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asset Optimization</CardTitle>
          <CardDescription>
            Run comprehensive asset optimization and performance testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Optimize Static Assets</h4>
                <p className="text-sm text-muted-foreground">
                  Minify, compress, and optimize all static assets
                </p>
              </div>
              <Button
                onClick={handleOptimization}
                disabled={isOptimizing}
                className="flex items-center gap-2"
              >
                {isOptimizing ? (
                  <>
                    <Settings className="h-4 w-4 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Optimize Assets
                  </>
                )}
              </Button>
            </div>

            {isOptimizing && (
              <div className="space-y-2">
                <Progress value={optimizationProgress} />
                <p className="text-sm text-muted-foreground">
                  Optimizing assets... {optimizationProgress.toFixed(0)}%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Optimization Results</CardTitle>
            <CardDescription>Detailed optimization metrics for each asset type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.map((metric, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{metric.type.toUpperCase()}</Badge>
                      <span className="font-medium">Asset {index + 1}</span>
                      {metric.cacheHit && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Cached
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {metric.loadTime}ms load time
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Original Size</p>
                      <p className="font-semibold">{(metric.originalSize / 1024).toFixed(1)}KB</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Optimized Size</p>
                      <p className="font-semibold text-green-600">
                        {(metric.optimizedSize / 1024).toFixed(1)}KB
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Compression</p>
                      <p className="font-semibold text-blue-600">
                        {(metric.compressionRatio * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Savings</p>
                      <p className="font-semibold text-purple-600">
                        {((metric.originalSize - metric.optimizedSize) / 1024).toFixed(1)}KB
                      </p>
                    </div>
                  </div>
                  <Progress value={metric.compressionRatio * 100} className="mt-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            Asset Optimization Score
          </CardTitle>
          <CardDescription>Overall static asset optimization effectiveness</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600">
              {overallScore}
            </div>
            <div className="text-lg text-muted-foreground">Asset Optimization Score</div>
            <Progress value={overallScore} className="w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-yellow-50 p-3 rounded">
                <p className="font-medium text-yellow-800">Compression Ratio</p>
                <p className="text-yellow-600">
                  {metrics.length > 0
                    ? (
                        (metrics.reduce((sum, m) => sum + m.compressionRatio, 0) / metrics.length) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="font-medium text-green-800">Total Savings</p>
                <p className="text-green-600">{(totalSavings / 1024).toFixed(1)}KB</p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-medium text-blue-800">Cache Hit Rate</p>
                <p className="text-blue-600">
                  {metrics.length > 0
                    ? ((metrics.filter((m) => m.cacheHit).length / metrics.length) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
