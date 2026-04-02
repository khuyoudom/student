const sequelize = require("../config/database");

const User = require("./User")(sequelize);
const Category = require("./Category")(sequelize);
const Product = require("./Product")(sequelize);
const Order = require("./Order")(sequelize);

Category.hasMany(Product, { foreignKey: "category_id", as: "products" });
Product.belongsTo(Category, { foreignKey: "category_id", as: "category" });

User.hasMany(Order, { foreignKey: "user_id", as: "orders" });
Order.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Order
};
