import { supabase } from "../../supabaseClient.js";

/* =========================
   INITIATE PAYMENT (UNCHANGED)
========================= */
export async function initiatePayment(req, res) {
  try {
    const { stkPush } = await import("../services/mpesa.service.js");

    const { phone, amount, customer_id } = req.body;

    const response = await stkPush(phone, amount, customer_id);

    res.json({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/* =========================
   CALLBACK (NEW CLEAN LOGIC)
========================= */
export async function mpesaCallback(req, res) {
  try {
    const stk = req.body?.Body?.stkCallback;

    if (!stk) {
      return res.json({ ResultCode: 0, ResultDesc: "Invalid payload" });
    }

    // If payment failed
    if (stk.ResultCode !== 0) {
      return res.json({ ResultCode: 0, ResultDesc: "Ignored" });
    }

    const metadata = stk.CallbackMetadata.Item;

    const amount = metadata.find((i) => i.Name === "Amount")?.Value;
    const phone = metadata.find((i) => i.Name === "PhoneNumber")?.Value;
    const receipt = metadata.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

    if (!phone || !amount) {
      return res.json({ ResultCode: 0, ResultDesc: "Missing data" });
    }

    /* =========================
       1. CHECK CUSTOMER BY PHONE
    ========================= */
    let { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (customerError) throw customerError;

    /* =========================
       2. CREATE CUSTOMER IF NOT EXISTS
    ========================= */
    if (!customer) {
      const { data: newCustomer, error: createError } = await supabase
        .from("customers")
        .insert([
          {
            name: `Customer ${phone}`, // fallback name
            phone,
          },
        ])
        .select()
        .single();

      if (createError) throw createError;

      customer = newCustomer;
    }

    /* =========================
       3. INSERT PAYMENT
    ========================= */
    const { error: paymentError } = await supabase.from("payments").insert([
      {
        customer_id: customer.id,
        amount,
        mpesa_receipt: receipt,
        phone,
        status: "success",
      },
    ]);

    if (paymentError) throw paymentError;

    console.log("✅ Payment saved:", {
      phone,
      amount,
      receipt,
    });

    return res.json({
      ResultCode: 0,
      ResultDesc: "Accepted",
    });
  } catch (err) {
  console.error("❌ FULL CALLBACK ERROR:", err);

  return res.status(500).json({
    ResultCode: 1,
    ResultDesc: err.message,
  });
}
}