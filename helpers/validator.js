const userConst = require("../constants/user")

/**
 * @param {string|undefined} username 
 * @returns object
 */
const isValidUsername = (username) => {
    if (typeof username !== "string") 
        return { status: false, message: "Le username est incorrect" };

    if (userConst.USERNAME_PATTERN.test(username))
        return { 
            status: false, 
            message: `Username incorrect (${userConst.MIN_USERNAME} - ${userConst.MAX_USERNAME}) sans '@'` 
        }

    return { status: true, message: "ok" };
}

/**
 * @param {string|undefined} email 
 * @returns object
 */
const isValidEmail = (email) => {
    if (typeof email !== "string" || userConst.EMAIL_PATTERN.test(email))
        return { status: false, message: "Email incorrect" };

    return { status: true, message: "ok" };
}

/**
 * @param {string|undefined} password
 * @param {string|undefined} confirm
 * @returns object
 */
const isValidPassword = (password, confirm) => {
    if (typeof password !== "string") 
        return { status: false, message: "Le mot de passe incorrect" };

    if (password !== confirm)
        return { status: false, message: "Les mots de passe différents" };
    
    if (userConst.PASSWORD_PATTERN.test(password))
        return { 
            status: false, 
            message: `Mot de passe incorrect (${userConst.MIN_PASSWORD} - ${userConst.MAX_PASSWORD})` 
        };

    return { status: true, message: "ok" };
}

module.exports = {
    isValidEmail,
    isValidUsername,
    isValidPassword
}