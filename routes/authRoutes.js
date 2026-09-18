import {Router} from "express";
import AuthController from "../controllers/authController.js";
import {
    loginLimiter, registerLimiter, refreshLimiter, logoutLimiter, cancelDeletionLimiter,
    verifyEmailLimiter, resendVerificationLimiter, forgotPasswordLimiter, resetPasswordLimiter
} from "../middlewares/rateLimit.js";

const router = new Router();
const authController = new AuthController();

router.get("/me", authController.checkUser);

router.post("/register", registerLimiter, authController.register);

router.post("/login", loginLimiter, authController.login);

router.post("/logout", logoutLimiter, authController.logout);

router.post("/refresh", refreshLimiter, authController.refreshToken);

router.post("/cancel-deletion", cancelDeletionLimiter, authController.cancelDeletion);

router.post("/verify-email", verifyEmailLimiter, authController.verifyEmail);

router.post("/resend-verification", resendVerificationLimiter, authController.resendVerification);

router.post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword);

router.post("/reset-password", resetPasswordLimiter, authController.resetPassword);

export default router;