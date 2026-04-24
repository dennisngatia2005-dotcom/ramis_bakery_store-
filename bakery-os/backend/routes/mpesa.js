const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");

router.post("/callback", async (req, res) => {
  try {
    const body = req.body;

    console.log("Mpesa raw:", body);

    // ⚠️ Structure depends on Daraja response
    const amount = body.amount || 0;
    const phone = body.phone || "unknown";
    const transaction_id = body.transaction_id || Date.now();

    // Save payment
    const { error } = await supabase
      .from("payments")
      .insert([
        {
          phone,
          amount,
          transaction_id,
        },
      ]);

    if (error) throw error;

    res.json({ message: "Payment recorded" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

module.exports = router;