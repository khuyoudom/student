const { Sequelize } = require("sequelize");

const dialect = process.env.DB_DIALECT || "sqlite";

const sequelize =
  dialect === "mysql"
    ? new Sequelize(
        process.env.DB_NAME || "dynamics_node",
        process.env.DB_USER || "root",
        process.env.DB_PASSWORD || "",
        {
          host: process.env.DB_HOST || "127.0.0.1",
          port: Number(process.env.DB_PORT || 3306),
          dialect: "mysql",
          logging: false
        }
      )
    : new Sequelize({
        dialect: "sqlite",
        storage: process.env.DB_STORAGE || "database.sqlite",
        logging: false
      });

module.exports = sequelize;
