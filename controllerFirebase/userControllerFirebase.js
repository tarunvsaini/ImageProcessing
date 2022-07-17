const admin = require('firebase-admin');
const crypto = require('crypto');
const User = require('../models/userModel');
const ApiFeatures = require('../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
// const FeatureLogController = require('./loggingController');

const filterObj = (obj, ...allowedFields) => {
    const newObj = {};
    Object.keys(obj).forEach((el) => {
        if (allowedFields.includes(el)) newObj[el] = obj[el];
    });
    return newObj;
};
exports.activeUsers = (req, res, next) => {
    req.query.active = true;
    next();
};

exports.inactiveUsers = (req, res, next) => {
    req.query.active = false;
    next();
};

exports.activateUser = (req, res, next) => {
    req.body.active = true;
    next();
};

exports.deactivateUser = (req, res, next) => {
    req.body.active = false;
    next();
};

exports.getAllUsers = catchAsync(async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return next(
            new AppError(`You are not allowed to access the users.`, 403)
        );
    }

    const features = new ApiFeatures(User.find(), req.query)
        .filter()
        .sort()
        .projection()
        .pagination();

    const users = await features.query;

    // SEND RESPONSE
    res.status(200).json({
        status: 'success',
        requestedAt: req.requestTime,
        results: users.length,
        //TODO: change to data in app and here
        users: {
            users,
        },
    });
});

exports.createUser = catchAsync(async (req, res, next) => {
    const db = admin.database();
    const ref = db.ref().child('Users');

    const passwordGenerated = crypto.randomBytes(3).toString('hex');
    req.body.password = passwordGenerated;
    req.body.passwordConfirm = passwordGenerated;
    req.body.passwordTemp = passwordGenerated;

    if (!req.body.company) req.body.company = req.user.company._id;
    if (!req.body.company) req.body.organization = req.user.company.name;

    const user = await User.create(req.body);
    const userId = String(user._id);

    try {
        await admin.auth().createUser({
            uid: userId,
            displayName: req.body.name,
            email: req.body.email,
            phoneNumber: `+91${req.body.phone_1}`,
            password: passwordGenerated,
            image_url:
                req.body.image_url !== undefined ? req.body.image_url : '',
            emailVerified: false,
            disabled: false,
        });
        await ref.child(userId).set({
            name: req.body.name,
            email: req.body.email,
            designation: req.body.designation,
            organization:
                req.body.organization !== undefined
                    ? req.body.organization
                    : '',
            phone: `+91${req.body.phone_1}`,
            company: String(req.body.company),
            role: req.body.role,
            online: false,
            disabled: false,
            photo: req.body.image_url !== undefined ? req.body.image_url : '',
        });
    } catch (e) {
        await User.findByIdAndDelete(userId);
        res.status(404).json({
            status: 'fail',
            message: e.message,
        });
    }

    res.status(201).json({
        status: 'success',
        data: {
            user: user,
        },
    });
});

exports.getUser = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    // .populate({
    //     path: 'projects',
    //     //,
    //     // select: '-__v -members -documents -notes', // This is how to remove multiple entries
    //     select: 'projectMembers',
    // });
    // .populate('attendance');
    if (!user) {
        //console.log('It comes here 🔥🌈');
        return next(
            new AppError(`No User found with ID: ${req.params.id}`, 404)
        );
    }

    // const projectMember = user.projects.filter(
    //     (project) => project.id === '5e17734b1ea7dd00174347fc'
    // );

    // const operation =
    //     projectMember.length > 0
    //         ? projectMember
    //               .map((selectedProject) => selectedProject.projectMembers)[0]
    //               .filter((item) => String(item.user) === req.params.id)[0]
    //         : [];

    res.status(200).json({
        status: 'success',
        // operation,
        requestedAt: req.requestTime,
        data: {
            user,
        },
    });
});

exports.getStatus = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('+active');

    if (!user) {
        //console.log('It comes here 🔥🌈');
        return next(new AppError(`No User found with ID: ${req.user.id}`, 404));
    }
    res.status(200).json({
        active: user.active,
    });
});

exports.getMe = catchAsync(async (req, res, next) => {
    req.params.id = req.user.id;
    next();
});

exports.updateUser = catchAsync(async (req, res, next) => {
    const db = admin.database();
    const ref = db.ref().child('Users');

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!user) {
        return next(
            new AppError(`No User found with ID: ${req.params.id}`, 404)
        );
    }
    const userId = String(user._id);
    await admin.auth().updateUser(userId, {
        // photoURL:
        //   user.image_url !== undefined
        //     ? user.image_url
        //     : 'https://firebasestorage.googleapis.com/v0/b/optimiz-28df2.appspot.com/o/Profile%20Images%2Fprofile.jpg?alt=media&token=1f07107a-fdb6-4dad-ab54-5e0c87f85b27',
        email: user.email,
        phoneNumber: `+91${user.phone_1}`,
        displayName: user.name,
    });

    await ref.child(userId).update({
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation !== undefined ? user.designation : '',
        organization: user.organization !== undefined ? user.organization : '',
        photo: user.image_url !== undefined ? user.image_url : '',
        phone: `+91${user.phone_1}`,
        disabled: !user.active,
    });

    res.status(200).json({
        status: 'success',
        requestedAt: req.requestTime,
        data: {
            user,
        },
    });
});

exports.updateMe = catchAsync(async (req, res, next) => {
    // 1) Create error if user POSTs password data
    const db = admin.database();
    const ref = db.ref().child('Users');
    if (req.body.password || req.body.passwordConfirm) {
        return next(
            new AppError('This route cannot be used to change passwords.')
        );
    }
    // 2) Update user document
    const filterBody = filterObj(
        req.body,
        'name',
        'email',
        'phone_1',
        'designation',
        'organization',
        'department',
        'address',
        'image_url',
        'phone_2',
        'office_timing',
        'work_week',
        'remarks'
    );
    const user = await User.findByIdAndUpdate(req.user.id, filterBody, {
        new: true,
        runValidators: true,
    });
    if (!user) {
        return next(
            new AppError(`No User found with ID: ${req.params.id}`, 404)
        );
    }

    const userId = String(user._id);

    await admin.auth().updateUser(userId, {
        // photoURL:
        //   user.image_url !== undefined
        //     ? user.image_url
        //     : 'https://firebasestorage.googleapis.com/v0/b/optimiz-28df2.appspot.com/o/Profile%20Images%2Fprofile.jpg?alt=media&token=1f07107a-fdb6-4dad-ab54-5e0c87f85b27',
        email: user.email,
        phoneNumber: `+91${user.phone_1}`,
        displayName: user.name,
    });
    await ref.child(userId).update({
        name: user.name,
        email: user.email,
        phone: `+91${user.phone_1}`,
        photo: user.image_url !== undefined ? user.image_url : '',
        designation: user.designation !== undefined ? user.designation : '',
        organization: user.organization !== undefined ? user.organization : '',
    });

    res.status(200).json({
        status: 'success',
        data: {
            user,
        },
    });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
    const user = await User.findByIdAndDelete(req.params.id);
    const db = admin.database();
    const ref = db.ref().child('Users');
    if (!user) {
        return next(
            new AppError(`No User found with ID: ${req.params.id}`, 404)
        );
    }
    const userId = String(user._id);
    await admin.auth().deleteUser(userId);
    await ref.child(userId).set(null);

    res.status(200).json({
        status: 'success',
        requestedAt: req.requestTime,
        data: {
            user,
        },
    });
});
