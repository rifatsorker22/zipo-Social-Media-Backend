const User = require('../models/User');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');

/**
 * Generate JWT Token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

/**
 * @desc    Register new user
 * @route   POST /api/users/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { username, email, password, display_name } = req.body;

    // Validation
    if (!username || !email || !password || !display_name) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      display_name
    });

    const token = generateToken(user._id);

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/users/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Please provide email/username and password'
      });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: login.toLowerCase() }, { username: login.toLowerCase() }]
    }).select('+password');

    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken(user._id);

    // Remove password from response
    user.password = undefined;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('followers', 'username display_name avatar_url')
      .populate('following', 'username display_name avatar_url');

    res.status(StatusCodes.OK).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

/**
 * @desc    Get user by username
 * @route   GET /api/users/:username
 * @access  Public
 */
const getUserByUsername = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .populate('followers', 'username display_name avatar_url')
      .populate('following', 'username display_name avatar_url');

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/me
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = ['display_name', 'bio', 'avatar_url'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/users/me/password
 * @access  Private
 */
const updatePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = new_password;
    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
};

/**
 * @desc    Follow a user
 * @route   POST /api/users/:username/follow
 * @access  Private
 */
const followUser = async (req, res) => {
  try {
    const userToFollow = await User.findOne({ username: req.params.username });

    if (!userToFollow) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if trying to follow self
    if (userToFollow._id.toString() === req.user.id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    // Check if already following
    if (userToFollow.followers.includes(req.user.id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'You are already following this user'
      });
    }

    // Add to followers/following
    await User.findByIdAndUpdate(userToFollow._id, {
      $push: { followers: req.user.id }
    });

    await User.findByIdAndUpdate(req.user.id, {
      $push: { following: userToFollow._id }
    });

    // Create notification
    await Notification.create({
      recipient: userToFollow._id,
      sender: req.user.id,
      type: 'follow'
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'User followed successfully'
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error following user',
      error: error.message
    });
  }
};

/**
 * @desc    Unfollow a user
 * @route   DELETE /api/users/:username/follow
 * @access  Private
 */
const unfollowUser = async (req, res) => {
  try {
    const userToUnfollow = await User.findOne({ username: req.params.username });

    if (!userToUnfollow) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if not following
    if (!userToUnfollow.followers.includes(req.user.id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'You are not following this user'
      });
    }

    // Remove from followers/following
    await User.findByIdAndUpdate(userToUnfollow._id, {
      $pull: { followers: req.user.id }
    });

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { following: userToUnfollow._id }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'User unfollowed successfully'
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error unfollowing user',
      error: error.message
    });
  }
};

/**
 * @desc    Get user followers
 * @route   GET /api/users/:username/followers
 * @access  Public
 */
const getFollowers = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .populate('followers', 'username display_name avatar_url is_verified');

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: user.followers,
      count: user.followers.length
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching followers',
      error: error.message
    });
  }
};

/**
 * @desc    Get user following
 * @route   GET /api/users/:username/following
 * @access  Public
 */
const getFollowing = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .populate('following', 'username display_name avatar_url is_verified');

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: user.following,
      count: user.following.length
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching following',
      error: error.message
    });
  }
};

/**
 * @desc    Search users
 * @route   GET /api/users/search
 * @access  Public
 */
const searchUsers = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;

    if (!query) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const skip = (page - 1) * limit;

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { display_name: { $regex: query, $options: 'i' } }
      ],
      is_active: true
    })
      .select('username display_name avatar_url is_verified bio')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { display_name: { $regex: query, $options: 'i' } }
      ],
      is_active: true
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: users,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_results: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error searching users',
      error: error.message
    });
  }
};

/**
 * @desc    Deactivate account
 * @route   DELETE /api/users/me
 * @access  Private
 */
const deactivateAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      is_active: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deactivating account',
      error: error.message
    });
  }
};

module.exports = {
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
};