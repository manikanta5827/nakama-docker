// This is Nakama's entry point — like index.js in Express
// Nakama looks for "InitModule" by name at startup

function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {

  // Register your RPC — like app.get('/healthcheck', handler)
  try {
    initializer.registerRpc("healthcheck", rpcHealthCheck);
    logger.info("healthcheck RPC registered successfully");
  } catch (error) {
    logger.error("Failed to register healthcheck RPC: %s", error.message);
  }

  logger.info("=== Game server loaded successfully ===");
}

// IMPORTANT: This line stops Rollup from removing InitModule during build
// Rollup tree-shakes unused code — this tells it "no, keep this function"
!InitModule && InitModule.bind(null);