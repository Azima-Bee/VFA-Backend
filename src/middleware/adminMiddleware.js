/**
 * Admin Role Authorization Middleware
 * Verifies that the authenticated user has role === 'admin'
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  return next();
};

module.exports = adminMiddleware;
