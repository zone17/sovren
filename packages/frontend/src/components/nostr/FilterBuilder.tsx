/**
 * FilterBuilder Component
 *
 * US-314: Build NOSTR Filter Builder UI Component
 * Epic 003: NOSTR Consolidation
 *
 * Visual interface for constructing NOSTR subscription filters
 * without writing code. Supports presets, validation, templates,
 * and import/export functionality.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  NostrFilter,
  NostrFilterBuilder,
  CommonFilters,
  validateFilter,
  optimizeFilter,
  NostrEventKind,
} from '@shared/types/nostr';
import {
  Plus,
  X,
  Copy,
  Upload,
  Download,
  Save,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Filter as FilterIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

// ========================================
// Types
// ========================================

interface FilterBuilderProps {
  /** Callback when filter changes */
  onFilterChange?: (filter: NostrFilter) => void;
  /** Initial filter to load */
  initialFilter?: NostrFilter;
  /** Current user's pubkey (for presets) */
  currentPubkey?: string;
  /** Custom class name */
  className?: string;
  /** Show advanced fields by default */
  showAdvanced?: boolean;
}

interface FilterTemplate {
  name: string;
  filter: NostrFilter;
  created: number;
}

interface ValidationFeedback {
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// ========================================
// Constants
// ========================================

const EVENT_KIND_OPTIONS = [
  { value: NostrEventKind.METADATA, label: 'Metadata (0)' },
  { value: NostrEventKind.TEXT_NOTE, label: 'Text Note (1)' },
  { value: NostrEventKind.RECOMMEND_RELAY, label: 'Recommend Relay (2)' },
  { value: NostrEventKind.CONTACTS, label: 'Contacts (3)' },
  { value: NostrEventKind.ENCRYPTED_DIRECT_MESSAGE, label: 'Encrypted DM (4)' },
  { value: NostrEventKind.DELETE, label: 'Delete (5)' },
  { value: NostrEventKind.REPOST, label: 'Repost (6)' },
  { value: NostrEventKind.REACTION, label: 'Reaction (7)' },
  { value: NostrEventKind.CHANNEL_CREATE, label: 'Channel Create (40)' },
  { value: NostrEventKind.CHANNEL_METADATA, label: 'Channel Metadata (41)' },
  { value: NostrEventKind.LONG_FORM, label: 'Long Form (30023)' },
];

const TAG_TYPE_OPTIONS = [
  { value: 'e', label: 'Event Reference (#e)' },
  { value: 'p', label: 'Pubkey Reference (#p)' },
  { value: 't', label: 'Hashtag (#t)' },
  { value: 'a', label: 'Address (#a)' },
  { value: 'd', label: 'Identifier (#d)' },
  { value: 'r', label: 'Reference (#r)' },
  { value: 'g', label: 'Geohash (#g)' },
];

const TEMPLATES_STORAGE_KEY = 'nostr-filter-templates';

// ========================================
// Utility Functions
// ========================================

const isValidHex = (str: string, length = 64): boolean => {
  return new RegExp(`^[0-9a-f]{${length}}$`, 'i').test(str);
};

const isValidNpub = (str: string): boolean => {
  return str.startsWith('npub1') && str.length === 63;
};

const parseTimestamp = (input: string): number | null => {
  if (!input) return null;

  // Try parsing as direct timestamp
  const timestamp = parseInt(input, 10);
  if (!isNaN(timestamp) && timestamp > 0) {
    return timestamp;
  }

  // Try parsing as date
  const date = new Date(input);
  if (!isNaN(date.getTime())) {
    return Math.floor(date.getTime() / 1000);
  }

  return null;
};

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toISOString().slice(0, 16);
};

// ========================================
// FilterBuilder Component
// ========================================

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  onFilterChange,
  initialFilter,
  currentPubkey,
  className = '',
  showAdvanced = false,
}) => {
  // ========================================
  // State
  // ========================================

  const [filter, setFilter] = useState<Partial<NostrFilter>>(initialFilter || {});
  const [validation, setValidation] = useState<ValidationFeedback>({
    errors: [],
    warnings: [],
    suggestions: [],
  });

  // Field input states
  const [idInput, setIdInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [selectedKinds, setSelectedKinds] = useState<number[]>(filter.kinds || []);
  const [limitInput, setLimitInput] = useState((filter.limit || 50).toString());
  const [sinceInput, setSinceInput] = useState(
    filter.since ? formatTimestamp(filter.since) : ''
  );
  const [untilInput, setUntilInput] = useState(
    filter.until ? formatTimestamp(filter.until) : ''
  );

  // Tag filters
  const [tagType, setTagType] = useState('e');
  const [tagValue, setTagValue] = useState('');
  const [customTagKey, setCustomTagKey] = useState('');

  // Templates
  const [templates, setTemplates] = useState<FilterTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  // Import/Export
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJson, setImportJson] = useState('');

  // UI state
  const [showAdvancedFields, setShowAdvancedFields] = useState(showAdvanced);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // ========================================
  // Effects
  // ========================================

  // Load templates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (stored) {
        setTemplates(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, []);

  // Validate filter on change
  useEffect(() => {
    const result = validateFilter(filter as NostrFilter);
    setValidation({
      errors: result.errors,
      warnings: result.warnings,
      suggestions: result.suggestions,
    });
  }, [filter]);

  // Notify parent of filter changes
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filter as NostrFilter);
    }
  }, [filter, onFilterChange]);

  // ========================================
  // Filter Building Functions
  // ========================================

  const updateFilter = useCallback((updates: Partial<NostrFilter>) => {
    setFilter((prev) => {
      const updated = { ...prev, ...updates };
      // Remove empty arrays
      Object.keys(updated).forEach((key) => {
        const value = updated[key as keyof NostrFilter];
        if (Array.isArray(value) && value.length === 0) {
          delete updated[key as keyof NostrFilter];
        }
      });
      return updated;
    });
  }, []);

  const addEventId = useCallback(() => {
    const trimmed = idInput.trim();
    if (!trimmed) return;

    if (!isValidHex(trimmed, 64)) {
      setValidation((prev) => ({
        ...prev,
        errors: [...prev.errors, 'Invalid event ID format. Must be 64 character hex string.'],
      }));
      return;
    }

    const ids = filter.ids || [];
    if (!ids.includes(trimmed)) {
      updateFilter({ ids: [...ids, trimmed] });
      setIdInput('');
    }
  }, [idInput, filter.ids, updateFilter]);

  const removeEventId = useCallback(
    (id: string) => {
      const ids = (filter.ids || []).filter((i) => i !== id);
      updateFilter({ ids: ids.length > 0 ? ids : undefined });
    },
    [filter.ids, updateFilter]
  );

  const addAuthor = useCallback(() => {
    const trimmed = authorInput.trim();
    if (!trimmed) return;

    // Support both hex and npub formats
    let pubkeyHex = trimmed;
    if (isValidNpub(trimmed)) {
      // In a real implementation, decode npub to hex
      // For now, just validate format
      setValidation((prev) => ({
        ...prev,
        errors: [...prev.errors, 'Npub decoding not yet implemented. Please use hex pubkey.'],
      }));
      return;
    }

    if (!isValidHex(pubkeyHex, 64)) {
      setValidation((prev) => ({
        ...prev,
        errors: [...prev.errors, 'Invalid pubkey format. Must be 64 character hex string or npub.'],
      }));
      return;
    }

    const authors = filter.authors || [];
    if (!authors.includes(pubkeyHex)) {
      updateFilter({ authors: [...authors, pubkeyHex] });
      setAuthorInput('');
    }
  }, [authorInput, filter.authors, updateFilter]);

  const removeAuthor = useCallback(
    (author: string) => {
      const authors = (filter.authors || []).filter((a) => a !== author);
      updateFilter({ authors: authors.length > 0 ? authors : undefined });
    },
    [filter.authors, updateFilter]
  );

  const toggleKind = useCallback(
    (kind: number) => {
      const kinds = selectedKinds.includes(kind)
        ? selectedKinds.filter((k) => k !== kind)
        : [...selectedKinds, kind];

      setSelectedKinds(kinds);
      updateFilter({ kinds: kinds.length > 0 ? kinds : undefined });
    },
    [selectedKinds, updateFilter]
  );

  const addTag = useCallback(() => {
    const trimmed = tagValue.trim();
    if (!trimmed) return;

    const key = customTagKey || tagType;
    const tagKey = `#${key}` as keyof NostrFilter;
    const existing = (filter[tagKey] as string[] | undefined) || [];

    if (!existing.includes(trimmed)) {
      updateFilter({ [tagKey]: [...existing, trimmed] } as Partial<NostrFilter>);
      setTagValue('');
      setCustomTagKey('');
    }
  }, [tagValue, tagType, customTagKey, filter, updateFilter]);

  const removeTag = useCallback(
    (tagKey: string, value: string) => {
      const key = `#${tagKey}` as keyof NostrFilter;
      const existing = (filter[key] as string[] | undefined) || [];
      const updated = existing.filter((v) => v !== value);

      updateFilter({ [key]: updated.length > 0 ? updated : undefined } as Partial<NostrFilter>);
    },
    [filter, updateFilter]
  );

  const updateTimeRange = useCallback(() => {
    const since = parseTimestamp(sinceInput);
    const until = parseTimestamp(untilInput);

    updateFilter({
      since: since || undefined,
      until: until || undefined,
    });

    // Validate time range
    if (since && until && until < since) {
      setValidation((prev) => ({
        ...prev,
        errors: [...prev.errors, 'Until timestamp must be after since timestamp.'],
      }));
    }
  }, [sinceInput, untilInput, updateFilter]);

  const updateLimit = useCallback(() => {
    const limit = parseInt(limitInput, 10);
    if (isNaN(limit)) {
      updateFilter({ limit: undefined });
      return;
    }

    if (limit < 1 || limit > 5000) {
      setValidation((prev) => ({
        ...prev,
        errors: [...prev.errors, 'Limit must be between 1 and 5000.'],
      }));
      return;
    }

    updateFilter({ limit });
  }, [limitInput, updateFilter]);

  // ========================================
  // Preset Functions
  // ========================================

  const applyPreset = useCallback(
    (presetFilter: NostrFilter) => {
      setFilter(presetFilter);
      setSelectedKinds(presetFilter.kinds || []);
      setLimitInput((presetFilter.limit || 50).toString());
      setSinceInput(presetFilter.since ? formatTimestamp(presetFilter.since) : '');
      setUntilInput(presetFilter.until ? formatTimestamp(presetFilter.until) : '');
    },
    []
  );

  const presets = useMemo(
    () => [
      {
        name: 'User Notes',
        filter: currentPubkey ? CommonFilters.userNotes(currentPubkey) : null,
        description: 'Text notes from current user',
        disabled: !currentPubkey,
      },
      {
        name: 'Mentions',
        filter: currentPubkey ? CommonFilters.mentions(currentPubkey) : null,
        description: 'Posts mentioning current user',
        disabled: !currentPubkey,
      },
      {
        name: 'Global Feed',
        filter: CommonFilters.globalFeed(),
        description: 'Recent text notes from all users',
        disabled: false,
      },
      {
        name: 'Long Form',
        filter: CommonFilters.longFormContent(),
        description: 'Articles and long-form content',
        disabled: false,
      },
    ],
    [currentPubkey]
  );

  // ========================================
  // Template Functions
  // ========================================

  const saveTemplate = useCallback(() => {
    if (!templateName.trim()) {
      setValidation((prev) => ({
        ...prev,
        errors: [...prev.errors, 'Template name is required.'],
      }));
      return;
    }

    const newTemplate: FilterTemplate = {
      name: templateName.trim(),
      filter: optimizeFilter(filter as NostrFilter),
      created: Date.now(),
    };

    const updated = [...templates, newTemplate];
    setTemplates(updated);

    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
      setTemplateName('');
      setShowTemplateDialog(false);
    } catch (error) {
      console.error('Failed to save template:', error);
      setValidation((prev) => ({
        ...prev,
        errors: [...prev.errors, 'Failed to save template to storage.'],
      }));
    }
  }, [templateName, filter, templates]);

  const loadTemplate = useCallback(
    (template: FilterTemplate) => {
      applyPreset(template.filter);
      setShowLoadDialog(false);
    },
    [applyPreset]
  );

  const deleteTemplate = useCallback(
    (index: number) => {
      const updated = templates.filter((_, i) => i !== index);
      setTemplates(updated);

      try {
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    },
    [templates]
  );

  // ========================================
  // Import/Export Functions
  // ========================================

  const importFilter = useCallback(() => {
    try {
      const parsed = JSON.parse(importJson);
      const result = validateFilter(parsed);

      if (!result.valid) {
        setValidation((prev) => ({
          ...prev,
          errors: [...prev.errors, 'Invalid filter format.', ...result.errors],
        }));
        return;
      }

      applyPreset(parsed);
      setImportJson('');
      setShowImportDialog(false);
    } catch (error) {
      setValidation((prev) => ({
        ...prev,
        errors: [...prev.errors, 'Invalid JSON format.'],
      }));
    }
  }, [importJson, applyPreset]);

  const copyToClipboard = useCallback(async () => {
    try {
      const json = JSON.stringify(optimizeFilter(filter as NostrFilter), null, 2);
      await navigator.clipboard.writeText(json);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [filter]);

  const resetFilter = useCallback(() => {
    setFilter({});
    setSelectedKinds([]);
    setLimitInput('50');
    setSinceInput('');
    setUntilInput('');
    setIdInput('');
    setAuthorInput('');
    setTagValue('');
    setValidation({ errors: [], warnings: [], suggestions: [] });
  }, []);

  // ========================================
  // Computed Values
  // ========================================

  const filterJson = useMemo(() => {
    return JSON.stringify(optimizeFilter(filter as NostrFilter), null, 2);
  }, [filter]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];

    if (filter.ids && filter.ids.length > 0) {
      parts.push(`${filter.ids.length} specific event(s)`);
    }
    if (filter.authors && filter.authors.length > 0) {
      parts.push(`from ${filter.authors.length} author(s)`);
    }
    if (filter.kinds && filter.kinds.length > 0) {
      parts.push(`kind(s): ${filter.kinds.join(', ')}`);
    }
    if (filter.since || filter.until) {
      parts.push('time-filtered');
    }
    if (filter.limit) {
      parts.push(`limit: ${filter.limit}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Empty filter';
  }, [filter]);

  // ========================================
  // Render
  // ========================================

  return (
    <div
      className={`filter-builder space-y-6 ${className}`}
      role="region"
      aria-label="NOSTR Filter Builder"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FilterIcon className="w-6 h-6" />
            Filter Builder
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{filterSummary}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetFilter}
          aria-label="Reset filter to empty state"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Validation Feedback */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="w-4 h-4" />
          <div className="ml-2">
            <h3 className="font-semibold">Errors</h3>
            <ul className="list-disc list-inside mt-1">
              {validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert variant="default">
          <AlertTriangle className="w-4 h-4" />
          <div className="ml-2">
            <h3 className="font-semibold">Warnings</h3>
            <ul className="list-disc list-inside mt-1">
              {validation.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {validation.suggestions.length > 0 && (
        <Alert variant="default">
          <Info className="w-4 h-4" />
          <div className="ml-2">
            <h3 className="font-semibold">Suggestions</h3>
            <ul className="list-disc list-inside mt-1">
              {validation.suggestions.map((suggestion, i) => (
                <li key={i}>{suggestion}</li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {/* Presets */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Quick Presets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              onClick={() => preset.filter && applyPreset(preset.filter)}
              disabled={preset.disabled}
              title={preset.description}
              aria-label={`Apply ${preset.name} preset`}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </Card>

      {/* Event IDs */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Event IDs</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addEventId()}
            placeholder="Enter 64-character hex event ID"
            className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
            aria-label="Event IDs input field"
          />
          <Button onClick={addEventId} aria-label="Add event ID to filter">
            <Plus className="w-4 h-4 mr-2" />
            Add ID
          </Button>
        </div>

        {filter.ids && filter.ids.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filter.ids.map((id) => (
              <Badge key={id} variant="secondary" className="flex items-center gap-2">
                <span className="font-mono text-xs">{id.slice(0, 8)}...{id.slice(-8)}</span>
                <button
                  onClick={() => removeEventId(id)}
                  className="hover:text-destructive"
                  aria-label={`Remove event ID ${id.slice(0, 8)}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Authors */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Authors (Pubkeys)</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={authorInput}
            onChange={(e) => setAuthorInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addAuthor()}
            placeholder="Enter hex pubkey or npub"
            className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
            aria-label="Authors input field"
          />
          <Button onClick={addAuthor} aria-label="Add author to filter">
            <Plus className="w-4 h-4 mr-2" />
            Add Author
          </Button>
        </div>

        {filter.authors && filter.authors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filter.authors.map((author) => (
              <Badge key={author} variant="secondary" className="flex items-center gap-2">
                <span className="font-mono text-xs">{author.slice(0, 8)}...{author.slice(-8)}</span>
                <button
                  onClick={() => removeAuthor(author)}
                  className="hover:text-destructive"
                  aria-label={`Remove author ${author.slice(0, 8)}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Event Kinds */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Event Kinds</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {EVENT_KIND_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={selectedKinds.includes(option.value) ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleKind(option.value)}
              aria-label={`Toggle ${option.label}`}
              aria-pressed={selectedKinds.includes(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Tag Filters */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Tag Filters</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={tagType}
              onChange={(e) => setTagType(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background"
              aria-label="Tag type selector"
            >
              {TAG_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              placeholder="Enter tag value"
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
              aria-label="Tag value input"
            />

            <Button onClick={addTag} aria-label="Add tag filter">
              <Plus className="w-4 h-4 mr-2" />
              Add Tag
            </Button>
          </div>

          {/* Display active tags */}
          {Object.keys(filter)
            .filter((key) => key.startsWith('#'))
            .map((tagKey) => {
              const tagName = tagKey.slice(1);
              const values = filter[tagKey as keyof NostrFilter] as string[] | undefined;

              return values && values.length > 0 ? (
                <div key={tagKey} className="space-y-2">
                  <h4 className="text-sm font-medium">#{tagName} tags:</h4>
                  <div className="flex flex-wrap gap-2">
                    {values.map((value) => (
                      <Badge key={value} variant="secondary" className="flex items-center gap-2">
                        <span className="text-xs">{value}</span>
                        <button
                          onClick={() => removeTag(tagName, value)}
                          className="hover:text-destructive"
                          aria-label={`Remove #${tagName} tag ${value}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null;
            })}
        </div>
      </Card>

      {/* Time Range and Limit */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Time Range & Limit</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="since-input" className="block text-sm font-medium mb-1">
              Since (timestamp or date)
            </label>
            <input
              id="since-input"
              type="text"
              value={sinceInput}
              onChange={(e) => setSinceInput(e.target.value)}
              onBlur={updateTimeRange}
              placeholder="Unix timestamp or ISO date"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              aria-label="Since timestamp"
            />
          </div>

          <div>
            <label htmlFor="until-input" className="block text-sm font-medium mb-1">
              Until (timestamp or date)
            </label>
            <input
              id="until-input"
              type="text"
              value={untilInput}
              onChange={(e) => setUntilInput(e.target.value)}
              onBlur={updateTimeRange}
              placeholder="Unix timestamp or ISO date"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              aria-label="Until timestamp"
            />
          </div>

          <div>
            <label htmlFor="limit-input" className="block text-sm font-medium mb-1">
              Limit (1-5000)
            </label>
            <input
              id="limit-input"
              type="number"
              min="1"
              max="5000"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              onBlur={updateLimit}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              aria-label="Event limit"
            />
          </div>
        </div>
      </Card>

      {/* Filter Preview */}
      <Card className="p-4" role="region" aria-label="Filter preview">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Filter Preview (JSON)</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              aria-label="Copy filter JSON to clipboard"
            >
              {copiedToClipboard ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
          {filterJson}
        </pre>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => onFilterChange && onFilterChange(optimizeFilter(filter as NostrFilter))}
          disabled={validation.errors.length > 0}
          aria-label="Apply filter to subscription"
        >
          Apply Filter
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowTemplateDialog(true)}
          aria-label="Save current filter as template"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Template
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowLoadDialog(true)}
          aria-label="Load saved template"
        >
          <Download className="w-4 h-4 mr-2" />
          Load Template
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowImportDialog(true)}
          aria-label="Import filter from JSON"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
      </div>

      {/* Template Save Dialog */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Save Template</h3>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Enter template name"
              className="w-full px-3 py-2 border border-input rounded-md bg-background mb-4"
              aria-label="Template name"
            />
            <div className="flex gap-2">
              <Button onClick={saveTemplate}>Save</Button>
              <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Template Load Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-96 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Load Template</h3>
            {templates.length === 0 ? (
              <p className="text-muted-foreground mb-4">No saved templates yet.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {templates.map((template, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-input rounded-md hover:bg-muted"
                    role="option"
                  >
                    <button
                      onClick={() => loadTemplate(template)}
                      className="flex-1 text-left"
                      aria-label={`Load template ${template.name}`}
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(template.created).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteTemplate(index)}
                      className="ml-2 text-destructive hover:text-destructive/80"
                      aria-label={`Delete template ${template.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
              Close
            </Button>
          </Card>
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-[600px]">
            <h3 className="text-lg font-semibold mb-4">Import Filter JSON</h3>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder="Paste filter JSON here..."
              className="w-full h-48 px-3 py-2 border border-input rounded-md bg-background font-mono text-xs mb-4"
              aria-label="Paste filter JSON"
            />
            <div className="flex gap-2">
              <Button onClick={importFilter} aria-label="Load imported filter">
                Load
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FilterBuilder;
