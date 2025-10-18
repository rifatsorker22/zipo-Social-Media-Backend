const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { StatusCodes } = require('http-status-codes');

/**
 * @desc    Create a comment on a post
 * @route   POST /api/comments
 * @access  Private
 */
const createComment = async (req, res) => {
  try {
    const { post, content } = req.body;

    if (!post || !content || content.trim().length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Post ID and content are required'
      });
    }

    // Check if post exists and is not deleted
    const postDoc = await Post.findOne({
      _id: post,
      is_deleted: false
    });

    if (!postDoc) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Create comment
    const comment = await Comment.create({
      post,
      author: req.user.id,
      content
    });

    // Increment post comment count
    await Post.findByIdAndUpdate(post, {
      $inc: { comments_count: 1 }
    });

    // Create notification if not commenting on own post
    if (postDoc.author.toString() !== req.user.id) {
      await Notification.create({
        recipient: postDoc.author,
        sender: req.user.id,
        type: 'comment',
        post: post,
        comment: comment._id
      });
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'username display_name avatar_url is_verified')
      .populate('post', 'content');

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: populatedComment
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error creating comment',
      error: error.message
    });
  }
};

/**
 * @desc    Get comments for a post
 * @route   GET /api/comments/post/:postId
 * @access  Public
 */
const getCommentsByPost = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Check if post exists
    const post = await Post.findOne({
      _id: req.params.postId,
      is_deleted: false
    });

    if (!post) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Post not found'
      });
    }

    const comments = await Comment.find({
      post: req.params.postId,
      is_deleted: false
    })
      .populate('author', 'username display_name avatar_url is_verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Comment.countDocuments({
      post: req.params.postId,
      is_deleted: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: comments,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_comments: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching comments',
      error: error.message
    });
  }
};

/**
 * @desc    Get single comment by ID
 * @route   GET /api/comments/:id
 * @access  Public
 */
const getCommentById = async (req, res) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.id,
      is_deleted: false
    })
      .populate('author', 'username display_name avatar_url is_verified')
      .populate('post', 'content author');

    if (!comment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Comment not found'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: comment
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching comment',
      error: error.message
    });
  }
};

/**
 * @desc    Get comments by user
 * @route   GET /api/comments/user/:username
 * @access  Public
 */
const getCommentsByUser = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Find user by username
    const User = require('../models/User');
    const user = await User.findOne({ username: req.params.username });

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    const comments = await Comment.find({
      author: user._id,
      is_deleted: false
    })
      .populate('author', 'username display_name avatar_url is_verified')
      .populate('post', 'content author')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Comment.countDocuments({
      author: user._id,
      is_deleted: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: comments,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_comments: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching user comments',
      error: error.message
    });
  }
};

/**
 * @desc    Update a comment
 * @route   PUT /api/comments/:id
 * @access  Private
 */
const updateComment = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Content is required'
      });
    }

    const comment = await Comment.findOne({
      _id: req.params.id,
      is_deleted: false
    });

    if (!comment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user is the author
    if (comment.author.toString() !== req.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to update this comment'
      });
    }

    comment.content = content;
    await comment.save();

    const updatedComment = await Comment.findById(comment._id)
      .populate('author', 'username display_name avatar_url is_verified')
      .populate('post', 'content');

    res.status(StatusCodes.OK).json({
      success: true,
      data: updatedComment
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error updating comment',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a comment (soft delete)
 * @route   DELETE /api/comments/:id
 * @access  Private
 */
const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.id,
      is_deleted: false
    });

    if (!comment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user is the author or post owner
    const post = await Post.findById(comment.post);
    
    if (
      comment.author.toString() !== req.user.id &&
      post.author.toString() !== req.user.id
    ) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to delete this comment'
      });
    }

    // Soft delete comment
    comment.is_deleted = true;
    await comment.save();

    // Decrement post comment count
    await Post.findByIdAndUpdate(comment.post, {
      $inc: { comments_count: -1 }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deleting comment',
      error: error.message
    });
  }
};

/**
 * @desc    Get recent comments (activity feed)
 * @route   GET /api/comments/recent
 * @access  Public
 */
const getRecentComments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ is_deleted: false })
      .populate('author', 'username display_name avatar_url is_verified')
      .populate('post', 'content author')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Comment.countDocuments({ is_deleted: false });

    res.status(StatusCodes.OK).json({
      success: true,
      data: comments,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_comments: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching recent comments',
      error: error.message
    });
  }
};

/**
 * @desc    Search comments
 * @route   GET /api/comments/search
 * @access  Public
 */
const searchComments = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;

    if (!query) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      content: { $regex: query, $options: 'i' },
      is_deleted: false
    })
      .populate('author', 'username display_name avatar_url is_verified')
      .populate('post', 'content author')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Comment.countDocuments({
      content: { $regex: query, $options: 'i' },
      is_deleted: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: comments,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_results: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error searching comments',
      error: error.message
    });
  }
};

/**
 * @desc    Get comment count for a post
 * @route   GET /api/comments/post/:postId/count
 * @access  Public
 */
const getCommentCount = async (req, res) => {
  try {
    const count = await Comment.countDocuments({
      post: req.params.postId,
      is_deleted: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching comment count',
      error: error.message
    });
  }
};

module.exports = {
  createComment,
  getCommentsByPost,
  getCommentById,
  getCommentsByUser,
  updateComment,
  deleteComment,
  getRecentComments,
  searchComments,
  getCommentCount
};