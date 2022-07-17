// const crypto = require('crypto');
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
    // if (req.user.role !== 'admin') {
    //     return next(
    //         new AppError(`You are not allowed to access the users.`, 403)
    //     );
    // }

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
    // Generate a random password
    // const passwordGenerated = crypto.randomBytes(3).toString('hex');
    // req.body.password = passwordGenerated;
    // req.body.passwordConfirm = passwordGenerated;
    // req.body.passwordTemp = passwordGenerated;

    const user = await User.create(req.body);

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
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!user) {
        return next(
            new AppError(`No User found with ID: ${req.params.id}`, 404)
        );
    }

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
        'phone',
        'designation',
        'organization',
        'department',
        'address',
        'image_url',

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

    res.status(200).json({
        status: 'success',
        data: {
            user,
        },
    });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
        return next(
            new AppError(`No User found with ID: ${req.params.id}`, 404)
        );
    }

    res.status(200).json({
        status: 'success',
        requestedAt: req.requestTime,
        data: {
            user,
        },
    });
});
