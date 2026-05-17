'use strict';

const nodemailer = require('nodemailer');

const createTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// A single, reusable HTML wrapper/helper function for all Swiss Side transactional emails
const getEmailWrapper = (title, category, heading, bodyHtml, ctaText = null, ctaUrl = null, footerAlert = null) => {
  const currentYear = new Date().getFullYear();
  const logoUrl = 'https://swiss-side.store/logo.png';
  
  const ctaSection = (ctaText && ctaUrl) ? `
    <!-- CTA Button -->
    <table align="center" cellpadding="0" cellspacing="0" style="margin: 32px auto;">
      <tr>
        <td align="center" style="background-color:#A0604E;border-radius:4px;">
          <a href="${ctaUrl}" target="_blank"
             style="display:inline-block;padding:16px 32px;color:#ffffff;font-family:'Outfit','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;border-radius:4px;border:1px solid #A0604E;">
            ${ctaText} &rarr;
          </a>
        </td>
      </tr>
    </table>
  ` : '';

  const footerAlertText = footerAlert ? `
    <p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.6;font-family:'Outfit','Helvetica Neue',Helvetica,Arial,sans-serif;font-style:italic;">
      ${footerAlert}
    </p>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;900&display=swap" rel="stylesheet">
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; padding: 10px !important; }
      .email-card { border-radius: 8px !important; }
      .email-body { padding: 32px 24px !important; }
      .email-header { padding: 32px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f1ee;font-family:'Outfit','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ee;padding:40px 0;">
    <tr>
      <td align="center">
        <table class="email-container" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0dbd6;box-shadow: 0 4px 12px rgba(0,0,0,0.03);">

          <!-- Header with Logo -->
          <tr>
            <td class="email-header" align="center" style="background-color:#1a1a1a;padding:40px;">
              <img src="${logoUrl}" alt="Swiss Side Logo" width="80" height="80" style="display:block;margin-bottom:16px;border-radius:8px;object-fit:contain;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center">
                    <span style="color:#ffffff;font-size:14px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;vertical-align:middle;font-family:'Outfit',sans-serif;">Swiss Side</span>
                    <span style="color:#A0604E;font-size:14px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;vertical-align:middle;margin-left:6px;font-family:'Outfit',sans-serif;">Management</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Terracotta Accent Divider -->
          <tr>
            <td style="background-color:#A0604E;height:4px;line-height:4px;font-size:4px;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-body" style="padding:48px 40px 40px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:#A0604E;font-family:'Outfit',sans-serif;">
                ${category}
              </p>
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:900;color:#1a1a1a;letter-spacing:-0.02em;line-height:1.25;font-family:'Outfit',sans-serif;">
                ${heading}
              </h1>

              <div style="font-size:15px;line-height:1.75;color:#4a4a4a;font-family:'Outfit','Helvetica Neue',Helvetica,Arial,sans-serif;">
                ${bodyHtml}
              </div>

              ${ctaSection}

              ${footerAlertText}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #ede9e5;"></div>
            </td>
          </tr>

          <!-- Bottom Footer Bar -->
          <tr>
            <td style="background-color:#f9f7f5;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:'Outfit',sans-serif;font-size:10px;color:#8a8a8a;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">
                    Swiss Side Training Camp &mdash; Iten, Kenya
                  </td>
                  <td align="right" style="font-family:'Outfit',sans-serif;font-size:10px;color:#8a8a8a;letter-spacing:0.1em;font-weight:600;">
                    &copy; ${currentYear}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Below Card Note -->
        <p style="margin:20px 0 0;font-family:'Outfit',sans-serif;font-size:11px;color:#aaa;letter-spacing:0.05em;text-align:center;text-transform:uppercase;font-weight:600;">
          Swiss Side Management Suite &mdash; Internal Operations
        </p>

      </td>
    </tr>
  </table>

</body>
</html>`;
};

const sendMagicLink = async (toEmail, resetUrl) => {
  const transporter = createTransporter();
  
  const bodyHtml = `
    <p style="margin: 0 0 16px;">You requested a password reset for your Swiss Side Management account.</p>
    <p style="margin: 0 0 16px;">Click the link below to choose a new, secure password. This reset request expires in 30 minutes.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background-color:#f9f7f5; border-left:3px solid #A0604E; border-radius:0 4px 4px 0;">
      <tr>
        <td style="padding:14px 18px; font-size:13px; color:#555;">
          If the button does not work, copy and paste this link in your browser:
          <br/>
          <a href="${resetUrl}" style="color:#A0604E; word-break:break-all; display:block; margin-top:8px;">${resetUrl}</a>
        </td>
      </tr>
    </table>
  `;

  const html = getEmailWrapper(
    'Reset your Swiss Side password',
    'Account Security',
    'Reset Your Password',
    bodyHtml,
    'Reset Password',
    resetUrl,
    'If you did not request this, you can safely ignore this email. Your password will remain unchanged.'
  );

  await transporter.sendMail({
    from: `"Swiss Side Management" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Reset your Swiss Side password',
    text: `You requested a password reset for your Swiss Side Management account.\n\nClick the link below to reset your password. This link expires in 30 minutes.\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html
  });
};

const sendInvitation = async (toEmail, inviteUrl, invitedBy) => {
  const transporter = createTransporter();

  const bodyHtml = `
    <p style="margin: 0 0 16px;"><strong>${invitedBy}</strong> has invited you to join the Swiss Side Training Camp Management System as a staff member.</p>
    <p style="margin: 0 0 16px;">Click the button below to accept your invitation and finalize your account setup. This link is valid for 24 hours.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background-color:#f9f7f5; border-left:3px solid #A0604E; border-radius:0 4px 4px 0;">
      <tr>
        <td style="padding:14px 18px; font-size:13px; color:#555;">
          Or copy this link to join:
          <br/>
          <a href="${inviteUrl}" style="color:#A0604E; word-break:break-all; display:block; margin-top:8px;">${inviteUrl}</a>
        </td>
      </tr>
    </table>
  `;

  const html = getEmailWrapper(
    'You have been invited to Swiss Side Management',
    'Staff Invitation',
    'You Have Been Invited',
    bodyHtml,
    'Accept Invitation',
    inviteUrl,
    'If you were not expecting this invitation, you can safely ignore this email. No account will be created.'
  );

  await transporter.sendMail({
    from: `"Swiss Side Management" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'You have been invited to Swiss Side Management',
    text: `You have been invited by ${invitedBy} to join the Swiss Side Management system.\n\nClick the link below to set up your account:\n\n${inviteUrl}`,
    html
  });
};

const sendCustomEmail = async (toEmail, subject, text, html) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Swiss Side Management" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: subject,
    text: text,
    html: html || text
  });
};

const sendStatusNotification = async (toEmail, requestorName, item, newStatus, adminName, adminNote) => {
  const transporter = createTransporter();

  const statusConfig = {
    approved: {
      label: 'Approved',
      color: '#4F46E5',
      bgColor: '#EEF2FF',
      message: 'Your request has been reviewed and approved. It will now be ordered.'
    },
    ordered: {
      label: 'Ordered',
      color: '#D97706',
      bgColor: '#FFFBEB',
      message: 'Your item has been ordered and is on its way.'
    },
    fulfilled: {
      label: 'Fulfilled',
      color: '#059669',
      bgColor: '#ECFDF5',
      message: 'Your request has been fully fulfilled. The item is now available.'
    },
    dismissed: {
      label: 'Dismissed',
      color: '#DC2626',
      bgColor: '#FEF2F2',
      message: 'Your request has been reviewed and dismissed.'
    }
  };

  const cfg = statusConfig[newStatus] || {
    label: newStatus,
    color: '#6B7280',
    bgColor: '#F9FAFB',
    message: 'Your request status has been updated.'
  };

  const adminNoteRow = adminNote
    ? `<tr style="border-top: 1px solid #ede9e5;">
        <td style="padding:10px 0;font-size:13px;color:#6b7280;vertical-align:top;width:120px;font-weight:600;">Admin Note</td>
        <td style="padding:10px 0;font-size:13px;color:#1a1a1a;">${adminNote}</td>
       </tr>`
    : '';

  const bodyHtml = `
    <p style="margin: 0 0 16px;">Hello ${requestorName},</p>
    <p style="margin: 0 0 24px;">Your global operations requisition request has been processed.</p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e0dbd6;border-radius:6px;overflow:hidden;border-collapse:collapse;">
      <tr style="background-color:#1a1a1a;color:#ffffff;">
        <th colspan="2" align="left" style="padding:12px 18px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;font-family:'Outfit',sans-serif;">Requisition Details</th>
      </tr>
      <tr>
        <td style="padding:12px 18px;font-size:13px;color:#6b7280;width:120px;font-weight:600;">Requested Item</td>
        <td style="padding:12px 18px;font-size:13px;color:#1a1a1a;font-weight:700;">${item}</td>
      </tr>
      <tr style="border-top: 1px solid #ede9e5;">
        <td style="padding:12px 18px;font-size:13px;color:#6b7280;font-weight:600;">Update Status</td>
        <td style="padding:12px 18px;font-size:13px;color:${cfg.color};font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">${cfg.label}</td>
      </tr>
      <tr style="border-top: 1px solid #ede9e5;">
        <td style="padding:12px 18px;font-size:13px;color:#6b7280;font-weight:600;">Reviewed By</td>
        <td style="padding:12px 18px;font-size:13px;color:#1a1a1a;font-weight:700;">${adminName}</td>
      </tr>
      ${adminNoteRow ? `<tr style="border-top: 1px solid #ede9e5;"><td colspan="2" style="padding:12px 18px;background-color:#f9f7f5;font-size:13px;line-height:1.6;color:#555;"><strong>Admin Remark:</strong> ${adminNote}</td></tr>` : ''}
    </table>
    
    <p style="margin: 0 0 16px; font-size:14px; color:#4a4a4a;">${cfg.message}</p>
  `;

  const html = getEmailWrapper(
    `Requisition Status Update: ${cfg.label}`,
    'Operations Requisition',
    'Requisition Status Update',
    bodyHtml,
    'Access Requisitions',
    'https://swiss-side.store/needs',
    'If you have questions about this action, please speak to your department manager directly.'
  );

  await transporter.sendMail({
    from: `"Swiss Side Management" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Your request for "${item}" has been ${cfg.label}`,
    text: `Hi ${requestorName},\n\nYour request for "${item}" has been ${cfg.label} by ${adminName}.\n\n${cfg.message}${adminNote ? '\n\nAdmin note: ' + adminNote : ''}\n\n— Swiss Side Management`,
    html
  });
};

const sendWelcomeEmail = async (toEmail, displayName) => {
  const transporter = createTransporter();

  const bodyHtml = `
    <p style="margin: 0 0 16px;">Hello <strong>${displayName}</strong>,</p>
    <p style="margin: 0 0 16px;">Welcome to Swiss Side! Your management suite account has been successfully created and fully activated.</p>
    <p style="margin: 0 0 16px;">You can now log in at any time to access your custom operations dashboard, trace inventories, audit transactions, and process requisitions.</p>
  `;

  const html = getEmailWrapper(
    'Welcome to Swiss Side Management',
    'Account Activation',
    'Welcome to Swiss Side',
    bodyHtml,
    'Go to Dashboard',
    'https://swiss-side.store',
    'If you did not authorize this registration, please contact your systems administrator immediately.'
  );

  await transporter.sendMail({
    from: `"Swiss Side Management" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Welcome to Swiss Side Management',
    text: `Welcome to Swiss Side, ${displayName}!\n\nYour management account has been successfully created and configured.\n\nYou can log in at any time to access your dashboard.\n\n— Swiss Side Training Camp`,
    html
  });
};

const sendPasswordChangedEmail = async (toEmail, displayName) => {
  const transporter = createTransporter();

  const bodyHtml = `
    <p style="margin: 0 0 16px;">Hello <strong>${displayName}</strong>,</p>
    <p style="margin: 0 0 16px;">This is a security confirmation that the password for your Swiss Side Management account was successfully updated.</p>
    <p style="margin: 0 0 16px;">As a security precaution, this change has terminated previous sessions, securing your active credentials.</p>
  `;

  const html = getEmailWrapper(
    'Your Swiss Side password has been updated',
    'Security Notification',
    'Password Successfully Changed',
    bodyHtml,
    'Return to Dashboard',
    'https://swiss-side.store',
    'If you did not initiate this change, please reset your password immediately using the magic link or contact your systems administrator.'
  );

  await transporter.sendMail({
    from: `"Swiss Side Management" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your Swiss Side password has been updated',
    text: `Hello ${displayName},\n\nThis is a confirmation that the password for your Swiss Side Management account was recently updated.\n\nIf you did not make this change, please contact your administrator immediately.\n\n— Swiss Side Training Camp`,
    html
  });
};

const sendDetailedReportWithAttachment = async (toEmail, subject, text, html, pdfBuffer, pdfFilename) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Swiss Side Management" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: subject,
    text: text,
    html: html || text,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
};

module.exports = { 
  sendMagicLink, 
  sendInvitation, 
  sendCustomEmail, 
  sendStatusNotification,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendDetailedReportWithAttachment
};
