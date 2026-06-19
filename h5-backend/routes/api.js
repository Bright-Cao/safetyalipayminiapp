const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');

const authController = require('../controllers/auth');
const guardianController = require('../controllers/guardian');
const examController = require('../controllers/exam');
const trainingController = require('../controllers/training');
const applicationController = require('../controllers/application');
const exportController = require('../controllers/export');
const workshopAdminController = require('../controllers/workshop_admin');
const userManageController = require('../controllers/user_manage');
const safetyAdminController = require('../controllers/safety_admin');
const videoRoutes = require('./video');
const uploadRoutes = require('./upload');


// Auth routes (Open)
router.post('/login', authController.login);

// Guardian routes (Open - assuming it's a public inquiry)
router.post('/checkGuardian', guardianController.checkGuardian);

// Video Routes (from video.js)
router.use('/video', videoRoutes);

// Upload Routes (multipart file upload)
router.use('/upload', uploadRoutes);


// Protected Routes below (requires authentication logincards/etc)
router.use(authMiddleware);

// Application routes
router.post('/getMyApplications', applicationController.getMyApplications);
router.post('/submitApplication', applicationController.submitApplication);
router.post('/getAllApplications', applicationController.getAllApplications);

// Admin Data Exports
router.post('/exportData', exportController.exportData);

// Workshop Admin Routes
router.post('/workshop/getApplications',  workshopAdminController.getWorkshopApplications);
router.post('/workshop/approveInterview', workshopAdminController.approveWorkshopInterview);
router.post('/workshop/getAllInProgress', workshopAdminController.getAllInProgress);
router.post('/workshop/closeApplication', workshopAdminController.closeApplication);

// User Management (super_admin only)
router.post('/admin/getAllUsers', userManageController.getAllUsers);
router.post('/admin/updateUserRole', userManageController.updateUserRole);
router.post('/admin/createUser', userManageController.createUser);
router.post('/admin/deleteUser', userManageController.deleteUser);

// Safety Admin - Video Management
router.post('/safety/getVideos', safetyAdminController.getVideos);
router.post('/safety/addVideo', safetyAdminController.addVideo);
router.post('/safety/updateVideo', safetyAdminController.updateVideo);
router.post('/safety/deleteVideo', safetyAdminController.deleteVideo);

// Safety Admin - Question Bank Management
router.post('/safety/getQuestions', safetyAdminController.getQuestions);
router.post('/safety/addQuestion', safetyAdminController.addQuestion);
router.post('/safety/updateQuestion', safetyAdminController.updateQuestion);
router.post('/safety/deleteQuestions', safetyAdminController.deleteQuestions);
router.post('/safety/bulkImportQuestions', safetyAdminController.bulkImportQuestions);

// Safety Admin - Exam Settings
router.post('/safety/getExamSettings', safetyAdminController.getExamSettings);
router.post('/safety/updateExamSettings', safetyAdminController.updateExamSettings);


// Exam & Practice routes
router.post('/getPracticeQuestions', examController.getPracticeQuestions);
router.post('/getExamQuestions', examController.getExamQuestions);
router.post('/submitExam', examController.submitExam);

// Training routes
router.post('/updateVideoProgress', trainingController.updateVideoProgress);
router.post('/getVideoProgress', trainingController.getVideoProgress);
router.post('/training/getVideos', trainingController.getTrainingVideos);


// TODO: submitPracticeAnswers, if needed

module.exports = router;
