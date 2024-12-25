const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const session = require("express-session");
const app = express();
const PORT = 3000;
const upload = require("./upload");
const fs = require("fs");

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "assets"))); // Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Static files for uploads
app.use(
  session({
    secret: "your-secret-key", // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Change to true when using HTTPS
  })
);
app.use(express.urlencoded({ extended: true })); // Menambahkan ini untuk form data
app.use(express.json()); // Pastikan ini ada untuk JSON

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // Replace with your MySQL username
  password: "", // Replace with your MySQL password
  database: "gaming_news_hub_db",
  charset: "utf8mb4",
});

// Connect to database
db.connect((err) => {
  if (err) {
    console.error("Database connection error:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

// Configure multer for file uploads
const multerUpload = multer({ dest: "uploads/profilePictures" }); // Directory for uploaded files

// Routes

// Home Page (Display Articles)
app.get("/", (req, res) => {
  const user = req.session.user || null;
  const query = `
  (SELECT id, title, category, image FROM articles WHERE category = 'News' ORDER BY published_at DESC LIMIT 10)
  UNION ALL
  (SELECT id, title, category, image FROM articles WHERE category = 'Reviews' ORDER BY published_at DESC LIMIT 10)
  UNION ALL
  (SELECT id, title, category, image FROM articles WHERE category = 'Esports' ORDER BY published_at DESC LIMIT 10)
`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching articles:", err);
      return res.status(500).send("Database error");
    }
    res.render("index", { user, articles: results });
  });
});

// Login Page
app.get("/login", (req, res) => {
  res.render("login");
});

// Login User
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const query = "SELECT * FROM users WHERE username = ?";

  db.query(query, [username], async (err, results) => {
    if (err) return res.status(500).send("Error logging in");
    if (results.length === 0) return res.status(400).send("Username not found");

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) return res.status(401).send("Incorrect password");

    req.session.user = {
      id: user.id,
      username: user.username,
      profilePicture: user.profilePicture || "/default-avatar.png",
    };

    res.redirect("/profile");
  });
});

// Logout User
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Error logging out");
    res.redirect("/login");
  });
});

// Registration
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const query =
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

  db.query(query, [username, email, hashedPassword], (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY")
        return res.status(400).send("Username already exists");
      return res.status(500).send("Error registering user");
    }
    res.status(201).send("User registered successfully");
  });
});

// Route untuk mengganti foto profil
app.post("/profile/upload", upload.single("profilePicture"), (req, res) => {
  const user = req.session.user;

  if (!user) {
    return res.status(400).send("User not found");
  }

  if (req.file) {
    // Simpan path file baru ke dalam database
    const filePath = `/uploads/profilePictures/${req.file.filename}`;

    const query = "UPDATE users SET profilePicture = ? WHERE username = ?";
    db.query(query, [filePath, user.username], (err, result) => {
      if (err) {
        console.error("Error updating profile picture:", err);
        return res.status(500).send("Error updating profile picture");
      }

      // Update gambar profil di session
      user.profilePicture = filePath;

      // Redirect ke halaman profil setelah update berhasil
      res.redirect("/profile"); // Arahkan kembali ke halaman profil setelah upload
    });
  } else {
    return res.status(400).send("No file uploaded");
  }
});

// Halaman profil (menampilkan data pengguna)
app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const user = req.session.user;

  const query = "SELECT id, title, category, image FROM articles"; // Query untuk mengambil artikel
  db.query(query, (err, articles) => {
    if (err) {
      console.error("Error fetching articles:", err);
      return res.status(500).send("Error fetching articles");
    }

    // Kirim `user` dan `articles` ke template
    res.render("index", { user, articles });
  });
});

// Route untuk logout
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed!" });
    }
    res.clearCookie("connect.sid"); // Hapus cookie session
    res.json({ message: "Logged out successfully!" });
  });
});

// View Article by ID
app.get("/article", (req, res) => {
  const articleId = req.query.id;
  const query = "SELECT * FROM articles WHERE id = ?";

  db.query(query, [articleId], (err, results) => {
    if (err) {
      console.error("Error fetching article:", err);
      return res.status(500).send("Database error");
    }
    if (results.length === 0) return res.status(404).send("Article not found");

    const article = results[0]; // Artikel yang sedang dibaca

    // Query untuk mengambil komentar terkait artikel
    const queryComments =
      "SELECT comments.*, users.username, users.profilePicture, " +
      "(SELECT COUNT(*) FROM comment_reactions WHERE comment_id = comments.id AND reaction = 'like') AS likes, " +
      "(SELECT COUNT(*) FROM comment_reactions WHERE comment_id = comments.id AND reaction = 'dislike') AS dislikes " +
      "FROM comments JOIN users ON comments.user_id = users.id WHERE article_id = ? ORDER BY created_at DESC";

    db.query(queryComments, [articleId], (err, comments) => {
      if (err) {
        console.error("Error fetching comments:", err);
        return res.status(500).send("Database error");
      }

      // Query balasan untuk setiap komentar
      const promises = comments.map((comment) => {
        return new Promise((resolve, reject) => {
          const queryReplies =
            "SELECT comment_replies.*, users.username, users.profilePicture FROM comment_replies JOIN users ON comment_replies.user_id = users.id WHERE comment_id = ? ORDER BY created_at DESC";

          db.query(queryReplies, [comment.id], (err, replies) => {
            if (err) {
              console.error("Error fetching replies:", err);
              reject("Error fetching replies");
            }
            comment.replies = replies; // Menambahkan balasan ke komentar
            resolve(comment); // Mengembalikan komentar dengan balasan
          });
        });
      });

      // Tunggu semua balasan selesai diambil
      Promise.all(promises)
        .then((commentsWithReplies) => {
          // Query untuk mengambil 5 artikel terkait
          const relatedQuery =
            "SELECT id, title, image FROM articles WHERE id != ? ORDER BY published_at DESC LIMIT 5";

          db.query(relatedQuery, [articleId], (err, relatedArticles) => {
            if (err) {
              console.error("Error fetching related articles:", err);
              return res.status(500).send("Database error");
            }

            const user = req.session.user || null;

            // Render halaman artikel dengan data artikel, komentar, dan artikel terkait
            res.render("article", {
              article,
              comments: commentsWithReplies,
              relatedArticles,
              user,
            });
          });
        })
        .catch((error) => {
          console.error(error);
          res.status(500).send("Error processing comments and replies");
        });
    });
  });
});

app.post("/article/comment", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login"); // Pastikan user login
  }

  const { content, article_id } = req.body;
  const user_id = req.session.user.id; // Ambil user_id dari session

  if (!user_id) {
    return res.status(400).send("User ID is missing or invalid.");
  }

  const query =
    "INSERT INTO comments (article_id, user_id, content) VALUES (?, ?, ?)";
  db.query(query, [article_id, user_id, content], (err, result) => {
    if (err) {
      console.error("Error posting comment:", err);
      return res.status(500).send("Error posting comment");
    }

    res.redirect(`/article?id=${article_id}`); // Redirect kembali ke halaman artikel
  });
});

// News Page
app.get("/news", (req, res) => {
  const user = req.session.user || null;
  const query =
    "SELECT * FROM articles WHERE category = 'News' ORDER BY published_at DESC";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching news articles:", err);
      return res.status(500).send("Database error");
    }
    res.render("news", { user, articles: results });
  });
});

// Reviews Page
app.get("/reviews", (req, res) => {
  const user = req.session.user || null;
  const query =
    "SELECT * FROM articles WHERE category = 'Reviews' ORDER BY published_at DESC";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching reviews articles:", err);
      return res.status(500).send("Database error");
    }
    res.render("reviews", { user, articles: results });
  });
});

// Esports Page
app.get("/esports", (req, res) => {
  const user = req.session.user || null;
  const query =
    "SELECT * FROM articles WHERE category = 'Esports' ORDER BY published_at DESC";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching esports articles:", err);
      return res.status(500).send("Database error");
    }
    res.render("esports", { user, articles: results });
  });
});

app.post("/api/comment/reaction", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "You must be logged in" });
  }

  const { comment_id, reaction } = req.body;
  const user_id = req.session.user.id;

  if (!["like", "dislike"].includes(reaction)) {
    return res.status(400).json({ error: "Invalid reaction" });
  }

  const checkReactionQuery =
    "SELECT * FROM comment_reactions WHERE comment_id = ? AND user_id = ?";

  db.query(checkReactionQuery, [comment_id, user_id], (err, results) => {
    if (err) {
      console.error("Error checking reaction:", err);
      return res.status(500).json({ error: "Error checking reaction" });
    }

    if (results.length > 0) {
      const existingReaction = results[0].reaction;

      if (existingReaction === reaction) {
        const deleteReactionQuery =
          "DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ?";
        db.query(deleteReactionQuery, [comment_id, user_id], (err) => {
          if (err) {
            console.error("Error deleting reaction:", err);
            return res.status(500).json({ error: "Error deleting reaction" });
          }

          const getCountsQuery =
            "SELECT COUNT(CASE WHEN reaction = 'like' THEN 1 END) AS likes, COUNT(CASE WHEN reaction = 'dislike' THEN 1 END) AS dislikes FROM comment_reactions WHERE comment_id = ?";
          db.query(getCountsQuery, [comment_id], (err, counts) => {
            if (err) {
              console.error("Error fetching counts:", err);
              return res.status(500).json({ error: "Error fetching counts" });
            }

            res.json({
              success: true,
              likes: counts[0].likes,
              dislikes: counts[0].dislikes,
            });
          });
        });
      } else {
        const updateReactionQuery =
          "UPDATE comment_reactions SET reaction = ? WHERE comment_id = ? AND user_id = ?";
        db.query(
          updateReactionQuery,
          [reaction, comment_id, user_id],
          (err) => {
            if (err) {
              console.error("Error updating reaction:", err);
              return res.status(500).json({ error: "Error updating reaction" });
            }

            const getCountsQuery =
              "SELECT COUNT(CASE WHEN reaction = 'like' THEN 1 END) AS likes, COUNT(CASE WHEN reaction = 'dislike' THEN 1 END) AS dislikes FROM comment_reactions WHERE comment_id = ?";
            db.query(getCountsQuery, [comment_id], (err, counts) => {
              if (err) {
                console.error("Error fetching counts:", err);
                return res.status(500).json({ error: "Error fetching counts" });
              }

              res.json({
                success: true,
                likes: counts[0].likes,
                dislikes: counts[0].dislikes,
              });
            });
          }
        );
      }
    } else {
      const insertReactionQuery =
        "INSERT INTO comment_reactions (comment_id, user_id, reaction) VALUES (?, ?, ?)";
      db.query(insertReactionQuery, [comment_id, user_id, reaction], (err) => {
        if (err) {
          console.error("Error inserting reaction:", err);
          return res.status(500).json({ error: "Error inserting reaction" });
        }

        const getCountsQuery =
          "SELECT COUNT(CASE WHEN reaction = 'like' THEN 1 END) AS likes, COUNT(CASE WHEN reaction = 'dislike' THEN 1 END) AS dislikes FROM comment_reactions WHERE comment_id = ?";
        db.query(getCountsQuery, [comment_id], (err, counts) => {
          if (err) {
            console.error("Error fetching counts:", err);
            return res.status(500).json({ error: "Error fetching counts" });
          }

          res.json({
            success: true,
            likes: counts[0].likes,
            dislikes: counts[0].dislikes,
          });
        });
      });
    }
  });
});

// Balas komentar
app.post("/article/comment/reply", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login"); // Pastikan user login
  }

  const { comment_id, content, article_id } = req.body;
  const user_id = req.session.user.id;

  const insertReplyQuery =
    "INSERT INTO comment_replies (comment_id, user_id, content) VALUES (?, ?, ?)";

  db.query(insertReplyQuery, [comment_id, user_id, content], (err, result) => {
    if (err) {
      console.error("Error inserting reply:", err);
      return res.status(500).send("Error inserting reply");
    }

    res.redirect(`/article?id=${article_id}`);
  });
});

app.get("/search", (req, res) => {
  console.log("Search route accessed."); // Debug log

  const searchQuery = req.query.query || ""; // Default ke string kosong jika tidak ada query
  const user = req.session ? req.session.user : null;

  const query = `
    SELECT id, title, category, image
    FROM articles
    WHERE title LIKE ? OR content LIKE ?
    ORDER BY published_at DESC
  `;

  const searchPattern = `%${searchQuery}%`;

  db.query(query, [searchPattern, searchPattern], (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).send("Database error");
    }

    console.log("Search results:", results); // Debug log
    res.render("search", {
      user,
      query: searchQuery,
      articles: results,
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
