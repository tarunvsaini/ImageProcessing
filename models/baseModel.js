const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
    {
        name: String,
        // company: { type: mongoose.Schema.ObjectId, ref: 'Company' },
        created_at: { type: Date, default: Date.now() },
    },
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// entrySchema.pre(/^find/, function (next) {
//     this.populate({
//         path: 'company',
//         //select: '-__v -role', // This is how to remove multiple entries
//         select: 'name',
//     });
//     next();
// });

const BaseEntry = mongoose.model('Test', entrySchema);
module.exports = BaseEntry;
