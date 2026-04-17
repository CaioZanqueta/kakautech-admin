require("dotenv/config");

const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  dialect: "postgres",
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  logging: false,
  dialectOptions:
    isProduction && process.env.DB_SSL !== "false"
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  define: {
    timestamp: true,
    underscored: true,
    underscoredAll: true,
  },
};
