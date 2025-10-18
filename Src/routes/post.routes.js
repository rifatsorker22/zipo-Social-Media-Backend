const express = require('express');
const router = express.Router();
const {
  createPost,
  getPosts,
  getFeed,
  getPostById,
  getPostsByUsername,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getPostLikes,
  searchPosts
} = require('../controllers/post.controller');
const { protect, optionalAuth } = require('../middleware/auth');

// Search posts (must be before other routes)
router.get('/search', optionalAuth, searchPosts);

// Feed route (must be before /:id)
router.get('/feed', protect, getFeed);

// User posts (must be before /:id)
router.get('/user/:username', optionalAuth, getPostsByUsername);

// Main post routes
router.route('/')
  .get(optionalAuth, getPosts)
  .post(protect, createPost);

// Single post operations
router.route('/:id')
  .get(optionalAuth, getPostById)
  .put(protect, updatePost)
  .delete(protect, deletePost);

// Like operations
router.route('/:id/like')
  .post(protect, likePost)
  .delete(protect, unlikePost);

// Get post likes
router.get('/:id/likes', getPostLikes);

module.exports = router;