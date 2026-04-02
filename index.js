const path = require("path");
const express = require("express");
const session = require("express-session");
const methodOverride = require("method-override");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const dotenv = require("dotenv");

dotenv.config();

const webRoutes = require("./src/routes/web");
const apiRoutes = require("./src/routes/api");
const { connectMongoDB, getDb } = require("./src/config/mongodb");

let isConnected = false;

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.apiToken = req.session.apiToken || null;
  res.locals.path = req.path;
  next();
});

// Serverless MongoDB connection middleware
app.use(async (req, res, next) => {
  try {
    if (!isConnected) {
      await connectMongoDB();
      isConnected = true;
      // Seed data if needed, but not blocking every request ideally.
      // We will leave seedData to internal logic or only on startup to avoid performance hit.
    }
    next();
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    next(error);
  }
});

app.use("/api", apiRoutes);
app.use("/", webRoutes(express.Router()));

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.redirect("/admin/products?error=Uploaded+file+is+too+large.+Maximum+size+is+200MB.");
    }

    return res.redirect(`/admin/products?error=${encodeURIComponent(`Upload failed: ${error.message}`)}`);
  }

  if (error && error.message === "Unsupported file type. Please upload image or video files only.") {
    return res.redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  }

  return next(error);
});

app.use((_req, res) => {
  res.status(404).render("error", {
    title: "Not Found",
    message: "The page you requested does not exist."
  });
});

async function seedData() {
  const db = getDb();
  const categoriesCollection = db.collection("categories");
  const productsCollection = db.collection("products");
  const usersCollection = db.collection("users");

  const categoryCount = await categoriesCollection.countDocuments();
  if (categoryCount === 0) {
    const categoryResult = await categoriesCollection.insertMany([
      { name: "Design", created_at: new Date() },
      { name: "Development", created_at: new Date() },
      { name: "Marketing", created_at: new Date() },
      { name: "Consulting", created_at: new Date() }
    ]);

    const ids = Object.values(categoryResult.insertedIds);
    await productsCollection.insertMany([
      {
        title: "Brand Strategy Starter",
        description: "Brand positioning package for growing teams.",
        price: 129,
        category_id: ids[0],
        image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200",
        created_at: new Date()
      },
      {
        title: "Web Platform Build",
        description: "Modern responsive website build with CMS integration.",
        price: 980,
        category_id: ids[1],
        image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200",
        created_at: new Date()
      },
      {
        title: "Growth Campaign Kit",
        description: "Campaign planning and analytics setup for 30 days.",
        price: 320,
        category_id: ids[2],
        image: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200",
        created_at: new Date()
      },
      {
        title: "Free Development Tutorial",
        description: "Introduction to modern web development practices and tools.",
        price: 0,
        category_id: ids[1],
        image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200",
        created_at: new Date()
      },
      {
        title: "Design Fundamentals Guide",
        description: "Free guide to essential design principles and techniques.",
        price: 0,
        category_id: ids[0],
        image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200",
        created_at: new Date()
      }
    ]);
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  const existingAdmin = await usersCollection.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await usersCollection.insertOne({
      name: "Administrator",
      email: adminEmail,
      password: passwordHash,
      role: "admin",
      created_at: new Date()
    });
  }
}

async function startServer() {
  try {
    await connectMongoDB();
    isConnected = true;
    await seedData();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  startServer();
}

module.exports = app;
