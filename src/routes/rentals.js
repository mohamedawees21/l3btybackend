// backend/src/routes/rentals.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// 🚀 تأجير متعدد الألعاب
router.post('/multi', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const {
      games, // [{game_id, quantity, duration_minutes}]
      customer_name,
      customer_phone,
      shift_id,
      payment_method = 'cash',
      notes = '',
      discount = 0
    } = req.body;

    if (!shift_id) {
      return res.status(400).json({
        success: false,
        message: 'يجب بدء شيفت أولاً'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const rentalNumbers = [];
      const rentalDetails = [];

      for (const item of games) {
        // التحقق من توفر اللعبة
        const [game] = await connection.execute(
          `SELECT id, price_per_hour, price_per_15min 
           FROM games WHERE id = ? AND status = 'متاح' 
           AND branch_id = ?`,
          [item.game_id, user.branch_id]
        );

        if (game.length === 0) {
          throw new Error(`اللعبة ${item.game_id} غير متاحة`);
        }

        // حساب السعر
        let totalAmount = 0;
        if (item.duration_minutes >= 60) {
          totalAmount = (game[0].price_per_hour * item.duration_minutes / 60) * item.quantity;
        } else {
          const quarters = Math.ceil(item.duration_minutes / 15);
          totalAmount = (game[0].price_per_15min * quarters) * item.quantity;
        }

        // تطبيق الخصم
        totalAmount = totalAmount * (1 - discount / 100);

        // إنشاء التأجير
        const rentalData = {
          rental_number: `R${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
          game_id: item.game_id,
          branch_id: user.branch_id,
          employee_id: user.id,
          shift_id: shift_id,
          customer_name,
          customer_phone,
          quantity: item.quantity,
          duration_minutes: item.duration_minutes,
          payment_method,
          notes,
          total_amount: totalAmount,
          status: 'نشط',
          expected_end_time: new Date(Date.now() + item.duration_minutes * 60000)
        };

        // إدراج التأجير
        const [result] = await connection.execute(
          `INSERT INTO rentals SET ?`,
          [rentalData]
        );

        // تحديث حالة اللعبة
        await connection.execute(
          `UPDATE games SET status = 'مؤجرة' WHERE id = ?`,
          [item.game_id]
        );

        rentalNumbers.push(rentalData.rental_number);
        rentalDetails.push({
          rental_id: result.insertId,
          ...rentalData
        });
      }

      await connection.commit();

      res.json({
        success: true,
        message: `تم بدء ${games.length} تأجير بنجاح`,
        rental_numbers: rentalNumbers,
        details: rentalDetails
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Multi rental error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'حدث خطأ في بدء التأجير'
    });
  }
});

module.exports = router;