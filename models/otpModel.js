const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
    {
        otp: String,
        email: String,
        phone: String,
        otpExpires: Date,
    },
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

const Otp = mongoose.model('Otp', otpSchema);
module.exports = Otp;
