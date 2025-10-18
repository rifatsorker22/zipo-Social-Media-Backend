const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

    const { registerValidation, loginValidation, validate } = require('../middleware/validators');

router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.get('/me', protect, authController.getMe);
router.post('/refresh', authController.refreshToken);

module.exports = router;