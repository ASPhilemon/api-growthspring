import nodemailer from "nodemailer";
import ejs from "ejs"; 
import path from "path"; 

export async function sendEmail(
  sender,
  recipient,
  subject,
  message,
) {

  const transporter = nodemailer.createTransport({
    host: "live.smtp.mailtrap.io",
    port: 587,
    auth: {
      user: "api",
      pass: process.env.MAILTRAP_SECRET
    }
  });
  
  const mailOptions = {
    from:`<${sender}@growthspringers.com>`,
    to: recipient,
    subject: subject,
    html: message,
  };

  transporter.sendMail(mailOptions, (err)=>{
    if (err) throw new Error(err.message)
  });

}


/**
 * Sends an email using a specified template and data, allowing for a custom template path.
 *
 * @param {object} options - Email options.
 * @param {string} options.sender - The sender's identifier (e.g., "growthspring").
 * @param {string} options.recipient - The recipient's email address.
 * @param {string} options.subject - The email subject.
 * @param {string} options.templateName - The name of the EJS template file.
 * @param {object} options.templateData - An object containing data to inject into the template.
 * @param {string} options.templatesPath - The absolute path to the directory where the templateName can be found.
 * This allows other services to specify their own template folders.
 * @throws {Error} If email sending fails or template cannot be rendered.
 */
export async function sendEmailWithTemplate({
  sender,
  recipient,
  subject,
  templateName,
  templateData,
  templatesPath, 
}) {
  try {
    // 1. Validate templatesPath
    if (!templatesPath) {
      throw new Error("templatesPath must be provided when sending emails with templates.");
    }
    if (!path.isAbsolute(templatesPath)) {
        console.warn(`Warning: Provided templatesPath "${templatesPath}" is not an absolute path. This might lead to issues.`);
    }

    // 2. Construct the full path to the template file using the provided templatesPath
    const templateFilePath = path.join(templatesPath, templateName);

    // Render the EJS template with provided data
    const htmlMessage = await ejs.renderFile(templateFilePath, templateData);

    const transporter = nodemailer.createTransport({
      host: "live.smtp.mailtrap.io",
      port: 587,
      auth: {
        user: "api",
        pass: process.env.MAILTRAP_SECRET
      }
    });

    const mailOptions = {
      from: `<${sender}@growthspringers.com>`,
      to: recipient,
      subject: subject,
      html: htmlMessage, 
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Error sending email:", err);
        throw new Error(`Failed to send email: ${err.message}`);
      }
      console.log("Email sent successfully!");
    });

  } catch (error) {
    console.error("Error preparing or sending email with template:", error);
    throw new Error(`Could not send email: ${error.message}`);
  }
}