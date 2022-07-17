/* eslint-disable no-nested-ternary */
const multer = require('multer');
const sharp = require('sharp');
const Jimp = require('jimp');
const uuid = require('uuid').v4;
const UploadEntry = require('../models/uploadModel');
const quotes = require('../data/quotes');
// const quotes_test = require('../data/quotes-test');
const ApiFeatures = require('../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const utils = require('../utils/utilityFunctions');
const AppError = require('../utils/appError');
const { s3Uploadv2, s3Uploadv3, s3PresignedV3 } = require('../s3Service');
const { default: axios } = require('axios');

const multerStorageDisk = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    const name = file.originalname.split('.')[0];
    cb(null, `${name}-${req.params.type}-${Date.now()}.${ext}`);
  },
});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    //new AppError('Only Images allowed', 400)
    cb(new AppError('Only Images allowed', 400), false);
  }
};

// const upload = multer({ dest: 'uploads/' });
const uploadDisk = multer({
  storage: multerStorageDisk,
  limits: { fileSize: 2000000, files: 4 },
  fileFilter: multerFilter,
});

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: multerFilter,
  // limits: { fileSize: 2000000, files: 4 },
});

// Multer Single file upload middleware
exports.uploadSingleToDisk = uploadDisk.single('file');
exports.uploadSingleToMemory = uploadMemory.single('file');
// If only single multiple entry field
// exports.uploadMultiple = uploadMemory.array('images', 3);
exports.uploadMultipleMemory = uploadMemory.fields([
  { name: 'file', maxCount: 3 },
  { name: 'images', maxCount: 3 },
]);

exports.uploadMultipleDisk = uploadDisk.fields([
  { name: 'file', maxCount: 3 },
  { name: 'images', maxCount: 3 },
]);

exports.uploadMultipleAws = uploadMemory.array('file');
exports.resizePhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();
  // const ext = req.file.mimetype.split('/')[1];
  const name = req.file.originalname.split('.')[0];
  req.file.filename = `${name}-${req.params.type}-${Date.now()}.webp`;
  await sharp(req.file.buffer)
    .resize(500, 500, {
      fit: sharp.fit.inside,
      withoutEnlargement: true,
    })
    .toFormat('webp', 80)
    .toFile(`uploads/${req.file.filename}`);
  next();
});

exports.singleUpload = catchAsync(async (req, res, next) => {
  if (!req.body.type) req.body.type = req.params.type;
  if (req.file) req.body.url = req.file.filename;
  console.log('Size: ', `${utils.round(req.file.size / 1024)} KB`);
  next();
});

exports.multipleUploadMemory = catchAsync(async (req, res, next) => {
  // console.log('Images', req.files);
  if (!req.files.file || !req.files.images) return next();
  if (!req.body.type) req.body.type = req.params.type;

  // Single File
  req.body.url = `${req.files.file[0].originalname.split('.')[0]}-${
    req.params.type
  }-${Date.now()}.webp`;
  await sharp(req.files.file[0].buffer)
    .toFormat('webp')
    .toFile(`uploads/${req.body.url}`);

  // Multiple Images
  req.body.images = await Promise.all(
    req.files.images.map(async (image, i) => {
      const name = `${image.originalname.split('.')[0]}-${
        req.params.type
      }-${Date.now()}-${i + 1}.webp`;
      await sharp(image.buffer).toFormat('webp').toFile(`uploads/${name}`);
      return name;
    })
  );

  next();
});

exports.multipleUploadDisk = catchAsync(async (req, res, next) => {
  // console.log('Images', req.files);
  if (!req.files.file || !req.files.images) return next();
  if (!req.body.type) req.body.type = req.params.type;

  // Single File
  req.body.url = req.files.file[0].filename;

  // Multiple Images
  req.body.images = req.files.images.map((image) => image.filename);

  next();
});

exports.getAllEntries = catchAsync(async (req, res, next) => {
  //   const features = new ApiFeatures(
  //     UploadEntry.find({ company: req.user.company }),
  //     req.query
  // )
  const features = new ApiFeatures(UploadEntry.find(), req.query)
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

exports.uploadAwsV2 = catchAsync(async (req, res, next) => {
  if (!req.files) return next();
  if (!req.body.type) req.body.type = req.params.type;
  // console.log('files', req.files);
  const files = await Promise.all(
    req.files.map(async (file) => {
      const data = await sharp(file.buffer).toFormat('webp').toBuffer();
      const name = `${file.originalname.split('.')[0]}.webp`;
      const name2 = `${file.originalname
        .split('.')
        .slice(0, -1)
        .join('-')}.webp`;
      console.log('name', name, name2);
      return { ...file, originalname: name, buffer: data };
    })
  );
  // console.log('files from promise', files);
  const results = await s3Uploadv2(files);
  req.body.images = results.map((result) => result.Location);
  next();
});

exports.uploadAwsV3 = catchAsync(async (req, res, next) => {
  if (!req.files) return next();
  if (!req.body.type) req.body.type = req.params.type;
  // console.log('files', req.files);
  const baseUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
  const folder = 'test-folder';
  const imageFormat = 'webp';
  const files = await Promise.all(
    req.files.map(async (file) => {
      const data = await sharp(file.buffer).toFormat(imageFormat).toBuffer();
      // const name2 = `${uuid()}-${file.originalname.split('.')[0]}.webp`;
      const name = `${uuid()}-${file.originalname
        .split('.')
        .slice(0, -1)
        .join('-')}.${imageFormat}`;
      // console.log('name', name, name2);
      return { ...file, originalname: name, buffer: data };
    })
  );

  // console.log('files from promise', files);
  await s3Uploadv3(files, folder);
  req.body.images = files.map(
    (file) => `${baseUrl}/${folder}/${file.originalname}`
  );
  next();
  // res.status(200).json({
  //   status: 'success',
  //   data: {
  //     results,
  //   },
  // });
});

exports.processImage = catchAsync(async (req, res, next) => {
  // if (!req.files) return;
  // const imageFormat = 'jpeg';
  // await Promise.all(
  //   req.files.map(async (file, i) => {
  //     await sharp(file.buffer)
  //       .resize(1080, 1080)
  //       .toFormat(imageFormat)
  //       .toFile(`jimp/${i}.jpeg`);
  //   })
  // );
  // const answers = [];
  // let i = 0;
  // while (i <= 996) {
  //   answers.push({ i, modulus: i % 82 });
  //   i++;
  // }
  await Promise.all(
    quotes.map(async ({ quote, author }, index) => {
      const image = await Jimp.read(`jimp/${index % 82}.jpeg`);
      const srcImage = await Jimp.read('jimp/100.png');
      const logo = await Jimp.read('jimp/logo.png');
      const quoteFont = await Jimp.loadFont(
        `jimp/white/white-${
          quote.length >= 200
            ? 44
            : quote.length > 150
            ? 52
            : quote.length > 100
            ? 72
            : 82
        }.fnt`
      );
      const greetingFont = await Jimp.loadFont('jimp/golden/golden-100.fnt');
      // const authorFont = await Jimp.loadFont('jimp/white/white-32.fnt');
      const authorFont = await Jimp.loadFont('jimp/golden/golden-32.fnt');

      await image
        .composite(srcImage, 0, 0, {
          mode: Jimp.BLEND_SOURCE_OVER,
          opacitySource: 0.6,
        })
        .composite(logo, 40, 40, {
          mode: Jimp.BLEND_SOURCE_OVER,
        })
        .print(
          quoteFont,
          135,
          290,
          {
            text: quote,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
          },
          840,
          450,
          (err, img, { x, y }) => {
            image.print(
              authorFont,
              135,
              y + 20,
              {
                text: author.length < 1 ? 'Anonymous' : author,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
              },
              800
            );
          }
        )
        .print(
          greetingFont,
          135,
          920,
          {
            text: `Good Morning`,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
          },
          800
        )
        .write(`posts/${index}.jpeg`);
      console.log('Current Quote', index + 1);
      // return { quote, author, image: image };
    })
  );

  res.status(201).json({
    status: 'success',
    // answers,
    // data: {
    //   files,
    // },
  });
});

exports.getPresignedUrl = catchAsync(async (req, res, next) => {
  // if (!req.body.company) req.body.company = req.user.company; // From protect Middleware
  if (!req.file) {
    next(new AppError('Select a file', 400));
  }
  const folder = 'signed';
  const filename = req.file.originalname;
  const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${folder}/${filename}`;

  //Only File name is required
  const signedUrl = await s3PresignedV3(`${folder}/${filename}`);

  await axios.put(signedUrl, req.file.buffer);

  // {
  //   headers: {
  //     'Content-Type': req.file.type,
  //     // 'Content-Type': `image/png`,
  //   },
  // }

  res.status(201).json({
    status: 'success',
    data: {
      signedUrl,
      fileUrl,
    },
  });
});

exports.getUploadEntry = catchAsync(async (req, res, next) => {
  const entry = await UploadEntry.findById(req.params.id); // same
  // const UploadEntry = await UploadEntry.findOne({ _id: req.params.id }); //same
  if (!entry) {
    return next(
      new AppError(`No UploadEntry found with given ID: ${req.params.id}`, 404)
    );
  }
  res.status(200).json({
    status: 'success',
    data: {
      entry,
    },
  });
});

exports.createUploadEntry = catchAsync(async (req, res, next) => {
  // if (!req.body.company) req.body.company = req.user.company; // From protect Middleware
  const newUploadEntry = await UploadEntry.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      entry: newUploadEntry,
      // entry: req.body,
    },
  });
});

exports.createMultipleEntries = catchAsync(async (req, res, next) => {
  const newEntries = await UploadEntry.insertMany(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      entries: newEntries,
    },
  });
});

exports.updateUploadEntry = catchAsync(async (req, res, next) => {
  const entry = await UploadEntry.findByIdAndUpdate(req.params.id, req.body, {
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
exports.deleteUploadEntry = catchAsync(async (req, res, next) => {
  const entry = await UploadEntry.findByIdAndDelete(req.params.id);
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

// const image = await Jimp.read('jimp/14.jpeg');
// const srcImage = await Jimp.read('jimp/100.png');
// const logo = await Jimp.read('jimp/logo.png');
// const quote = `An entire sea of water can’t sink a ship unless it gets inside the ship. Similarly, the negativity of the world can’t put you down unless you allow it to get inside you.`;
// const author = 'Anonymous';
// // console.log('quote', quote.length);
// const quoteFont = await Jimp.loadFont(
//   `jimp/white/white-${
//     quote.length >= 200
//       ? 44
//       : quote.length > 150
//       ? 52
//       : quote.length > 100
//       ? 72
//       : 82
//   }.fnt`
// );
// const greetingFont = await Jimp.loadFont('jimp/golden/golden-100.fnt');
// // const authorFont = await Jimp.loadFont('jimp/white/white-32.fnt');
// const authorFont = await Jimp.loadFont('jimp/golden/golden-32.fnt');

// ////Users/tarunsaini/Projects/ApiBase/jimp/golden.ttf
// image
//   .composite(srcImage, 0, 0, {
//     mode: Jimp.BLEND_SOURCE_OVER,
//     opacitySource: 0.6,
//   })
//   .composite(logo, 40, 40, {
//     mode: Jimp.BLEND_SOURCE_OVER,
//   })
//   .print(
//     quoteFont,
//     135,
//     290,
//     {
//       text: quote,
//       alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
//       alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
//     },
//     840,
//     450,
//     (err, img, { x, y }) => {
//       image.print(
//         authorFont,
//         x - 540,
//         y + 20,
//         {
//           text: author,
//           alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
//           alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
//         },
//         240
//       );
//     }
//   )
//   .print(
//     greetingFont,
//     135,
//     920,
//     {
//       text: `Good Morning`,
//       alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
//       alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
//     },
//     800
//   )
//   .write(`modified/1.jpeg`);
