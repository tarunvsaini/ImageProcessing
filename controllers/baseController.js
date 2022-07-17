const Entry = require('../models/baseModel');
const ApiFeatures = require('../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAllEntries = catchAsync(async (req, res, next) => {
  //   const features = new ApiFeatures(
  //     Entry.find({ company: req.user.company }),
  //     req.query
  // )
  const features = new ApiFeatures(Entry.find(), req.query)
    .filter()
    .sort()
    .projection()
    .pagination();
  const entries = await features.query;
  res.status(200).json({
    status: 'success',
    results: entries.length,
    data: {
      entries,
    },
  });
});

exports.getEntry = catchAsync(async (req, res, next) => {
  const entry = await Entry.findById(req.params.id); // same
  // const Entry = await Entry.findOne({ _id: req.params.id }); //same
  if (!entry) {
    return next(
      new AppError(`No Entry found with given ID: ${req.params.id}`, 404)
    );
  }
  res.status(200).json({
    status: 'success',
    data: {
      entry,
    },
  });
});

exports.createEntry = catchAsync(async (req, res, next) => {
  // if (!req.body.company) req.body.company = req.user.company; // From protect Middleware
  const newEntry = await Entry.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      entry: newEntry,
    },
  });
});

exports.createMultipleEntries = catchAsync(async (req, res, next) => {
  const newEntries = await Entry.insertMany(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      entries: newEntries,
    },
  });
});

exports.updateEntry = catchAsync(async (req, res, next) => {
  const entry = await Entry.findByIdAndUpdate(req.params.id, req.body, {
    new: true, // returns the new updated value insted of previous response
    runValidators: true, // check if new update entry is valid data type (so that no one can change it later in patch)
  });
  if (!entry) {
    return next(new AppError(`No entry found with ID: ${req.params.id}`, 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      entry,
    },
  });
});
exports.deleteEntry = catchAsync(async (req, res, next) => {
  const entry = await Entry.findByIdAndDelete(req.params.id);
  // console.log('req.params.id', req.params.id, entry);
  // console.log('entry', entry);
  if (!entry) {
    return next(new AppError(`No entry found with ID: ${req.params.id}`, 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      entry,
    },
  });
});
