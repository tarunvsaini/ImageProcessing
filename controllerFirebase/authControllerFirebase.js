const { promisify } = require('util');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const axios = require('axios');
const User = require('../models/userModel');
// const Company = require('../models/companyModel');
// const Attendance = require('../models/attendanceModel');
// const Counter = require('../models/counterModel');
const Otp = require('../models/otpModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const Sms = require('../utils/sms');
// const FeatureLogController = require('./loggingController');

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });

const createSendToken = (user, customToken, statusCode, req, res) => {
    const token = signToken(user._id);

    // if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
    //cookieOptions.secure = req.secure || req.headers['x-forwarded-proto'] === 'https';

    res.cookie('jwt', token, {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    });
    // Remove password from output
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        customToken,
        newUser: user.newUser,
        data: {
            user,
        },
    });
};

const createSignUpUser = catchAsync(async (req, res, next) => {
    // const newUser = await User.create(req.body);
    // console.log('req', req.body.user.company);
    // console.log('company', company);

    const newUser = await User.create({
        name: req.body.user.name,
        email: req.body.user.email,
        phone: req.body.user.phone,
        role: 'admin',
        company: req.body.user.company,
        newUser: false,
        password: req.body.user.password,
        passwordConfirm: req.body.user.passwordConfirm,
    });
    const userId = String(newUser._id);
    // const url = 'http://optimiz.co.in';
    const db = admin.database();
    const ref = db.ref().child('Users');
    try {
        await admin.auth().createUser({
            uid: userId,
            displayName: req.body.user.name,
            email: req.body.user.email,
            phoneNumber: `+91${req.body.user.phone}`,
            password: req.body.user.password,
            emailVerified: false,
            disabled: false,
        });
        await ref.child(userId).set({
            name: req.body.user.name,
            email: req.body.user.email,
            phone: `+91${req.body.user.phone}`,
            company: String(req.body.user.company),
            online: false,
            disabled: false,
            role: 'admin',
            photo: '',
        });
        const customToken = await admin.auth().createCustomToken(userId);
        createSendToken(newUser, customToken, 201, req, res);
    } catch (e) {
        await User.findByIdAndDelete(userId);
        res.status(404).json({
            status: 'fail',
            message: e.message,
        });
    }
});

// INFO: Do not use this
exports.signup = catchAsync((req, res, next) => {
    // const newUser = await User.create(req.body);
    createSignUpUser(req, res, next, null);
});

exports.otpSignUp = catchAsync(async (req, res, next) => {
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.otp)
        .digest('hex');

    const otp = await Otp.findOne({
        otp: hashedToken,
        email: req.body.user.email,
        phone: req.body.user.phone,
        otpExpires: { $gt: Date.now() },
    });

    if (!otp) {
        return next(new AppError('OTP is invalid or has expired', 400));
    }

    otp.otp = undefined;
    otp.otpExpires = undefined;
    await otp.save();

    await createSignUpUser(req, res, next);
});

exports.phoneLogin = catchAsync(async (req, res, next) => {
    const { phone, password } = req.body;
    // Check if email,password exists
    if (!phone || !password) {
        return next(new AppError('Please provide an email and password', 400));
    }

    // Check if user exists and password is correct
    const user = await User.findOne({ phone: phone }).select(
        '+password +active'
    );

    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect Phone Number or Password', 401));
    }

    if (user.active === false) {
        return next(
            new AppError(
                'Your account is deactivated.Contact Adminstrator to reactivate.',
                401
            )
        );
    }
    const customToken = await admin.auth().createCustomToken(String(user._id));
    // If everything is ok send a json web token to client
    createSendToken(user, customToken, 200, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    // Check if email,password exists
    if (!email || !password) {
        return next(new AppError('Please provide an email and password', 400));
    }

    // Check if user exists and password is correct
    const user = await User.findOne({ email }).select('+password +active');

    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect Email or Password', 401));
    }

    if (user.active === false) {
        return next(
            new AppError(
                'Your account is deactivated.Contact Adminstrator to reactivate.',
                401
            )
        );
    }

    const customToken = await admin.auth().createCustomToken(String(user._id));
    // If everything is ok send a json web token to client
    createSendToken(user, customToken, 200, req, res);
});

exports.otpLogin = catchAsync(async (req, res, next) => {
    //
    // const { loginCredential, credentialType, otpPassword } = req.body;
    // {
    //   "loginCredential": "tvssaini@gmail.com",
    //   "credentialType": "email",
    //   "otpPassword":"547110"
    //   }
    const { phone, otp: otpPassword } = req.body;
    const hashedToken = crypto
        .createHash('sha256')
        .update(otpPassword)
        .digest('hex');

    const verify = {
        otp: hashedToken,
        phone: phone,
        otpExpires: { $gt: Date.now() },
    };

    const otp = await Otp.findOne(verify);

    if (!otp) {
        return next(new AppError('OTP is invalid or has expired', 400));
    }

    otp.otp = undefined;
    otp.otpExpires = undefined;
    await otp.save();

    const user = await User.findOne({ phone: phone }).select(
        '+password +active'
    );

    if (!user) {
        return next(
            new AppError(
                `${phone} is not registered.You can create a FREE account using the Sign Up Button`,
                401
            )
        );
    }

    if (user.active === false) {
        return next(
            new AppError(
                'Your account is deactivated.Contact Adminstrator to reactivate.',
                401
            )
        );
    }

    const customToken = await admin.auth().createCustomToken(String(user._id));
    // If everything is ok send a json web token to client
    createSendToken(user, customToken, 200, req, res);
});

// Protect Route Middleware
exports.protect = catchAsync(async (req, res, next) => {
    //1) Get tokken and check of if its There
    let token;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }
    //console.log(token);
    if (!token) {
        return next(
            new AppError('You are not Logged In.Please LogIn to continue.', 401)
        );
    }
    // 2) Verify Tokken
    const decodedToken = await promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET
    );
    //console.log(decodedToken);

    // 3) Check if user still exists
    const currentUser = await User.findById(decodedToken.id).populate({
        path: 'projects',
        select: 'projectMembers',
    });
    // .lean(false);
    if (!currentUser) {
        return next(new AppError(`No User found with this token`, 401));
    }
    // 4) Check if user is inactive
    if (!currentUser.active) {
        return next(
            new AppError(
                `Your Account has been deactivated.Contact Admin for more info.`,
                401
            )
        );
    }

    // 5) Check if user changed password after JWT was issued
    if (currentUser.changedPasswordAfter(decodedToken.iat)) {
        return next(
            new AppError(
                'User recently changed password.Please LogIn again.',
                401
            )
        );
    }

    if (req.params.projectID) {
        const currentUserProjects = currentUser.projects.filter(
            (project) => project.id === req.params.projectID
        );

        const project =
            currentUserProjects.length > 0
                ? currentUserProjects
                      .map(
                          (selectedProject) => selectedProject.projectMembers
                      )[0]
                      .filter(
                          (item) => String(item.user) === decodedToken.id
                      )[0]
                : [];

        // currentUser = { ...currentUser, currentProject: project };
        currentUser.projects = project;
        // console.log('project', project);
    }

    // Grant access to protected routes
    req.user = currentUser;
    next();
});
exports.restrictTo =
    (...roles) =>
    (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                new AppError(
                    'You do not have permission to perform this action',
                    403
                )
            );
        }
        next();
    };

exports.forgotPassword = catchAsync(async (req, res, next) => {
    // 1) Get user based on POSTed email
    const user = await User.findOne({ phone: req.body.phone });
    if (!user) {
        return next(
            new AppError(
                `There is no user with phone number ${req.body.phone}`,
                404
            )
        );
    }
    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // 3) Send it to user's email
    // const resetURL = `${req.protocol}://${req.get(
    //   'host'
    // )}/api/v1/users/resetPassword/${resetToken}`;

    try {
        await new Email(user, resetToken).sendPasswordReset();
        //production development
        if (process.env.NODE_ENV === 'production') {
            await new Sms(user, resetToken).sendMessage();
        }

        //await new Email(user, resetURL).sendPasswordReset();

        res.status(200).json({
            status: 'success',
            message: 'OTP sent to registered phone and email!',
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(
            new AppError(
                'There was an error sending the email. Try again later!'
            ),
            500
        );
    }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    // 1) Get user based on the token
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');
    //console.log('hashedToken : ', hashedToken);
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    });

    //console.log('user: ', user);
    // 2) If token has not expired, and there is user, set the new password
    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }
    const userId = String(user._id);
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    try {
        await admin.auth().updateUser(userId, {
            password: req.body.password,
        });
        const customToken = await admin.auth().createCustomToken(userId);
        createSendToken(user, customToken, 200, req, res);
    } catch (error) {
        res.status(404).json({
            status: 'fail',
            message: error.message,
        });
    }
});

exports.updatePassword = catchAsync(async (req, res, next) => {
    // 1) Get user from collection
    const user = await User.findById(req.user.id).select('+password');
    // 2) Check if POSTed current password is correct
    if (
        !(await user.correctPassword(req.body.passwordCurrent, user.password))
    ) {
        return next(new AppError('Your current password is wrong.', 401));
    }
    // 3) If so, update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    const userId = String(user._id);
    await user.save();
    try {
        await admin.auth().updateUser(userId, {
            password: req.body.password,
        });
        const customToken = await admin.auth().createCustomToken(userId);
        createSendToken(user, customToken, 200, req, res);
    } catch (error) {
        res.status(404).json({
            status: 'fail',
            message: error.message,
        });
    }
});

exports.createOtp = catchAsync(async (req, res, next) => {
    const otpToken = Math.floor(Math.random() * 899999 + 100000).toString();
    req.body.otp = crypto.createHash('sha256').update(otpToken).digest('hex');
    req.body.otpExpires = Date.now() + 10 * 60 * 1000;

    // console.log('otpToken', otpToken);

    // await new Email(user, otpToken).sendPasswordReset();

    const newOtp = await Otp.create(req.body);
    if (process.env.NODE_ENV === 'production') {
        await axios.get(
            `https://2factor.in/API/V1/${process.env.SMS_API_KEY}/SMS/${req.body.phone}/${otpToken}`
        );
    }

    res.status(201).json({
        status: 'success',
        data: {
            otp: newOtp,
            otpToken,
        },
    });
});

exports.sendInvite = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.userId);
    if (!user.newUser) {
        return next(new AppError('User has already loggedIn', 404));
    }
    await new Email(
        user,
        'http://optimiz-apps.herokuapp.com/login'
    ).sendInvite();
    res.status(200).json({
        status: 'success',
        requestedAt: req.requestTime,
        // data: {
        // user: req.user.company._id,
        // folder,
        // folder: folder._path.segments[1],
        // type: folder._path.segments[0],
        // },
    });
});
