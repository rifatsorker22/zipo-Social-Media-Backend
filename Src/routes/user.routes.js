const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  getUserByUsername,
  updateProfile,
  updatePassword,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  searchUsers,
  deactivateAccount
} = require('../controllers/user.controller');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/search', searchUsers);

// Protected routes - Current user
router.get('/me', protect, getMe);
router.put('/me', protect, updateProfile);
router.put('/me/password', protect, updatePassword);
router.delete('/me', protect, deactivateAccount);

// Public/Protected routes - Specific user
router.get('/:username', getUserByUsername);
router.get('/:username/followers', getFollowers);
router.get('/:username/following', getFollowing);

// Protected routes - Follow/Unfollow
router.post('/:username/follow', protect, followUser);
router.delete('/:username/follow', protect, unfollowUser);

module.exports = router;