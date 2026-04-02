const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Order",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      total_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("pending", "paid", "cancelled"),
        allowNull: false,
        defaultValue: "pending"
      }
    },
    {
      underscored: true,
      createdAt: "created_at",
      updatedAt: false
    }
  );
