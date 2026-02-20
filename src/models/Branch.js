const db = require('../config/database');

class Branch {
  // الحصول على جميع الفروع
  static async getAll() {
    try {
      const [rows] = await db.execute(`
        SELECT b.*, 
               COUNT(DISTINCT g.id) as total_games,
               COUNT(DISTINCT CASE WHEN g.status = 'متاح' THEN g.id END) as available_games,
               COUNT(DISTINCT u.id) as total_employees
        FROM branches b
        LEFT JOIN games g ON b.id = g.branch_id AND g.is_active = 1
        LEFT JOIN users u ON b.id = u.branch_id AND u.is_active = 1
        WHERE b.is_active = 1
        GROUP BY b.id
        ORDER BY b.name
      `);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // الحصول على فرع بالمعرف
  static async getById(id) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM branches WHERE id = ? AND is_active = 1`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // إنشاء فرع جديد
  static async create(branchData) {
    try {
      const { 
        name, location, city, contact_phone, 
        contact_email, opening_time, closing_time,
        is_active = 1
      } = branchData;
      
      const branchCode = `BR-${Date.now().toString().slice(-6)}`;
      
      const [result] = await db.execute(
        `INSERT INTO branches (
          name, location, city, contact_phone, 
          contact_email, opening_time, closing_time,
          branch_code, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          name, location, city || 'القاهرة',
          contact_phone || '', contact_email || '',
          opening_time || '10:00:00', closing_time || '22:00:00',
          branchCode, is_active
        ]
      );
      
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  // تحديث فرع
  static async update(id, branchData) {
    try {
      const fields = [];
      const values = [];
      
      const allowedFields = [
        'name', 'location', 'city', 'contact_phone',
        'contact_email', 'opening_time', 'closing_time', 'is_active'
      ];
      
      allowedFields.forEach(field => {
        if (branchData[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(branchData[field]);
        }
      });
      
      if (fields.length === 0) {
        throw new Error('لا توجد بيانات للتحديث');
      }
      
      fields.push('updated_at = NOW()');
      values.push(id);
      
      const [result] = await db.execute(
        `UPDATE branches SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // حذف فرع
  static async delete(id) {
    try {
      const [result] = await db.execute(
        'UPDATE branches SET is_active = 0, updated_at = NOW() WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // الحصول على ألعاب الفرع
  static async getGames(branchId, filters = {}) {
    try {
      let query = `
        SELECT g.*, bg.price_per_hour, bg.quantity,
               c.name as category_name, c.description as category_description
        FROM branch_games bg
        JOIN games g ON bg.game_inventory_id = g.id
        LEFT JOIN categories c ON g.category_id = c.id
        WHERE bg.branch_id = ? AND g.is_active = 1
      `;
      
      const params = [branchId];
      
      if (filters.status) {
        query += ' AND g.status = ?';
        params.push(filters.status);
      }
      
      if (filters.category_id) {
        query += ' AND g.category_id = ?';
        params.push(filters.category_id);
      }
      
      query += ' ORDER BY g.name';
      
      const [rows] = await db.execute(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // إضافة لعبة للفرع
  static async addGame(branchId, gameData) {
    try {
      const { game_inventory_id, price_per_hour, quantity = 1 } = gameData;
      
      // التحقق من عدم تكرار اللعبة في الفرع
      const [existing] = await db.execute(
        'SELECT id FROM branch_games WHERE branch_id = ? AND game_inventory_id = ?',
        [branchId, game_inventory_id]
      );
      
      if (existing.length > 0) {
        throw new Error('اللعبة موجودة بالفعل في هذا الفرع');
      }
      
      const [result] = await db.execute(
        `INSERT INTO branch_games (branch_id, game_inventory_id, price_per_hour, quantity, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [branchId, game_inventory_id, price_per_hour, quantity]
      );
      
      return {
        id: result.insertId,
        branch_id: branchId,
        game_inventory_id,
        price_per_hour,
        quantity
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Branch;