/**
 * Content Shield API Routes (v2)
 * /api/v2/shield/*
 * EPIC-008: Content Shield
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, optionalAuth, getAuthUser } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { readOnlyRateLimiter, createUserRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { NotFoundError, AuthorizationError } from '../../utils/errors';
import { ShieldValidators } from '../../validators/shield';
import type { IProvenanceService } from '../../interfaces/provenance/IProvenanceService';
import type { IFingerprintService } from '../../interfaces/provenance/IFingerprintService';
import type { IAlertService } from '../../interfaces/provenance/IAlertService';
import type { IDmcaService } from '../../interfaces/provenance/IDmcaService';
import type { AlertStatus } from '@sovren/shared/types/provenance';

const router = Router();

// Rate limiting: baseline read limit for all GET endpoints
router.use(readOnlyRateLimiter);

// Stricter rate limiters for mutations and expensive operations
const mutationRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 20 });
const expensiveRateLimiter = createUserRateLimiter({ windowMs: 60000, max: 5 });

// Lazy service resolution
let _provenanceService: IProvenanceService | null = null;
let _fingerprintService: IFingerprintService | null = null;
let _alertService: IAlertService | null = null;
let _dmcaService: IDmcaService | null = null;

function getProvenanceService(): IProvenanceService {
  if (!_provenanceService) _provenanceService = container.resolve(TYPES.ProvenanceService);
  return _provenanceService;
}
function getFingerprintService(): IFingerprintService {
  if (!_fingerprintService) _fingerprintService = container.resolve(TYPES.FingerprintService);
  return _fingerprintService;
}
function getAlertService(): IAlertService {
  if (!_alertService) _alertService = container.resolve(TYPES.AlertService);
  return _alertService;
}
function getDmcaService(): IDmcaService {
  if (!_dmcaService) _dmcaService = container.resolve(TYPES.DmcaService);
  return _dmcaService;
}

// ============================================================================
// Provenance
// ============================================================================

router.get(
  '/provenance/:contentId',
  optionalAuth,
  validate({ params: ShieldValidators.contentIdParam }),
  asyncHandler(async (req, res) => {
    const data = await getProvenanceService().getProvenanceChain(req.params.contentId);
    if (!data) {
      throw new NotFoundError(`Provenance for content ${req.params.contentId}`);
    }
    res.json(createApiResponse(req, data));
  })
);

router.get(
  '/provenance/:contentId/certificate',
  authenticate,
  requireCreator,
  validate({
    params: ShieldValidators.contentIdParam,
    query: ShieldValidators.certificateQuery,
  }),
  asyncHandler(async (req, res) => {
    const certificate = await getProvenanceService().getCertificate(
      req.params.contentId,
      getAuthUser(req).nostr_pubkey
    );
    // PDF format not implemented yet — return JSON
    res.json(createApiResponse(req, { certificate }));
  })
);

router.post(
  '/provenance/sign',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: ShieldValidators.signProvenanceBody }),
  asyncHandler(async (req, res) => {
    const data = await getProvenanceService().signContent({
      contentId: req.body.content_id,
      creatorId: getAuthUser(req).nostr_pubkey,
      contentBody: req.body.content_body,
      nostrEventId: req.body.nostr_event_id,
      signature: req.body.signature,
      relays: req.body.relays || [],
    });
    res.status(201).json(createApiResponse(req, data));
  })
);

router.post(
  '/provenance/:contentId/revoke',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ params: ShieldValidators.contentIdParam }),
  asyncHandler(async (req, res) => {
    const data = await getProvenanceService().revokeProvenance(
      req.params.contentId,
      getAuthUser(req).nostr_pubkey
    );
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Fingerprinting
// ============================================================================

router.post(
  '/fingerprint',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ body: ShieldValidators.createFingerprint }),
  asyncHandler(async (req, res) => {
    const data = await getFingerprintService().createFingerprint(
      getAuthUser(req).nostr_pubkey,
      req.body
    );
    res.status(201).json(createApiResponse(req, data));
  })
);

router.get(
  '/fingerprints/:creatorId',
  authenticate,
  requireCreator,
  validate({
    params: ShieldValidators.getFingerprintsParam,
    query: ShieldValidators.getFingerprintsQuery,
  }),
  asyncHandler(async (req, res) => {
    // Enforce creator can only view own registry
    if (req.params.creatorId !== getAuthUser(req).nostr_pubkey) {
      throw new AuthorizationError('Can only view your own fingerprint registry');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await getFingerprintService().getRegistry(
      getAuthUser(req).nostr_pubkey,
      page,
      limit
    );
    res.json(createApiResponse(req, { data: result.data, pagination: result.pagination }));
  })
);

router.post(
  '/compare',
  authenticate,
  requireCreator,
  expensiveRateLimiter,
  validate({ body: ShieldValidators.compare }),
  asyncHandler(async (req, res) => {
    const data = await getFingerprintService().compare(getAuthUser(req).nostr_pubkey, req.body);
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// Alerts
// ============================================================================

router.get(
  '/alerts',
  authenticate,
  requireCreator,
  validate({ query: ShieldValidators.getAlertsQuery }),
  asyncHandler(async (req, res) => {
    const status = (req.query.status as AlertStatus) || 'new';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await getAlertService().getAlerts(
      getAuthUser(req).nostr_pubkey,
      status,
      page,
      limit
    );
    res.json(createApiResponse(req, { data: result.data, pagination: result.pagination }));
  })
);

router.get(
  '/alerts/:id',
  authenticate,
  requireCreator,
  validate({ params: ShieldValidators.alertIdParam }),
  asyncHandler(async (req, res) => {
    const data = await getAlertService().getAlertDetail(
      getAuthUser(req).nostr_pubkey,
      req.params.id
    );
    res.json(createApiResponse(req, data));
  })
);

router.put(
  '/alerts/:id',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({
    params: ShieldValidators.alertIdParam,
    body: ShieldValidators.updateAlertStatus,
  }),
  asyncHandler(async (req, res) => {
    const data = await getAlertService().updateAlertStatus(
      getAuthUser(req).nostr_pubkey,
      req.params.id,
      req.body.status
    );
    res.json(createApiResponse(req, data));
  })
);

// ============================================================================
// DMCA Reports
// ============================================================================

router.post(
  '/alerts/:id/dmca-report',
  authenticate,
  requireCreator,
  expensiveRateLimiter,
  validate({
    params: ShieldValidators.alertIdParam,
    query: ShieldValidators.dmcaReportQuery,
  }),
  asyncHandler(async (req, res) => {
    const report = await getDmcaService().generateReport(
      getAuthUser(req).nostr_pubkey,
      req.params.id
    );
    // PDF format not implemented yet — return JSON
    res.status(201).json(createApiResponse(req, { report }));
  })
);

export default router;
