import axios from "axios";

export async function getAccessToken() {
  try {
    const url =
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    return response.data.access_token;

  } catch (error) {
    console.error("TOKEN ERROR:", error.response?.data || error.message);
    throw error;
  }
}
export async function registerUrls(token, ngrokUrl) {
  const url =
    "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl";

  const response = await axios.post(
    url,
    {
      ShortCode: "174379",
      ResponseType: "Completed",
      ConfirmationURL: `${ngrokUrl}/api/payment_callback`,
      ValidationURL: `${ngrokUrl}/api/payment_callback`,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
}