const express = require('express');
const router = express.Router();

const {
  addFavorite,
  getFavorites,
  removeFavorite
} = require('../controllers/favoriteController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/:listingId', authMiddleware, addFavorite);
router.get('/', authMiddleware, getFavorites);
router.delete('/:listingId', authMiddleware, removeFavorite);

module.exports = router;
