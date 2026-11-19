import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

// Cache verified tokens briefly (max 60s, bounded by token exp) and user DB sync (5 min)
// to prevent concurrent SQL UPSERT contention during parallel API bursts.
const verifiedTokenCache = new Map<string, { decoded: DecodedIdToken; cachedUntil: number }>();
const syncedUserCache = new Map<string, number>();
const inFlightUserSync = new Map<string, Promise<void>>();

const TOKEN_CACHE_TTL_MS = 60_000;
const USER_SYNC_TTL_MS = 5 * 60_000;

async function syncUserWithTtl(decoded: DecodedIdToken): Promise<void> {
  const now = Date.now();
  const lastSynced = syncedUserCache.get(decoded.uid);
  if (lastSynced && now - lastSynced < USER_SYNC_TTL_MS) {
    return;
  }

  let pending = inFlightUserSync.get(decoded.uid);
  if (!pending) {
    pending = getOrCreateUser(
      decoded.uid,
      decoded.email || '',
      typeof decoded.name === 'string' ? decoded.name : undefined
    )
      .then(() => {
        syncedUserCache.set(decoded.uid, Date.now());
      })
      .finally(() => {
        inFlightUserSync.delete(decoded.uid);
      });
    inFlightUserSync.set(decoded.uid, pending);
  }
  await pending;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Non autorisé : jeton d’authentification manquant' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const now = Date.now();
    let decodedToken: DecodedIdToken | undefined;
    const cached = verifiedTokenCache.get(token);
    if (cached && cached.cachedUntil > now) {
      decodedToken = cached.decoded;
    } else {
      decodedToken = await adminAuth.verifyIdToken(token);
      const expMs = (decodedToken.exp || 0) * 1000;
      const ttlEnd = Math.min(now + TOKEN_CACHE_TTL_MS, expMs || now + TOKEN_CACHE_TTL_MS);
      if (ttlEnd > now) {
        if (verifiedTokenCache.size > 500) {
          verifiedTokenCache.clear();
        }
        verifiedTokenCache.set(token, { decoded: decodedToken, cachedUntil: ttlEnd });
      }
    }

    req.user = decodedToken;
    await syncUserWithTtl(decodedToken);
    next();
  } catch (error) {
    verifiedTokenCache.delete(token);
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Non autorisé : jeton d’authentification invalide' });
  }
};
