const { pool } = require('../config/database');
const { logAdminAction } = require('../services/auditService');

/**
 * Get system metrics and overview statistics
 * GET /api/admin/stats
 */
const getAdminStats = async (req, res) => {
  try {
    const [[studentCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'student'"
    );
    const [[verifiedCount]] = await pool.query(
      "SELECT COUNT(DISTINCT user_id) AS total FROM verifications WHERE status = 'verified'"
    );
    const [[pendingVerifCount]] = await pool.query(
      "SELECT COUNT(DISTINCT user_id) AS total FROM verifications WHERE status = 'pending'"
    );
    const [[rejectedVerifCount]] = await pool.query(
      "SELECT COUNT(DISTINCT user_id) AS total FROM verifications WHERE status = 'rejected'"
    );
    const [[activeListingCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM listings WHERE status = 'active'"
    );
    const [[totalListingCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM listings"
    );
    const [[totalConnCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM connections"
    );
    const [[pendingConnCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM connections WHERE status = 'pending'"
    );
    const [[pendingReportsCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM reports WHERE status = 'pending'"
    );
    const [[suspendedUserCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM users WHERE account_status = 'suspended'"
    );

    return res.status(200).json({
      success: true,
      stats: {
        totalStudents: Number(studentCount?.total || 0),
        verifiedStudents: Number(verifiedCount?.total || 0),
        pendingVerifications: Number(pendingVerifCount?.total || 0),
        rejectedVerifications: Number(rejectedVerifCount?.total || 0),
        activeListings: Number(activeListingCount?.total || 0),
        totalListings: Number(totalListingCount?.total || 0),
        totalConnections: Number(totalConnCount?.total || 0),
        pendingConnections: Number(pendingConnCount?.total || 0),
        reportsCount: Number(pendingReportsCount?.total || 0),
        suspendedUsers: Number(suspendedUserCount?.total || 0)
      }
    });
  } catch (error) {
    console.error('Get Admin Stats Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get all users with profile & verification status
 * GET /api/admin/users
 */
const getAdminUsers = async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = `
      SELECT u.id, u.full_name, u.email, u.phone, u.role, u.account_status, u.created_at,
              sp.college_name, sp.course, sp.year_of_study, sp.city, sp.gender,
              (
                SELECT status FROM verifications 
                WHERE user_id = u.id 
                ORDER BY id DESC LIMIT 1
              ) AS verification_status
       FROM users u
       LEFT JOIN student_profiles sp ON u.id = sp.user_id
    `;
    const whereClauses = [];
    const params = [];

    if (search && search.trim()) {
      whereClauses.push('(u.full_name LIKE ? OR u.email LIKE ? OR sp.college_name LIKE ? OR sp.course LIKE ? OR sp.city LIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s, s);
    }

    if (status && ['active', 'suspended'].includes(status.toLowerCase())) {
      whereClauses.push('u.account_status = ?');
      params.push(status.toLowerCase());
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' ORDER BY u.id DESC';

    const [rows] = await pool.query(query, params);

    const users = rows.map((r) => ({
      id: String(r.id),
      name: r.full_name,
      email: r.email,
      phone: r.phone || '',
      role: r.role || 'student',
      college: r.college_name || 'Not Specified',
      course: r.course || 'Not Specified',
      year: r.year_of_study || '',
      city: r.city || '',
      verificationStatus: r.verification_status === 'verified'
        ? 'Verified'
        : r.verification_status === 'pending'
          ? 'Pending'
          : r.verification_status === 'rejected'
            ? 'Rejected'
            : 'Not Verified',
      accountStatus: r.account_status === 'suspended' ? 'Suspended' : 'Active',
      joinedDate: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-01-01'
    }));

    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get Admin Users Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Suspend or activate a user account
 * PATCH /api/admin/users/:id/status
 */
const updateUserStatus = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const adminId = req.user.id;

    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (targetUserId === adminId) {
      return res.status(400).json({
        success: false,
        message: 'Admin cannot suspend their own account'
      });
    }

    const { status } = req.body;
    if (!status || !['active', 'suspended'].includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account status. Must be active or suspended'
      });
    }

    const cleanStatus = status.toLowerCase();

    const [userRows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [targetUserId]);
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await pool.query('UPDATE users SET account_status = ? WHERE id = ?', [cleanStatus, targetUserId]);

    // Record admin audit log
    await logAdminAction(
      adminId,
      cleanStatus === 'suspended' ? 'SUSPEND_USER' : 'REACTIVATE_USER',
      'user',
      targetUserId,
      `User status set to ${cleanStatus}`
    );

    return res.status(200).json({
      success: true,
      message: `User account status updated to ${cleanStatus}`,
      user: {
        id: targetUserId,
        account_status: cleanStatus
      }
    });
  } catch (error) {
    console.error('Update User Status Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get all listings with owner info for admin moderation
 * GET /api/admin/listings
 */
const getAdminListings = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.*, u.full_name AS owner_name, u.email AS owner_email, u.phone AS owner_phone
       FROM listings l
       JOIN users u ON l.owner_id = u.id
       ORDER BY l.created_at DESC`
    );

    const listings = rows.map((l) => ({
      id: String(l.id),
      title: l.title,
      description: l.description,
      ownerId: String(l.owner_id),
      ownerName: l.owner_name,
      ownerEmail: l.owner_email,
      ownerPhone: l.owner_phone,
      area: `${l.city}${l.address ? ', ' + l.address : ''}`,
      rent: `₹${Number(l.monthly_rent || 0).toLocaleString()}/mo`,
      monthly_rent: l.monthly_rent,
      security_deposit: l.security_deposit,
      property_type: l.property_type,
      gender_preference: l.gender_preference,
      furnished: l.furnished,
      image_url: l.image_url,
      status: l.status === 'active' ? 'Approved' : 'Rejected',
      rawStatus: l.status,
      created_at: l.created_at
    }));

    return res.status(200).json({
      success: true,
      count: listings.length,
      listings
    });
  } catch (error) {
    console.error('Get Admin Listings Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update listing status (Approve / Reject / Activate / Inactivate)
 * PATCH /api/admin/listings/:id/status
 */
const updateListingStatus = async (req, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);
    const adminId = req.user.id;

    if (isNaN(listingId) || listingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    let cleanStatus = status.toLowerCase();
    if (cleanStatus === 'approved') cleanStatus = 'active';
    if (cleanStatus === 'rejected') cleanStatus = 'inactive';

    if (!['active', 'inactive'].includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const [rows] = await pool.query('SELECT id FROM listings WHERE id = ?', [listingId]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    await pool.query('UPDATE listings SET status = ? WHERE id = ?', [cleanStatus, listingId]);

    // Record admin audit log
    await logAdminAction(
      adminId,
      'UPDATE_LISTING_STATUS',
      'listing',
      listingId,
      `Listing status set to ${cleanStatus}`
    );

    return res.status(200).json({
      success: true,
      message: `Listing status updated to ${cleanStatus}`,
      listingId,
      status: cleanStatus
    });
  } catch (error) {
    console.error('Update Listing Status Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin delete listing
 * DELETE /api/admin/listings/:id
 */
const deleteAdminListing = async (req, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);
    const adminId = req.user.id;

    if (isNaN(listingId) || listingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    const [rows] = await pool.query('SELECT id FROM listings WHERE id = ?', [listingId]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    await pool.query('DELETE FROM listings WHERE id = ?', [listingId]);

    // Record admin audit log
    await logAdminAction(
      adminId,
      'DELETE_LISTING',
      'listing',
      listingId,
      'Listing permanently removed by administrator'
    );

    return res.status(200).json({
      success: true,
      message: 'Listing deleted successfully by administrator'
    });
  } catch (error) {
    console.error('Delete Admin Listing Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get all student verifications for admin queue
 * GET /api/admin/verifications
 */
const getAdminVerifications = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT v.id, v.user_id, v.document_type, v.document_url, v.status, v.verified_at,
              v.student_id_number, v.university_email, v.created_at,
              u.full_name AS student_name, u.email AS user_email, u.phone,
              sp.college_name AS college, sp.course, sp.year_of_study
       FROM verifications v
       JOIN users u ON v.user_id = u.id
       LEFT JOIN student_profiles sp ON u.id = sp.user_id
    `;
    const whereClauses = [];
    const params = [];

    if (search && search.trim()) {
      whereClauses.push('(u.full_name LIKE ? OR u.email LIKE ? OR sp.college_name LIKE ? OR v.student_id_number LIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    if (status && ['pending', 'verified', 'rejected'].includes(status.toLowerCase())) {
      whereClauses.push('v.status = ?');
      params.push(status.toLowerCase());
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' ORDER BY v.id DESC';

    const [rows] = await pool.query(query, params);

    const verifications = rows.map((v) => ({
      id: String(v.id),
      userId: String(v.user_id),
      studentName: v.student_name,
      userEmail: v.user_email,
      college: v.college || 'Not Specified',
      course: v.course || 'Not Specified',
      year: v.year_of_study || '',
      documentType: v.document_type,
      documentUrl: v.document_url,
      studentIdStatus: `Document: ${v.document_type ? v.document_type.toUpperCase().replace('_', ' ') : 'STUDENT ID'}`,
      universityEmailStatus: `Email: ${v.university_email || v.user_email}`,
      submittedDate: v.created_at ? new Date(v.created_at).toISOString().split('T')[0] : '2026-01-01',
      status: v.status === 'verified'
        ? 'Approved'
        : v.status === 'rejected'
          ? 'Rejected'
          : 'Pending',
      rawStatus: v.status,
      verified_at: v.verified_at
    }));

    return res.status(200).json({
      success: true,
      count: verifications.length,
      verifications
    });
  } catch (error) {
    console.error('Get Admin Verifications Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get administrative audit logs
 * GET /api/admin/audit-logs
 */
const getAdminAuditLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.admin_id, a.action, a.target_type, a.target_id, a.details, a.created_at,
              u.full_name AS admin_name, u.email AS admin_email
       FROM admin_audit_logs a
       LEFT JOIN users u ON a.admin_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 100`
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      logs: rows
    });
  } catch (error) {
    console.error('Get Admin Audit Logs Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  getAdminListings,
  updateListingStatus,
  deleteAdminListing,
  getAdminVerifications,
  getAdminAuditLogs
};

