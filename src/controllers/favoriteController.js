const { pool } = require('../config/database');

/**
 * Add a listing to favorites
 * POST /api/favorites/:listingId
 */
const addFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = parseInt(req.params.listingId, 10);

    if (isNaN(listingId) || listingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    // Check if listing exists
    const [listingRows] = await pool.query(
      'SELECT id FROM listings WHERE id = ?',
      [listingId]
    );

    if (listingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check if already favorited
    const [existingFav] = await pool.query(
      'SELECT id FROM favorites WHERE user_id = ? AND listing_id = ?',
      [userId, listingId]
    );

    if (existingFav.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Listing is already in favorites'
      });
    }

    // Insert favorite (user_id strictly comes from req.user.id)
    const [result] = await pool.query(
      'INSERT INTO favorites (user_id, listing_id) VALUES (?, ?)',
      [userId, listingId]
    );

    return res.status(201).json({
      success: true,
      message: 'Listing added to favorites',
      favorite: {
        id: result.insertId,
        user_id: userId,
        listing_id: listingId
      }
    });
  } catch (error) {
    console.error('Add Favorite Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get authenticated user's favorite listings
 * GET /api/favorites
 */
const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    // Join favorites with listings table
    const [rows] = await pool.query(
      `SELECT f.id AS favorite_id, f.created_at AS favorited_at,
              l.id AS listing_id, l.owner_id, l.title, l.description, l.property_type,
              l.city, l.address, l.monthly_rent, l.security_deposit, l.available_from,
              l.gender_preference, l.furnished, l.image_url, l.status, l.created_at
       FROM favorites f
       JOIN listings l ON f.listing_id = l.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      favorites: rows
    });
  } catch (error) {
    console.error('Get Favorites Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Remove a listing from favorites
 * DELETE /api/favorites/:listingId
 */
const removeFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = parseInt(req.params.listingId, 10);

    if (isNaN(listingId) || listingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }

    // Check if favorite exists
    const [existing] = await pool.query(
      'SELECT id FROM favorites WHERE user_id = ? AND listing_id = ?',
      [userId, listingId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found'
      });
    }

    // Delete favorite
    await pool.query(
      'DELETE FROM favorites WHERE user_id = ? AND listing_id = ?',
      [userId, listingId]
    );

    return res.status(200).json({
      success: true,
      message: 'Listing removed from favorites'
    });
  } catch (error) {
    console.error('Remove Favorite Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  addFavorite,
  getFavorites,
  removeFavorite
};
