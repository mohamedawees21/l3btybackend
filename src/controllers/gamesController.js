const db = require('../config/database');
const imageProcessingService = require('../services/imageProcessingService');

// 🔹 دالة مساعدة للتحقق من البيانات
const validateGameData = (data) => {
    const { name, branch_id, price_per_15min } = data;
    
    if (!name || !branch_id || !price_per_15min) {
        return 'الرجاء إدخال جميع البيانات المطلوبة';
    }
    
    if (typeof name !== 'string' || name.trim().length === 0) {
        return 'اسم اللعبة غير صحيح';
    }
    
    if (isNaN(parseFloat(price_per_15min)) || parseFloat(price_per_15min) <= 0) {
        return 'السعر يجب أن يكون رقمًا أكبر من الصفر';
    }
    
    return null;
};

// 🔹 إضافة لعبة جديدة مع معالجة الصور الفورية
exports.createGameWithImage = async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            branch_id,
            price_per_15min,
            status = 'متاح',
            image_url: customImageUrl,
            external_image_url
        } = req.body;

        // 🔹 التحقق من البيانات باستخدام الدالة المساعدة
        const validationError = validateGameData({ name, branch_id, price_per_15min });
        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        // 🔹 تنظيف البيانات
        const cleanName = name?.trim() || '';
        const cleanDescription = description?.trim() || '';
        const cleanCategory = category?.trim() || 'عام';

        console.log(`➕ إضافة لعبة جديدة: ${cleanName}`);

        // 🔹 إضافة اللعبة أولاً
        const [result] = await db.query(`
            INSERT INTO games 
            (name, description, category, branch_id, price_per_15min, status, 
             created_at, updated_at, image_status)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 'pending')
        `, [cleanName, cleanDescription, cleanCategory, branch_id, price_per_15min, status]);

        const gameId = result.insertId;

        // 🔹 معالجة الصورة في الخلفية (دون انتظار)
        process.nextTick(async () => {
            try {
                console.log(`🖼️ بدء معالجة صورة للعبة: ${cleanName}`);
                
                const processedImage = await imageProcessingService.processGameImage(
                    cleanName,
                    cleanCategory,
                    external_image_url || customImageUrl
                );

                await db.query(`
                    UPDATE games 
                    SET image_url = ?,
                        thumbnail_url = ?,
                        external_image_url = ?,
                        image_status = ?,
                        image_uploaded_at = NOW()
                    WHERE id = ?
                `, [
                    processedImage.image_url || '/images/default-game.jpg',
                    processedImage.thumbnail_url || '/images/default-game.jpg',
                    external_image_url || customImageUrl || null,
                    processedImage.image_status || 'completed',
                    gameId
                ]);

                console.log(`✅ تمت معالجة صورة اللعبة ${cleanName} (ID: ${gameId})`);

            } catch (error) {
                console.error(`❌ خطأ في معالجة صورة اللعبة ${gameId}:`, error);
                
                // استخدام الصورة الافتراضية في حالة الخطأ
                await db.query(`
                    UPDATE games 
                    SET image_url = '/images/default-game.jpg',
                        thumbnail_url = '/images/default-game.jpg',
                        image_status = 'failed',
                        image_error = ?
                    WHERE id = ?
                `, [error.message.substring(0, 200), gameId]);
            }
        });

        // 🔹 إرجاع استجابة فورية
        return res.status(201).json({
            success: true,
            message: 'تمت إضافة اللعبة بنجاح',
            data: {
                id: gameId,
                name: cleanName,
                description: cleanDescription,
                category: cleanCategory,
                branch_id,
                price_per_15min,
                status,
                image_url: '/images/default-game.jpg',
                thumbnail_url: '/images/default-game.jpg',
                image_status: 'processing'
            }
        });

    } catch (error) {
        console.error('❌ خطأ في إضافة لعبة:', error);
        return res.status(500).json({
            success: false,
            message: 'فشل إضافة اللعبة',
            error: error.message
        });
    }
};

// 🔹 جلب ألعاب الفرع مع الصور (محسّن)
exports.getBranchGames = async (req, res) => {
    try {
        const { branch_id } = req.params;
        
        // 🔹 التحقق من branch_id
        if (!branch_id || isNaN(branch_id)) {
            return res.status(400).json({
                success: false,
                message: 'رقم الفرع غير صحيح'
            });
        }

        console.log(`📥 جلب ألعاب الفرع: ${branch_id}`);

        const [games] = await db.query(`
            SELECT 
                g.id,
                g.name,
                g.description,
                g.category,
                g.price_per_15min,
                g.status,
                g.image_url,
                g.thumbnail_url,
                g.external_image_url,
                g.image_status,
                g.image_uploaded_at,
                g.created_at,
                g.updated_at,
                b.name as branch_name,
                -- 🔹 تحديد الصورة للعرض
                CASE 
                    WHEN g.image_status = 'completed' AND g.image_url IS NOT NULL 
                    THEN 
                        CASE 
                            WHEN g.image_url LIKE 'http%' THEN g.image_url
                            WHEN g.image_url LIKE '/%' THEN g.image_url
                            ELSE CONCAT('/images/', g.image_url)
                        END
                    ELSE '/images/default-game.jpg'
                END as display_image,
                
                -- 🔹 تحديد الثومبنيال
                CASE 
                    WHEN g.thumbnail_url IS NOT NULL 
                    THEN 
                        CASE 
                            WHEN g.thumbnail_url LIKE 'http%' THEN g.thumbnail_url
                            WHEN g.thumbnail_url LIKE '/%' THEN g.thumbnail_url
                            ELSE CONCAT('/images/', g.thumbnail_url)
                        END
                    WHEN g.image_url IS NOT NULL 
                    THEN 
                        CASE 
                            WHEN g.image_url LIKE 'http%' THEN g.image_url
                            WHEN g.image_url LIKE '/%' THEN g.image_url
                            ELSE CONCAT('/images/', g.image_url)
                        END
                    ELSE '/images/default-game.jpg'
                END as display_thumbnail
                
            FROM games g
            LEFT JOIN branches b ON g.branch_id = b.id
            WHERE g.branch_id = ? AND g.is_active = 1
            ORDER BY g.created_at DESC
        `, [branch_id]);

        // 🔹 تحسين البيانات قبل الإرسال
        const enhancedGames = Array.isArray(games) ? games.map(game => ({
            id: game.id,
            name: game.name || 'غير معروف',
            description: game.description || '',
            category: game.category || 'عام',
            price_per_15min: parseFloat(game.price_per_15min) || 100,
            status: game.status || 'متاح',
            image_url: game.image_url,
            display_image: game.display_image || '/images/default-game.jpg',
            display_thumbnail: game.display_thumbnail || '/images/default-game.jpg',
            image_status: game.image_status || 'completed',
            branch_name: game.branch_name || 'غير محدد',
            created_at: game.created_at,
            updated_at: game.updated_at
        })) : [];

        console.log(`✅ تم جلب ${enhancedGames.length} لعبة للفرع ${branch_id}`);

        return res.json({
            success: true,
            data: enhancedGames,
            count: enhancedGames.length,
            message: enhancedGames.length === 0 ? 'لا توجد ألعاب في هذا الفرع' : null
        });

    } catch (error) {
        console.error('❌ خطأ في جلب ألعاب الفرع:', error);
        return res.status(500).json({
            success: false,
            message: 'فشل جلب الألعاب',
            error: error.message
        });
    }
};

// 🔹 جلب لعبة محددة مع صورها
exports.getGameById = async (req, res) => {
    try {
        const { game_id } = req.params;
        
        if (!game_id || isNaN(game_id)) {
            return res.status(400).json({
                success: false,
                message: 'رقم اللعبة غير صحيح'
            });
        }

        const [games] = await db.query(`
            SELECT 
                g.*,
                b.name as branch_name,
                -- 🔹 تحديد الصورة للعرض
                COALESCE(
                    CASE 
                        WHEN g.image_status = 'completed' AND g.image_url IS NOT NULL 
                        THEN 
                            CASE 
                                WHEN g.image_url LIKE 'http%' THEN g.image_url
                                WHEN g.image_url LIKE '/%' THEN g.image_url
                                ELSE CONCAT('/images/', g.image_url)
                            END
                        ELSE NULL
                    END,
                    '/images/default-game.jpg'
                ) as display_image
            FROM games g
            LEFT JOIN branches b ON g.branch_id = b.id
            WHERE g.id = ? AND g.is_active = 1
        `, [game_id]);

        if (games.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'اللعبة غير موجودة'
            });
        }

        const game = games[0];
        
        // 🔹 تحسين البيانات
        const enhancedGame = {
            id: game.id,
            name: game.name || 'غير معروف',
            description: game.description || '',
            category: game.category || 'عام',
            price_per_15min: parseFloat(game.price_per_15min) || 100,
            status: game.status || 'متاح',
            image_url: game.image_url,
            display_image: game.display_image || '/images/default-game.jpg',
            image_status: game.image_status || 'completed',
            branch_id: game.branch_id,
            branch_name: game.branch_name,
            created_at: game.created_at,
            updated_at: game.updated_at
        };

        return res.json({
            success: true,
            data: enhancedGame
        });

    } catch (error) {
        console.error(`❌ خطأ في جلب اللعبة ${game_id}:`, error);
        return res.status(500).json({
            success: false,
            message: 'فشل جلب بيانات اللعبة',
            error: error.message
        });
    }
};

// 🔹 معالجة الصور لألعاب محددة
exports.processGamesImages = async (req, res) => {
    try {
        const { game_ids } = req.body;
        
        // 🔹 التحقق من البيانات
        if (!game_ids || !Array.isArray(game_ids)) {
            return res.status(400).json({
                success: false,
                message: 'الرجاء إرسال مصفوفة من معرفات الألعاب'
            });
        }

        // 🔹 تصفية المعرفات الصحيحة
        const validGameIds = game_ids
            .map(id => parseInt(id))
            .filter(id => !isNaN(id) && id > 0)
            .slice(0, 50); // 🔹 تحديد حد أقصى

        if (validGameIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'لا توجد معرفات ألعاب صحيحة'
            });
        }

        console.log(`🖼️ بدء معالجة ${validGameIds.length} صورة`);

        // 🔹 بدء المعالجة في الخلفية
        process.nextTick(async () => {
            try {
                await imageProcessingService.processBulkGameImages(validGameIds);
                console.log(`✅ تمت معالجة ${validGameIds.length} صورة`);
            } catch (error) {
                console.error('❌ خطأ في المعالجة الجماعية:', error);
            }
        });

        return res.json({
            success: true,
            message: `بدأت معالجة ${validGameIds.length} صورة`,
            processing_count: validGameIds.length
        });

    } catch (error) {
        console.error('❌ خطأ في معالجة صور الألعاب:', error);
        return res.status(500).json({
            success: false,
            message: 'فشل معالجة الصور',
            error: error.message
        });
    }
};

// 🔹 جلب صورة لعبة محددة
exports.getGameImage = async (req, res) => {
    try {
        const { game_id } = req.params;
        
        if (!game_id || isNaN(game_id)) {
            return res.status(400).json({
                success: false,
                message: 'رقم اللعبة غير صحيح'
            });
        }

        const imageData = await imageProcessingService.getGameImage(game_id);
        
        return res.json({
            success: true,
            data: imageData
        });

    } catch (error) {
        console.error(`❌ خطأ في جلب صورة اللعبة ${game_id}:`, error);
        return res.status(500).json({
            success: false,
            message: 'فشل جلب الصورة',
            error: error.message
        });
    }
};

// 🔹 تحديث صورة لعبة
exports.updateGameImage = async (req, res) => {
    try {
        const { game_id } = req.params;
        const { image_url, external_image_url } = req.body;
        
        if (!game_id || isNaN(game_id)) {
            return res.status(400).json({
                success: false,
                message: 'رقم اللعبة غير صحيح'
            });
        }

        // 🔹 تحديث حالة الصورة
        await db.query(`
            UPDATE games 
            SET image_status = 'pending',
                updated_at = NOW()
            WHERE id = ?
        `, [game_id]);

        // 🔹 معالجة الصورة في الخلفية
        process.nextTick(async () => {
            try {
                // 🔹 جلب بيانات اللعبة
                const [games] = await db.query(`
                    SELECT name, category 
                    FROM games 
                    WHERE id = ?
                `, [game_id]);

                if (games.length > 0) {
                    const game = games[0];
                    const processedImage = await imageProcessingService.processGameImage(
                        game.name,
                        game.category,
                        external_image_url || image_url
                    );

                    await db.query(`
                        UPDATE games 
                        SET image_url = ?,
                            thumbnail_url = ?,
                            external_image_url = ?,
                            image_status = ?,
                            image_uploaded_at = NOW()
                        WHERE id = ?
                    `, [
                        processedImage.image_url || '/images/default-game.jpg',
                        processedImage.thumbnail_url || '/images/default-game.jpg',
                        external_image_url || image_url || null,
                        processedImage.image_status || 'completed',
                        game_id
                    ]);

                    console.log(`✅ تم تحديث صورة اللعبة ${game_id}`);
                }
            } catch (error) {
                console.error(`❌ خطأ في تحديث صورة اللعبة ${game_id}:`, error);
            }
        });

        return res.json({
            success: true,
            message: 'بدأت عملية تحديث الصورة'
        });

    } catch (error) {
        console.error(`❌ خطأ في تحديث صورة اللعبة:`, error);
        return res.status(500).json({
            success: false,
            message: 'فشل تحديث الصورة',
            error: error.message
        });
    }
};