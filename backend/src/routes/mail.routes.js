/**
 * Puvima IT Service and Research Consultancy — Mail Routes
 * Endpoints for the PUVIMA Mail Application.
 */

const express = require('express');
const multer = require('multer');
const mailController = require('../controllers/mail.controller');
const mailAuth = require('../middleware/mailAuth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB like Gmail
    files: 20
  }
});

// Dynamic Mailbox Connection (Gmail / Custom IMAP & SMTP) — Entry point for mailbox sign-in
router.post('/connect', mailController.connectMailbox);

// All subsequent mail operations require valid session or mailbox authentication
router.use(mailAuth);

router.post('/disconnect', mailController.disconnectMailbox);

// Mailbox Account & Folders
router.get('/account', mailController.getAccount);
router.get('/folders', mailController.getFolders);

// Messages listing & retrieval
router.get('/messages', mailController.getMessages);
router.get('/messages/:uid', mailController.getMessage);

// Outbound email actions
router.post('/send', upload.array('attachments', 10), mailController.sendMail);
router.post('/reply', upload.array('attachments', 10), mailController.replyMail);
router.post('/forward', upload.array('attachments', 10), mailController.forwardMail);

// Message status & lifecycle
router.patch('/messages/:uid/read', mailController.markRead);
router.patch('/messages/:uid/star', mailController.markStarred);
router.post('/messages/batch-trash', mailController.batchMoveToTrash);
router.post('/messages/batch-restore', mailController.batchRestore);
router.post('/messages/batch-move', mailController.batchMoveToFolder);
router.post('/messages/batch-read', mailController.batchMarkRead);
router.post('/messages/:uid/trash', mailController.moveToTrash);
router.post('/messages/:uid/restore', mailController.restoreFromTrash);
router.post('/messages/:uid/move', mailController.moveToFolder);

// Safe attachment downloads
router.get('/attachments/:uid/:partId/:filename', mailController.downloadAttachment);

module.exports = router;
