const { pool } = require('../config/database');

/**
 * Helper to clean up string fields
 */
const cleanString = (val) => (typeof val === 'string' ? val.trim() : null);

/**
 * Create or Update own student profile
 * PUT /api/profile
 */
const createOrUpdateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      college_name,
      course,
      year_of_study,
      gender,
      age,
      bio,
      city,
      profile_image
    } = req.body;

    const cleanCollegeName = cleanString(college_name);
    const cleanCourse = cleanString(course);
    const cleanYearOfStudy = cleanString(year_of_study);
    const cleanGender = cleanString(gender);
    const cleanBio = cleanString(bio);
    const cleanCity = cleanString(city);
    const cleanProfileImage = typeof profile_image === 'string' ? profile_image.trim() : '';

    // Validate Gender
    if (cleanGender && !['male', 'female', 'other'].includes(cleanGender.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender'
      });
    }

    const validGender = cleanGender ? cleanGender.toLowerCase() : null;

    // Validate Age
    let parsedAge = null;
    if (age !== undefined && age !== null && age !== '') {
      parsedAge = Number(age);
      if (isNaN(parsedAge) || !Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid age'
        });
      }
    }

    // Validate Field Lengths
    if (cleanCollegeName && cleanCollegeName.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'College name exceeds maximum length of 150 characters'
      });
    }

    if (cleanCourse && cleanCourse.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Course exceeds maximum length of 100 characters'
      });
    }

    if (cleanYearOfStudy && cleanYearOfStudy.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Year of study exceeds maximum length of 50 characters'
      });
    }

    if (cleanCity && cleanCity.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'City exceeds maximum length of 100 characters'
      });
    }

    if (cleanProfileImage && cleanProfileImage.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Profile image URL exceeds maximum length of 500 characters'
      });
    }

    // Check if profile exists for user
    const [existing] = await pool.query(
      'SELECT id FROM student_profiles WHERE user_id = ?',
      [userId]
    );

    if (existing.length === 0) {
      // Create new profile
      const [result] = await pool.query(
        `INSERT INTO student_profiles
          (user_id, college_name, course, year_of_study, gender, age, bio, city, profile_image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          cleanCollegeName,
          cleanCourse,
          cleanYearOfStudy,
          validGender,
          parsedAge,
          cleanBio,
          cleanCity,
          cleanProfileImage
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Profile created successfully',
        profile: {
          id: result.insertId,
          user_id: userId,
          college_name: cleanCollegeName,
          course: cleanCourse,
          year_of_study: cleanYearOfStudy,
          gender: validGender,
          age: parsedAge,
          bio: cleanBio,
          city: cleanCity,
          profile_image: cleanProfileImage
        }
      });
    } else {
      // Update existing profile
      const profileId = existing[0].id;
      await pool.query(
        `UPDATE student_profiles
         SET college_name = ?, course = ?, year_of_study = ?, gender = ?, age = ?, bio = ?, city = ?, profile_image = ?
         WHERE user_id = ?`,
        [
          cleanCollegeName,
          cleanCourse,
          cleanYearOfStudy,
          validGender,
          parsedAge,
          cleanBio,
          cleanCity,
          cleanProfileImage,
          userId
        ]
      );

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        profile: {
          id: profileId,
          user_id: userId,
          college_name: cleanCollegeName,
          course: cleanCourse,
          year_of_study: cleanYearOfStudy,
          gender: validGender,
          age: parsedAge,
          bio: cleanBio,
          city: cleanCity,
          profile_image: cleanProfileImage
        }
      });
    }
  } catch (error) {
    console.error('Profile PUT Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get own student profile
 * GET /api/profile
 */
const getOwnProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, user_id, college_name, course, year_of_study, gender, age, bio, city, profile_image
       FROM student_profiles
       WHERE user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      profile: rows[0]
    });
  } catch (error) {
    console.error('Get Own Profile Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get another student's profile by user ID
 * GET /api/profile/:userId
 */
const getUserProfile = async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, college_name, course, year_of_study, gender, age, bio, city, profile_image
       FROM student_profiles
       WHERE user_id = ?`,
      [targetUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      profile: rows[0]
    });
  } catch (error) {
    console.error('Get User Profile Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createOrUpdateProfile,
  getOwnProfile,
  getUserProfile
};
