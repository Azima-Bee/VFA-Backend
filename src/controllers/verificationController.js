const { pool } = require('../config/database');
const { createNotification } = require('../services/notificationService');
const { logAdminAction } = require('../services/auditService');

const allowedDocumentTypes = [
  'college_id',
  'student_id',
  'admission_letter',
  'bonafide_certificate'
];

/**
 * Submit student verification request
 * POST /api/verification
 */
const submitVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { document_type, document_url, university_email, student_id_number } = req.body;

    // Validate document_type
    if (!document_type || typeof document_type !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    const cleanDocumentType = document_type.trim().toLowerCase();
    if (!allowedDocumentTypes.includes(cleanDocumentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    // Validate document_url
    if (!document_url || typeof document_url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid document URL'
      });
    }

    const cleanDocumentUrl = document_url.trim();
    if (!cleanDocumentUrl || cleanDocumentUrl.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document URL'
      });
    }

    // Basic URL format validation (must start with http:// or https://)
    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(cleanDocumentUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document URL'
      });
    }

    // Check existing verifications for user
    const [existing] = await pool.query(
      'SELECT status FROM verifications WHERE user_id = ? ORDER BY id DESC',
      [userId]
    );

    for (const record of existing) {
      if (record.status === 'pending') {
        return res.status(409).json({
          success: false,
          message: 'A verification request is already pending'
        });
      }
      if (record.status === 'verified') {
        return res.status(409).json({
          success: false,
          message: 'Student is already verified'
        });
      }
    }

    const cleanUniEmail = university_email && typeof university_email === 'string' ? university_email.trim().toLowerCase() : null;
    const cleanStudentIdNum = student_id_number && typeof student_id_number === 'string' ? student_id_number.trim() : null;

    // Insert new pending verification
    const [result] = await pool.query(
      `INSERT INTO verifications (user_id, document_type, document_url, status, verified_at, university_email, student_id_number)
       VALUES (?, ?, ?, 'pending', NULL, ?, ?)`,
      [userId, cleanDocumentType, cleanDocumentUrl, cleanUniEmail, cleanStudentIdNum]
    );

    return res.status(201).json({
      success: true,
      message: 'Verification submitted successfully',
      verification: {
        id: result.insertId,
        user_id: userId,
        document_type: cleanDocumentType,
        document_url: cleanDocumentUrl,
        university_email: cleanUniEmail,
        student_id_number: cleanStudentIdNum,
        status: 'pending',
        verified_at: null
      }
    });
  } catch (error) {
    console.error('Submit Verification Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get own verification records
 * GET /api/verification
 */
const getOwnVerification = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, user_id, document_type, document_url, status, verified_at, university_email, student_id_number, created_at
       FROM verifications
       WHERE user_id = ?
       ORDER BY id DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      verifications: rows
    });
  } catch (error) {
    console.error('Get Own Verification Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get another user's safe verification status
 * GET /api/verification/:userId
 */
const getUserVerification = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const [rows] = await pool.query(
      `SELECT status, verified_at
       FROM verifications
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [targetUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Verification not found'
      });
    }

    // Privacy protection: Do NOT return document_url to other users
    return res.status(200).json({
      success: true,
      verification: {
        user_id: targetUserId,
        status: rows[0].status,
        verified_at: rows[0].verified_at
      }
    });
  } catch (error) {
    console.error('Get User Verification Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin review verification status (approve or reject)
 * PATCH /api/verification/:id/status
 */
const updateVerificationStatus = async (req, res) => {
  try {
    const verificationId = parseInt(req.params.id, 10);

    if (isNaN(verificationId) || verificationId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification ID'
      });
    }

    const { status } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }

    let cleanStatus = status.trim().toLowerCase();
    if (cleanStatus === 'approved') cleanStatus = 'verified';

    if (!['verified', 'rejected'].includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }

    // Check if verification record exists
    const [existing] = await pool.query(
      'SELECT id, user_id, document_type FROM verifications WHERE id = ?',
      [verificationId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Verification not found'
      });
    }

    const record = existing[0];

    // Update status and timestamp in DB
    if (cleanStatus === 'verified') {
      await pool.query(
        'UPDATE verifications SET status = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['verified', verificationId]
      );

      // Send approval notification
      try {
        await createNotification(
          record.user_id,
          'Verification Approved 🎓',
          'Congratulations! Your student ID verification request has been approved. You now have the verified student badge.',
          'verification'
        );
      } catch (notifErr) {
        console.warn('Verification notification failed:', notifErr.message);
      }
    } else {
      await pool.query(
        'UPDATE verifications SET status = ?, verified_at = NULL WHERE id = ?',
        ['rejected', verificationId]
      );

      // Send rejection notification
      try {
        await createNotification(
          record.user_id,
          'Verification Rejected ⚠️',
          'Your student ID verification request was rejected. Please review your documents and resubmit.',
          'verification'
        );
      } catch (notifErr) {
        console.warn('Verification rejection notification failed:', notifErr.message);
      }
    }

    // Record admin audit log
    await logAdminAction(
      req.user.id,
      cleanStatus === 'verified' ? 'APPROVE_VERIFICATION' : 'REJECT_VERIFICATION',
      'verification',
      verificationId,
      `Verification for student ID ${record.user_id} was ${cleanStatus}`
    );

    // Fetch updated record for response
    const [updated] = await pool.query(
      'SELECT id, user_id, document_type, status, verified_at FROM verifications WHERE id = ?',
      [verificationId]
    );

    return res.status(200).json({
      success: true,
      message: 'Verification status updated successfully',
      verification: updated[0]
    });
  } catch (error) {
    console.error('Update Verification Status Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin get all verifications
 * GET /api/verification/admin
 */
const adminGetAllVerifications = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id, v.user_id, v.document_type, v.document_url, v.status, v.verified_at,
              v.student_id_number, v.university_email, v.created_at,
              u.full_name AS student_name, u.email AS user_email, u.phone,
              sp.college_name AS college, sp.course, sp.year_of_study
       FROM verifications v
       JOIN users u ON v.user_id = u.id
       LEFT JOIN student_profiles sp ON u.id = sp.user_id
       ORDER BY v.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      verifications: rows
    });
  } catch (error) {
    console.error('Admin Get Verifications Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  submitVerification,
  getOwnVerification,
  getUserVerification,
  updateVerificationStatus,
  adminGetAllVerifications
};
