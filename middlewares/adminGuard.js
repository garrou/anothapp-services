/**
 * Must run after checkJwt (needs req.userId already set). A single fixed account id, not a role
 * column, is deliberately enough for now - see the admin roadmap notes for why.
 */
export const checkAdmin = (req, res, next) => {
    if (req.userId !== process.env.ADMIN_ID) {
        return res.status(403).json({ message: "Accès refusé" });
    }
    next();
}
