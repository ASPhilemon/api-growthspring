const nodemailer = require('nodemailer');
const ejs = require('ejs')

function sendMail(
  {
    senderName,
    recipientEmail, 
    emailSubject,
    emailTemplate,
    context
  }
)
{
  let emailBody;

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'creditme.ug.info@gmail.com',
      pass: 'xkubwidoohzorewf'
    }
  });

  ejs.renderFile(emailTemplate, context, (err, data)=> {
    if(err) throw Error(err.message)
    emailBody = data
  } )
  
  var mailOptions = {
    from:`${senderName} <creditme.ug.info@gmail.com>`,
    to: recipientEmail,
    subject: emailSubject,
    html: emailBody
  };
  
  transporter.sendMail(mailOptions, function(err){
    if (err) throw Error(err.message)
  });
}

module.exports = {sendMail}