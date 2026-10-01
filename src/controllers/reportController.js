const { pool } = require('../config/database');
const { logAdminAction } = require('../services/auditService');

const allowedReportStatuses = ['pending', 'reviewed', 'resolved', 'rejected'];

/**
 * Submit a report against a user or listing
 * POST /api/reports
 */
const submitReport = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { reported_user_id, listing_id, reason, description } = req.body;

    let targetReportedUserId = null;
    let targetListingId = null;

    // Validate reported_user_id if supplied
    if (reported_user_id !== undefined && reported_user_id !== null && reported_user_id !== '') {
      targetReportedUserId = parseInt(reported_user_id, 10);
      if (isNaN(targetReportedUserId) || targetReportedUserId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reported user ID'
        });
      }

      // Prevent self reporting
      if (targetReportedUserId === reporterId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot report yourself'
        });
      }

      // Check reported user exists
      const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [targetReportedUserId]);
      if (userRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Reported user not found'
        });
      }
    }

    // Validate listing_id if supplied
    if (listing_id !== undefined && listing_id !== null && listing_id !== '') {
      targetListingId = parseInt(listing_id, 10);
      if (isNaN(targetListingId) || targetListingId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid listing ID'
        });
      }

      // Check listing exists
      const [listingRows] = await pool.query('SELECT id FROM listings WHERE id = ?', [targetListingId]);
      if (listingRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Listing not found'
        });
      }
    }

    // Ensure at least one target is provided
    if (!targetReportedUserId && !targetListingId) {
      return res.status(400).json({
        success: false,
        message: 'Report target (user or listing) is required'
      });
    }

    // Validate reason
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const cleanReason = reason.trim();
    if (cleanReason.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Reason exceeds maximum length of 255 characters'
      });
    }

    const cleanDescription = description && typeof description === 'string' ? description.trim() : null;

    // Insert report into database
    const [result] = await pool.query(
      `INSERT INTO reports (reporter_id, reported_user_id, listing_id, reason, description, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [reporterId, targetReportedUserId, targetListingId, cleanReason, cleanDescription]
    );

    const reportId = result.insertId;
    const [created] = await pool.query(
      'SELECT id, reporter_id, reported_user_id, listing_id, reason, description, status, created_at FROM reports WHERE id = ?',
      [reportId]
    );

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report: created[0]
    });
  } catch (error) {
    console.error('Submit Report Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get reports submitted by authenticated user
 * GET /api/reports
 */
const getMyReports = async (req, res) => {
  try {
    const reporterId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, reported_user_id, listing_id, reason, description, status, created_at
       FROM reports
       WHERE reporter_id = ?
       ORDER BY created_at DESC`,
      [reporterId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      reports: rows
    });
  } catch (error) {
    console.error('Get My Reports Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin get all reports with user/listing details
 * GET /api/reports/admin
 */
const adminGetAllReports = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.reporter_id, r.reported_user_id, r.listing_id, r.reason, r.description, r.status, r.created_at,
              u_reporter.full_name AS reporter_name, u_reporter.email AS reporter_email,
              u_reported.full_name AS reported_user_name, u_reported.email AS reported_user_email,
              l.title AS listing_title
       FROM reports r
       JOIN users u_reporter ON r.reporter_id = u_reporter.id
       LEFT JOIN users u_reported ON r.reported_user_id = u_reported.id
       LEFT JOIN listings l ON r.listing_id = l.id
       ORDER BY r.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      reports: rows
    });
  } catch (error) {
    console.error('Admin Get All Reports Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin update report status
 * PATCH /api/reports/:id/status
 */
const adminUpdateReportStatus = async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);

    if (isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    const { status } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid report status'
      });
    }

    const cleanStatus = status.trim().toLowerCase();
    if (!allowedReportStatuses.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report status'
      });
    }

    // Check report existence
    const [existing] = await pool.query('SELECT id FROM reports WHERE id = ?', [reportId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    await pool.query('UPDATE reports SET status = ? WHERE id = ?', [cleanStatus, reportId]);

    // Record admin audit log
    await logAdminAction(
      req.user.id,
      'RESOLVE_REPORT',
      'report',
      reportId,
      `Report #${reportId} status updated to ${cleanStatus}`
    );

    const [updated] = await pool.query(
      'SELECT id, reporter_id, reported_user_id, listing_id, reason, description, status, created_at FROM reports WHERE id = ?',
      [reportId]
    );

    return res.status(200).json({
      success: true,
      message: 'Report status updated successfully',
      report: updated[0]
    });
  } catch (error) {
    console.error('Admin Update Report Status Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  submitReport,
  getMyReports,
  adminGetAllReports,
  adminUpdateReportStatus
};
