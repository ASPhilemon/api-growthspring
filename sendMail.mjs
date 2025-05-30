import nodemailer from 'nodemailer'
import ejs from 'ejs'

let transporter = nodemailer.createTransport({
  host: "live.smtp.mailtrap.io",
  port: 587,
  auth: {
    user: "api",
    pass: "dfa04f6b252a5436c6afc525de9f22ef"
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 50,
});

export async function sendMail(
  {
    sender,
    recipient, 
    subject,
    message
  }
)
{
  var mailOptions = {
    from:`<${sender}@growthspringers.com>`,
    to: recipient,
    subject: subject,
    html: message,
  };
  
  await new Promise((resolve, reject)=>{
    transporter.sendMail(mailOptions, function(err){
      if (err) throw new Error(err.message);
      resolve()
    });
  })
}

export function closeMailTransport() {
  transporter.close();
}