const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

// Authentication Management getAppUsers
// OTP Auth
router.post('/otpLogin', authController.otpLogin);
router.post('/otp', authController.createOtp);
router.post('/otpSignUp/:otp', authController.otpSignUp);

router.post('/login', authController.login);
router.post('/phoneLogin', authController.phoneLogin);
router.post('/signup', authController.signup);

router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

router.use(authController.protect);
//sendInvite
router.route('/invite/:userId').get(authController.sendInvite);

router
    .route('/active')
    .get(
        authController.restrictTo('admin'),
        userController.activeUsers,
        userController.getAllUsers
    );
router
    .route('/inactive')
    .get(
        authController.restrictTo('admin'),
        userController.inactiveUsers,
        userController.getAllUsers
    );

router.patch('/updateMyPassword', authController.updatePassword);

// User Management

router.patch('/updateMe', userController.updateMe);
router.get('/me', userController.getMe, userController.getUser);
router.route('/status').get(userController.getStatus);

router.patch(
    '/deactivate/:id',
    authController.restrictTo('admin'),
    userController.deactivateUser,
    userController.updateUser
);

router.patch(
    '/activate/:id',
    authController.restrictTo('admin'),
    userController.activateUser,
    userController.updateUser
);

router
    .route('/')
    .get(authController.restrictTo('admin'), userController.getAllUsers)
    .post(authController.restrictTo('admin'), userController.createUser);

router
    .route('/:id')
    .get(userController.getUser)
    .patch(authController.restrictTo('admin'), userController.updateUser)
    .delete(authController.restrictTo('admin'), userController.deleteUser);

module.exports = router;
