const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        console.log('[Auth] No token provided');
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
        if (err) {
            console.log('[Auth] Token verification failed:', err.message);
            return res.sendStatus(403);
        }
        console.log('[Auth] User verified:', user.email, 'Role:', user.role);
        req.user = user;
        next();
    });
};

const checkRole = (roles) => {
    return (req, res, next) => {
        console.log('[Auth] Checking role for user:', req.user?.email, 'Required:', roles, 'Actual:', req.user?.role);
        if (!roles.includes(req.user.role)) {
            console.log('[Auth] Role mismatch - Forbidden');
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
};

// Also export verifyToken alias if needed, but stick to authenticateToken
module.exports = { authenticateToken, checkRole };
