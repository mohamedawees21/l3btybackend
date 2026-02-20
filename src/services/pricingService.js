const { GAMES, PRICE_MULTIPLIERS, SYSTEM_LIMITS } = require('../utils/constants');

class PricingService {
  /**
   * حساب سعر التأجير
   * @param {string} gameType - نوع اللعبة
   * @param {number} duration - المدة بالدقائق
   * @returns {number} السعر
   */
  static calculatePrice(gameType, duration) {
    const game = GAMES[gameType];
    if (!game) {
      throw new Error('نوع اللعبة غير معروف');
    }

    // التحقق من صحة المدة
    if (duration < SYSTEM_LIMITS.MIN_RENTAL_DURATION) {
      throw new Error(`المدة يجب أن تكون ${SYSTEM_LIMITS.MIN_RENTAL_DURATION} دقيقة على الأقل`);
    }

    if (duration > SYSTEM_LIMITS.MAX_RENTAL_DURATION) {
      throw new Error(`المدة يجب أن تكون ${SYSTEM_LIMITS.MAX_RENTAL_DURATION} دقيقة على الأكثر`);
    }

    const basePrice = game.basePrice;
    let price;

    // استخدام مضاعفات الأسعار للفواصل المعروفة
    if (PRICE_MULTIPLIERS[duration]) {
      price = basePrice * PRICE_MULTIPLIERS[duration];
    } else {
      // حساب السعر بناءً على أقرب فاصل
      if (duration <= 15) {
        price = basePrice;
      } else if (duration <= 30) {
        price = basePrice * 1.8;
      } else if (duration <= 45) {
        price = basePrice * 2.5;
      } else if (duration <= 60) {
        price = basePrice * 3.0;
      } else {
        // أكثر من ساعة: 3 + 0.5 لكل 15 دقيقة إضافية
        const hours = Math.floor(duration / 60);
        const extraMinutes = duration % 60;
        const extraQuarters = Math.ceil(extraMinutes / 15);
        price = (basePrice * 3 * hours) + (basePrice * 0.5 * extraQuarters);
      }
    }

    return Math.round(price);
  }

  /**
   * حساب المبلغ المرتجع
   * @param {Object} rental - بيانات التأجير
   * @param {Date} cancellationTime - وقت الإلغاء
   * @returns {number} المبلغ المرتجع
   */
  static calculateRefund(rental, cancellationTime) {
    const startTime = new Date(rental.start_time);
    const elapsedMinutes = Math.floor((cancellationTime - startTime) / (1000 * 60));
    
    // إذا تم الإلغاء خلال أول 3 دقائق، استرجاع كامل المبلغ
    if (elapsedMinutes <= SYSTEM_LIMITS.MAX_CANCELLATION_TIME) {
      return rental.price;
    }
    
    // احتساب نسبة الاسترجاع
    const usedPercentage = elapsedMinutes / rental.duration;
    const refundAmount = rental.price * (1 - usedPercentage);
    
    // الحد الأدنى للاسترجاع 10% من السعر
    const minRefund = rental.price * 0.1;
    
    return Math.max(Math.round(refundAmount), minRefund);
  }

  /**
   * حساب سعر التمديد
   * @param {Object} rental - بيانات التأجير
   * @param {number} extensionMinutes - المدة الإضافية بالدقائق
   * @returns {number} سعر التمديد
   */
  static getExtensionPrice(rental, extensionMinutes) {
    const gameType = rental.game_type;
    const game = GAMES[gameType];
    
    if (!game) {
      throw new Error('نوع اللعبة غير معروف');
    }

    // سعر التمديد: سعر 15 دقيقة × عدد وحدات الربع ساعة
    const quarterHours = Math.ceil(extensionMinutes / 15);
    const pricePer15Minutes = game.basePrice; // سعر 15 دقيقة = السعر الأساسي
    
    return pricePer15Minutes * quarterHours;
  }

  /**
   * الحصول على قائمة الأسعار لجميع الألعاب
   * @returns {Array} قائمة الأسعار
   */
  static getAllPrices() {
    const prices = [];
    const durations = [15, 30, 45, 60];

    Object.keys(GAMES).forEach(gameType => {
      const game = GAMES[gameType];
      
      durations.forEach(duration => {
        try {
          const price = this.calculatePrice(gameType, duration);
          prices.push({
            gameType,
            gameName: game.name,
            duration,
            price
          });
        } catch (error) {
          // تجاهل الأخطاء
        }
      });
    });

    return prices;
  }
}

module.exports = PricingService;