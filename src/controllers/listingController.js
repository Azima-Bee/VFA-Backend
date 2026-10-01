const { pool } = require('../config/database');

const cleanString = (val) => (typeof val === 'string' ? val.trim() : null);

const allowedPropertyTypes = ['flat', 'room', 'hostel'];
const allowedGenderPreferences = ['male', 'female', 'any'];
const allowedFurnishingTypes = ['fully', 'semi', 'unfurnished'];
const allowedStatuses = ['active', 'inactive'];

/**
 * Create a new listing
 * POST /api/listings
 */
const createListing = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const {
      title,
      description,
      property_type,
      city,
      address,
      monthly_rent,
      security_deposit,
      available_from,
      gender_preference,
      furnished,
      image_url,
      status
    } = req.body;

    // Required fields validation
    const cleanTitle = cleanString(title);
    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }
    if (cleanTitle.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Title exceeds maximum length of 150 characters'
      });
    }

    const cleanPropertyType = cleanString(property_type) ? cleanString(property_type).toLowerCase() : null;
    if (!cleanPropertyType || !allowedPropertyTypes.includes(cleanPropertyType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid property type. Must be flat, room, or hostel'
      });
    }

    const cleanCity = cleanString(city);
    if (!cleanCity) {
      return res.status(400).json({
        success: false,
        message: 'City is required'
      });
    }
    if (cleanCity.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'City exceeds maximum length of 100 characters'
      });
    }

    // Optional fields & length validations
    const cleanDescription = cleanString(description);
    const cleanAddress = cleanString(address);
    if (cleanAddress && cleanAddress.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Address exceeds maximum length of 255 characters'
      });
    }

    // Rent & Deposit
    let rentVal = null;
    if (monthly_rent !== undefined && monthly_rent !== null && monthly_rent !== '') {
      rentVal = Number(monthly_rent);
      if (isNaN(rentVal) || rentVal < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid monthly rent'
        });
      }
    }

    let depositVal = null;
    if (security_deposit !== undefined && security_deposit !== null && security_deposit !== '') {
      depositVal = Number(security_deposit);
      if (isNaN(depositVal) || depositVal < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid security deposit'
        });
      }
    }

    // Date validation
    let dateVal = null;
    if (available_from) {
      const parsedDate = new Date(available_from);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid available_from date'
        });
      }
      dateVal = parsedDate.toISOString().split('T')[0];
    }

    // Enums
    const cleanGenderPref = cleanString(gender_preference) ? cleanString(gender_preference).toLowerCase() : 'any';
    if (!allowedGenderPreferences.includes(cleanGenderPref)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender preference'
      });
    }

    const cleanFurnished = cleanString(furnished) ? cleanString(furnished).toLowerCase() : 'unfurnished';
    if (!allowedFurnishingTypes.includes(cleanFurnished)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid furnishing status'
      });
    }

    const cleanImageUrl = typeof image_url === 'string' ? image_url.trim() : '';
    if (cleanImageUrl && cleanImageUrl.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Image URL exceeds maximum length of 500 characters'
      });
    }

    const cleanStatus = cleanString(status) ? cleanString(status).toLowerCase() : 'active';
    if (!allowedStatuses.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Insert into database (owner_id comes strictly from req.user.id)
    const [result] = await pool.query(
      `INSERT INTO listings
        (owner_id, title, description, property_type, city, address, monthly_rent, security_deposit, available_from, gender_preference, furnished, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        cleanTitle,
        cleanDescription,
        cleanPropertyType,
        cleanCity,
        cleanAddress,
        rentVal,
        depositVal,
        dateVal,
        cleanGenderPref,
        cleanFurnished,
        cleanImageUrl,
        cleanStatus
      ]
    );

    const listingId = result.insertId;

    // Fetch created record
    const [created] = await pool.query('SELECT * FROM listings WHERE id = ?', [listingId]);

    return res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      listing: created[0]
    });
  } catch (error) {
    console.error('Create Listing Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get all listings with optional filter support
 * GET /api/listings
 */
const getListings = async (req, res) => {
  try {
    const { city, property_type, gender_preference, furnished, min_rent, max_rent, status } = req.query;

    let query = 'SELECT * FROM listings WHERE 1=1';
    const params = [];

    // Filters
    if (city && typeof city === 'string' && city.trim()) {
      query += ' AND LOWER(city) LIKE ?';
      params.push(`%${city.trim().toLowerCase()}%`);
    }

    if (property_type && typeof property_type === 'string' && property_type.trim()) {
      query += ' AND LOWER(property_type) = ?';
      params.push(property_type.trim().toLowerCase());
    }

    if (gender_preference && typeof gender_preference === 'string' && gender_preference.trim()) {
      query += ' AND LOWER(gender_preference) = ?';
      params.push(gender_preference.trim().toLowerCase());
    }

    if (furnished && typeof furnished === 'string' && furnished.trim()) {
      query += ' AND LOWER(furnished) = ?';
      params.push(furnished.trim().toLowerCase());
    }

    if (min_rent !== undefined && min_rent !== null && min_rent !== '') {
      const minVal = Number(min_rent);
      if (!isNaN(minVal)) {
        query += ' AND monthly_rent >= ?';
        params.push(minVal);
      }
    }

    if (max_rent !== undefined && max_rent !== null && max_rent !== '') {
      const maxVal = Number(max_rent);
      if (!isNaN(maxVal)) {
        query += ' AND monthly_rent <= ?';
        params.push(maxVal);
      }
    }

    // Default status to active if not explicitly specified
    if (status && typeof status === 'string' && status.trim()) {
      query += ' AND status = ?';
      params.push(status.trim().toLowerCase());
    } else {
      query += ' AND status = "active"';
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
      listings: rows
    });
  } catch (error) {
    console.error('Get Listings Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get a single listing by ID
 * GET /api/listings/:id
 */
const getListingById = async (req, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);

    if (isNaN(listingId) || listingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    const [rows] = await pool.query('SELECT * FROM listings WHERE id = ?', [listingId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    return res.status(200).json({
      success: true,
      listing: rows[0]
    });
  } catch (error) {
    console.error('Get Listing By ID Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update a listing (Owner only)
 * PUT /api/listings/:id
 */
const updateListing = async (req, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(listingId) || listingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    // Check if listing exists
    const [existing] = await pool.query('SELECT * FROM listings WHERE id = ?', [listingId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    const listing = existing[0];

    // Check ownership
    if (listing.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage your own listings'
      });
    }

    const {
      title,
      description,
      property_type,
      city,
      address,
      monthly_rent,
      security_deposit,
      available_from,
      gender_preference,
      furnished,
      image_url,
      status
    } = req.body;

    // Required fields validation
    const cleanTitle = cleanString(title) || listing.title;
    if (cleanTitle.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Title exceeds maximum length of 150 characters'
      });
    }

    let cleanPropertyType = listing.property_type;
    if (property_type) {
      cleanPropertyType = cleanString(property_type).toLowerCase();
      if (!allowedPropertyTypes.includes(cleanPropertyType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid property type. Must be flat, room, or hostel'
        });
      }
    }

    const cleanCity = cleanString(city) || listing.city;
    if (cleanCity.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'City exceeds maximum length of 100 characters'
      });
    }

    const cleanDescription = description !== undefined ? cleanString(description) : listing.description;
    const cleanAddress = address !== undefined ? cleanString(address) : listing.address;
    if (cleanAddress && cleanAddress.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Address exceeds maximum length of 255 characters'
      });
    }

    let rentVal = listing.monthly_rent;
    if (monthly_rent !== undefined && monthly_rent !== null && monthly_rent !== '') {
      rentVal = Number(monthly_rent);
      if (isNaN(rentVal) || rentVal < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid monthly rent'
        });
      }
    }

    let depositVal = listing.security_deposit;
    if (security_deposit !== undefined && security_deposit !== null && security_deposit !== '') {
      depositVal = Number(security_deposit);
      if (isNaN(depositVal) || depositVal < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid security deposit'
        });
      }
    }

    let dateVal = listing.available_from;
    if (available_from) {
      const parsedDate = new Date(available_from);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid available_from date'
        });
      }
      dateVal = parsedDate.toISOString().split('T')[0];
    }

    let cleanGenderPref = listing.gender_preference;
    if (gender_preference) {
      cleanGenderPref = cleanString(gender_preference).toLowerCase();
      if (!allowedGenderPreferences.includes(cleanGenderPref)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid gender preference'
        });
      }
    }

    let cleanFurnished = listing.furnished;
    if (furnished) {
      cleanFurnished = cleanString(furnished).toLowerCase();
      if (!allowedFurnishingTypes.includes(cleanFurnished)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid furnishing status'
        });
      }
    }

    const cleanImageUrl = image_url !== undefined ? (typeof image_url === 'string' ? image_url.trim() : '') : listing.image_url;
    if (cleanImageUrl && cleanImageUrl.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Image URL exceeds maximum length of 500 characters'
      });
    }

    let cleanStatus = listing.status;
    if (status) {
      cleanStatus = cleanString(status).toLowerCase();
      if (!allowedStatuses.includes(cleanStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }
    }

    // Parameterized UPDATE query (owner_id remains unchanged)
    await pool.query(
      `UPDATE listings
       SET title = ?, description = ?, property_type = ?, city = ?, address = ?, monthly_rent = ?, security_deposit = ?, available_from = ?, gender_preference = ?, furnished = ?, image_url = ?, status = ?
       WHERE id = ?`,
      [
        cleanTitle,
        cleanDescription,
        cleanPropertyType,
        cleanCity,
        cleanAddress,
        rentVal,
        depositVal,
        dateVal,
        cleanGenderPref,
        cleanFurnished,
        cleanImageUrl,
        cleanStatus,
        listingId
      ]
    );

    const [updated] = await pool.query('SELECT * FROM listings WHERE id = ?', [listingId]);

    return res.status(200).json({
      success: true,
      message: 'Listing updated successfully',
      listing: updated[0]
    });
  } catch (error) {
    console.error('Update Listing Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete a listing (Owner only)
 * DELETE /api/listings/:id
 */
const deleteListing = async (req, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(listingId) || listingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    // Check if listing exists
    const [existing] = await pool.query('SELECT owner_id FROM listings WHERE id = ?', [listingId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check ownership
    if (existing[0].owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage your own listings'
      });
    }

    // Delete listing
    await pool.query('DELETE FROM listings WHERE id = ?', [listingId]);

    return res.status(200).json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    console.error('Delete Listing Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing
};
