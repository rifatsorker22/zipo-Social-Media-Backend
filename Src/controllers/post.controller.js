const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { StatusCodes } = require('http-status-codes');

/**
 * @desc    Create a new post
 * @route   POST /api/posts
 * @access  Private
 */
const createPost = async (req, res) => {
  try {
    const { content, media_url } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Post content is required'
      });
    }

    const post = await Post.create({
      author: req.user.id,
      content,
      media_url
    });

    const populatedPost = await Post.findById(post._id)
      .populate('author', 'username display_name avatar_url is_verified');

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: populatedPost
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error creating post',
      error: error.message
    });
  }
};

/**
 * @desc    Get all posts (feed)
 * @route   GET /api/posts
 * @access  Public
 */
const getPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ is_deleted: false })
      .populate('author', 'username display_name avatar_url is_verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add like status if user is authenticated
    if (req.user) {
      posts.forEach(post => {
        post.is_liked = post.likes.some(
          like => like.toString() === req.user.id
        );
        post.likes_count = post.likes.length;
        delete post.likes; // Remove likes array from response
      });
    } else {
      posts.forEach(post => {
        post.is_liked = false;
        post.likes_count = post.likes.length;
        delete post.likes;
      });
    }

    const total = await Post.countDocuments({ is_deleted: false });

    res.status(StatusCodes.OK).json({
      success: true,
      data: posts,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_posts: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching posts',
      error: error.message
    });
  }
};

/**
 * @desc    Get feed (posts from following users)
 * @route   GET /api/posts/feed
 * @access  Private
 */
const getFeed = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user.id);
    const followingIds = [...user.following, req.user.id]; // Include own posts

    const posts = await Post.find({
      author: { $in: followingIds },
      is_deleted: false
    })
      .populate('author', 'username display_name avatar_url is_verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add like status
    posts.forEach(post => {
      post.is_liked = post.likes.some(
        like => like.toString() === req.user.id
      );
      post.likes_count = post.likes.length;
      delete post.likes;
    });

    const total = await Post.countDocuments({
      author: { $in: followingIds },
      is_deleted: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: posts,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_posts: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching feed',
      error: error.message
    });
  }
};

/**
 * @desc    Get single post by ID
 * @route   GET /api/posts/:id
 * @access  Public
 */
const getPostById = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      is_deleted: false
    })
      .populate('author', 'username display_name avatar_url is_verified')
      .lean();

    if (!post) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Add like status if user is authenticated
    if (req.user) {
      post.is_liked = post.likes.some(
        like => like.toString() === req.user.id
      );
    } else {
      post.is_liked = false;
    }

    post.likes_count = post.likes.length;
    delete post.likes;

    res.status(StatusCodes.OK).json({
      success: true,
      data: post
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching post',
      error: error.message
    });
  }
};

/**
 * @desc    Get posts by username
 * @route   GET /api/posts/user/:username
 * @access  Public
 */
const getPostsByUsername = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username: req.params.username });

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    const posts = await Post.find({
      author: user._id,
      is_deleted: false
    })
      .populate('author', 'username display_name avatar_url is_verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add like status if user is authenticated
    if (req.user) {
      posts.forEach(post => {
        post.is_liked = post.likes.some(
          like => like.toString() === req.user.id
        );
        post.likes_count = post.likes.length;
        delete post.likes;
      });
    } else {
      posts.forEach(post => {
        post.is_liked = false;
        post.likes_count = post.likes.length;
        delete post.likes;
      });
    }

    const total = await Post.countDocuments({
      author: user._id,
      is_deleted: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: posts,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_posts: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching user posts',
      error: error.message
    });
  }
};

/**
 * @desc    Update a post
 * @route   PUT /api/posts/:id
 * @access  Private
 */
const updatePost = async (req, res) => {
  try {
    const { content, media_url } = req.body;

    const post = await Post.findOne({
      _id: req.params.id,
      is_deleted: false
    });

    if (!post) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user is the author
    if (post.author.toString() !== req.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to update this post'
      });
    }

    // Update fields
    if (content !== undefined) post.content = content;
    if (media_url !== undefined) post.media_url = media_url;

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate('author', 'username display_name avatar_url is_verified');

    res.status(StatusCodes.OK).json({
      success: true,
      data: updatedPost
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error updating post',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a post (soft delete)
 * @route   DELETE /api/posts/:id
 * @access  Private
 */
const deletePost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      is_deleted: false
    });

    if (!post) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user is the author
    if (post.author.toString() !== req.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    post.is_deleted = true;
    await post.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deleting post',
      error: error.message
    });
  }
};

/**
 * @desc    Like a post
 * @route   POST /api/posts/:id/like
 * @access  Private
 */
const likePost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      is_deleted: false
    });

    if (!post) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if already liked
    if (post.likes.includes(req.user.id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Post already liked'
      });
    }

    post.likes.push(req.user.id);
    await post.save();

    // Create notification if not own post
    if (post.author.toString() !== req.user.id) {
      await Notification.create({
        recipient: post.author,
        sender: req.user.id,
        type: 'like',
        post: post._id
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Post liked successfully',
      likes_count: post.likes.length
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error liking post',
      error: error.message
    });
  }
};

/**
 * @desc    Unlike a post
 * @route   DELETE /api/posts/:id/like
 * @access  Private
 */
const unlikePost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      is_deleted: false
    });

    if (!post) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if not liked
    if (!post.likes.includes(req.user.id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Post not liked yet'
      });
    }

    post.likes = post.likes.filter(
      like => like.toString() !== req.user.id
    );
    await post.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Post unliked successfully',
      likes_count: post.likes.length
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error unliking post',
      error: error.message
    });
  }
};

/**
 * @desc    Get users who liked a post
 * @route   GET /api/posts/:id/likes
 * @access  Public
 */
const getPostLikes = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      is_deleted: false
    }).populate('likes', 'username display_name avatar_url is_verified');

    if (!post) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: post.likes,
      count: post.likes.length
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching post likes',
      error: error.message
    });
  }
};

/**
 * @desc    Search posts
 * @route   GET /api/posts/search
 * @access  Public
 */
const searchPosts = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;

    if (!query) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const skip = (page - 1) * limit;

    const posts = await Post.find({
      content: { $regex: query, $options: 'i' },
      is_deleted: false
    })
      .populate('author', 'username display_name avatar_url is_verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add like status if user is authenticated
    if (req.user) {
      posts.forEach(post => {
        post.is_liked = post.likes.some(
          like => like.toString() === req.user.id
        );
        post.likes_count = post.likes.length;
        delete post.likes;
      });
    } else {
      posts.forEach(post => {
        post.is_liked = false;
        post.likes_count = post.likes.length;
        delete post.likes;
      });
    }

    const total = await Post.countDocuments({
      content: { $regex: query, $options: 'i' },
      is_deleted: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: posts,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_results: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error searching posts',
      error: error.message
    });
  }
};

module.exports = {
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
};