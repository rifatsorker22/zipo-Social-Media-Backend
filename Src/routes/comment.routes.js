const express = require('express');
const router = express.Router();
const {
  createComment,
  getCommentsByPost,
  getCommentById,
  getCommentsByUser,
  updateComment,
  deleteComment,
  getRecentComments,
  searchComments,
  getCommentCount
} = require('../controllers/comment.controller');
const { protect } = require('../middleware/auth');

// Search comments (must be before other routes)
router.get('/search', searchComments);

// Recent comments (must be before /:id)
router.get('/recent', getRecentComments);

// Get comments by post ID
router.get('/post/:postId', getCommentsByPost);

// Get comment count for a post
router.get('/post/:postId/count', getCommentCount);

// Get comments by username
router.get('/user/:username', getCommentsByUser);

// Create comment
router.post('/', protect, createComment);

// Single comment operations
router.route('/:id')
  .get(getCommentById)
  .put(protect, updateComment)
  .delete(protect, deleteComment);

module.exports = router;