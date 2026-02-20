// backend/src/utils/serverTime.js
class ServerTime {
  static getNow() {
    return new Date();
  }

  static getMySQLDateTime() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  static isWithinMinutes(startTime, minutes) {
    const diff = (new Date() - new Date(startTime)) / (1000 * 60);
    return diff <= minutes;
  }
}

module.exports = ServerTime;