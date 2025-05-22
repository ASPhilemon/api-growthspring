import nodemailer from "nodemailer"

export async function sendEmail({
  sender,
  recipient,
  subject,
  message,
}) {

  const transporter = nodemailer.createTransport({
    host: "live.smtp.mailtrap.io",
    port: 587,
    auth: {
      user: "api",
      pass: "dfa04f6b252a5436c6afc525de9f22ef"
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