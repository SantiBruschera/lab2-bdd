const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'umdb_jwt_secret';

// Middleware obligatorio — rechaza si no hay token válido
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Autenticación requerida' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware opcional — si hay token lo decodifica, si no sigue igual
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, SECRET); } catch {}
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
