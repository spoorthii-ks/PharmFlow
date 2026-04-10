const express = require('express');
const router = express.Router();
const { signup, login, googleAuthUrl, googleCallback } = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login', login);
router.get('/google/url', googleAuthUrl);
router.get('/google/callback', googleCallback);

module.exports = router;
