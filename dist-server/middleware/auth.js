import { config } from '../config.js';
export function authMiddleware(req, res, next) {
    // Allow health check without auth
    if (req.path === '/api/health')
        return next();
    // Skip auth if no token is configured (backwards compatible)
    if (!config.authToken)
        return next();
    const token = req.headers['x-mc-token']
        || req.headers['authorization']?.replace('Bearer ', '')
        || req.query.token;
    if (!token || token !== config.authToken) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}
