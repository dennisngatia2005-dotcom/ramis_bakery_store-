import express from "express";
import { getAccessToken } from "../services/mpesa.service.js";

const router = express.Router();

router.get("/token", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to get token",
      details: err.message,
    });
  }
});
router.post("/payment/callback", async (req, res) => {
  try {
    console.log("MPESA CALLBACK RECEIVED:");
    console.log(JSON.stringify(req.body, null, 2));

    // Always respond to Safaricom
    res.json({
      ResultCode: 0,
      ResultDesc: "Accepted",
    });

  } catch (err) {
    console.error("CALLBACK ERROR:", err);
    res.json({
      ResultCode: 0,
      ResultDesc: "Error handled",
    });
  }
});
import { registerUrls } from "../services/mpesa.service.js";

router.get("/register", async (req, res) => {
  try {
    const token = await getAccessToken();

    const ngrokUrl = "https://pediatric-alexander-ungrainable.ngrok-free.dev"; // replace with your ngrok URL

    const result = await registerUrls(token, ngrokUrl);

    res.json(result);

  } catch (err) {
    console.error("FULL ERROR:", err.response?.data || err.message);

    res.status(500).json({
      error: err.message,
      mpesa: err.response?.data,
    });
  }
});
export default router;