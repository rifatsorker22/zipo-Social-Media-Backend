const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../utils/jwt');

exports.register = async (req, res, next) => {
  try {
    const { username, email, password, display_name } = req.body;

    const user = await User.create({
      username,
      email,
      password,
      display_name
    });

    const token = generateToken(user._id);
    const refresh_token = generateRefreshToken(user._id);

    res.status(201).json({
      success: true,
      data: { user, token, refresh_token }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    const refresh_token = generateRefreshToken(user._id);

    user.password = undefined;
    res.json({ success: true, data: { user, token, refresh_token } });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('followers', 'username display_name avatar_url')
      .populate('following', 'username display_name avatar_url');

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const token = generateToken(decoded.id);

    res.json({ success: true, data: { token } });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};