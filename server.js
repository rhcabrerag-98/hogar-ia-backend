import express from "express";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(express.json());
app.use(cors());

// Configuración de Multer para manejo de archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage });

const PORT = process.env.PORT || 5000;

// Endpoint para crear un PaymentIntent
app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para subir imágenes a Supabase Storage
app.post("/api/profile/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No se envió ningún archivo" });

    const file = req.file;
    const fileName = `avatars/${file.originalname}`;

    // Subir archivo a Supabase Storage
    const { data, error } = await supabase.storage
      .from(process.env.BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (error) throw error;

    // Obtener la URL pública de la imagen
    const { publicUrl } = supabase.storage
      .from(process.env.BUCKET_NAME)
      .getPublicUrl(fileName);

    res.json({ message: "Imagen subida con éxito", url: publicUrl });
  } catch (error) {
    console.error("Error al subir la imagen:", error.message);
    res.status(500).json({ error: "Error al subir la imagen" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
