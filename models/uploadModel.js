const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema(
  {
    name: String,
    url: String,
    images: [String],
    type: {
      type: String,
      enum: ['disk', 'aws'],
      default: 'disk',
    },
    // company: { type: mongoose.Schema.ObjectId, ref: 'Company' },
    created_at: { type: Date, default: Date.now() },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// uploadSchema.pre(/^find/, function (next) {
//     this.populate({
//         path: 'company',
//         //select: '-__v -role', // This is how to remove multiple entries
//         select: 'name',
//     });
//     next();
// });

const UploadEntry = mongoose.model('Upload', uploadSchema);
module.exports = UploadEntry;
