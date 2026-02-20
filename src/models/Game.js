const db = require('../../config/database');

class Game {
  // الحصول على جميع الألعاب في المخزون
  static async getAllInventory() {
    const query = `
      SELECT gi.*, gc.name as category_name, gc.icon as category_icon
      FROM games_inventory gi
      LEFT JOIN game_categories gc ON gi.category_id = gc.id
      WHERE gi.is_active = 1
      ORDER BY gi.name
    `;
    
    const [rows] = await db.execute(query);
    return rows;
  }

  // الحصول على لعبة من المخزون
  static async getInventoryById(id) {
    const query = `
      SELECT gi.*, gc.name as category_name
      FROM games_inventory gi
      LEFT JOIN game_categories gc ON gi.category_id = gc.id
      WHERE gi.id = ? AND gi.is_active = 1
    `;
    
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
  }

  // إنشاء لعبة في المخزون
  static async createInventory(gameData) {
    const query = `
      INSERT INTO games_inventory 
      (name, category_id, description, specifications, image_url, minimum_age, max_weight, safety_instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.execute(query, [
      gameData.name,
      gameData.category_id,
      gameData.description || '',
      gameData.specifications ? JSON.stringify(gameData.specifications) : null,
      gameData.image_url || '',
      gameData.minimum_age || 12,
      gameData.max_weight || 100,
      gameData.safety_instructions || ''
    ]);
    
    return result.insertId;
  }

  // تحديث حالة لعبة في الفرع
  static async updateBranchGameStatus(branchGameId, status) {
    const query = 'UPDATE branch_games SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    const [result] = await db.execute(query, [status, branchGameId]);
    return result.affectedRows > 0;
  }

  // الحصول على ألعاب متاحة حسب الفرع
  static async getAvailableByBranch(branchId) {
    const query = `
      SELECT bg.*, gi.name as game_name, gi.image_url as game_image, gc.name as category_name
      FROM branch_games bg
      JOIN games_inventory gi ON bg.game_inventory_id = gi.id
      JOIN game_categories gc ON gi.category_id = gc.id
      WHERE bg.branch_id = ? AND bg.status = 'متاح' AND bg.is_active = 1
      ORDER BY gi.name
    `;
    
    const [rows] = await db.execute(query, [branchId]);
    return rows;
  }

  // الحصول على التصنيفات
  static async getCategories() {
    const query = 'SELECT * FROM game_categories WHERE is_active = 1 ORDER BY name';
    const [rows] = await db.execute(query);
    return rows;
  }

  // تحديث سعر لعبة في الفرع
  static async updateBranchGamePrice(branchGameId, priceData) {
    const fields = [];
    const values = [];
    
    if (priceData.price_per_hour) {
      fields.push('price_per_hour = ?');
      values.push(priceData.price_per_hour);
    }
    
    if (priceData.price_per_15min) {
      fields.push('price_per_15min = ?');
      values.push(priceData.price_per_15min);
    }
    
    if (fields.length === 0) {
      return false;
    }
    
    values.push(branchGameId);
    
    const query = `
      UPDATE branch_games 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    
    const [result] = await db.execute(query, values);
    return result.affectedRows > 0;
  }
}

module.exports = Game;