const { body, param, query, validationResult } = require('express-validator');
const { StatusCodes } = require('http-status-codes');

/**
 * Validation error handler
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const extractedErrors = {};
    errors.array().forEach((err) => {
      if (!extractedErrors[err.path]) {
        extractedErrors[err.path] = err.msg;
      }
    });

    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errors: extractedErrors
    });
  }
  
  next();
};

/**
 * Auth validations
 */
const registerValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
    .toLowerCase(),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('display_name')
    .trim()
    .notEmpty().withMessage('Display name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Display name must be between 2 and 50 characters')
];

const loginValidation = [
  body('login')
    .trim()
    .notEmpty().withMessage('Email or username is required'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

/**
 * User validations
 */
const updateProfileValidation = [
  body('display_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Display name must be between 2 and 50 characters'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  
  body('avatar_url')
    .optional()
    .trim()
    .isURL().withMessage('Avatar URL must be a valid URL')
];

const updatePasswordValidation = [
  body('current_password')
    .notEmpty().withMessage('Current password is required'),
  
  body('new_password')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const usernameValidation = [
  param('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Invalid username')
];

/**
 * Post validations
 */
const createPostValidation = [
  body('content')
    .trim()
    .notEmpty().withMessage('Post content is required')
    .isLength({ min: 1, max: 2000 }).withMessage('Post content must be between 1 and 2000 characters'),
  
  body('media_url')
    .optional()
    .trim()
    .isURL().withMessage('Media URL must be a valid URL')
];

const updatePostValidation = [
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 }).withMessage('Post content must be between 1 and 2000 characters'),
  
  body('media_url')
    .optional()
    .trim()
    .isURL().withMessage('Media URL must be a valid URL')
];

const postIdValidation = [
  param('id')
    .notEmpty().withMessage('Post ID is required')
    .isMongoId().withMessage('Invalid post ID')
];

/**
 * Comment validations
 */
const createCommentValidation = [
  body('post')
    .notEmpty().withMessage('Post ID is required')
    .isMongoId().withMessage('Invalid post ID'),
  
  body('content')
    .trim()
    .notEmpty().withMessage('Comment content is required')
    .isLength({ min: 1, max: 500 }).withMessage('Comment content must be between 1 and 500 characters')
];

const updateCommentValidation = [
  body('content')
    .trim()
    .notEmpty().withMessage('Comment content is required')
    .isLength({ min: 1, max: 500 }).withMessage('Comment content must be between 1 and 500 characters')
];

const commentIdValidation = [
  param('id')
    .notEmpty().withMessage('Comment ID is required')
    .isMongoId().withMessage('Invalid comment ID')
];

/**
 * Message validations
 */
const sendMessageValidation = [
  body('chat')
    .notEmpty().withMessage('Chat ID is required')
    .isMongoId().withMessage('Invalid chat ID'),
  
  body('content')
    .trim()
    .notEmpty().withMessage('Message content is required')
    .isLength({ min: 1, max: 2000 }).withMessage('Message content must be between 1 and 2000 characters')
];

const updateMessageValidation = [
  body('content')
    .trim()
    .notEmpty().withMessage('Message content is required')
    .isLength({ min: 1, max: 2000 }).withMessage('Message content must be between 1 and 2000 characters')
];

const messageIdValidation = [
  param('id')
    .notEmpty().withMessage('Message ID is required')
    .isMongoId().withMessage('Invalid message ID')
];

/**
 * Chat validations
 */
const createChatValidation = [
  body('participant')
    .notEmpty().withMessage('Participant ID is required')
    .isMongoId().withMessage('Invalid participant ID')
];

const chatIdValidation = [
  param('id')
    .notEmpty().withMessage('Chat ID is required')
    .isMongoId().withMessage('Invalid chat ID'),
  
  param('chatId')
    .optional()
    .isMongoId().withMessage('Invalid chat ID')
];

/**
 * Search validations
 */
const searchValidation = [
  query('query')
    .trim()
    .notEmpty().withMessage('Search query is required')
    .isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters')
];

/**
 * Pagination validations
 */
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt()
];

/**
 * Notification validations
 */
const notificationIdValidation = [
  param('id')
    .notEmpty().withMessage('Notification ID is required')
    .isMongoId().withMessage('Invalid notification ID')
];

/**
 * Sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  // Remove any null bytes
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/\0/g, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (let key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
};

/**
 * Rate limiting helper for validation
 */
const validateRateLimit = (req, res, next) => {
  // This would integrate with your rate limiting logic
  // For now, just pass through
  next();
};

module.exports = {
  // Core validation
  validate,
  sanitizeInput,
  validateRateLimit,
  
  // Auth validations
  registerValidation,
  loginValidation,
  
  // User validations
  updateProfileValidation,
  updatePasswordValidation,
  usernameValidation,
  
  // Post validations
  createPostValidation,
  updatePostValidation,
  postIdValidation,
  
  // Comment validations
  createCommentValidation,
  updateCommentValidation,
  commentIdValidation,
  
  // Message validations
  sendMessageValidation,
  updateMessageValidation,
  messageIdValidation,
  
  // Chat validations
  createChatValidation,
  chatIdValidation,
  
  // Search & pagination
  searchValidation,
  paginationValidation,
  
  // Notification validations
  notificationIdValidation
};