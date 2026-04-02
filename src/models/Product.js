const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Product",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      image: { type: DataTypes.STRING, allowNull: true }
    },
    {
      underscored: true,
      createdAt: "created_at",
      updatedAt: false
    }
  );
