// /api/support.js
const nodemailer = require('nodemailer');
const formidable = require('formidable');
const fs = require('fs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(400).json({ error: 'Error parsing form data' });
      return;
    }
    const { email, issue, description } = fields;
    let attachments = [];
    
    // Handle multiple attachments
    if (files.attachments) {
      // Convert to array if single file
      const attachmentFiles = Array.isArray(files.attachments) ? files.attachments : [files.attachments];
      
      attachmentFiles.forEach(file => {
        if (file.size > 0) {
          attachments.push({
            filename: file.name,
            path: file.path
          });
        }
      });
    }

    // Configure your SMTP transport
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your email provider
      auth: {
        user: 'your-email@gmail.com', // replace with your email
        pass: 'your-app-password' // replace with your app password
      }
    });

    const mailOptions = {
      from: email,
      to: 'your-email@gmail.com', // replace with your support email
      subject: `Support Request: ${issue}`,
      text: `From: ${email}\n\nIssue: ${issue}\n\nDescription:\n${description}`,
      attachments: attachments
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send email.' });
    }
  });
};
