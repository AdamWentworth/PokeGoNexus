const isValidEmail = (value) => {
  if (typeof value !== 'string' || value.length > 255) return false;

  let atIndex = -1;
  let domainDotIndex = -1;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (!character.trim()) return false;
    if (character === '@') {
      if (atIndex !== -1) return false;
      atIndex = index;
    } else if (character === '.' && atIndex !== -1) {
      domainDotIndex = index;
    }
  }

  return atIndex > 0 &&
    domainDotIndex > atIndex + 1 &&
    domainDotIndex < value.length - 1;
};

module.exports = isValidEmail;
