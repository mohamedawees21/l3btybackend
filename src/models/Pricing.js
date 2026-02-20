// backend/src/models/Pricing.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Branch = require('./Branch');
const Game = require('./Game');

const Pricing = sequelize.define('Pricing', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  game_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  price_per_hour: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  price_per_15min: {
    type: DataTypes.DECIMAL(10, 2)
  },
  deposit_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'pricing',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['branch_id', 'game_id']
    }
  ]
});

// العلاقات
Pricing.belongsTo(Branch, { foreignKey: 'branch_id' });
Pricing.belongsTo(Game, { foreignKey: 'game_id' });
Branch.hasMany(Pricing, { foreignKey: 'branch_id' });
Game.hasMany(Pricing, { foreignKey: 'game_id' });

module.exports = Pricing;