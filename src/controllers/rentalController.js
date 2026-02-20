// backend/src/controllers/rentalController.js
const rentalController = {
  // جلب جميع التأجيرات// في backend/src/controllers/rentalController.js - دالة getAllRentals
getAllRentals: async (req, res) => {
  try {
    const { status, branch_id, limit = 20, date } = req.query;
    const user = req.user;
    
    console.log('🔍 [RENTALS] جلب التأجيرات:', {
      user: user.email,
      role: user.role,
      branch: user.branch_id,
      filters: { status, branch_id, limit, date }
    });
    
    let query = `
      SELECT 
        r.*, 
        g.name as game_name,
        g.image_url,
        g.price_per_hour,
        g.price_per_15min,
        u.name as employee_name,
        b.name as branch_name
      FROM rentals r
      JOIN games g ON r.game_id = g.id
      JOIN users u ON r.user_id = u.id
      JOIN branches b ON r.branch_id = b.id
      WHERE 1=1
    `;
    
    let params = [];
    
    // فلترة حسب الفرع للموظفين
    if (user.role !== 'admin' && user.branch_id) {
      query += ` AND r.branch_id = ?`;
      params.push(user.branch_id);
      console.log('🔧 [RENTALS] فلترة فرع الموظف:', user.branch_id);
    }
    
    // فلترة حسب الفرع للمدير
    if (branch_id && branch_id !== 'all' && user.role === 'admin') {
      query += ` AND r.branch_id = ?`;
      params.push(branch_id);
      console.log('🔧 [RENTALS] فلترة فرع محدد:', branch_id);
    }
    
    // فلترة حسب الحالة
    if (status && status !== 'all') {
      query += ` AND r.status = ?`;
      params.push(status);
      console.log('🔧 [RENTALS] فلترة حالة:', status);
    }
    
    // فلترة حسب التاريخ
    if (date) {
      query += ` AND DATE(r.start_time) = ?`;
      params.push(date);
      console.log('🔧 [RENTALS] فلترة تاريخ:', date);
    }
    
    query += ` ORDER BY r.start_time DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    console.log('🔍 [RENTALS] الاستعلام النهائي:', query);
    console.log('🔍 [RENTALS] المعلمات:', params);
    
    const [rentals] = await req.db.execute(query, params);
    
    console.log(`✅ [RENTALS] تم جلب ${rentals.length} تأجير`);
    
    res.json({
      success: true,
      data: rentals
    });
    
  } catch (error) {
    console.error('❌ [RENTALS] خطأ في جلب التأجيرات:', error);
    console.error('❌ [RENTALS] SQL Error:', error.sqlMessage);
    console.error('❌ [RENTALS] Stack Trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'تعذر تحميل التأجيرات',
      error: error.message,
      sqlError: error.sqlMessage
    });
  }
},

  // جلب تأجير معين
// في backend/src/controllers/rentalController.js - تعديل دالة getRentalById
getRentalById: async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    console.log('📥 جلب تأجير بمعلومات:', { id, user: user.email });
    
    const query = `
      SELECT 
        r.*, 
        g.name as game_name,
        g.image_url,
        g.price_per_hour,
        g.price_per_15min,
        u.name as employee_name,
        b.name as branch_name,
        b.location as branch_location
      FROM rentals r
      JOIN games g ON r.game_id = g.id
      JOIN users u ON r.user_id = u.id
      JOIN branches b ON r.branch_id = b.id
      WHERE r.id = ?
    `;
    
    console.log('🔍 استعلام جلب تأجير:', query, [id]);
    
    const [rentals] = await req.db.execute(query, [id]);
    
    if (rentals.length === 0) {
      console.log('❌ التأجير غير موجود:', id);
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود'
      });
    }
    
    const rental = rentals[0];
    
    // التحقق من الصلاحيات
    if (user.role !== 'admin' && user.branch_id !== rental.branch_id) {
      console.log('❌ صلاحيات غير كافية:', { 
        userBranch: user.branch_id, 
        rentalBranch: rental.branch_id 
      });
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذا التأجير'
      });
    }
    
    console.log('✅ تم جلب التأجير:', rental.rental_number);
    
    res.json({
      success: true,
      data: rental
    });
    
  } catch (error) {
    console.error('Get rental error:', error);
    res.status(500).json({
      success: false,
      message: 'تعذر تحميل التأجير',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
},


createRental: async (req, res) => {
  try {
    const user = req.user;
    
    // المدير لا يمكنه إنشاء تأجيرات
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'المدير لا يمكنه إنشاء تأجيرات جديدة'
      });
    }
    
    const { 
      customer_name, 
      customer_phone, 
      game_id, 
      branch_id,
      duration_minutes, 
      start_time,
      total_amount,
      deposit = 0,
      payment_method = 'كاش',
      status = 'نشط',
      notes = '',
      is_open_time = false,
      quantity = 1
    } = req.body;
    
    // التحقق من الحقول المطلوبة
    if (!customer_name || !customer_phone || !game_id || !total_amount) {
      return res.status(400).json({
        success: false,
        message: 'الحقول المطلوبة: اسم العميل، رقم الهاتف، اللعبة، المبلغ'
      });
    }
    
    console.log('📥 [RENTAL] بيانات التأجير المستلمة:', req.body);
    
    // استخدام branch_id من المستخدم إذا لم يتم إرسالها
    const finalBranchId = branch_id || user.branch_id;
    
    // التحقق من أن الموظف في نفس الفرع
    if (user.branch_id !== parseInt(finalBranchId)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالتأجير من هذا الفرع'
      });
    }
    
    // ⚠️ **تعديل هام:** إزالة التحقق من حالة اللعبة
    // نسمح بتأجير اللعبة أكثر من مرة
    const [games] = await req.db.execute(
      'SELECT * FROM games WHERE id = ?',
      [game_id]
    );
    
    if (games.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    
    // **ملاحظة:** لا نتحقق من حالة اللعبة (متاح/مؤجرة)
    // نسمح بتأجير نفس اللعبة أكثر من مرة
    
    // 1. البحث عن العميل أو إنشاؤه
    let customer_id;
    
    // البحث عن العميل برقم الهاتف
    const [existingCustomers] = await req.db.execute(
      'SELECT id FROM customers WHERE phone = ?',
      [customer_phone]
    );
    
    if (existingCustomers.length > 0) {
      // العميل موجود
      customer_id = existingCustomers[0].id;
      
      // تحديث اسم العميل إذا كان مختلفاً
      await req.db.execute(
        'UPDATE customers SET name = ? WHERE id = ?',
        [customer_name, customer_id]
      );
    } else {
      // إنشاء عميل جديد
      const [customerResult] = await req.db.execute(
        `INSERT INTO customers (name, phone) 
         VALUES (?, ?)`,
        [customer_name, customer_phone]
      );
      customer_id = customerResult.insertId;
      console.log('✅ [RENTAL] تم إنشاء عميل جديد:', customer_id);
    }
    
    // إنشاء رقم تأجير
    const rentalNumber = `RENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // تحديد وقت النهاية
    let expected_end_time = null;
    let actualDuration = duration_minutes || 0;
    
    if (actualDuration > 0 && !is_open_time) {
      const startTime = start_time ? new Date(start_time) : new Date();
      expected_end_time = new Date(startTime.getTime() + actualDuration * 60000);
    }
    
    // حساب السعر
    let finalTotalAmount = total_amount;
    if (!total_amount && game.price_per_hour && actualDuration > 0) {
      const hours = actualDuration / 60;
      finalTotalAmount = game.price_per_hour * hours;
    }
    
    console.log('📋 [RENTAL] تحضير البيانات للإدخال:', {
      rentalNumber,
      customer_id,
      game_id,
      finalBranchId,
      user_id: user.id,
      duration: actualDuration,
      total_amount: finalTotalAmount
    });
    
    // بدء التأجير
    const [result] = await req.db.execute(
      `INSERT INTO rentals 
       (rental_number, customer_id, customer_name, customer_phone, 
        game_id, branch_id, user_id, employee_name,
        duration_minutes, start_time, expected_end_time,
        total_amount, deposit, payment_method, status, 
        notes, is_open_time, quantity, price_per_hour) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rentalNumber,
        customer_id,
        customer_name,
        customer_phone,
        game_id,
        finalBranchId,
        user.id,
        user.name,
        actualDuration,
        start_time || new Date(),
        expected_end_time,
        finalTotalAmount,
        deposit,
        payment_method,
        status,
        notes,
        is_open_time ? 1 : 0,
        quantity,
        game.price_per_hour || 0
      ]
    );
    
    const rentalId = result.insertId;
    console.log('✅ [RENTAL] تم إدخال التأجير:', rentalId);
    
    // **تعديل هام:** لا نغير حالة اللعبة إلى "مؤجرة"
    // نتركها كما هي لتأجيرها أكثر من مرة
    // await req.db.execute(
    //   'UPDATE games SET status = "مؤجرة" WHERE id = ?',
    //   [game_id]
    // );
    
    // تسجيل النشاط
    await req.db.execute(
      `INSERT INTO activity_logs (user_id, action, details) 
       VALUES (?, ?, ?)`,
      [user.id, 'بدء تأجير', `بدء تأجير ${rentalNumber} للعبة ${game.name} - العميل: ${customer_name}`]
    );
    
    // جلب التأجير الجديد
    const [newRental] = await req.db.execute(
      `SELECT r.*, g.name as game_name, g.image_url, g.price_per_hour
       FROM rentals r
       JOIN games g ON r.game_id = g.id
       WHERE r.id = ?`,
      [rentalId]
    );
    
    console.log('✅ [RENTAL] التأجير النهائي:', newRental[0]);
    
    res.json({
      success: true,
      message: 'تم بدء التأجير بنجاح',
      rental_number: rentalNumber,
      data: newRental[0]
    });
    
  } catch (error) {
    console.error('❌ [RENTAL] خطأ في إنشاء التأجير:', error);
    console.error('❌ SQL Error:', error.sqlMessage);
    
    res.status(500).json({
      success: false,
      message: 'تعذر بدء التأجير',
      error: error.message,
      sqlError: error.sqlMessage
    });
  }
},



  // جلب التأجيرات النشطة
getActiveRentals: async (req, res) => {
  try {
    const user = req.user;
    const { branch_id } = req.query;
    
    console.log('⏱️ [ACTIVE RENTALS] جلب التأجيرات النشطة:', {
      user: user.email,
      branch: user.branch_id,
      requestedBranch: branch_id
    });
    
    let query = `
      SELECT 
        r.*, 
        g.name as game_name,
        g.image_url,
        g.price_per_hour,
        g.price_per_15min,
        u.name as employee_name,
        b.name as branch_name
      FROM rentals r
      JOIN games g ON r.game_id = g.id
      JOIN users u ON r.user_id = u.id
      JOIN branches b ON r.branch_id = b.id
      WHERE r.status = 'نشط'
    `;
    
    let params = [];
    
    // فلترة حسب الفرع
    if (user.role !== 'admin' && user.branch_id) {
      query += ` AND r.branch_id = ?`;
      params.push(user.branch_id);
    } else if (branch_id && branch_id !== 'all' && user.role === 'admin') {
      query += ` AND r.branch_id = ?`;
      params.push(branch_id);
    }
    
    query += ` ORDER BY r.start_time DESC`;
    
    console.log('🔍 [ACTIVE RENTALS] استعلام:', query);
    console.log('🔍 [ACTIVE RENTALS] معلمات:', params);
    
    const [rentals] = await req.db.execute(query, params);
    
    console.log(`✅ [ACTIVE RENTALS] تم جلب ${rentals.length} تأجير نشط`);
    
    res.json({
      success: true,
      data: rentals
    });
    
  } catch (error) {
    console.error('❌ [ACTIVE RENTALS] خطأ:', error);
    res.status(500).json({
      success: false,
      message: 'تعذر تحميل التأجيرات النشطة',
      error: error.message
    });
  }
},

  // جلب التأجيرات المكتملة
  getCompletedRentals: async (req, res) => {
    try {
      const user = req.user;
      const { branch_id, date } = req.query;
      
      console.log('✅ [COMPLETED RENTALS] جلب التأجيرات المكتملة:', {
        user: user.email,
        date,
        requestedBranch: branch_id
      });
      
      let query = `
        SELECT 
          r.*, 
          g.name as game_name,
          g.image_url,
          g.price_per_hour,
          g.price_per_15min,
          u.name as employee_name,
          b.name as branch_name
        FROM rentals r
        JOIN games g ON r.game_id = g.id
        JOIN users u ON r.user_id = u.id
        JOIN branches b ON r.branch_id = b.id
        WHERE r.status = 'مكتمل'
      `;
      
      let params = [];
      
      // فلترة حسب الفرع
      if (user.role !== 'admin' && user.branch_id) {
        query += ` AND r.branch_id = ?`;
        params.push(user.branch_id);
      } else if (branch_id && branch_id !== 'all' && user.role === 'admin') {
        query += ` AND r.branch_id = ?`;
        params.push(branch_id);
      }
      
      // فلترة حسب التاريخ
      if (date) {
        query += ` AND DATE(r.start_time) = ?`;
        params.push(date);
      }
      
      query += ` ORDER BY r.start_time DESC LIMIT 50`;
      
      console.log('🔍 [COMPLETED RENTALS] استعلام:', query);
      console.log('🔍 [COMPLETED RENTALS] معلمات:', params);
      
      const [rentals] = await req.db.execute(query, params);
      
      console.log(`✅ [COMPLETED RENTALS] تم جلب ${rentals.length} تأجير مكتمل`);
      
      res.json({
        success: true,
        data: rentals
      });
      
    } catch (error) {
      console.error('❌ [COMPLETED RENTALS] خطأ:', error);
      res.status(500).json({
        success: false,
        message: 'تعذر تحميل التأجيرات المكتملة',
        error: error.message
      });
    }
  },

  // تحديث التأجير (للمدير والموظفين)
  updateRental: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const updateData = req.body;
      
      // التحقق من أن التأجير موجود
      const [rentals] = await req.db.execute(
        'SELECT * FROM rentals WHERE id = ?',
        [id]
      );
      
      if (rentals.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'التأجير غير موجود'
        });
      }
      
      const rental = rentals[0];
      
      // التحقق من الصلاحيات
      if (user.role !== 'admin' && user.branch_id !== rental.branch_id) {
        return res.status(403).json({
          success: false,
          message: 'غير مصرح بتعديل هذا التأجير'
        });
      }
      
      // تحديث الحقول المسموح بها
      const allowedFields = ['notes', 'deposit_amount', 'payment_method'];
      const fields = [];
      const values = [];
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(updateData[field]);
        }
      });
      
      // تمديد التأجير
      if (updateData.extension_minutes) {
        const minutes = parseInt(updateData.extension_minutes);
        if (minutes > 0) {
          fields.push('duration_minutes = duration_minutes + ?');
          fields.push('expected_end_time = DATE_ADD(IFNULL(expected_end_time, NOW()), INTERVAL ? MINUTE)');
          values.push(minutes, minutes);
          
          // إعادة حساب السعر
          if (rental.price_per_hour) {
            const additionalAmount = (rental.price_per_hour / 60) * minutes;
            fields.push('total_amount = total_amount + ?');
            values.push(additionalAmount);
          }
        }
      }
      
      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'لا توجد بيانات للتحديث'
        });
      }
      
      values.push(id);
      
      const query = `UPDATE rentals SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
      
      await req.db.execute(query, values);
      
      // تسجيل النشاط
      await req.db.execute(
        `INSERT INTO activity_logs (user_id, action, details, ip_address) 
         VALUES (?, 'تحديث تأجير', ?, ?)`,
        [user.id, `تم تحديث التأجير ${rental.rental_number}`, req.ip]
      );
      
      res.json({
        success: true,
        message: 'تم تحديث التأجير بنجاح'
      });
      
    } catch (error) {
      console.error('Update rental error:', error);
      res.status(500).json({
        success: false,
        message: 'تعذر تحديث التأجير'
      });
    }
  },

  
endRental: async (req, res) => {
  console.log('🔥 [END RENTAL] === بدء دالة إنهاء التأجير ===');
  console.log('📥 بيانات الطلب:', {
    params: req.params,
    body: req.body,
    user: req.user ? { id: req.user.id, email: req.user.email } : 'لا يوجد مستخدم'
  });

  try {
    const { id } = req.params;
    const user = req.user;
    const { final_amount, actual_end_time } = req.body;

    if (!id || !user) {
      console.error('❌ بيانات ناقصة');
      return res.status(400).json({
        success: false,
        message: 'بيانات غير كافية'
      });
    }

    console.log('🔍 1. جلب بيانات التأجير...');
    
    // استعلام بسيط
    const query = 'SELECT * FROM rentals WHERE id = ?';
    console.log('📝 استعلام:', query, [id]);
    
    const [rentals] = await req.db.execute(query, [id]);
    
    console.log('📊 النتيجة:', {
      found: rentals.length > 0,
      rental_id: rentals[0]?.id,
      rental_number: rentals[0]?.rental_number,
      status: rentals[0]?.status
    });

    if (rentals.length === 0) {
      console.log('❌ التأجير غير موجود');
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود'
      });
    }

    const rental = rentals[0];

    // التحقق من الحالة
    if (rental.status !== 'نشط') {
      console.log(`⚠️ التأجير ليس نشط: ${rental.status}`);
      return res.status(400).json({
        success: false,
        message: `التأجير ليس نشط (حالة: ${rental.status})`
      });
    }

    // التحقق من الصلاحيات
    console.log('🔐 2. التحقق من الصلاحيات:', {
      userBranch: user.branch_id,
      rentalBranch: rental.branch_id,
      userRole: user.role
    });

    if (user.role !== 'admin' && user.branch_id !== rental.branch_id) {
      console.log('❌ صلاحيات غير كافية');
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بإكمال هذا التأجير'
      });
    }

    // استخدام القيم الافتراضية
    const finalAmount = final_amount !== undefined ? parseFloat(final_amount) : (rental.total_amount || 0);
    const endTime = actual_end_time || new Date();
    
    console.log('💰 3. بيانات التحديث:', {
      finalAmount,
      endTime,
      rental_id: id
    });

    // ⚡ **استعلام تحديث مبسط جداً**
    const updateQuery = `
      UPDATE rentals 
      SET status = 'مكتمل',
          actual_end_time = ?,
          updated_at = NOW()
      WHERE id = ?
    `;

    const updateParams = [endTime, id];
    
    console.log('⚡ 4. تنفيذ التحديث:', updateQuery, updateParams);
    
    const [result] = await req.db.execute(updateQuery, updateParams);
    
    console.log('✅ 5. نتيجة التحديث:', {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows
    });

    if (result.affectedRows === 0) {
      console.log('❌ لم يتم تحديث أي صفوف');
      return res.status(500).json({
        success: false,
        message: 'فشل تحديث التأجير'
      });
    }

    // تسجيل النشاط
    try {
      const activityQuery = `
        INSERT INTO activity_logs (user_id, action, details) 
        VALUES (?, ?, ?)
      `;
      
      await req.db.execute(activityQuery, [
        user.id,
        'إكمال تأجير',
        `إنهاء تأجير ${rental.rental_number || rental.id}`
      ]);
      
      console.log('📝 تم تسجيل النشاط');
    } catch (logError) {
      console.warn('⚠️ خطأ غير حرج في تسجيل النشاط:', logError.message);
    }

    console.log(`🎉 6. تم إنهاء التأجير ${rental.rental_number || id} بنجاح!`);
    
    res.json({
      success: true,
      message: 'تم إكمال التأجير بنجاح',
      data: {
        rental_number: rental.rental_number,
        amount: finalAmount,
        end_time: endTime
      }
    });

  } catch (error) {
    console.error('🔥🔥🔥 خطأ حرج:', error);
    console.error('📌 نوع الخطأ:', error.name);
    console.error('📌 رسالة الخطأ:', error.message);
    console.error('📌 SQL Error:', error.sqlMessage || 'لا يوجد');
    console.error('📌 كود الخطأ:', error.code);
    
    // خطأ SQL محدد
    if (error.sqlMessage) {
      console.error('🔍 خطأ SQL مفصل:', {
        message: error.sqlMessage,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      });
    }

    res.status(500).json({
      success: false,
      message: 'تعذر إكمال التأجير',
      debug: {
        error: error.message,
        sqlError: error.sqlMessage,
        code: error.code
      }
    });
  } finally {
    console.log('🔥 [END RENTAL] === نهاية دالة إنهاء التأجير ===');
  }
},



  // إلغاء التأجير
  cancelRental: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // التحقق من أن التأجير موجود ونشط
      const [rentals] = await req.db.execute(
        'SELECT * FROM rentals WHERE id = ? AND status = "نشط"',
        [id]
      );
      
      if (rentals.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'التأجير غير موجود أو غير نشط'
        });
      }
      
      const rental = rentals[0];
      
      // التحقق من الصلاحيات
      if (user.role !== 'admin' && user.branch_id !== rental.branch_id) {
        return res.status(403).json({
          success: false,
          message: 'غير مصرح بإلغاء هذا التأجير'
        });
      }
      
      // إلغاء التأجير
      const [result] = await req.db.execute(
        `UPDATE rentals 
         SET status = 'ملغي',
             updated_at = NOW()
         WHERE id = ?`,
        [id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'التأجير غير موجود'
        });
      }
      
      // تحديث حالة اللعبة
      await req.db.execute(
        'UPDATE games SET status = "متاح" WHERE id = ?',
        [rental.game_id]
      );
      
      // تسجيل النشاط
      await req.db.execute(
        `INSERT INTO activity_logs (user_id, action, details, ip_address) 
         VALUES (?, 'إلغاء تأجير', ?, ?)`,
        [user.id, `إلغاء التأجير ${rental.rental_number}`, req.ip]
      );
      
      res.json({
        success: true,
        message: 'تم إلغاء التأجير بنجاح'
      });
      
    } catch (error) {
      console.error('Cancel rental error:', error);
      res.status(500).json({
        success: false,
        message: 'تعذر إلغاء التأجير'
      });
    }
  },



fixRental: async (req, res) => {
  try {
    const { rental_id } = req.body;
    
    if (!rental_id) {
      return res.status(400).json({
        success: false,
        message: 'رقم التأجير مطلوب'
      });
    }
    
    // تحديث حالة اللعبة
    const [result] = await req.db.execute(
      `UPDATE games g
       JOIN rentals r ON g.id = r.game_id
       SET g.status = 'متاح'
       WHERE r.id = ? AND r.status = 'مكتمل'`,
      [rental_id]
    );
    
    res.json({
      success: true,
      message: 'تم إصلاح التأجير'
    });
    
  } catch (error) {
    console.error('Fix rental error:', error);
    res.status(500).json({
      success: false,
      message: 'تعذر إصلاح التأجير'
    });
  }
}

};

module.exports = rentalController;