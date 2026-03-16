// build-and-exit.cjs
const { build } = require("vite");

(async () => {
  try {
    await build();
    console.log("✅ Build complete. Forcing process exit...");

    // Give stdout / Rollup logger a moment to flush
    setTimeout(() => {
      console.log("🚪 Exiting...");
      process.exit(0);
    }, 1000);
  } catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
  }
})();
