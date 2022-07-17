const express = require('express');
const uploadController = require('../controllers/uploadController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);
//authController.restrictTo('coordinator', 'admin'),
router.route('/multi').post(uploadController.createMultipleEntries);

router
  .route('/')
  .get(uploadController.getAllEntries)
  .post(authController.restrictTo('admin'), uploadController.createUploadEntry);
// .post(uploadController.createUploadEntry);

router
  .route('/single-disk/:type')
  .post(
    uploadController.uploadSingleToDisk,
    uploadController.singleUpload,
    uploadController.createUploadEntry
  );

router
  .route('/single-memory/:type')
  .post(
    uploadController.uploadSingleToMemory,
    uploadController.resizePhoto,
    uploadController.singleUpload,
    uploadController.createUploadEntry
  );

router
  .route('/multiple-memory/:type')
  .post(
    uploadController.uploadMultipleMemory,
    uploadController.multipleUploadMemory,
    uploadController.createUploadEntry
  );

router
  .route('/multiple-disk/:type')
  .post(
    uploadController.uploadMultipleDisk,
    uploadController.multipleUploadDisk,
    uploadController.createUploadEntry
  );

router
  .route('/multiple-aws-v2/:type')
  .post(
    uploadController.uploadMultipleAws,
    uploadController.uploadAwsV2,
    uploadController.createUploadEntry
  );

router
  .route('/multiple-aws-v3/:type')
  .post(
    uploadController.uploadMultipleAws,
    uploadController.uploadAwsV3,
    uploadController.createUploadEntry
  );

router
  .route('/signed-aws-v3/:type')
  .post(
    uploadController.uploadMultipleAws,
    uploadController.uploadAwsV3,
    uploadController.createUploadEntry
  );

router
  .route('/signed-url')
  .post(
    uploadController.uploadSingleToMemory,
    uploadController.getPresignedUrl
  );

router
  .route('/process')
  .post(uploadController.uploadMultipleAws, uploadController.processImage);

router
  .route('/:id')
  .get(uploadController.getUploadEntry)
  .patch(authController.restrictTo('admin'), uploadController.updateUploadEntry)
  .delete(
    authController.restrictTo('admin'),
    uploadController.deleteUploadEntry
  );

module.exports = router;
