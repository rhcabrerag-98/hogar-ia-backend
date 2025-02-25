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

const PORT = process.env.PORT || 5000;

// 🖼️ **Configuración de Multer para manejar archivos en memoria**
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🎯 **Crear PaymentIntent con Stripe**
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

// 📤 **Subir imagen a Supabase Storage**
app.post("/api/profile/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No se envió ningún archivo" });

    const file = req.file;
    //const fileName = `avatars/${file.originalname}`;
    const timestamp = Date.now();
    const fileName = `avatars/${timestamp}_${file.originalname}`;

    // Eliminar imagen anterior si existe antes de subir la nueva
    await supabase.storage.from(process.env.BUCKET_NAME).remove([fileName]);

    // Subir nueva imagen a Supabase Storage
    const { data, error } = await supabase.storage
      .from(process.env.BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true, // Sobrescribir si ya existe
      });

    if (error) throw error;

    // Obtener URL pública de la imagen
    const { publicUrl } = supabase.storage
      .from(process.env.BUCKET_NAME)
      .getPublicUrl(fileName);

    res.json({ message: "Imagen subida con éxito", url: publicUrl });
  } catch (error) {
    console.error("Error al subir la imagen:", error.message);
    res.status(500).json({ error: "Error al subir la imagen" });
  }
});

// 🖼️ **Obtener URL de la imagen de perfil**
app.get("/api/profile/image/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId)
      return res.status(400).json({ error: "ID del usuario no proporcionado" });

    const fileName = `avatars/${userId}.jpg`; // Ajustar según el formato de almacenamiento

    // Obtener la URL pública de la imagen
    const { data } = supabase.storage
      .from(process.env.BUCKET_NAME)
      .getPublicUrl(fileName);

    if (!data.publicUrl) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    res.json({ imageUrl: data.publicUrl });
  } catch (error) {
    console.error("Error al obtener la imagen del perfil:", error.message);
    res.status(500).json({ error: "Error al obtener la imagen del perfil" });
  }
});

// 🗑️ **Eliminar imagen de Supabase Storage**
app.delete("/api/profile/delete/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const fileName = `avatars/${userId}.jpg`; // Ajusta según cómo guardas los archivos

    // Verificar si la imagen existe antes de eliminarla
    const { data } = await supabase.storage
      .from(process.env.BUCKET_NAME)
      .list("avatars");

    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ error: "Imagen no encontrada en Supabase" });
    }

    // Intentar eliminar la imagen en Supabase Storage
    const { error } = await supabase.storage
      .from(process.env.BUCKET_NAME)
      .remove([fileName]);

    if (error) {
      return res
        .status(500)
        .json({ error: "Error al eliminar la imagen", details: error.message });
    }

    res.json({ message: "Imagen eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar la imagen:", error.message);
    res.status(500).json({ error: "Error al eliminar la imagen" });
  }
});

// 🚀 **Iniciar servidor**
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

//cODIGO DEL UPDATE
app.put("/api/profile/update", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo" });
    }

    const file = req.file;
    const { userId } = req.body; // Se espera que el userId venga en el body

    if (!userId) {
      return res.status(400).json({ error: "ID del usuario no proporcionado" });
    }

    const fileName = `avatars/${userId}.jpg`; // Se usa el ID del usuario como nombre de archivo

    // Subir o sobrescribir la imagen en Supabase Storage
    const { data, error } = await supabase.storage
      .from(process.env.BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true, // Permite sobrescribir el archivo existente
      });

    if (error) throw error;

    // Obtener la URL pública de la imagen actualizada
    const { publicUrl } = supabase.storage
      .from(process.env.BUCKET_NAME)
      .getPublicUrl(fileName);

    res.json({ message: "Imagen actualizada con éxito", url: publicUrl });
  } catch (error) {
    console.error("Error al actualizar la imagen:", error.message);
    res.status(500).json({ error: "Error al actualizar la imagen" });
  }
});

//
app.get("/api/profile/all-files", async (req, res) => {
  try {
    const { data, error } = await supabase.storage
      .from(process.env.BUCKET_NAME)
      .list("avatars");

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error al obtener archivos:", error.message);
    res.status(500).json({ error: "Error al obtener archivos" });
  }
});

app.get("/api/profile/latest-image/:originalName", async (req, res) => {
  try {
    const { originalName } = req.params;

    // Listar archivos en el bucket "avatars"
    const { data, error } = await supabase.storage
      .from(process.env.BUCKET_NAME)
      .list("avatars");

    if (error) throw error;

    // Filtrar archivos que contienen el originalName en su nombre
    const matchingFiles = data
      .filter((file) => file.name.includes(`_${originalName}`))
      .sort((a, b) => {
        // Extraer el timestamp del nombre del archivo
        const timestampA = parseInt(a.name.split("_")[0], 10);
        const timestampB = parseInt(b.name.split("_")[0], 10);
        return timestampB - timestampA; // Ordenar de más reciente a más antiguo
      });

    if (matchingFiles.length === 0) {
      return res.status(404).json({ error: "No se encontró ninguna imagen" });
    }

    // Tomar el archivo más reciente
    const latestFile = matchingFiles[0];

    // Obtener la URL pública correctamente
    const { publicUrl } = supabase.storage
      .from(process.env.BUCKET_NAME)
      .getPublicUrl(`avatars/${latestFile.name}`);

    res.json({
      imageUrl:
        "https://tuagrdrzxnmsdazaohta.supabase.co/storage/v1/object/public/profile-images/avatars/" +
        latestFile.name,
      url: supabase.storage
        .from(process.env.BUCKET_NAME)
        .getPublicUrl(`avatars/${latestFile.name}`).publicUrl,
    });
  } catch (error) {
    console.error("Error al obtener la última imagen:", error.message);
    res.status(500).json({ error: "Error al obtener la última imagen" });
  }
});
