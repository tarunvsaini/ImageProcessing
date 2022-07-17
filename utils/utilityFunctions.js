exports.pad = (number, length) => {
  let str = `${number}`;
  while (str.length < length) {
    str = `0${str}`;
  }

  return str;
};

exports.round = (number) => Math.round((number + Number.EPSILON) * 100) / 100;
