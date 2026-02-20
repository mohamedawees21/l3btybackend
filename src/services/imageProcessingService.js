const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

class ImageProcessingService {
    constructor() {
        this.imagesDir = path.join(__dirname, '../../public/images');
        this.cache = new Map();
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(this.imagesDir, { recursive: true });
            await fs.mkdir(path.join(this.imagesDir, 'thumbnails'), { recursive: true });
            await fs.mkdir(path.join(this.imagesDir, 'processed'), { recursive: true });
            console.log('📁 مجلدات الصور جاهزة');
        } catch (error) {
            console.error('❌ خطأ في إنشاء مجلدات الصور:', error);
        }
    }

    async processGameImage(gameName, gameCategory, externalUrl = null) {
        try {
            console.log(`🔍 معالجة صورة للعبة: ${gameName}`);
            
            // 1. البحث عن صورة افتراضية مطابقة
            const defaultImage = await this.findDefaultImage(gameName, gameCategory);
            if (defaultImage) {
                console.log(`✅ تم العثور على صورة افتراضية: ${defaultImage.image_url}`);
                return {
                    image_url: defaultImage.image_url,
                    thumbnail_url: defaultImage.thumbnail_url || defaultImage.image_url,
                    external_image_url: defaultImage.external_url,
                    image_status: 'completed'
                };
            }

            // 2. محاولة جلب الصورة من الرابط الخارجي
            if (externalUrl) {
                try {
                    const processedImage = await this.downloadAndProcessImage(gameName, externalUrl);
                    if (processedImage) {
                        return processedImage;
                    }
                } catch (error) {
                    console.warn(`⚠️ فشل جلب الصورة من الرابط الخارجي: ${error.message}`);
                }
            }

            // 3. استخدام الصورة الافتراضية
            console.log(`🔄 استخدام الصورة الافتراضية للعبة: ${gameName}`);
            return {
                image_url: '/images/default-game.jpg',
                thumbnail_url: '/images/default-game.jpg',
                external_image_url: externalUrl,
                image_status: 'completed'
            };

        } catch (error) {
            console.error(`❌ خطأ في معالجة صورة اللعبة ${gameName}:`, error);
            return {
                image_url: '/images/default-game.jpg',
                thumbnail_url: '/images/default-game.jpg',
                external_image_url: externalUrl,
                image_status: 'failed'
            };
        }
    }

    async findDefaultImage(gameName, gameCategory) {
        try {
            const cacheKey = `${gameName}-${gameCategory}`;
            
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // البحث في قاعدة البيانات
            const db = require('../config/database');
            
            // البحث بالاسم الدقيق
            let query = `
                SELECT * FROM default_game_images 
                WHERE game_name = ? AND is_active = 1
                LIMIT 1
            `;
            
            const [exactMatch] = await db.query(query, [gameName]);
            
            if (exactMatch.length > 0) {
                this.cache.set(cacheKey, exactMatch[0]);
                return exactMatch[0];
            }

            // البحث بجزء من الاسم
            query = `
                SELECT * FROM default_game_images 
                WHERE ? LIKE CONCAT('%', game_name, '%') 
                AND is_active = 1
                LIMIT 1
            `;
            
            const [partialMatch] = await db.query(query, [gameName]);
            
            if (partialMatch.length > 0) {
                this.cache.set(cacheKey, partialMatch[0]);
                return partialMatch[0];
            }

            // البحث بالتصنيف
            if (gameCategory) {
                query = `
                    SELECT * FROM default_game_images 
                    WHERE game_category = ? 
                    AND is_active = 1
                    LIMIT 1
                `;
                
                const [categoryMatch] = await db.query(query, [gameCategory]);
                
                if (categoryMatch.length > 0) {
                    this.cache.set(cacheKey, categoryMatch[0]);
                    return categoryMatch[0];
                }
            }

            return null;
            
        } catch (error) {
            console.error('❌ خطأ في البحث عن الصورة الافتراضية:', error);
            return null;
        }
    }

    async downloadAndProcessImage(gameName, imageUrl) {
        try {
            console.log(`⬇️  تحميل الصورة من: ${imageUrl}`);
            
            // إنشاء اسم فريد للصورة
            const imageHash = crypto.createHash('md5').update(`${gameName}-${Date.now()}`).digest('hex');
            const imageFileName = `${imageHash}.jpg`;
            const imagePath = path.join(this.imagesDir, 'processed', imageFileName);
            const thumbnailPath = path.join(this.imagesDir, 'thumbnails', imageFileName);
            
            // تحميل الصورة
            const response = await axios({
                method: 'GET',
                url: imageUrl,
                responseType: 'stream',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // حفظ الصورة الأصلية
            await pipeline(response.data, fs.createWriteStream(imagePath));
            console.log(`✅ تم حفظ الصورة في: ${imagePath}`);

            // إنشاء ثومبنيال
            await sharp(imagePath)
                .resize(300, 300, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 80 })
                .toFile(thumbnailPath);

            console.log(`✅ تم إنشاء الثومبنيال في: ${thumbnailPath}`);

            return {
                image_url: `/images/processed/${imageFileName}`,
                thumbnail_url: `/images/thumbnails/${imageFileName}`,
                external_image_url: imageUrl,
                image_status: 'completed',
                image_hash: imageHash
            };

        } catch (error) {
            console.error(`❌ خطأ في تحميل الصورة: ${error.message}`);
            return null;
        }
    }

    async processBulkGameImages(gameIds) {
        try {
            const db = require('../config/database');
            
            for (const gameId of gameIds) {
                try {
                    // الحصول على بيانات اللعبة
                    const [games] = await db.query(`
                        SELECT id, name, category, image_url, external_image_url 
                        FROM games 
                        WHERE id = ? AND (image_url IS NULL OR image_status != 'completed')
                    `, [gameId]);
                    
                    if (games.length === 0) continue;
                    
                    const game = games[0];
                    
                    // معالجة الصورة
                    const processedImage = await this.processGameImage(
                        game.name,
                        game.category,
                        game.external_image_url
                    );
                    
                    // تحديث قاعدة البيانات
                    await db.query(`
                        UPDATE games 
                        SET image_url = ?,
                            thumbnail_url = ?,
                            external_image_url = ?,
                            image_status = ?,
                            image_hash = ?,
                            image_uploaded_at = NOW()
                        WHERE id = ?
                    `, [
                        processedImage.image_url,
                        processedImage.thumbnail_url,
                        processedImage.external_image_url,
                        processedImage.image_status,
                        processedImage.image_hash || null,
                        gameId
                    ]);
                    
                    console.log(`✅ تمت معالجة صورة اللعبة ${game.name} (ID: ${gameId})`);
                    
                } catch (error) {
                    console.error(`❌ خطأ في معالجة صورة اللعبة ${gameId}:`, error);
                }
            }
            
            return { success: true, message: 'تمت معالجة جميع الصور' };
            
        } catch (error) {
            console.error('❌ خطأ في معالجة الصور المجمعة:', error);
            return { success: false, error: error.message };
        }
    }

    async getGameImage(gameId) {
        try {
            const db = require('../config/database');
            
            const [games] = await db.query(`
                SELECT id, name, image_url, thumbnail_url, image_status
                FROM games 
                WHERE id = ?
            `, [gameId]);
            
            if (games.length === 0) {
                return {
                    image_url: '/images/default-game.jpg',
                    thumbnail_url: '/images/default-game.jpg'
                };
            }
            
            const game = games[0];
            
            // إذا كانت الصورة غير مكتملة، حاول معالجتها
            if (game.image_status !== 'completed' || !game.image_url) {
                const processedImage = await this.processGameImage(game.name, game.category);
                
                // تحديث قاعدة البيانات
                await db.query(`
                    UPDATE games 
                    SET image_url = ?,
                        thumbnail_url = ?,
                        image_status = ?
                    WHERE id = ?
                `, [
                    processedImage.image_url,
                    processedImage.thumbnail_url,
                    processedImage.image_status,
                    gameId
                ]);
                
                return processedImage;
            }
            
            return {
                image_url: game.image_url || '/images/default-game.jpg',
                thumbnail_url: game.thumbnail_url || game.image_url || '/images/default-game.jpg',
                image_status: game.image_status
            };
            
        } catch (error) {
            console.error(`❌ خطأ في جلب صورة اللعبة ${gameId}:`, error);
            return {
                image_url: '/images/default-game.jpg',
                thumbnail_url: '/images/default-game.jpg',
                image_status: 'failed'
            };
        }
    }
}

module.exports = new ImageProcessingService();