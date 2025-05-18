const nodemailer = require('nodemailer');
const ejs = require('ejs')

function sendMail(
  {
    senderName,
    recipientEmail, 
    emailSubject,
    emailTemplate,
    replyTo,
    context
  }
)
{
  let emailBody;

  let transporter = nodemailer.createTransport({
    host: "live.smtp.mailtrap.io",
    port: 587,
    auth: {
      user: "api",
      pass: "dfa04f6b252a5436c6afc525de9f22ef"
    }
  });

  ejs.renderFile(emailTemplate, context, (err, data)=> {
    if(err) throw Error(err.message)
    emailBody = data
  } )
  
  var mailOptions = {
    from:`<${senderName}@growthspringers.com>`,
    to: recipientEmail,
    subject: emailSubject,
    html: emailBody,
    replyTo: replyTo
  };
  
  transporter.sendMail(mailOptions, function(err){
    if (err) throw Error(err.message)
  });
}

module.exports = {sendMail}
