const mysql = require('mysql2/promise');

class SyncService {
  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'l3bty_rental',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  // تسجيل النشاط في قاعدة البيانات
  async logActivity(userId, action, entityType, entityId, oldValues, newValues) {
    try {
      const query = `
        INSERT INTO activity_logs 
        (user_id, action, entity_type, entity_id, old_values, new_values) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await this.pool.execute(query, [
        userId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null
      ]);
      
      console.log(`✅ تم تسجيل النشاط: ${action} بواسطة المستخدم ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ خطأ في تسجيل النشاط:', error);
      return false;
    }
  }

  // تحديث مستخدم
  async updateUser(userId, userData) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // جلب البيانات القديمة
      const [oldData] = await connection.execute(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      // تحديث البيانات
      const fields = [];
      const values = [];
      
      if (userData.name) {
        fields.push('name = ?');
        values.push(userData.name);
      }
      
      if (userData.email) {
        fields.push('email = ?');
        values.push(userData.email);
      }
      
      if (userData.role) {
        fields.push('role = ?');
        values.push(userData.role);
      }
      
      if (userData.branch_id !== undefined) {
        fields.push('branch_id = ?');
        values.push(userData.branch_id);
      }
      
      if (userData.phone !== undefined) {
        fields.push('phone = ?');
        values.push(userData.phone);
      }
      
      if (userData.is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(userData.is_active);
      }
      
      if (userData.password) {
        fields.push('password = ?');
        values.push(userData.password);
      }

      if (fields.length === 0) {
        throw new Error('لا توجد بيانات للتحديث');
      }

      fields.push('updated_at = NOW()');
      values.push(userId);

      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      const [result] = await connection.execute(query, values);

      if (result.affectedRows === 0) {
        throw new Error('المستخدم غير موجود');
      }

      // جلب البيانات الجديدة
      const [newData] = await connection.execute(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      await connection.commit();

      // تسجيل النشاط
      await this.logActivity(
        userId,
        'تحديث مستخدم',
        'users',
        userId,
        oldData[0],
        newData[0]
      );

      return {
        success: true,
        message: 'تم تحديث المستخدم بنجاح',
        user: newData[0]
      };

    } catch (error) {
      await connection.rollback();
      console.error('❌ خطأ في تحديث المستخدم:', error);
      return {
        success: false,
        message: error.message || 'حدث خطأ في تحديث المستخدم'
      };
    } finally {
      connection.release();
    }
  }

  // تحديث فرع
  async updateBranch(branchId, branchData, userId) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // جلب البيانات القديمة
      const [oldData] = await connection.execute(
        'SELECT * FROM branches WHERE id = ?',
        [branchId]
      );

      // تحديث البيانات
      const fields = [];
      const values = [];
      
      if (branchData.name) {
        fields.push('name = ?');
        values.push(branchData.name);
      }
      
      if (branchData.location) {
        fields.push('location = ?');
        values.push(branchData.location);
      }
      
      if (branchData.city) {
        fields.push('city = ?');
        values.push(branchData.city);
      }
      
      if (branchData.contact_phone !== undefined) {
        fields.push('contact_phone = ?');
        values.push(branchData.contact_phone);
      }
      
      if (branchData.contact_email !== undefined) {
        fields.push('contact_email = ?');
        values.push(branchData.contact_email);
      }
      
      if (branchData.opening_time) {
        fields.push('opening_time = ?');
        values.push(branchData.opening_time);
      }
      
      if (branchData.closing_time) {
        fields.push('closing_time = ?');
        values.push(branchData.closing_time);
      }
      
      if (branchData.is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(branchData.is_active);
      }

      if (fields.length === 0) {
        throw new Error('لا توجد بيانات للتحديث');
      }

      fields.push('updated_at = NOW()');
      values.push(branchId);

      const query = `UPDATE branches SET ${fields.join(', ')} WHERE id = ?`;
      const [result] = await connection.execute(query, values);

      if (result.affectedRows === 0) {
        throw new Error('الفرع غير موجود');
      }

      // جلب البيانات الجديدة
      const [newData] = await connection.execute(
        'SELECT * FROM branches WHERE id = ?',
        [branchId]
      );

      await connection.commit();

      // تسجيل النشاط
      await this.logActivity(
        userId,
        'تحديث فرع',
        'branches',
        branchId,
        oldData[0],
        newData[0]
      );

      return {
        success: true,
        message: 'تم تحديث الفرع بنجاح',
        branch: newData[0]
      };

    } catch (error) {
      await connection.rollback();
      console.error('❌ خطأ في تحديث الفرع:', error);
      return {
        success: false,
        message: error.message || 'حدث خطأ في تحديث الفرع'
      };
    } finally {
      connection.release();
    }
  }

  // تحديث لعبة
  async updateGame(gameId, gameData, userId) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // جلب البيانات القديمة
      const [oldData] = await connection.execute(
        'SELECT * FROM games WHERE id = ?',
        [gameId]
      );

      // تحديث البيانات
      const fields = [];
      const values = [];
      
      if (gameData.name) {
        fields.push('name = ?');
        values.push(gameData.name);
      }
      
      if (gameData.description !== undefined) {
        fields.push('description = ?');
        values.push(gameData.description);
      }
      
      if (gameData.category) {
        fields.push('category = ?');
        values.push(gameData.category);
      }
      
      if (gameData.image_url !== undefined) {
        fields.push('image_url = ?');
        values.push(gameData.image_url);
      }
      
      if (gameData.price_per_hour !== undefined) {
        fields.push('price_per_hour = ?');
        values.push(gameData.price_per_hour);
      }
      
      if (gameData.deposit_amount !== undefined) {
        fields.push('deposit_amount = ?');
        values.push(gameData.deposit_amount);
      }
      
      if (gameData.status) {
        fields.push('status = ?');
        values.push(gameData.status);
      }
      
      if (gameData.is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(gameData.is_active);
      }

      if (fields.length === 0) {
        throw new Error('لا توجد بيانات للتحديث');
      }

      fields.push('updated_at = NOW()');
      values.push(gameId);

      const query = `UPDATE games SET ${fields.join(', ')} WHERE id = ?`;
      const [result] = await connection.execute(query, values);

      if (result.affectedRows === 0) {
        throw new Error('اللعبة غير موجودة');
      }

      // جلب البيانات الجديدة
      const [newData] = await connection.execute(
        'SELECT * FROM games WHERE id = ?',
        [gameId]
      );

      await connection.commit();

      // تسجيل النشاط
      await this.logActivity(
        userId,
        'تحديث لعبة',
        'games',
        gameId,
        oldData[0],
        newData[0]
      );

      return {
        success: true,
        message: 'تم تحديث اللعبة بنجاح',
        game: newData[0]
      };

    } catch (error) {
      await connection.rollback();
      console.error('❌ خطأ في تحديث اللعبة:', error);
      return {
        success: false,
        message: error.message || 'حدث خطأ في تحديث اللعبة'
      };
    } finally {
      connection.release();
    }
  }

  // حذف سجل (soft delete)
  async softDelete(entityType, entityId, userId) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      let tableName, idColumn;
      
      switch(entityType) {
        case 'user':
          tableName = 'users';
          idColumn = 'id';
          break;
        case 'branch':
          tableName = 'branches';
          idColumn = 'id';
          break;
        case 'game':
          tableName = 'games';
          idColumn = 'id';
          break;
        default:
          throw new Error('نوع السجل غير مدعوم');
      }

      // جلب البيانات القديمة
      const [oldData] = await connection.execute(
        `SELECT * FROM ${tableName} WHERE ${idColumn} = ?`,
        [entityId]
      );

      // تحديث حالة is_active
      const [result] = await connection.execute(
        `UPDATE ${tableName} SET is_active = 0, updated_at = NOW() WHERE ${idColumn} = ?`,
        [entityId]
      );

      if (result.affectedRows === 0) {
        throw new Error('السجل غير موجود');
      }

      await connection.commit();

      // تسجيل النشاط
      await this.logActivity(
        userId,
        `حذف ${entityType}`,
        tableName,
        entityId,
        oldData[0],
        { is_active: 0 }
      );

      return {
        success: true,
        message: `تم حذف ${entityType} بنجاح`
      };

    } catch (error) {
      await connection.rollback();
      console.error(`❌ خطأ في حذف ${entityType}:`, error);
      return {
        success: false,
        message: error.message || `حدث خطأ في حذف ${entityType}`
      };
    } finally {
      connection.release();
    }
  }

  // جلب سجل الأنشطة
  async getActivityLogs(filters = {}) {
    try {
      let query = `
        SELECT al.*, u.name as user_name, u.role as user_role
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      
      const params = [];
      
      if (filters.user_id) {
        query += ' AND al.user_id = ?';
        params.push(filters.user_id);
      }
      
      if (filters.entity_type) {
        query += ' AND al.entity_type = ?';
        params.push(filters.entity_type);
      }
      
      if (filters.start_date) {
        query += ' AND DATE(al.created_at) >= ?';
        params.push(filters.start_date);
      }
      
      if (filters.end_date) {
        query += ' AND DATE(al.created_at) <= ?';
        params.push(filters.end_date);
      }
      
      query += ' ORDER BY al.created_at DESC LIMIT 100';
      
      const [logs] = await this.pool.execute(query, params);
      
      // تحليل القيم القديمة والجديدة
      const parsedLogs = logs.map(log => ({
        ...log,
        old_values: log.old_values ? JSON.parse(log.old_values) : null,
        new_values: log.new_values ? JSON.parse(log.new_values) : null,
        created_at_formatted: new Date(log.created_at).toLocaleString('ar-EG')
      }));
      
      return {
        success: true,
        logs: parsedLogs
      };
      
    } catch (error) {
      console.error('❌ خطأ في جلب سجل الأنشطة:', error);
      return {
        success: false,
        message: 'حدث خطأ في جلب سجل الأنشطة'
      };
    }
  }
}

module.exports = new SyncService();