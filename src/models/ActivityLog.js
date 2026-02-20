const { DataTypes } = require('sequelize');

const ActivityLog = (sequelize) => {
  return sequelize.define('ActivityLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    user_role: {
      type: DataTypes.STRING,
      allowNull: false
    },
    action_type: {
      type: DataTypes.ENUM('login', 'logout', 'create', 'update', 'delete', 'view'),
      allowNull: false
    },
    entity_type: {
      type: DataTypes.ENUM('game', 'branch', 'rental', 'user', 'system'),
      allowNull: false
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    entity_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'activity_logs',
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['action_type'] },
      { fields: ['entity_type'] },
      { fields: ['created_at'] }
    ]
  });
};

module.exports = ActivityLog;