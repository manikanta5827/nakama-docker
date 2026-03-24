// This is your first RPC — think of it like a Lambda function
// Client calls "healthcheck" → this function runs → returns JSON

function rpcHealthCheck(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  logger.info("Health check RPC called!");

  return JSON.stringify({
    success: true,
    message: "Nakama server is alive!",
    timestamp: Date.now()
  });
}