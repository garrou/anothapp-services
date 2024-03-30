module.exports = Object.freeze({
    EMAIL_PATTERN: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/,
    IMAGE_PATTERN: /^https:\/\/pictures\.betaseries\.com\/.*$/,
    MAX_PASSWORD: 50,
    MIN_PASSWORD: 8,
    MAX_USERNAME: 25,
    MIN_USERNAME: 3,
    PASSWORD_PATTERN: /^.{8,50}$/,
    USERNAME_PATTERN: /^[^@]{3,25}$/
});