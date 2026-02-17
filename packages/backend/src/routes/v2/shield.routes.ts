/**
 * Content Shield API Routes (v2)
 * /api/v2/shield/*
 * EPIC-008: Content Shield
 */

import { Request, Response, NextFunction, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, requireCreator, optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import {
  readOnlyRateLimiter,
  createUserRateLimiter,
} from '../../middleware/rate-limit-middleware';
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getProvenanceService().getProvenanceChain(req.params.contentId);
      if (!data) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: `Provenance not found for content ${req.params.contentId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/provenance/:contentId/certificate',
  authenticate,
  requireCreator,
  validate({
    params: ShieldValidators.contentIdParam,
    query: ShieldValidators.certificateQuery,
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const certificate = await getProvenanceService().getCertificate(
        req.params.contentId,
        req.user!.nostr_pubkey
      );
      // PDF format not implemented yet — return JSON
      res.json({ success: true, data: { certificate } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/provenance/sign',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getProvenanceService().signContent({
        contentId: req.body.content_id,
        creatorId: req.user!.nostr_pubkey,
        contentBody: req.body.content_body,
        nostrEventId: req.body.nostr_event_id,
        signature: req.body.signature,
        relays: req.body.relays || [],
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/provenance/:contentId/revoke',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  validate({ params: ShieldValidators.contentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getProvenanceService().revokeProvenance(
        req.params.contentId,
        req.user!.nostr_pubkey
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getFingerprintService().createFingerprint(req.user!.nostr_pubkey, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/fingerprints/:creatorId',
  authenticate,
  requireCreator,
  validate({
    params: ShieldValidators.getFingerprintsParam,
    query: ShieldValidators.getFingerprintsQuery,
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Enforce creator can only view own registry
      if (req.params.creatorId !== req.user!.nostr_pubkey) {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Can only view your own fingerprint registry',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await getFingerprintService().getRegistry(req.user!.nostr_pubkey, page, limit);
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/compare',
  authenticate,
  requireCreator,
  expensiveRateLimiter,
  validate({ body: ShieldValidators.compare }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getFingerprintService().compare(req.user!.nostr_pubkey, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Alerts
// ============================================================================

router.get(
  '/alerts',
  authenticate,
  requireCreator,
  validate({ query: ShieldValidators.getAlertsQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = (req.query.status as AlertStatus) || 'new';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await getAlertService().getAlerts(req.user!.nostr_pubkey, status, page, limit);
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/alerts/:id',
  authenticate,
  requireCreator,
  validate({ params: ShieldValidators.alertIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getAlertService().getAlertDetail(req.user!.nostr_pubkey, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getAlertService().updateAlertStatus(
        req.user!.nostr_pubkey,
        req.params.id,
        req.body.status
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await getDmcaService().generateReport(req.user!.nostr_pubkey, req.params.id);
      // PDF format not implemented yet — return JSON
      res.status(201).json({ success: true, data: { report } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
