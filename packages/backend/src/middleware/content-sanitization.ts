/**
 * 🧹 **COMPREHENSIVE CONTENT SANITIZATION SYSTEM**
 *
 * US-132: Content Sanitization Implementation
 *
 * Elite Security Features:
 * - Content Sanitization System Design (9.10.1)
 * - HTML Sanitization (9.10.2)
 * - File Upload Validation (9.10.3)
 * - Malware Scanning Capabilities (9.10.4)
 * - Content Filtering Rules (9.10.5)
 * - Sanitization Monitoring (9.10.6)
 * - Sanitization Bypass Detection (9.10.7)
 * - Content Sanitization Effectiveness Testing (9.10.8)
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import path from 'path';

// Import the input validation framework
import { ValidationError } from './input-validation';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface SanitizationResult {
  success: boolean;
  sanitized?: any;
  originalSize: number;
  sanitizedSize: number;
  threatsDetected: string[];
  filteringApplied: string[];
  errors?: ValidationError[];
  processingTime: number;
}

export interface FileValidationResult {
  isValid: boolean;
  fileType: string;
  mimeType: string;
  size: number;
  hash: string;
  threats: string[];
  metadata: Record<string, any>;
}

export interface ContentFilterRule {
  id: string;
  name: string;
  pattern: RegExp;
  action: 'block' | 'sanitize' | 'flag';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

export interface SanitizationConfig {
  allowedHtmlTags: string[];
  allowedAttributes: string[];
  allowedFileTypes: string[];
  maxFileSize: number;
  maxTextLength: number;
  enableMalwareScanning: boolean;
  enableContentFiltering: boolean;
  customFilters: ContentFilterRule[];
}

// =====================================================
// 9.10.1 CONTENT SANITIZATION SYSTEM DESIGN
// =====================================================

export class ContentSanitizationSystem {
  private static instance: ContentSanitizationSystem;
  private config: SanitizationConfig;
  private filterRules: Map<string, ContentFilterRule>;
  private sanitizationStats: Map<string, number>;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.filterRules = new Map();
    this.sanitizationStats = new Map();
    this.initializeDefaultFilters();
  }

  static getInstance(): ContentSanitizationSystem {
    if (!ContentSanitizationSystem.instance) {
      ContentSanitizationSystem.instance = new ContentSanitizationSystem();
    }
    return ContentSanitizationSystem.instance;
  }

  private getDefaultConfig(): SanitizationConfig {
    return {
      allowedHtmlTags: [
        'p',
        'br',
        'strong',
        'em',
        'b',
        'i',
        'u',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'blockquote',
        'a',
        'img',
        'code',
        'pre',
      ],
      allowedAttributes: ['href', 'src', 'alt', 'title', 'class'],
      allowedFileTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'video/mp4',
        'video/webm',
        'audio/mp3',
        'audio/wav',
        'application/pdf',
        'text/plain',
        'text/markdown',
      ],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxTextLength: 50000, // 50K characters
      enableMalwareScanning: true,
      enableContentFiltering: true,
      customFilters: [],
    };
  }

  private initializeDefaultFilters(): void {
    const defaultFilters: ContentFilterRule[] = [
      {
        id: 'profanity-filter',
        name: 'Profanity Filter',
        pattern: /\b(f[*]ck|sh[*]t|d[*]mn|b[*]tch|a[*]s)\b/gi,
        action: 'sanitize',
        severity: 'medium',
        category: 'language',
      },
      {
        id: 'spam-detection',
        name: 'Spam Detection',
        pattern: /(click here|buy now|limited time|act now|urgent|free money)/gi,
        action: 'flag',
        severity: 'low',
        category: 'spam',
      },
      {
        id: 'personal-info',
        name: 'Personal Information',
        pattern: /\b\d{3}-\d{2}-\d{4}\b|\b\d{4}\s\d{4}\s\d{4}\s\d{4}\b/g,
        action: 'sanitize',
        severity: 'high',
        category: 'privacy',
      },
      {
        id: 'malicious-urls',
        name: 'Malicious URL Detection',
        pattern: /(bit\.ly|tinyurl|t\.co|short\.link|goo\.gl)\/[^\s]+/gi,
        action: 'block',
        severity: 'high',
        category: 'security',
      },
      {
        id: 'phishing-keywords',
        name: 'Phishing Keywords',
        pattern:
          /(verify account|suspended account|click to verify|update payment|security alert)/gi,
        action: 'block',
        severity: 'critical',
        category: 'security',
      },
    ];

    defaultFilters.forEach((filter) => {
      this.filterRules.set(filter.id, filter);
    });
  }

  public updateConfig(newConfig: Partial<SanitizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public addCustomFilter(filter: ContentFilterRule): void {
    this.filterRules.set(filter.id, filter);
  }

  public removeFilter(filterId: string): boolean {
    return this.filterRules.delete(filterId);
  }

  public getStats(): Record<string, number> {
    return Object.fromEntries(this.sanitizationStats);
  }

  private incrementStat(key: string): void {
    this.sanitizationStats.set(key, (this.sanitizationStats.get(key) || 0) + 1);
  }
}

// =====================================================
// 9.10.2 HTML SANITIZATION
// =====================================================

export class AdvancedHTMLSanitizer {
  private config: SanitizationConfig;

  constructor(config: SanitizationConfig) {
    this.config = config;
  }

  sanitizeHTML(input: string): { sanitized: string; threatsDetected: string[] } {
    const threatsDetected: string[] = [];
    let sanitized = input;

    // 1. Detect and remove script tags
    const scriptRegex = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
    if (scriptRegex.test(sanitized)) {
      threatsDetected.push('SCRIPT_TAG_DETECTED');
      sanitized = sanitized.replace(scriptRegex, '');
    }

    // 2. Detect and sanitize event handlers
    const eventHandlerRegex = /on\w+\s*=\s*["'][^"']*["']/gi;
    if (eventHandlerRegex.test(sanitized)) {
      threatsDetected.push('EVENT_HANDLER_DETECTED');
      sanitized = sanitized.replace(eventHandlerRegex, '');
    }

    // 3. Detect and sanitize javascript: URLs
    const jsUrlRegex = /javascript\s*:/gi;
    if (jsUrlRegex.test(sanitized)) {
      threatsDetected.push('JAVASCRIPT_URL_DETECTED');
      sanitized = sanitized.replace(jsUrlRegex, 'about:blank');
    }

    // 4. Detect and sanitize data URLs with JavaScript
    const dataUrlRegex = /data\s*:\s*text\/html/gi;
    if (dataUrlRegex.test(sanitized)) {
      threatsDetected.push('DATA_URL_HTML_DETECTED');
      sanitized = sanitized.replace(dataUrlRegex, 'about:blank');
    }

    // 5. Remove dangerous style expressions
    const styleExpressionRegex = /expression\s*\(/gi;
    if (styleExpressionRegex.test(sanitized)) {
      threatsDetected.push('CSS_EXPRESSION_DETECTED');
      sanitized = sanitized.replace(styleExpressionRegex, '');
    }

    // 6. Sanitize allowed tags and attributes
    sanitized = this.sanitizeAllowedElements(sanitized);

    // 7. Encode remaining dangerous characters
    sanitized = this.encodeSpecialCharacters(sanitized);

    return { sanitized, threatsDetected };
  }

  private sanitizeAllowedElements(html: string): string {
    // Simple tag whitelist implementation
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi;

    return html.replace(tagRegex, (match, tagName) => {
      if (!this.config.allowedHtmlTags.includes(tagName.toLowerCase())) {
        return ''; // Remove disallowed tags
      }

      // For allowed tags, sanitize attributes
      return this.sanitizeAttributes(match);
    });
  }

  private sanitizeAttributes(tag: string): string {
    // Extract and validate attributes
    const attrRegex = /(\w+)\s*=\s*["']([^"']*)["']/gi;

    return tag.replace(attrRegex, (match, attrName, attrValue) => {
      if (!this.config.allowedAttributes.includes(attrName.toLowerCase())) {
        return ''; // Remove disallowed attributes
      }

      // Validate attribute values
      const sanitizedValue = this.sanitizeAttributeValue(attrName, attrValue);
      return `${attrName}="${sanitizedValue}"`;
    });
  }

  private sanitizeAttributeValue(attrName: string, attrValue: string): string {
    // Remove potentially dangerous attribute values
    let sanitized = attrValue;

    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript\s*:/gi, 'about:blank');

    // Remove data: URLs (except for images)
    if (attrName.toLowerCase() !== 'src' || !sanitized.startsWith('data:image/')) {
      sanitized = sanitized.replace(/data\s*:/gi, 'about:blank');
    }

    // Remove vbscript: URLs
    sanitized = sanitized.replace(/vbscript\s*:/gi, 'about:blank');

    return sanitized;
  }

  private encodeSpecialCharacters(text: string): string {
    const entityMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };

    return text.replace(/[<>"'\/]/g, (char) => entityMap[char] || char);
  }
}

// =====================================================
// 9.10.3 FILE UPLOAD VALIDATION
// =====================================================

export class FileUploadValidator {
  private config: SanitizationConfig;
  private magicNumbers: Map<string, Buffer[]>;

  constructor(config: SanitizationConfig) {
    this.config = config;
    this.magicNumbers = new Map();
    this.initializeMagicNumbers();
  }

  private initializeMagicNumbers(): void {
    // File type magic numbers for validation
    this.magicNumbers.set('image/jpeg', [Buffer.from([0xff, 0xd8, 0xff])]);
    this.magicNumbers.set('image/png', [Buffer.from([0x89, 0x50, 0x4e, 0x47])]);
    this.magicNumbers.set('image/gif', [Buffer.from([0x47, 0x49, 0x46])]);
    this.magicNumbers.set('application/pdf', [Buffer.from([0x25, 0x50, 0x44, 0x46])]);
    this.magicNumbers.set('video/mp4', [Buffer.from([0x66, 0x74, 0x79, 0x70])]);
  }

  async validateFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: false,
      fileType: path.extname(originalName).toLowerCase(),
      mimeType,
      size: buffer.length,
      hash: this.calculateFileHash(buffer),
      threats: [],
      metadata: {},
    };

    // 1. Size validation
    if (buffer.length > this.config.maxFileSize) {
      result.threats.push('FILE_TOO_LARGE');
      return result;
    }

    // 2. MIME type validation
    if (!this.config.allowedFileTypes.includes(mimeType)) {
      result.threats.push('INVALID_MIME_TYPE');
      return result;
    }

    // 3. File extension validation
    const allowedExtensions = this.getAllowedExtensions();
    if (!allowedExtensions.includes(result.fileType)) {
      result.threats.push('INVALID_FILE_EXTENSION');
      return result;
    }

    // 4. Magic number validation
    if (!this.validateMagicNumbers(buffer, mimeType)) {
      result.threats.push('MAGIC_NUMBER_MISMATCH');
      return result;
    }

    // 5. File content analysis
    const contentThreats = await this.analyzeFileContent(buffer, mimeType);
    result.threats.push(...contentThreats);

    // 6. Metadata extraction
    result.metadata = this.extractMetadata(buffer, mimeType);

    result.isValid = result.threats.length === 0;
    return result;
  }

  private getAllowedExtensions(): string[] {
    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'text/markdown': '.md',
    };

    return Object.values(extensionMap);
  }

  private validateMagicNumbers(buffer: Buffer, mimeType: string): boolean {
    const magicNumbers = this.magicNumbers.get(mimeType);
    if (!magicNumbers) {
      return true; // No magic numbers defined for this type
    }

    return magicNumbers.some((magic) => {
      return buffer.subarray(0, magic.length).equals(magic);
    });
  }

  private async analyzeFileContent(buffer: Buffer, mimeType: string): Promise<string[]> {
    const threats: string[] = [];

    // Check for embedded scripts in images
    if (mimeType.startsWith('image/')) {
      if (this.detectEmbeddedScript(buffer)) {
        threats.push('EMBEDDED_SCRIPT_DETECTED');
      }
    }

    // Check for malicious patterns
    if (this.detectMaliciousPatterns(buffer)) {
      threats.push('MALICIOUS_PATTERN_DETECTED');
    }

    // Check for polyglot files
    if (this.detectPolyglotFile(buffer)) {
      threats.push('POLYGLOT_FILE_DETECTED');
    }

    return threats;
  }

  private detectEmbeddedScript(buffer: Buffer): boolean {
    const content = buffer.toString('utf8');
    const scriptPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\./i,
      /window\./i,
    ];

    return scriptPatterns.some((pattern) => pattern.test(content));
  }

  private detectMaliciousPatterns(buffer: Buffer): boolean {
    const content = buffer.toString('binary');
    const maliciousPatterns = [
      // Executable signatures
      /MZ[\x00-\xFF]{58}PE/,
      // Shell scripts
      /^#!\/bin\//,
      // PHP tags
      /<\?php/i,
      // SQL injection patterns
      /(union|select|insert|drop|delete)\s+/gi,
    ];

    return maliciousPatterns.some((pattern) => pattern.test(content));
  }

  private detectPolyglotFile(buffer: Buffer): boolean {
    // Check if file has multiple valid file format signatures
    const signatures = [
      Buffer.from([0xff, 0xd8]), // JPEG
      Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG
      Buffer.from([0x47, 0x49, 0x46]), // GIF
      Buffer.from([0x25, 0x50, 0x44, 0x46]), // PDF
    ];

    let matchCount = 0;
    for (const sig of signatures) {
      if (buffer.includes(sig)) {
        matchCount++;
      }
    }

    return matchCount > 1;
  }

  private extractMetadata(buffer: Buffer, mimeType: string): Record<string, any> {
    const metadata: Record<string, any> = {
      size: buffer.length,
      hash: this.calculateFileHash(buffer),
      uploadTimestamp: new Date().toISOString(),
    };

    if (mimeType.startsWith('image/')) {
      // Extract basic image metadata
      metadata.imageData = this.extractImageMetadata(buffer);
    }

    return metadata;
  }

  private extractImageMetadata(buffer: Buffer): Record<string, any> {
    // Basic image metadata extraction
    // In production, use libraries like 'exif-parser' or 'sharp'
    return {
      hasExifData: buffer.includes(Buffer.from('Exif')),
      hasIccProfile: buffer.includes(Buffer.from('ICC_PROFILE')),
    };
  }

  private calculateFileHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}

// =====================================================
// 9.10.4 MALWARE SCANNING CAPABILITIES
// =====================================================

export class MalwareScanner {
  private virusSignatures: Map<string, Buffer>;
  private suspiciousPatterns: RegExp[];

  constructor() {
    this.virusSignatures = new Map();
    this.suspiciousPatterns = [];
    this.initializeSignatures();
  }

  private initializeSignatures(): void {
    // Initialize known malware signatures (simplified for demo)
    this.virusSignatures.set(
      'EICAR_TEST',
      Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')
    );

    // Suspicious patterns
    this.suspiciousPatterns = [
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /shell_exec\s*\(/gi,
      /passthru\s*\(/gi,
      /cmd\.exe/gi,
      /powershell/gi,
      /\/bin\/sh/gi,
      /\/bin\/bash/gi,
    ];
  }

  async scanBuffer(buffer: Buffer): Promise<{ threats: string[]; score: number }> {
    const threats: string[] = [];
    let riskScore = 0;

    // 1. Signature-based scanning
    for (const [name, signature] of this.virusSignatures) {
      if (buffer.includes(signature)) {
        threats.push(`MALWARE_SIGNATURE_${name}`);
        riskScore += 100; // Maximum risk for known malware
      }
    }

    // 2. Pattern-based analysis
    const content = buffer.toString('utf8');
    for (const pattern of this.suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        threats.push(`SUSPICIOUS_PATTERN_${pattern.source}`);
        riskScore += matches.length * 10;
      }
    }

    // 3. Entropy analysis (detect encrypted/obfuscated content)
    const entropy = this.calculateEntropy(buffer);
    if (entropy > 7.5) {
      // High entropy indicates potential obfuscation
      threats.push('HIGH_ENTROPY_DETECTED');
      riskScore += 25;
    }

    // 4. File structure analysis
    const structureThreats = this.analyzeFileStructure(buffer);
    threats.push(...structureThreats);
    riskScore += structureThreats.length * 15;

    return {
      threats,
      score: Math.min(riskScore, 100), // Cap at 100
    };
  }

  private calculateEntropy(buffer: Buffer): number {
    const frequency: Record<number, number> = {};

    // Count byte frequencies
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      frequency[byte] = (frequency[byte] || 0) + 1;
    }

    // Calculate Shannon entropy
    let entropy = 0;
    const length = buffer.length;

    for (const count of Object.values(frequency)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  private analyzeFileStructure(buffer: Buffer): string[] {
    const threats: string[] = [];

    // Check for suspicious file structure patterns
    if (this.hasUnusualPadding(buffer)) {
      threats.push('UNUSUAL_PADDING_DETECTED');
    }

    if (this.hasHiddenContent(buffer)) {
      threats.push('HIDDEN_CONTENT_DETECTED');
    }

    if (this.hasAntiAnalysisFeatures(buffer)) {
      threats.push('ANTI_ANALYSIS_DETECTED');
    }

    return threats;
  }

  private hasUnusualPadding(buffer: Buffer): boolean {
    // Check for excessive null bytes or padding
    const nullBytes = buffer.filter((byte) => byte === 0).length;
    return nullBytes > buffer.length * 0.5; // More than 50% null bytes
  }

  private hasHiddenContent(buffer: Buffer): boolean {
    // Look for content hidden in file structure
    const content = buffer.toString('binary');

    // Check for steganographic markers
    const stegoPatterns = [/StegHide/i, /outguess/i, /jsteg/i, /F5/i];

    return stegoPatterns.some((pattern) => pattern.test(content));
  }

  private hasAntiAnalysisFeatures(buffer: Buffer): boolean {
    const content = buffer.toString('binary');

    // Check for anti-analysis techniques
    const antiAnalysisPatterns = [
      /VirtualBox/i,
      /VMware/i,
      /QEMU/i,
      /debugger/i,
      /analysis/i,
      /sandbox/i,
    ];

    return antiAnalysisPatterns.some((pattern) => pattern.test(content));
  }
}

// =====================================================
// 9.10.5 CONTENT FILTERING RULES
// =====================================================

export class ContentFilter {
  private rules: Map<string, ContentFilterRule>;
  private sanitizer: AdvancedHTMLSanitizer;

  constructor(config: SanitizationConfig) {
    this.rules = new Map();
    this.sanitizer = new AdvancedHTMLSanitizer(config);
    this.initializeRules(config.customFilters);
  }

  private initializeRules(customFilters: ContentFilterRule[]): void {
    // Add custom filters
    customFilters.forEach((filter) => {
      this.rules.set(filter.id, filter);
    });
  }

  applyFilters(content: string): {
    filtered: string;
    rulesApplied: string[];
    blocked: boolean;
  } {
    let filtered = content;
    const rulesApplied: string[] = [];
    let blocked = false;

    for (const [id, rule] of this.rules) {
      const matches = content.match(rule.pattern);

      if (matches) {
        rulesApplied.push(id);

        switch (rule.action) {
          case 'block':
            blocked = true;
            break;

          case 'sanitize':
            filtered = filtered.replace(rule.pattern, this.getSanitizationReplacement(rule));
            break;

          case 'flag':
            // Content is flagged but not modified
            break;
        }
      }
    }

    return { filtered, rulesApplied, blocked };
  }

  private getSanitizationReplacement(rule: ContentFilterRule): string {
    switch (rule.category) {
      case 'language':
        return '[FILTERED]';
      case 'privacy':
        return '[REDACTED]';
      case 'security':
        return '[BLOCKED_CONTENT]';
      default:
        return '[FILTERED_CONTENT]';
    }
  }

  addRule(rule: ContentFilterRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRules(): ContentFilterRule[] {
    return Array.from(this.rules.values());
  }
}

// =====================================================
// 9.10.6 SANITIZATION MONITORING
// =====================================================

export class SanitizationMonitor {
  private events: Array<{
    timestamp: Date;
    type: string;
    severity: string;
    details: any;
  }> = [];

  private metrics = {
    totalRequests: 0,
    sanitizedRequests: 0,
    blockedRequests: 0,
    threatsDetected: 0,
    averageProcessingTime: 0,
  };

  logEvent(type: string, severity: string, details: any): void {
    this.events.push({
      timestamp: new Date(),
      type,
      severity,
      details,
    });

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    this.updateMetrics(type, details);
  }

  private updateMetrics(type: string, details: any): void {
    this.metrics.totalRequests++;

    if (type === 'CONTENT_SANITIZED') {
      this.metrics.sanitizedRequests++;
    }

    if (type === 'CONTENT_BLOCKED') {
      this.metrics.blockedRequests++;
    }

    if (details.threatsDetected?.length > 0) {
      this.metrics.threatsDetected += details.threatsDetected.length;
    }

    if (details.processingTime) {
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime + details.processingTime) / 2;
    }
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  getRecentEvents(limit = 100): typeof this.events {
    return this.events.slice(-limit);
  }

  generateReport(): {
    summary: typeof this.metrics;
    topThreats: Array<{ threat: string; count: number }>;
    timeDistribution: Record<string, number>;
  } {
    const threatCounts: Record<string, number> = {};
    const hourCounts: Record<string, number> = {};

    this.events.forEach((event) => {
      // Count threats
      if (event.details.threatsDetected) {
        event.details.threatsDetected.forEach((threat: string) => {
          threatCounts[threat] = (threatCounts[threat] || 0) + 1;
        });
      }

      // Count by hour
      const hour = event.timestamp.getHours().toString();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const topThreats = Object.entries(threatCounts)
      .map(([threat, count]) => ({ threat, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      summary: this.getMetrics(),
      topThreats,
      timeDistribution: hourCounts,
    };
  }
}

// =====================================================
// 9.10.7 SANITIZATION BYPASS DETECTION
// =====================================================

export class BypassDetector {
  private bypassPatterns: RegExp[];
  private encodingPatterns: RegExp[];
  private obfuscationPatterns: RegExp[];

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Common bypass techniques
    this.bypassPatterns = [
      // HTML entity encoding bypasses
      /&#x?\d+;/g,
      // URL encoding bypasses
      /%[0-9a-fA-F]{2}/g,
      // Double encoding
      /%25[0-9a-fA-F]{2}/g,
      // Unicode bypasses
      /\\u[0-9a-fA-F]{4}/g,
      // Character concatenation
      /['"][\s]*\+[\s]*['"]/g,
    ];

    this.encodingPatterns = [
      // Base64 encoded content
      /[A-Za-z0-9+\/]{20,}={0,2}/g,
      // Hex encoded content
      /(?:0x|\\x)[0-9a-fA-F]{2,}/g,
    ];

    this.obfuscationPatterns = [
      // String splitting and concatenation
      /['"][^'"]*['"][\s]*\+[\s]*['"][^'"]*['"]/g,
      // Character code manipulation
      /String\.fromCharCode/gi,
      // Eval with encoded content
      /eval\s*\(\s*(?:atob|unescape|decodeURI)/gi,
    ];
  }

  detectBypassAttempts(content: string): {
    bypasses: string[];
    score: number;
    decodedContent?: string;
  } {
    const bypasses: string[] = [];
    let score = 0;
    let decodedContent = content;

    // Check for bypass patterns
    this.bypassPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        bypasses.push(`BYPASS_PATTERN_${index}`);
        score += 20;
      }
    });

    // Check for encoding patterns
    this.encodingPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        bypasses.push(`ENCODING_PATTERN_${index}`);
        score += 15;

        // Attempt to decode
        try {
          decodedContent = this.attemptDecoding(content);
        } catch (error) {
          // Decoding failed, increase suspicion
          score += 10;
        }
      }
    });

    // Check for obfuscation patterns
    this.obfuscationPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        bypasses.push(`OBFUSCATION_PATTERN_${index}`);
        score += 25;
      }
    });

    return { bypasses, score, decodedContent };
  }

  private attemptDecoding(content: string): string {
    let decoded = content;

    // Try HTML entity decoding
    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(parseInt(dec, 10));
    });

    // Try URL decoding
    try {
      decoded = decodeURIComponent(decoded);
    } catch (error) {
      // URL decoding failed
    }

    // Try Base64 decoding (simple check)
    const base64Regex = /[A-Za-z0-9+\/]{20,}={0,2}/g;
    decoded = decoded.replace(base64Regex, (match) => {
      try {
        return Buffer.from(match, 'base64').toString('utf8');
      } catch (error) {
        return match; // Return original if decoding fails
      }
    });

    return decoded;
  }
}

// =====================================================
// MAIN CONTENT SANITIZATION MIDDLEWARE
// =====================================================

export function createContentSanitizationMiddleware(options: Partial<SanitizationConfig> = {}) {
  const system = ContentSanitizationSystem.getInstance();
  system.updateConfig(options);

  const monitor = new SanitizationMonitor();
  const bypassDetector = new BypassDetector();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const config = system['config']; // Access private config

      // Initialize components
      const htmlSanitizer = new AdvancedHTMLSanitizer(config);
      const fileValidator = new FileUploadValidator(config);
      const malwareScanner = new MalwareScanner();
      const contentFilter = new ContentFilter(config);

      const result: SanitizationResult = {
        success: false,
        originalSize: 0,
        sanitizedSize: 0,
        threatsDetected: [],
        filteringApplied: [],
        processingTime: 0,
      };

      // 1. Sanitize text content
      if (req.body && typeof req.body === 'object') {
        const sanitizedBody = await sanitizeObjectContent(
          req.body,
          htmlSanitizer,
          contentFilter,
          bypassDetector
        );

        req.body = sanitizedBody.sanitized;
        result.threatsDetected.push(...sanitizedBody.threatsDetected);
        result.filteringApplied.push(...sanitizedBody.filteringApplied);
      }

      // 2. Validate file uploads
      if (req.file) {
        const fileResult = await fileValidator.validateFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        if (!fileResult.isValid) {
          monitor.logEvent('FILE_BLOCKED', 'high', {
            fileName: req.file.originalname,
            threats: fileResult.threats,
            size: fileResult.size,
          });

          res.status(400).json({
            success: false,
            error: 'File validation failed',
            code: 'FILE_VALIDATION_ERROR',
            threats: fileResult.threats,
          });
          return;
        }

        // Malware scanning
        if (config.enableMalwareScanning) {
          const scanResult = await malwareScanner.scanBuffer(req.file.buffer);
          if (scanResult.score > 50) {
            // High risk threshold
            monitor.logEvent('MALWARE_DETECTED', 'critical', {
              fileName: req.file.originalname,
              threats: scanResult.threats,
              riskScore: scanResult.score,
            });

            res.status(400).json({
              success: false,
              error: 'Malware detected in file',
              code: 'MALWARE_DETECTED',
              riskScore: scanResult.score,
            });
            return;
          }

          result.threatsDetected.push(...scanResult.threats);
        }
      }

      // 3. Calculate processing metrics
      result.processingTime = Date.now() - startTime;
      result.success = true;

      // 4. Log sanitization event
      monitor.logEvent('CONTENT_SANITIZED', 'info', {
        threatsDetected: result.threatsDetected,
        filteringApplied: result.filteringApplied,
        processingTime: result.processingTime,
        url: req.originalUrl,
      });

      // 5. Attach sanitization metadata
      req.sanitizationMeta = result;

      next();
    } catch (error) {
      console.error('Content sanitization error:', error);
      res.status(500).json({
        success: false,
        error: 'Content sanitization service error',
        code: 'SANITIZATION_SERVICE_ERROR',
      });
      return;
    }
  };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function sanitizeObjectContent(
  obj: any,
  htmlSanitizer: AdvancedHTMLSanitizer,
  contentFilter: ContentFilter,
  bypassDetector: BypassDetector
): Promise<{
  sanitized: any;
  threatsDetected: string[];
  filteringApplied: string[];
}> {
  const threatsDetected: string[] = [];
  const filteringApplied: string[] = [];

  function sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      // 1. Detect bypass attempts
      const bypassResult = bypassDetector.detectBypassAttempts(value);
      if (bypassResult.bypasses.length > 0) {
        threatsDetected.push(...bypassResult.bypasses);
        value = bypassResult.decodedContent || value;
      }

      // 2. Apply content filters
      const filterResult = contentFilter.applyFilters(value);
      if (filterResult.blocked) {
        throw new Error('Content blocked by filter rules');
      }
      filteringApplied.push(...filterResult.rulesApplied);
      value = filterResult.filtered;

      // 3. HTML sanitization
      const htmlResult = htmlSanitizer.sanitizeHTML(value);
      threatsDetected.push(...htmlResult.threatsDetected);
      return htmlResult.sanitized;
    }

    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[sanitizeValue(key)] = sanitizeValue(val);
      }
      return sanitized;
    }

    return value;
  }

  const sanitized = sanitizeValue(obj);
  return { sanitized, threatsDetected, filteringApplied };
}

// =====================================================
// TYPE EXTENSIONS
// =====================================================

declare global {
  namespace Express {
    interface Request {
      sanitizationMeta?: SanitizationResult;
    }
  }
}

// =====================================================
// 9.10.8 CONTENT SANITIZATION TESTING UTILITIES
// =====================================================

export const ContentSanitizationTestSuite = {
  htmlTests: [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<div onclick="alert("XSS")">Click me</div>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')"></iframe>',
  ],

  bypassTests: [
    '&#60;script&#62;alert(1)&#60;/script&#62;',
    '%3Cscript%3Ealert(1)%3C/script%3E',
    '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e',
    '"' + '+' + '"alert(1)"' + '+' + '"',
    'eval(atob("YWxlcnQoMSk="))', // Base64 encoded alert(1)
  ],

  fileTests: [
    {
      name: 'malicious.exe',
      content: Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00'),
      mimeType: 'application/octet-stream',
    },
    {
      name: 'test.jpg',
      content: Buffer.from('\xff\xd8\xff\xe0\x00\x10JFIF'),
      mimeType: 'image/jpeg',
    },
  ],

  async runTests(): Promise<{
    htmlTests: Array<{ input: string; sanitized: string; threatsDetected: string[] }>;
    bypassTests: Array<{ input: string; bypasses: string[]; score: number }>;
    fileTests: Array<{ name: string; isValid: boolean; threats: string[] }>;
  }> {
    const config: SanitizationConfig = {
      allowedHtmlTags: ['p', 'br', 'strong', 'em'],
      allowedAttributes: [],
      allowedFileTypes: ['image/jpeg', 'image/png'],
      maxFileSize: 1024 * 1024,
      maxTextLength: 1000,
      enableMalwareScanning: true,
      enableContentFiltering: true,
      customFilters: [],
    };

    const htmlSanitizer = new AdvancedHTMLSanitizer(config);
    const bypassDetector = new BypassDetector();
    const fileValidator = new FileUploadValidator(config);

    return {
      htmlTests: this.htmlTests.map((input) => {
        const result = htmlSanitizer.sanitizeHTML(input);
        return {
          input,
          sanitized: result.sanitized,
          threatsDetected: result.threatsDetected,
        };
      }),
      bypassTests: this.bypassTests.map((input) => {
        const result = bypassDetector.detectBypassAttempts(input);
        return {
          input,
          bypasses: result.bypasses,
          score: result.score,
        };
      }),
      fileTests: await Promise.all(
        this.fileTests.map(async (test) => {
          const result = await fileValidator.validateFile(test.content, test.name, test.mimeType);
          return {
            name: test.name,
            isValid: result.isValid,
            threats: result.threats,
          };
        })
      ),
    };
  },
};

// =====================================================
// EXPORTS
// =====================================================

export {
  AdvancedHTMLSanitizer,
  BypassDetector,
  ContentFilter,
  ContentSanitizationSystem,
  FileUploadValidator,
  MalwareScanner,
  SanitizationMonitor,
};
