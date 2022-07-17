const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const validator = require('validator');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: [true, 'A user must have a name'] },
        email: {
            type: String,
            required: [true, 'A user must have an Email Id'],
            unique: true,
            lowercase: true,
            validate: [validator.isEmail, 'Please Provide a valid email.'],
        },
        phone: {
            type: String,
            required: [true, 'A user must have a Phone Number'],
            unique: true,
        },
        designation: { type: String },
        organization: { type: String },
        image_url: { type: String },
        address: { type: String },

        gender: {
            type: String,
            enum: ['Male', 'Female', 'Other'],
        },

        role: {
            type: String,
            required: [true, 'A user must have a role'],
            default: 'user',
            enum: [
                'admin', // Use these for user level management admin,other,super_user,user,
                'super_user',
                'user',
                'other',
            ],
        },
        password: {
            type: String,
            required: [true, 'Please provide a password'],
            minLength: 6,
            select: false,
        },
        passwordConfirm: {
            type: String,
            required: true,
            validate: {
                // Custom validation only works on SAVE and CREATE !!!
                validator: function (el) {
                    return el === this.password;
                },
                message: 'Passwords do not match.',
            },
        },
        passwordTemp: {
            type: String,
        },
        passwordChangedAt: Date,
        passwordResetToken: String,
        passwordResetExpires: Date,
        active: {
            type: Boolean,
            default: true,
        },
        super_user: {
            type: Boolean,
            default: false,
        },
        newUser: {
            type: Boolean,
            default: true,
        },
        remarks: { type: String },
        createdAt: { type: Date, default: Date.now() },
    },
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

userSchema.pre('save', async function (next) {
    // Only run if password was modified
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    // Delete passwordConfirm Field
    this.passwordConfirm = undefined;
    if (this.role === 'super_user') {
        this.super_user = true;
    }
    //console.log('Before', this.newUser);

    next();
});

userSchema.pre('save', function (next) {
    if (!this.isModified('password') || this.isNew) return next();
    this.passwordChangedAt = Date.now() - 1000;
    this.newUser = false;
    //console.log('After', this.newUser);
    next();
});

userSchema.pre('find', function (next) {
    // this points to the current query
    this.find({ super_user: false });
    next();
});

// Compare encrypted Passwords
userSchema.methods.correctPassword = async function (
    candidatePassword,
    userPassword
) {
    // candidatePassword : password entered at the time of login
    // userPassword : password in database (Orignal password)
    return await bcrypt.compare(candidatePassword, userPassword);
};

// Check if password is changed
userSchema.methods.changedPasswordAfter = function (JwtTimestamp) {
    if (this.passwordChangedAt) {
        //console.log(this.passwordChangedAt);
        const changedTimestamp = parseInt(
            this.passwordChangedAt.getTime() / 1000,
            10
        );
        //console.log(JwtTimestamp < changedTimestamp);
        return JwtTimestamp < changedTimestamp;
    }
    return false;
};

// Generate Password reset token
userSchema.methods.createPasswordResetToken = function () {
    // const resetToken = crypto.randomBytes(3).toString('hex');
    const resetToken = Math.floor(Math.random() * 899999 + 100000).toString();

    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

// userSchema.virtual('projects', {
//     ref: 'Project',
//     foreignField: 'projectMembers.user',
//     localField: '_id',
// });

// //Populate Child References
// userSchema.pre(/^find/, function (next) {
//     this.populate({
//         path: 'company',
//         //select: '-__v -role', // This is how to remove multiple entries
//         // select: 'name',
//     }).populate({
//         path: 'superior',
//         select: 'name',
//     });
//     next();
// });

const User = mongoose.model('User', userSchema);

module.exports = User;
