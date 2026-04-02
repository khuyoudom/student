const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const upload = require("../middleware/upload");
const { ensureAuth, ensureAdmin } = require("../middleware/auth");
const { getDb, toObjectId } = require("../config/mongodb");

function getValidationErrors(req) {
  const errors = validationResult(req);
  return errors.isEmpty() ? [] : errors.array().map((item) => item.msg);
}

function normalizeId(doc) {
  if (!doc) return null;
  return {
    ...doc,
    id: doc._id.toString()
  };
}

function toCategoryMap(categories) {
  const map = new Map();
  categories.forEach((item) => {
    map.set(item._id.toString(), item);
  });
  return map;
}

async function getDashboardStats(db) {
  const [users, products, categories, orders] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("products").countDocuments(),
    db.collection("categories").countDocuments(),
    db.collection("orders").countDocuments()
  ]);

  const grouped = await db
    .collection("orders")
    .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    .toArray();

  const ordersByStatus = grouped.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  return { users, products, categories, orders, ordersByStatus };
}

module.exports = function webRoutes(router) {
  router.get("/", async (_req, res) => {
    const db = getDb();
    const [products, categories] = await Promise.all([
      db.collection("products").find({}).sort({ created_at: -1 }).limit(6).toArray(),
      db.collection("categories").find({}).toArray()
    ]);

    const categoryMap = toCategoryMap(categories);
    const featuredProducts = products.map((item) => {
      const category = item.category_id ? categoryMap.get(item.category_id.toString()) : null;
      return normalizeId({ ...item, category });
    });

    return res.render("home", {
      title: "Home",
      featuredProducts
    });
  });

  router.get("/products", async (req, res) => {
    const db = getDb();
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = 8;
    const offset = (page - 1) * limit;

    const q = (req.query.q || "").trim();
    const categoryId = req.query.category || "";

    const filter = {};
    if (q) {
      filter.$or = [{ title: { $regex: q, $options: "i" } }, { description: { $regex: q, $options: "i" } }];
    }

    const categoryObjectId = toObjectId(categoryId);
    if (categoryId && categoryObjectId) {
      filter.category_id = categoryObjectId;
    }

    const [productsRaw, total, categories] = await Promise.all([
      db.collection("products").find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).toArray(),
      db.collection("products").countDocuments(filter),
      db.collection("categories").find({}).sort({ name: 1 }).toArray()
    ]);

    const categoryMap = toCategoryMap(categories);
    const products = productsRaw.map((item) => {
      const category = item.category_id ? categoryMap.get(item.category_id.toString()) : null;
      return normalizeId({ ...item, category });
    });

    return res.render("products", {
      title: "Products",
      products,
      categories: categories.map((item) => normalizeId(item)),
      total,
      page,
      pageCount: Math.max(Math.ceil(total / limit), 1),
      q,
      categoryId
    });
  });

  router.get("/products/:id", async (req, res) => {
    const db = getDb();
    const productId = toObjectId(req.params.id);
    if (!productId) {
      return res.status(404).render("error", { title: "Not Found", message: "Product not found" });
    }

    const product = await db.collection("products").findOne({ _id: productId });
    if (!product) {
      return res.status(404).render("error", { title: "Not Found", message: "Product not found" });
    }

    const category = product.category_id
      ? await db.collection("categories").findOne({ _id: product.category_id })
      : null;

    return res.render("product-detail", {
      title: product.title,
      product: normalizeId({ ...product, category: normalizeId(category) })
    });
  });

  router.post("/orders", ensureAuth, async (req, res) => {
    const db = getDb();
    const totalPrice = Number(req.body.total_price || 0);
    const productId = req.body.productId ? toObjectId(req.body.productId) : null;

    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      return res.status(400).render("error", {
        title: "Invalid Order",
        message: "Invalid product price."
      });
    }

    const isFreeContent = totalPrice === 0;
    const orderData = {
      user_id: toObjectId(req.session.user.id),
      total_price: totalPrice,
      status: isFreeContent ? "completed" : "pending",
      created_at: new Date()
    };

    if (productId) {
      orderData.product_id = productId;
    }

    await db.collection("orders").insertOne(orderData);

    return res.redirect("/orders");
  });

  router.get("/orders", ensureAuth, async (req, res) => {
    const db = getDb();
    const filter = req.session.user.role === "admin" ? {} : { user_id: toObjectId(req.session.user.id) };
    const [orders, users] = await Promise.all([
      db.collection("orders").find(filter).sort({ created_at: -1 }).toArray(),
      db.collection("users").find({}, { projection: { password: 0 } }).toArray()
    ]);

    const userMap = new Map(users.map((item) => [item._id.toString(), normalizeId(item)]));
    const resolvedOrders = orders.map((item) =>
      normalizeId({
        ...item,
        user: item.user_id ? userMap.get(item.user_id.toString()) : null
      })
    );

    return res.render("orders", {
      title: "My Orders",
      orders: resolvedOrders
    });
  });

  router.get("/about", (_req, res) => res.render("about", { title: "About" }));
  router.get("/contact", (_req, res) => res.render("contact", { title: "Contact" }));

  router.get("/register", (_req, res) => {
    res.render("register", { title: "Register", errors: [] });
  });

  router.post(
    "/register",
    [
      body("name").isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
      body("email").isEmail().withMessage("Valid email is required"),
      body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
    ],
    async (req, res) => {
      const db = getDb();
      const errors = getValidationErrors(req);
      if (errors.length > 0) {
        return res.status(400).render("register", { title: "Register", errors });
      }

      const email = req.body.email.toLowerCase();
      const existing = await db.collection("users").findOne({ email });
      if (existing) {
        return res.status(400).render("register", { title: "Register", errors: ["Email already in use"] });
      }

      const passwordHash = await bcrypt.hash(req.body.password, 10);
      const result = await db.collection("users").insertOne({
        name: req.body.name,
        email,
        password: passwordHash,
        role: "user",
        created_at: new Date()
      });

      req.session.user = {
        id: result.insertedId.toString(),
        name: req.body.name,
        email,
        role: "user"
      };

      return res.redirect("/");
    }
  );

  router.get("/login", (_req, res) => {
    res.render("login", { title: "Login", errors: [] });
  });

  router.post(
    "/login",
    [
      body("email").isEmail().withMessage("Valid email is required"),
      body("password").notEmpty().withMessage("Password is required")
    ],
    async (req, res) => {
      const db = getDb();
      const errors = getValidationErrors(req);
      if (errors.length > 0) {
        return res.status(400).render("login", { title: "Login", errors });
      }

      const email = req.body.email.toLowerCase();
      const user = await db.collection("users").findOne({ email });
      if (!user) {
        return res.status(401).render("login", { title: "Login", errors: ["Invalid credentials"] });
      }

      const validPassword = await bcrypt.compare(req.body.password, user.password);
      if (!validPassword) {
        return res.status(401).render("login", { title: "Login", errors: ["Invalid credentials"] });
      }

      req.session.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET || "dev-secret",
        { expiresIn: "2h" }
      );

      req.session.apiToken = token;

      return res.redirect(user.role === "admin" ? "/admin" : "/");
    }
  );

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  router.get("/admin", ensureAuth, ensureAdmin, async (_req, res) => {
    const db = getDb();
    const stats = await getDashboardStats(db);
    return res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats
    });
  });

  router.get("/admin/users", ensureAuth, ensureAdmin, async (_req, res) => {
    const db = getDb();
    const users = await db.collection("users").find({}, { projection: { password: 0 } }).sort({ created_at: -1 }).toArray();
    return res.render("admin/users", { title: "Manage Users", users: users.map((item) => normalizeId(item)) });
  });

  router.post("/admin/users/:id/role", ensureAuth, ensureAdmin, async (req, res) => {
    const db = getDb();
    const userId = toObjectId(req.params.id);
    const role = req.body.role === "admin" ? "admin" : "user";
    if (userId) {
      await db.collection("users").updateOne({ _id: userId }, { $set: { role } });
    }
    return res.redirect("/admin/users");
  });

  router.get("/admin/categories", ensureAuth, ensureAdmin, async (_req, res) => {
    const db = getDb();
    const categories = await db.collection("categories").find({}).sort({ name: 1 }).toArray();
    return res.render("admin/categories", { title: "Manage Categories", categories: categories.map((item) => normalizeId(item)) });
  });

  router.post("/admin/categories", ensureAuth, ensureAdmin, async (req, res) => {
    const db = getDb();
    if (req.body.name && req.body.name.trim()) {
      await db.collection("categories").insertOne({ name: req.body.name.trim(), created_at: new Date() });
    }
    return res.redirect("/admin/categories");
  });

  router.put("/admin/categories/:id", ensureAuth, ensureAdmin, async (req, res) => {
    const db = getDb();
    const categoryId = toObjectId(req.params.id);
    if (categoryId) {
      await db.collection("categories").updateOne({ _id: categoryId }, { $set: { name: req.body.name } });
    }
    return res.redirect("/admin/categories");
  });

  router.delete("/admin/categories/:id", ensureAuth, ensureAdmin, async (req, res) => {
    const db = getDb();
    const categoryId = toObjectId(req.params.id);
    if (categoryId) {
      await db.collection("categories").deleteOne({ _id: categoryId });
    }
    return res.redirect("/admin/categories");
  });

  router.get("/admin/products", ensureAuth, ensureAdmin, async (req, res) => {
    const db = getDb();
    const [products, categories] = await Promise.all([
      db.collection("products").find({}).sort({ created_at: -1 }).toArray(),
      db.collection("categories").find({}).sort({ name: 1 }).toArray()
    ]);

    const categoryMap = toCategoryMap(categories);
    const resolvedProducts = products.map((item) =>
      normalizeId({
        ...item,
        category: item.category_id ? categoryMap.get(item.category_id.toString()) : null
      })
    );

    return res.render("admin/products", {
      title: "Manage Products",
      products: resolvedProducts,
      categories: categories.map((item) => normalizeId(item)),
      uploadError: req.query.error || ""
    });
  });

  router.post(
    "/admin/products",
    ensureAuth,
    ensureAdmin,
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "video", maxCount: 1 }
    ]),
    async (req, res) => {
    const db = getDb();
    const title = (req.body.title || "").trim();
    if (!title) {
      return res.redirect("/admin/products?error=Title+is+required.");
    }

    const categoryId = toObjectId(req.body.category_id);
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];
    const parsedPrice = req.body.price === "" || req.body.price === undefined ? null : Number(req.body.price);

    await db.collection("products").insertOne({
      title,
      description: req.body.description || "",
      price: Number.isFinite(parsedPrice) ? parsedPrice : null,
      category_id: categoryId,
      image: imageFile ? `/uploads/${imageFile.filename}` : null,
      video: videoFile ? `/uploads/${videoFile.filename}` : null,
      created_at: new Date()
    });
    return res.redirect("/admin/products");
    }
  );

  router.put(
    "/admin/products/:id",
    ensureAuth,
    ensureAdmin,
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "video", maxCount: 1 }
    ]),
    async (req, res) => {
    const db = getDb();
    const productId = toObjectId(req.params.id);
    const title = (req.body.title || "").trim();
    if (!title) {
      return res.redirect("/admin/products?error=Title+is+required.");
    }

    const categoryId = toObjectId(req.body.category_id);
    if (!productId) {
      return res.redirect("/admin/products");
    }

    const existing = await db.collection("products").findOne({ _id: productId });
    if (!existing) {
      return res.redirect("/admin/products");
    }

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];
    const parsedPrice = req.body.price === "" || req.body.price === undefined ? null : Number(req.body.price);

    await db.collection("products").updateOne(
      { _id: productId },
      {
        $set: {
          title,
          description: req.body.description || "",
          price: Number.isFinite(parsedPrice) ? parsedPrice : null,
          category_id: categoryId,
          image: imageFile ? `/uploads/${imageFile.filename}` : existing.image,
          video: videoFile ? `/uploads/${videoFile.filename}` : existing.video
        }
      }
    );
    return res.redirect("/admin/products");
    }
  );

  router.delete("/admin/products/:id", ensureAuth, ensureAdmin, async (req, res) => {
    const db = getDb();
    const productId = toObjectId(req.params.id);
    if (productId) {
      await db.collection("products").deleteOne({ _id: productId });
    }
    return res.redirect("/admin/products");
  });

  router.get("/admin/orders", ensureAuth, ensureAdmin, async (_req, res) => {
    const db = getDb();
    const [orders, users] = await Promise.all([
      db.collection("orders").find({}).sort({ created_at: -1 }).toArray(),
      db.collection("users").find({}, { projection: { password: 0 } }).toArray()
    ]);

    const userMap = new Map(users.map((item) => [item._id.toString(), normalizeId(item)]));
    const resolvedOrders = orders.map((item) =>
      normalizeId({
        ...item,
        user: item.user_id ? userMap.get(item.user_id.toString()) : null
      })
    );

    return res.render("admin/orders", {
      title: "Manage Orders",
      orders: resolvedOrders
    });
  });

  router.post("/admin/orders/:id/status", ensureAuth, ensureAdmin, async (req, res) => {
    const db = getDb();
    const orderId = toObjectId(req.params.id);
    const allowedStatuses = ["pending", "paid", "cancelled"];
    const nextStatus = allowedStatuses.includes(req.body.status) ? req.body.status : "pending";

    if (orderId) {
      await db.collection("orders").updateOne({ _id: orderId }, { $set: { status: nextStatus } });
    }
    return res.redirect("/admin/orders");
  });

  return router;
};
