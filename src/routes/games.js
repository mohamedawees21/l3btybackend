const express = require('express');
const router = express.Router();
const gamesController = require('../controllers/gamesController');

// إنشاء لعبة جديدة مع معالجة الصور
router.post('/create-with-image', gamesController.createGameWithImage);

// جلب ألعاب الفرع
router.get('/branch/:branch_id', gamesController.getBranchGames);

// معالجة الصور لألعاب محددة
router.post('/process-images', gamesController.processGamesImages);

// جلب صورة لعبة محددة
router.get('/:game_id/image', gamesController.getGameImage);

module.exports = router;