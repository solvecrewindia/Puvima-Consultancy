/**
 * PUVIMA Consultancy — Public Customer Reviews API Routes
 */

const express = require('express');
const router = express.Router();
const storeService = require('../services/store.service');

// GET /api/reviews - returns only approved reviews for public showcase
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await storeService.getReviews({ status: 'approved' });
    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve published reviews: ' + err.message
    });
  }
});

// POST /api/reviews - submit a new review from the main page
router.post('/reviews', async (req, res) => {
  try {
    const { name, company, rating, review_text, platform, avatar_url } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name is required (minimum 2 characters).'
      });
    }

    if (!review_text || typeof review_text !== 'string' || review_text.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Review feedback is required (minimum 5 characters).'
      });
    }

    const numericRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));

    const newReview = await storeService.addReview({
      name: name.trim(),
      company: company ? company.trim() : null,
      rating: numericRating,
      review_text: review_text.trim(),
      platform: platform ? platform.trim().toLowerCase() : 'google',
      avatar_url: avatar_url || 'assets/images/team/member-1.svg'
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for your review! Your feedback has been submitted to the PUVIMA Advisory Desk and will be published to the main page once approved by the administrator.',
      review: newReview
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to record customer review: ' + err.message
    });
  }
});

module.exports = router;
