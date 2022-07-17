const express = require('express');
const baseController = require('../controllers/baseController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);
//authController.restrictTo('coordinator', 'admin'),
router.route('/multi').post(baseController.createMultipleEntries);

router
  .route('/')
  .get(baseController.getAllEntries)
  .post(authController.restrictTo('admin'), baseController.createEntry);
// .post(baseController.createEntry);

router
  .route('/:id')
  .get(baseController.getEntry)
  .patch(authController.restrictTo('admin'), baseController.updateEntry)
  .delete(authController.restrictTo('admin'), baseController.deleteEntry);

module.exports = router;
