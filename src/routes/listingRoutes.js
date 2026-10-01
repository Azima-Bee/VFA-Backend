const express = require('express');
const router = express.Router();

const {
  createListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing
} = require('../controllers/listingController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createListing);
router.get('/', authMiddleware, getListings);
router.get('/:id', authMiddleware, getListingById);
router.put('/:id', authMiddleware, updateListing);
router.delete('/:id', authMiddleware, deleteListing);

module.exports = router;
