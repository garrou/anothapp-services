import userConst from "../constants/user.js";

/**
 * @param {string|undefined} username 
 * @returns object
 */
const isValidUsername = (username) => {
    if (typeof username !== "string") 
        return { status: false, message: "Username incorrect" };

    if (!userConst.USERNAME_PATTERN.test(username))
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
    if (typeof email !== "string" || !userConst.EMAIL_PATTERN.test(email))
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
        return { status: false, message: "Mot de passe incorrect" };

    if (password !== confirm)
        return { status: false, message: "Mots de passe différents" };
    
    if (!userConst.PASSWORD_PATTERN.test(password))
        return { 
            status: false, 
            message: `Mot de passe incorrect (${userConst.MIN_PASSWORD} - ${userConst.MAX_PASSWORD})` 
        };

    return { status: true, message: "ok" };
}

/**
 * @param {string|undefined} oldPass 
 * @param {string|undefined} newPass 
 * @param {string|undefined} confPass 
 * @returns object
 */
const isValidChangePassword = (oldPass, newPass, confPass) => {
    if (typeof oldPass !== "string")
        return { status: false, message: "Mot de passe incorrect" };

    if (oldPass === newPass)
        return { status: false, message: "Le nouveau mot de passe doit être différent de l'ancien "};

    return isValidPassword(newPass, confPass);
}

/**
 * @param {string|undefined} oldEmail 
 * @param {string|undefined} newEmail
 * @returns object
 */
const isValidChangeEmail = (oldEmail, newEmail) => {
    if (typeof oldEmail !== "string")
        return { status: false, message: "Email incorrect" };

    if (oldEmail === newEmail)
        return { status: false, message: "Le nouveau mail doit être différent" };

    return isValidEmail(newEmail);
}

/**
 * @param {string|undefined} image 
 */
const isValidImage = (image) => {
    return typeof image === "string" 
        && image.length > 0 
        && userConst.IMAGE_PATTERN.test(image);
}

const isValidId = (name) => {
    return typeof name === "string";
}

const idValidShow = (serie) => {
    const { id, title, kinds, duration, seasons, country } = serie;
    return id && title && kinds && duration && seasons && country;
}

export {
    isValidChangeEmail,
    isValidChangePassword,
    isValidEmail,
    isValidId,
    isValidImage,
    isValidUsername,
    isValidPassword,
    idValidShow
}