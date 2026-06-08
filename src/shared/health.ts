import { Router } from 'express';
import { pool } from '../db/pool';

/**
 * Liveness + readiness endpoints used by orchestrators (Docker/K8s).
 *  - /health  : process is up (cheap, no dependencies)
 *  - /ready   : dependencies (DB) are reachable
 */
export function healthRoutes(serviceName: string): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: serviceName, time: new Date().toISOString() });
  });

  router.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ready', service: serviceName });
    } catch {
      res.status(503).json({ status: 'not-ready', service: serviceName });
    }
  });

  return router;
}
