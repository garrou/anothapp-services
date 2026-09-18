import transporter from "../config/mailer.js";
import { isDevMode } from "../helpers/utils.js";

export default class MailerService {

    /**
     * @param {string} to
     * @param {string} subject
     * @param {string} html
     * @returns {Promise<void>}
     */
    #send = async (to, subject, html) => {
        if (!transporter) {
            if (isDevMode()) {
                console.log(`[mailer] EMAIL_HOST non défini, email non envoyé à ${to} : ${subject}`);
            }
            return;
        }
        await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
    }

    /**
     * @param {string} to
     * @param {string} url
     * @returns {Promise<void>}
     */
    sendVerificationEmail = (to, url) => this.#send(to, "Confirmez votre adresse email", `
<p>Bienvenue sur Anothapp !</p>
<p>Cliquez sur le lien ci-dessous pour confirmer votre adresse email :</p>
<p><a href="${url}">Confirmer mon email</a></p>
<p>Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>`);

    /**
     * @param {string} to
     * @param {string} url
     * @returns {Promise<void>}
     */
    sendPasswordResetEmail = (to, url) => this.#send(to, "Réinitialisation de votre mot de passe", `
<p>Une demande de réinitialisation de mot de passe a été faite pour ce compte.</p>
<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
<p><a href="${url}">Réinitialiser mon mot de passe</a></p>
<p>Ce lien expire dans 1 heure.</p>`);
}
