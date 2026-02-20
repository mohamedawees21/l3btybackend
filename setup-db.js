// backend/setup-db.js
const { sequelize } = require('./src/config/database');
const Branch = require('./src/models/Branch');
const Game = require('./src/models/Game');
const User = require('./src/models/User');
const Pricing = require('./src/models/Pricing');

const setupDatabase = async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('Database synced successfully');
    
    // إضافة الفروع
    const branches = await Branch.bulkCreate([
      { name: 'غازي مول', location: 'الرياض', is_active: true },
      { name: 'سكوير مول', location: 'الرياض', is_active: true },
      { name: 'زمزم مول', location: 'الرياض', is_active: true },
      { name: 'نادي اكتوبر', location: 'الرياض', is_active: true },
      { name: 'نادي الجزيرة', location: 'الرياض', is_active: true }
    ]);
    
    // إضافة الألعاب
    const games = await Game.bulkCreate([
      { name: 'دريفت كار', category: 'CARS', image_url: 'drift-car.jpg' },
      { name: 'هافر بورد', category: 'ELECTRIC', image_url: 'hoverboard.jpg' },
      { name: 'موتسكل كهربائي', category: 'ELECTRIC', image_url: 'electric-bike.jpg' },
      { name: 'عربيه كهربائيه', category: 'CARS', image_url: 'electric-car.jpg' },
      { name: 'سكوتر كهربائي', category: 'ELECTRIC', image_url: 'electric-scooter.jpg' },
      { name: 'هارلي', category: 'MOTORCYCLE', image_url: 'harley.jpg' },
      { name: 'سيجواي', category: 'ELECTRIC', image_url: 'segway.jpg' },
      { name: 'كريزي كار', category: 'CARS', image_url: 'crazy-car.jpg' }
    ]);
    
    console.log('Database setup completed successfully!');
    console.log(`Added ${branches.length} branches and ${games.length} games`);
    
  } catch (error) {
    console.error('Error setting up database:', error);
  }
};

setupDatabase();