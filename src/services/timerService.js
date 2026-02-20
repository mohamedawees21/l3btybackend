// src/services/timerService.js
const WebSocket = require('ws');
const Rental = require('../models/Rental');
const NotificationService = require('./notificationService');

class TimerService {
  constructor(io) {
    this.io = io;
    this.timers = new Map();
    this.expirationChecks = new Map();
  }

  async startRentalTimer(rentalId, branchId) {
    const rental = await Rental.findById(rentalId);
    if (!rental || rental.status !== 'ACTIVE') return;

    const expiresAt = new Date(rental.expires_at);
    const now = new Date();
    const remainingMs = expiresAt - now;

    if (remainingMs <= 0) {
      await this.handleRentalExpiration(rentalId);
      return;
    }

    // إعداد التايمر
    const timer = setTimeout(async () => {
      await this.handleRentalExpiration(rentalId);
      this.timers.delete(rentalId);
    }, remainingMs);

    this.timers.set(rentalId, timer);

    // إعداد الفحص الدوري (كل دقيقة)
    const checkInterval = setInterval(async () => {
      const rental = await Rental.findById(rentalId);
      if (!rental || rental.status !== 'ACTIVE') {
        clearInterval(checkInterval);
        this.expirationChecks.delete(rentalId);
        return;
      }

      const remainingMinutes = Math.ceil((new Date(rental.expires_at) - new Date()) / 60000);
      
      // إرسال تحديث الوقت
      this.io.to(`branch-${branchId}`).emit('timer_update', {
        rental_id: rentalId,
        remaining_minutes: remainingMinutes,
        expires_at: rental.expires_at
      });

      // تنبيه قبل 5 دقائق
      if (remainingMinutes === 5) {
        this.io.to(`branch-${branchId}`).emit('rental_warning', {
          rental_id: rentalId,
          message: '5 دقائق متبقية',
          game_name: rental.game_name
        });
      }

      // تنبيه قبل دقيقة
      if (remainingMinutes === 1) {
        this.io.to(`branch-${branchId}`).emit('rental_warning', {
          rental_id: rentalId,
          message: 'دقيقة واحدة متبقية',
          game_name: rental.game_name,
          urgent: true
        });
      }
    }, 60000); // كل دقيقة

    this.expirationChecks.set(rentalId, checkInterval);
  }

  async handleRentalExpiration(rentalId) {
    try {
      const rental = await Rental.findById(rentalId);
      if (!rental || rental.status !== 'ACTIVE') return;

      // تحديث الحالة
      await Rental.updateStatus(rentalId, 'COMPLETED');

      // إرسال إشعار انتهاء الوقت
      this.io.to(`branch-${rental.branch_id}`).emit('rental_expired', {
        rental_id: rentalId,
        game_name: rental.game_name,
        child_name: rental.child_name,
        message: 'انتهى وقت التأجير'
      });

      // إرسال تنبيه صوتي
      this.io.to(`branch-${rental.branch_id}`).emit('play_sound', {
        sound: 'timeout',
        rental_id: rentalId
      });

      // إرسال إشعار للموظفين
      await NotificationService.create({
        user_id: rental.employee_id,
        title: 'انتهاء التأجير',
        message: `انتهى وقت تأجير ${rental.game_name} للطفل ${rental.child_name}`,
        type: 'RENTAL_EXPIRED',
        data: { rental_id: rentalId }
      });

      // تسجيل النشاط
      await ActivityLog.create({
        user_id: rental.employee_id,
        action: 'RENTAL_EXPIRED',
        entity_type: 'RENTAL',
        entity_id: rentalId,
        details: JSON.stringify({
          completed_at: new Date()
        })
      });

    } catch (error) {
      console.error('Error handling rental expiration:', error);
    }
  }

  cancelTimer(rentalId) {
    if (this.timers.has(rentalId)) {
      clearTimeout(this.timers.get(rentalId));
      this.timers.delete(rentalId);
    }

    if (this.expirationChecks.has(rentalId)) {
      clearInterval(this.expirationChecks.get(rentalId));
      this.expirationChecks.delete(rentalId);
    }
  }

  async restartAllTimers(branchId) {
    // إعادة تشغيل كل التايمرات للفرع
    const activeRentals = await Rental.findActiveByBranch(branchId);
    
    for (const rental of activeRentals) {
      this.cancelTimer(rental.id);
      await this.startRentalTimer(rental.id, branchId);
    }
  }
}

module.exports = TimerService;