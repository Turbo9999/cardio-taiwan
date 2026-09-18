// ========================================
// CARDIO TAIWAN
// World Gym Schedule Sync
// ========================================

export default async function handler(req, res) {

  return res.status(200).json({
    success: true,
    message: "World Gym Sync API is ready.",
    time: new Date().toISOString()
  });

}
