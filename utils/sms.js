// const got = require('got');
const axios = require('axios');

module.exports = class SMS {
  constructor(user, otp) {
    this.to = user.phone_1;
    this.firstName = user.name.split(' ')[0];
    this.message = otp;
    this.subject = `OPTIMIZ`;
  }

  async sendMessage() {
    try {
      await axios.get(
        `https://2factor.in/API/V1/${process.env.SMS_API_KEY}/SMS/${this.to}/${this.message}`
      );
    } catch (error) {
      console.error(error);
    }
  }
};
