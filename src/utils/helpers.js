/**
 * تنسيق الوقت
 * @param {Date} date - التاريخ
 * @returns {string} الوقت المنسق
 */
function formatTime(date) {
  return new Date(date).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * تنسيق التاريخ
 * @param {Date} date - التاريخ
 * @returns {string} التاريخ المنسق
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * حساب الوقت المتبقي
 * @param {Date} startTime - وقت البداية
 * @param {number} duration - المدة بالدقائق
 * @returns {Object} الوقت المتبقي
 */
function calculateRemainingTime(startTime, duration) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + (duration * 60000));
  const now = new Date();
  
  const remainingMs = end - now;
  const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));
  const remainingSeconds = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
  
  return {
    totalSeconds: Math.floor(remainingMs / 1000),
    minutes: remainingMinutes,
    seconds: remainingSeconds,
    isExpired: remainingMs <= 0,
    isWarning: remainingMinutes <= 5 && remainingMinutes > 0,
    isCritical: remainingMinutes <= 1
  };
}

/**
 * تنسيق المبلغ
 * @param {number} amount - المبلغ
 * @returns {string} المبلغ المنسق
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * إنشاء معرف فريد
 * @returns {string} المعرف
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * التحقق من وقت الإلغاء المسموح به
 * @param {Date} startTime - وقت البداية
 * @param {number} maxMinutes - أقصى وقت للإلغاء بالدقائق
 * @returns {boolean} هل يمكن الإلغاء؟
 */
function canCancel(startTime, maxMinutes = 3) {
  const start = new Date(startTime);
  const now = new Date();
  const elapsedMinutes = (now - start) / (1000 * 60);
  return elapsedMinutes <= maxMinutes;
}

/**
 * تقسيم المصفوفة إلى صفحات
 * @param {Array} array - المصفوفة
 * @param {number} pageSize - حجم الصفحة
 * @param {number} pageNumber - رقم الصفحة
 * @returns {Object} البيانات المقسمة
 */
function paginate(array, pageSize, pageNumber) {
  const startIndex = (pageNumber - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  return {
    data: array.slice(startIndex, endIndex),
    page: pageNumber,
    pageSize,
    total: array.length,
    totalPages: Math.ceil(array.length / pageSize)
  };
}

module.exports = {
  formatTime,
  formatDate,
  calculateRemainingTime,
  formatCurrency,
  generateId,
  canCancel,
  paginate
};