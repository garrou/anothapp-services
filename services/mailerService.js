import transporter from "../config/mailer.js";
import { isDevMode } from "../helpers/utils.js";
import eventBus from "../helpers/eventBus.js";

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
        eventBus.emit("mailer.sent");
        await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
    }

    /**
     * Wraps an email's content in the shared Anothapp layout. Styles are inline throughout
     * since most email clients strip <style> blocks and ignore external stylesheets.
     *
     * @param {string} title
     * @param {string} bodyHtml
     * @param {string} ctaLabel
     * @param {string} ctaUrl
     * @param {string} noteHtml
     * @returns {string}
     */
    #layout = (title, bodyHtml, ctaLabel, ctaUrl, noteHtml) => `
<body style="margin:0; padding:24px 12px; background-color:#F6F6FA; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto;">
    <tr>
      <td style="padding-bottom:24px; text-align:center;">
        <span style="font-size:20px; font-weight:700; color:#6C5CE0;">Anothapp</span>
      </td>
    </tr>
    <tr>
      <td style="background-color:#FFFFFF; border-radius:12px; padding:32px 28px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 16px; font-size:18px; color:#1A1A2E;">${title}</h1>
        <div style="font-size:15px; line-height:1.6; color:#3D3D52;">${bodyHtml}</div>
        <div style="text-align:center; margin:28px 0;">
          <a href="${ctaUrl}" style="display:inline-block; background-color:#6C5CE0; color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:600; padding:12px 28px; border-radius:8px;">${ctaLabel}</a>
        </div>
        <p style="font-size:13px; line-height:1.5; color:#8A8AA3; margin:0;">${noteHtml}</p>
      </td>
    </tr>
    <tr>
      <td style="padding-top:20px; text-align:center;">
        <p style="font-size:12px; color:#ACACC2; margin:0;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
          <a href="${ctaUrl}" style="color:#9C8CFF; word-break:break-all;">${ctaUrl}</a>
        </p>
      </td>
    </tr>
  </table>
</body>`;

    /**
     * @param {string} to
     * @param {string} url
     * @returns {Promise<void>}
     */
    sendVerificationEmail = (to, url) => this.#send(to, "Confirmez votre nouvelle adresse email", this.#layout(
        "Confirmez votre nouvelle adresse email",
        "Une demande de changement d'adresse email a été faite pour ce compte. Confirmez cette nouvelle adresse :",
        "Confirmer mon email",
        url,
        "Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
    ));

    /**
     * @param {string} to
     * @param {string} url
     * @returns {Promise<void>}
     */
    sendPasswordResetEmail = (to, url) => this.#send(to, "Réinitialisation de votre mot de passe", this.#layout(
        "Réinitialisation de mot de passe",
        "Une demande de réinitialisation de mot de passe a été faite pour ce compte.",
        "Réinitialiser mon mot de passe",
        url,
        "Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
    ));

    /**
     * No CTA button here, unlike the other emails - the code is retyped by hand into the app,
     * so it's shown as large, isolated text instead of wrapped in a link.
     * @param {string} to
     * @param {string} code
     * @returns {Promise<void>}
     */
    sendLoginCodeEmail = (to, code) => this.#send(to, "Votre code de connexion Anothapp", `
<body style="margin:0; padding:24px 12px; background-color:#F6F6FA; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto;">
    <tr>
      <td style="padding-bottom:24px; text-align:center;">
        <span style="font-size:20px; font-weight:700; color:#6C5CE0;">Anothapp</span>
      </td>
    </tr>
    <tr>
      <td style="background-color:#FFFFFF; border-radius:12px; padding:32px 28px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 16px; font-size:18px; color:#1A1A2E;">Confirmez votre connexion</h1>
        <div style="font-size:15px; line-height:1.6; color:#3D3D52;">Une connexion à votre compte Anothapp est en attente. Saisissez ce code pour la confirmer :</div>
        <div style="text-align:center; margin:28px 0;">
          <span style="display:inline-block; font-size:32px; font-weight:700; letter-spacing:8px; color:#1A1A2E;">${code}</span>
        </div>
        <p style="font-size:13px; line-height:1.5; color:#8A8AA3; margin:0;">Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette connexion, ignorez cet email.</p>
      </td>
    </tr>
  </table>
</body>`);
}
