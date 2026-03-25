// Save player stats to Nakama storage
export function rpcSaveStats(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {

  // ctx.userId is automatically the logged-in player's ID
  // Nakama extracts this from the Bearer token — you don't pass it manually
  const userId = ctx.userId;

  const stats = {
    wins: 0,
    losses: 0,
    draws: 0
  };

  // This is like nk.storageWrite() — think of it as putItem in DynamoDB
  const writeRequest: nkruntime.StorageWriteRequest = {
    collection: "player_stats",   // like a table
    key: "stats",                 // like an item key
    userId: userId,               // whose data
    value: stats,                 // the actual data
    permissionRead: 1,            // 1 = owner can read, 2 = anyone can read
    permissionWrite: 0            // 0 = only server can write (prevents cheating)
  };

  try {
    nk.storageWrite([writeRequest]);
    logger.info("Stats saved for user: %s", userId);
  } catch (error) {
    logger.error("Failed to save stats: %s", error.message);
    throw error;
  }

  return JSON.stringify({ success: true, saved: stats });
}

// Read player stats from Nakama storage
export function rpcGetStats(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {

  const userId = ctx.userId;

  // This is like getItem in DynamoDB
  const readRequest: nkruntime.StorageReadRequest = {
    collection: "player_stats",
    key: "stats",
    userId: userId
  };

  try {
    const result = nk.storageRead([readRequest]);

    // If no data found yet, return default stats
    if (result.length === 0) {
      return JSON.stringify({ wins: 0, losses: 0, draws: 0 });
    }

    // result[0].value is your stored JSON object
    return JSON.stringify(result[0].value);

  } catch (error) {
    logger.error("Failed to get stats: %s", error.message);
    throw error;
  }
}